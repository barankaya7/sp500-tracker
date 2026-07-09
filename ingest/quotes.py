"""Gün içi fiyat snapshot'ı (15 dk gecikmeli) — quotes_latest tablosunu tazeler."""
import datetime as dt
import math
import pandas as pd
import yfinance as yf
from common import select, upsert, run_job
from telegram_utils import send_alert

MOVE_ALERT_PCT = 7.0


def main():
    symbols = [r["symbol"] for r in select("stocks", "select=symbol")]
    if not symbols:
        raise RuntimeError("stocks tablosu boş")
    df = yf.download(symbols, period="5d", interval="1d", group_by="ticker",
                     auto_adjust=True, threads=True, progress=False)
    rows = []
    for sym in symbols:
        try:
            sub = df[sym].dropna(subset=["Close"])
        except KeyError:
            continue
        if len(sub) == 0:
            continue
        last = sub.iloc[-1]
        prev_close = float(sub.iloc[-2]["Close"]) if len(sub) >= 2 else None
        price = float(last["Close"])
        if math.isnan(price):
            continue
        change = round((price / prev_close - 1) * 100, 2) if prev_close else None
        rows.append({
            "symbol": sym,
            "price": round(price, 4),
            "change_pct": change,
            "volume": int(last["Volume"]) if not pd.isna(last.get("Volume")) else None,
        })
    n = upsert("quotes_latest", rows, on_conflict="symbol")
    today = dt.date.today().isoformat()
    movers = [r for r in rows if r["change_pct"] is not None and abs(r["change_pct"]) >= MOVE_ALERT_PCT]
    for m in sorted(movers, key=lambda r: -abs(r["change_pct"]))[:5]:
        arrow = "🚀" if m["change_pct"] > 0 else "🔻"
        send_alert(
            kind="price_move", symbol=m["symbol"],
            dedupe_key=f"move-{m['symbol']}-{today}",
            text=(f"{arrow} <b>{m['symbol']}</b> bugün "
                  f"{'+' if m['change_pct'] > 0 else ''}{m['change_pct']:.1f}% — ${m['price']:.2f}"),
        )
    return f"{n} quote, {len(movers)} büyük hareket"


if __name__ == "__main__":
    run_job("quotes", main)
