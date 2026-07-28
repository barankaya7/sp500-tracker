"""Günlük Telegram raporu — SADECE aksiyon gerektiren olaylar (uzun vade odaklı).

Kategoriler:
  🔥 Cluster buy (7 günde 2+ farklı insider alımı)
  💼 Büyük tekil insider alımları (24 saat, ≥$500K)
  📈 Skor sıçramaları (+5 ve üzeri, gerekçeleriyle)
  🐋 Balina raporu (sadece yeni 13F çeyreği açıklandığında, çeyrekte 1 kez)
  🎯 Fırsat radarı (zirveden ≥%30 aşağıda + analist ≥%25 upside + insider satmıyor)
  📊 Mega-cap bilançoları (bugün, ≥$100B)

Olay yoksa tek satır gönderilir. "Yükselenler/düşenler" listesi bilinçli olarak YOK.
"""
import datetime as dt
import json
import os
from collections import defaultdict

from common import select, run_job, upsert
from telegram_utils import send_alert, send_message

SITE = os.environ.get("SITE_URL", "")


def _logged(key: str) -> bool:
    return bool(select("alerts_log", f"select=id&dedupe_key=eq.{key}&limit=1"))


def _log(kind: str, key: str, symbol: str | None = None) -> None:
    try:
        upsert("alerts_log", [{"kind": kind, "symbol": symbol, "message": "", "dedupe_key": key}])
    except Exception:  # noqa: BLE001
        pass


def cluster_buys(today: dt.date) -> list[str]:
    """7 günde 2+ farklı insider'ın alım yaptığı hisseler (hisse başına haftada 1 kez)."""
    week_ago = (today - dt.timedelta(days=7)).isoformat()
    buys = select("insider_trades",
                  f"select=symbol,filer_name,value&transaction_code=eq.P&transaction_date=gte.{week_ago}")
    by_sym: dict[str, dict] = defaultdict(lambda: {"names": set(), "total": 0.0})
    for b in buys:
        if not b["symbol"]:
            continue
        by_sym[b["symbol"]]["names"].add(b["filer_name"])
        by_sym[b["symbol"]]["total"] += b["value"] or 0
    week = today.isocalendar()[1]
    lines = []
    for sym, d in sorted(by_sym.items(), key=lambda kv: -kv[1]["total"]):
        if len(d["names"]) < 2 or d["total"] < 300_000:
            continue
        key = f"cluster-{sym}-{today.year}w{week}"
        if _logged(key):
            continue
        _log("cluster_buy", key, sym)
        lines.append(f"  <b>{sym}</b> — {len(d['names'])} insider, toplam ${d['total']/1e6:.1f}M")
    return lines[:5]


def big_buys(today: dt.date) -> list[str]:
    since = (today - dt.timedelta(days=1)).isoformat()
    rows = select("insider_trades",
                  f"select=*&transaction_code=eq.P&value=gte.500000&filing_date=gte.{since}"
                  "&order=value.desc&limit=5")
    return [f"  <b>{t['symbol']}</b> — {t['filer_name']} ({t['filer_title']}): ${(t['value'] or 0)/1e6:.1f}M"
            for t in rows if t["symbol"]]


def score_jumps() -> list[str]:
    rows = select("scores_daily", "select=*&order=date.desc&limit=1006")
    if not rows:
        return []
    latest = rows[0]["date"]
    jumps = sorted([r for r in rows if r["date"] == latest and (r["delta"] or 0) >= 5],
                   key=lambda r: -r["delta"])[:5]
    lines = []
    for s in jumps:
        details = s.get("details") or {}
        if isinstance(details, str):
            try:
                details = json.loads(details)
            except ValueError:
                details = {}
        notlar = "; ".join((details.get("notlar") or [])[:3])
        prev = s["total"] - s["delta"]
        line = f"  <b>{s['symbol']}</b> {prev:.0f}→{s['total']:.0f} (+{s['delta']:.0f})"
        if notlar:
            line += f"\n    <i>{notlar}</i>"
        lines.append(line)
    return lines


def whale_report() -> list[str]:
    """Yeni bir 13F çeyreği ilk kez göründüğünde bir defalık özet."""
    holdings = select("whale_holdings", "select=quarter,symbol,issuer_name,value_usd,change_type,cik&order=value_usd.desc.nullslast&limit=3000")
    if not holdings:
        return []
    latest_q = max(h["quarter"] for h in holdings)
    key = f"whaleq-{latest_q}"
    if _logged(key):
        return []
    _log("whale_quarter", key)
    funds = {f["cik"]: f["name"] for f in select("whale_funds", "select=cik,name")}
    cur = [h for h in holdings if h["quarter"] == latest_q]
    news = [h for h in cur if h["change_type"] == "new"][:5]
    exits = [h for h in cur if h["change_type"] == "sold_out"]
    exits = sorted(exits, key=lambda h: -(h.get("value_usd") or 0))[:3]
    lines = [f"  <i>{latest_q} bildirimleri geldi:</i>"]
    for h in news:
        lines.append(f"  🟢 YENİ: <b>{h['symbol'] or h['issuer_name']}</b> ← {funds.get(h['cik'], '?')} (${(h['value_usd'] or 0)/1e6:.0f}M)")
    for h in exits:
        lines.append(f"  🔴 ÇIKIŞ: <b>{h['symbol'] or h['issuer_name'] or h['cik']}</b> ← {funds.get(h['cik'], '?')}")
    return lines if len(lines) > 1 else []


def opportunity_radar(today: dt.date) -> list[str]:
    """Uzun vade fırsat filtresi: derin düşüş + analist güveni + insider satmıyor."""
    funds = select("fundamentals",
                   "select=symbol,market_cap,analyst_target_mean,fifty_two_week_high,analyst_count")
    quotes = {q["symbol"]: q["price"] for q in select("quotes_latest", "select=symbol,price")}
    cutoff = (today - dt.timedelta(days=90)).isoformat()
    ins = select("insider_trades", f"select=symbol,transaction_code,value&transaction_date=gte.{cutoff}")
    net_by_sym: dict[str, float] = defaultdict(float)
    for t in ins:
        if not t["symbol"]:
            continue
        v = t["value"] or 0
        net_by_sym[t["symbol"]] += v if t["transaction_code"] == "P" else (-v if t["transaction_code"] == "S" else 0)
    lines = []
    for f in funds:
        sym = f["symbol"]
        price = quotes.get(sym)
        high, target = f.get("fifty_two_week_high"), f.get("analyst_target_mean")
        if not price or not high or not target or (f.get("market_cap") or 0) < 10e9 or (f.get("analyst_count") or 0) < 8:
            continue
        drawdown = (price / high - 1) * 100
        upside = (target / price - 1) * 100
        if drawdown > -30 or upside < 25 or net_by_sym.get(sym, 0) < 0:
            continue
        key = f"firsat-{sym}-{today.strftime('%Y%m')}"
        if _logged(key):
            continue
        _log("opportunity", key, sym)
        lines.append(f"  <b>{sym}</b> — zirveden %{abs(drawdown):.0f} aşağıda, analist hedefi +%{upside:.0f}"
                     + (", insider alıyor" if net_by_sym.get(sym, 0) > 0 else ""))
    return sorted(lines)[:4]


def megacap_earnings(today: dt.date) -> str:
    rows = select("earnings_calendar", f"select=symbol&earnings_date=eq.{today.isoformat()}")
    if not rows:
        return ""
    caps = {f["symbol"]: f["market_cap"] or 0
            for f in select("fundamentals", "select=symbol,market_cap")}
    megas = [r["symbol"] for r in rows if caps.get(r["symbol"], 0) >= 100e9]
    return ", ".join(sorted(megas)[:10])


def main():
    today = dt.date.today()
    sections: list[tuple[str, list[str] | str]] = [
        ("🔥 <b>Cluster Buy</b>", cluster_buys(today)),
        ("💼 <b>Büyük Insider Alımları</b> (24s)", big_buys(today)),
        ("📈 <b>Skor Sıçramaları</b>", score_jumps()),
        ("🐋 <b>Balina Raporu</b>", whale_report()),
        ("🎯 <b>Fırsat Radarı</b>", opportunity_radar(today)),
    ]
    megas = megacap_earnings(today)

    body_parts = []
    for title, lines in sections:
        if lines:
            body_parts.append(title + "\n" + "\n".join(lines))
    if megas:
        body_parts.append(f"📊 <b>Bugün bilanço:</b> {megas}")

    header = f"📡 <b>RADAR·500</b> — {today.strftime('%d.%m.%Y')}"
    if body_parts:
        text = header + "\n\n" + "\n\n".join(body_parts)
        if SITE:
            text += f'\n\n<a href="{SITE}">Panele git →</a>'
    else:
        text = header + "\nBugün aksiyon gerektiren olay yok."

    key = f"digest-{today.isoformat()}"
    if not _logged(key):
        if send_message(text):
            _log("daily_digest", key)
    return f"{len(body_parts)} bölüm"


if __name__ == "__main__":
    run_job("digest", main)
