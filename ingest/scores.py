"""Kural bazlı kompozit skor motoru (0-100) — her akşam ingestion sonrası çalışır.

Bileşenler: Momentum 25 + Insider 25 + Balina 20 + Kongre 10 + Analist 20
"""
import datetime as dt
import json
from collections import defaultdict

import pandas as pd

from common import select, upsert, run_job


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def momentum_score(bars: pd.DataFrame) -> tuple[float, list[str]]:
    """bars: date-indexed close/volume, artan sırada."""
    if len(bars) < 60:
        return 0, []
    close, vol = bars["close"], bars["volume"]
    notes = []
    # RSI(14)
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, 1e-9)
    rsi = float((100 - 100 / (1 + rs)).iloc[-1])
    if 50 <= rsi <= 70:
        s_rsi = 8
    elif 40 <= rsi < 50:
        s_rsi = 5
    elif rsi > 70:
        s_rsi = 3
        notes.append(f"RSI {rsi:.0f} aşırı alım")
    elif rsi < 30:
        s_rsi = 2
        notes.append(f"RSI {rsi:.0f} aşırı satım")
    else:
        s_rsi = 3
    # MA konumu
    p = float(close.iloc[-1])
    ma50 = float(close.rolling(50).mean().iloc[-1])
    ma200 = float(close.rolling(200).mean().iloc[-1]) if len(close) >= 200 else None
    s_ma = 0
    if p > ma50:
        s_ma += 4
    if ma200 and p > ma200:
        s_ma += 3
    if ma200 and ma50 > ma200:
        s_ma += 2
        notes.append("MA50 > MA200")
    # 52 hafta zirvesine yakınlık
    high52 = float(close.tail(252).max())
    dist = (p / high52 - 1) * 100
    s_52 = 4 if dist >= -5 else 2 if dist >= -15 else 0
    if dist >= -5:
        notes.append("52H zirvesine yakın")
    # hacim anomalisi
    v_avg = float(vol.tail(21).head(20).mean() or 0)
    v_last = float(vol.iloc[-1] or 0)
    chg = float(close.pct_change().iloc[-1] or 0)
    s_vol = 4 if v_avg and v_last > 2 * v_avg and chg > 0 else 2 if v_avg and v_last > 1.5 * v_avg else 0
    if s_vol == 4:
        notes.append("hacim patlaması + yükseliş")
    return clamp(s_rsi + s_ma + s_52 + s_vol, 0, 25), notes


def insider_score(trades: list[dict], today: dt.date) -> tuple[float, list[str]]:
    if not trades:
        return 0, []
    buys = [t for t in trades if t["transaction_code"] == "P"]
    sells = [t for t in trades if t["transaction_code"] == "S"]
    buy_val = sum(t["value"] or 0 for t in buys)
    sell_val = sum(t["value"] or 0 for t in sells)
    net = buy_val - sell_val
    notes = []
    if net <= 0 or not buys:
        return 0, (["yoğun insider satışı"] if sell_val > 1_000_000 else [])
    s = 15 if net >= 5e6 else 12 if net >= 1e6 else 8 if net >= 1e5 else 5
    buyers = {t["filer_name"] for t in buys}
    if len(buyers) >= 3:
        s += 6
        notes.append(f"cluster buy: {len(buyers)} insider")
    elif len(buyers) == 2:
        s += 4
    else:
        s += 2
    recent = [t for t in buys if t["transaction_date"] and
              (today - dt.date.fromisoformat(t["transaction_date"])).days <= 14]
    if recent:
        s += 4
        notes.append("son 14 günde alım")
    notes.insert(0, f"net alım ${net/1e6:.1f}M")
    return clamp(s, 0, 25), notes


def whale_score(holdings: list[dict]) -> tuple[float, list[str]]:
    if not holdings:
        return 0, []
    counts = defaultdict(int)
    for h in holdings:
        counts[h["change_type"]] += 1
    holders = len([h for h in holdings if h["change_type"] != "sold_out"])
    s = min(holders, 5) + counts["new"] * 4 + counts["added"] * 2 - counts["reduced"] * 2 - counts["sold_out"] * 3
    notes = []
    if counts["new"]:
        notes.append(f"{counts['new']} fon yeni pozisyon")
    if counts["added"]:
        notes.append(f"{counts['added']} fon artırdı")
    if counts["sold_out"]:
        notes.append(f"{counts['sold_out']} fon çıktı")
    return clamp(s, 0, 20), notes


def congress_score(trades: list[dict], today: dt.date) -> tuple[float, list[str]]:
    recent = [t for t in trades if t["transaction_date"] and
              (today - dt.date.fromisoformat(t["transaction_date"])).days <= 60]
    if not recent:
        return 0, []
    buys = [t for t in recent if t["transaction_type"] == "buy"]
    sells = [t for t in recent if t["transaction_type"] == "sell"]
    s = len(buys) * 3 - len(sells) * 2
    if any((t["amount_mid"] or 0) >= 250_000 for t in buys):
        s += 2
    notes = [f"{len(buys)} kongre alımı"] if buys else []
    return clamp(s, 0, 10), notes


def analyst_score(f: dict | None, price: float | None, sector_pe_median: float | None) -> tuple[float, list[str]]:
    if not f or not price:
        return 0, []
    s, notes = 0, []
    target = f.get("analyst_target_mean")
    if target:
        upside = (target / price - 1) * 100
        s += 10 if upside >= 20 else 7 if upside >= 10 else 5 if upside >= 5 else 3 if upside > 0 else 0
        if upside >= 15:
            notes.append(f"analist hedefi +%{upside:.0f}")
    rating = (f.get("analyst_rating") or "").lower()
    s += 6 if "strong" in rating and "buy" in rating else 5 if rating == "buy" else 2 if rating == "hold" else 0
    if (f.get("analyst_count") or 0) >= 10:
        s += 2
    pe = f.get("trailing_pe")
    if pe and sector_pe_median and 0 < pe < sector_pe_median:
        s += 2
        notes.append("sektöre göre ucuz F/K")
    return clamp(s, 0, 20), notes


def main():
    today = dt.date.today()
    stocks = select("stocks", "select=symbol,sector")
    symbols = [r["symbol"] for r in stocks]
    sector_of = {r["symbol"]: r["sector"] for r in stocks}

    cutoff = (today - dt.timedelta(days=380)).isoformat()
    prices = select("prices_daily", f"select=symbol,date,close,volume&date=gte.{cutoff}&order=date")
    quotes = {r["symbol"]: r for r in select("quotes_latest", "select=symbol,price")}
    funds = {r["symbol"]: r for r in select("fundamentals", "select=*")}
    ins_cut = (today - dt.timedelta(days=90)).isoformat()
    insiders = defaultdict(list)
    for t in select("insider_trades", f"select=*&transaction_date=gte.{ins_cut}"):
        if t["symbol"]:
            insiders[t["symbol"]].append(t)
    holdings_all = select("whale_holdings", "select=symbol,change_type,quarter")
    latest_q = max((h["quarter"] for h in holdings_all), default=None)
    whales = defaultdict(list)
    for h in holdings_all:
        if h["quarter"] == latest_q and h["symbol"]:
            whales[h["symbol"]].append(h)
    cg_cut = (today - dt.timedelta(days=60)).isoformat()
    congress = defaultdict(list)
    for t in select("congress_trades", f"select=*&transaction_date=gte.{cg_cut}"):
        if t["symbol"]:
            congress[t["symbol"]].append(t)

    # sektör F/K medyanları
    pe_by_sector = defaultdict(list)
    for sym, f in funds.items():
        if f.get("trailing_pe") and sector_of.get(sym):
            pe_by_sector[sector_of[sym]].append(f["trailing_pe"])
    sector_pe = {s: sorted(v)[len(v) // 2] for s, v in pe_by_sector.items() if v}

    df = pd.DataFrame(prices)
    if df.empty:
        raise RuntimeError("prices_daily boş — önce prices.py çalıştır")
    df["date"] = pd.to_datetime(df["date"])

    # dünkü skorlar (delta için)
    prev_scores = {}
    prev_rows = select("scores_daily", "select=symbol,total,date&order=date.desc&limit=1006")
    if prev_rows:
        prev_day = prev_rows[0]["date"]
        prev_scores = {r["symbol"]: r["total"] for r in prev_rows if r["date"] == prev_day}

    out = []
    for sym in symbols:
        bars = df[df["symbol"] == sym].set_index("date").sort_index()
        m, m_notes = momentum_score(bars) if len(bars) else (0, [])
        i, i_notes = insider_score(insiders.get(sym, []), today)
        w, w_notes = whale_score(whales.get(sym, []))
        c, c_notes = congress_score(congress.get(sym, []), today)
        price = (quotes.get(sym) or {}).get("price") or (float(bars["close"].iloc[-1]) if len(bars) else None)
        a, a_notes = analyst_score(funds.get(sym), price, sector_pe.get(sector_of.get(sym)))
        total = round(m + i + w + c + a, 1)
        out.append({
            "symbol": sym, "date": today.isoformat(), "total": total,
            "momentum": m, "insider": i, "whale": w, "congress": c, "analyst": a,
            "delta": round(total - prev_scores[sym], 1) if sym in prev_scores else None,
            "details": json.dumps({"notlar": m_notes + i_notes + w_notes + c_notes + a_notes}, ensure_ascii=False),
        })
    n = upsert("scores_daily", out, on_conflict="symbol,date")
    return f"{n} skor yazıldı"


if __name__ == "__main__":
    run_job("scores", main)
