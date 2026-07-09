"""Temel veriler + analist hedefleri + yaklaşan bilanço tarihi — yfinance .info.

503 sembol için tek tek çağrı yapar (~10-15 dk). Günde 1 kez çalışır.
"""
import datetime as dt
import math
import time
import yfinance as yf
from common import select, upsert, run_job


def num(v, scale=1):
    if v is None:
        return None
    try:
        f = float(v) * scale
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else round(f, 6)


def main():
    symbols = [r["symbol"] for r in select("stocks", "select=symbol")]
    if not symbols:
        raise RuntimeError("stocks tablosu boş")
    fund_rows, earn_rows, errors = [], [], 0
    today = dt.date.today()
    for i, sym in enumerate(symbols):
        try:
            info = yf.Ticker(sym).info
            if not info or info.get("regularMarketPrice") is None and info.get("currentPrice") is None:
                errors += 1
                continue
            mc = info.get("marketCap")
            fund_rows.append({
                "symbol": sym,
                "market_cap": int(mc) if mc else None,
                "trailing_pe": num(info.get("trailingPE")),
                "forward_pe": num(info.get("forwardPE")),
                "price_to_book": num(info.get("priceToBook")),
                "profit_margin": num(info.get("profitMargins")),
                "revenue_growth": num(info.get("revenueGrowth")),
                "earnings_growth": num(info.get("earningsGrowth")),
                "dividend_yield": num(info.get("dividendYield")),
                "beta": num(info.get("beta")),
                "fifty_two_week_high": num(info.get("fiftyTwoWeekHigh")),
                "fifty_two_week_low": num(info.get("fiftyTwoWeekLow")),
                "analyst_target_mean": num(info.get("targetMeanPrice")),
                "analyst_target_high": num(info.get("targetHighPrice")),
                "analyst_target_low": num(info.get("targetLowPrice")),
                "analyst_rating": info.get("recommendationKey"),
                "analyst_count": info.get("numberOfAnalystOpinions"),
                "short_pct_of_float": num(info.get("shortPercentOfFloat")),
                "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            })
            ts = info.get("earningsTimestamp")
            if ts:
                edate = dt.datetime.fromtimestamp(ts, dt.timezone.utc).date()
                if edate >= today:
                    earn_rows.append({
                        "symbol": sym,
                        "earnings_date": edate.isoformat(),
                        "eps_estimate": num(info.get("epsCurrentYear")),
                        "time_hint": "unknown",
                    })
        except Exception:  # noqa: BLE001
            errors += 1
        if i % 50 == 49:
            time.sleep(2)  # nazik ol
    if len(fund_rows) < len(symbols) * 0.5:
        raise RuntimeError(f"Çok fazla hata: {len(fund_rows)}/{len(symbols)} başarılı")
    n = upsert("fundamentals", fund_rows, on_conflict="symbol")
    ne = upsert("earnings_calendar", earn_rows, on_conflict="symbol,earnings_date")
    return f"{n} fundamentals, {ne} earnings, {errors} hata"


if __name__ == "__main__":
    run_job("fundamentals", main)
