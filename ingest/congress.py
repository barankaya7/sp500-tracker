"""ABD Kongre üyesi hisse işlemleri.

Birincil: kadoa-org/congress-trading-monitor (House Clerk + Senate eFD resmi
verilerini günlük derleyen açık kaynak repo, raw GitHub JSON).
Yedek: CapitolTrades bff API (bot korumalı, her zaman çalışmayabilir).
"""
import hashlib

import requests

from common import upsert, run_job

UA = {"User-Agent": "sp500-tracker (barankaya1502@gmail.com)"}
KADOA_URL = "https://raw.githubusercontent.com/kadoa-org/congress-trading-monitor/main/public/data/trades.json"
CT_URL = "https://bff.capitoltrades.com/trades?pageSize=96&page={page}"


def fetch_kadoa() -> list[dict]:
    data = requests.get(KADOA_URL, headers=UA, timeout=60).json()
    rows = []
    for t in data:
        if t.get("branch") == "executive":
            continue
        ticker = (t.get("ticker") or "").strip().upper().replace(".", "-") or None
        tx = (t.get("transaction_type") or "").lower()
        if "purchase" in tx or tx == "buy":
            tx_type = "buy"
        elif "sale" in tx or "sold" in tx or tx == "sell" or "exchange" in tx:
            tx_type = "sell"
        else:
            continue
        lo, hi = t.get("amount_range_low"), t.get("amount_range_high")
        rows.append({
            "id": hashlib.md5(str(t.get("id")).encode()).hexdigest(),
            "politician": t.get("filer_name") or "?",
            "chamber": t.get("chamber"),
            "party": t.get("party"),
            "symbol": ticker,
            "transaction_type": tx_type,
            "amount_range": t.get("amount_range_label"),
            "amount_mid": (lo + hi) / 2 if lo and hi else lo,
            "transaction_date": (t.get("transaction_date") or "")[:10] or None,
            "disclosure_date": (t.get("filing_date") or "")[:10] or None,
            "source_url": t.get("doc_url"),
        })
    return rows


def fetch_capitoltrades(pages: int = 5) -> list[dict]:
    import time
    rows = []
    headers = {**UA, "Accept": "application/json",
               "Origin": "https://www.capitoltrades.com",
               "Referer": "https://www.capitoltrades.com/"}
    for p in range(1, pages + 1):
        r = requests.get(CT_URL.format(page=p), headers=headers, timeout=30)
        r.raise_for_status()
        data = r.json().get("data", [])
        if not data:
            break
        for t in data:
            pol = t.get("politician") or {}
            asset = t.get("asset") or {}
            ticker = (asset.get("assetTicker") or "").split(":")[0].replace(".", "-") or None
            lo, hi = t.get("sizeRangeLow"), t.get("sizeRangeHigh")
            raw_id = str(t.get("_txId") or f"{pol.get('_politicianId')}-{ticker}-{t.get('txDate')}")
            rows.append({
                "id": hashlib.md5(raw_id.encode()).hexdigest(),
                "politician": f"{pol.get('firstName', '')} {pol.get('lastName', '')}".strip() or "?",
                "chamber": (pol.get("chamber") or "").lower() or None,
                "party": pol.get("party"),
                "symbol": ticker,
                "transaction_type": "buy" if t.get("txType") == "buy" else "sell",
                "amount_range": f"${lo:,.0f} - ${hi:,.0f}" if lo and hi else None,
                "amount_mid": (lo + hi) / 2 if lo and hi else None,
                "transaction_date": t.get("txDate"),
                "disclosure_date": (t.get("pubDate") or "")[:10] or None,
                "source_url": "https://www.capitoltrades.com/trades",
            })
        time.sleep(1)
    return rows


def main():
    try:
        rows = fetch_kadoa()
        source = "kadoa"
    except Exception:  # noqa: BLE001
        rows = fetch_capitoltrades()
        source = "capitoltrades"
    rows = [r for r in rows if r["transaction_date"]]
    n = upsert("congress_trades", rows, on_conflict="id")
    return f"{n} işlem ({source})"


if __name__ == "__main__":
    run_job("congress", main)
