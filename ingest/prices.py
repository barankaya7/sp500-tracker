"""Günlük OHLCV — yfinance bulk download. İlk çalıştırmada 1 yıl, sonra son 5 gün."""
import math
import sys
import pandas as pd
import yfinance as yf
from common import select, upsert, run_job


def get_symbols() -> list[str]:
    return [r["symbol"] for r in select("stocks", "select=symbol")]


def has_history() -> bool:
    rows = select("prices_daily", "select=date&limit=1")
    return len(rows) > 0


def clean(v):
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else round(f, 4)


def main():
    symbols = get_symbols()
    if not symbols:
        raise RuntimeError("stocks tablosu boş — önce universe.py çalıştır")
    period = "5d" if has_history() else "1y"
    if len(sys.argv) > 1 and sys.argv[1] == "--full":
        period = "1y"
    df = yf.download(symbols, period=period, interval="1d", group_by="ticker",
                     auto_adjust=True, threads=True, progress=False)
    rows = []
    for sym in symbols:
        try:
            sub = df[sym].dropna(how="all")
        except KeyError:
            continue
        for date, r in sub.iterrows():
            if pd.isna(r.get("Close")):
                continue
            rows.append({
                "symbol": sym,
                "date": date.strftime("%Y-%m-%d"),
                "open": clean(r.get("Open")),
                "high": clean(r.get("High")),
                "low": clean(r.get("Low")),
                "close": clean(r.get("Close")),
                "volume": int(r["Volume"]) if not pd.isna(r.get("Volume")) else None,
            })
    if not rows:
        raise RuntimeError("yfinance hiç veri döndürmedi")
    n = upsert("prices_daily", rows, on_conflict="symbol,date")
    return f"{n} satır ({period}, {len(symbols)} sembol)"


if __name__ == "__main__":
    run_job("prices", main)
