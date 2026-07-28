"""Form 4 geriye dönük doldurma — atom feed'in kaçırdığı dönem için.

Her S&P 500 şirketinin EDGAR submissions listesinden belirtilen tarih aralığındaki
Form 4 bildirimlerini bulur ve mevcut parser ile işler.

Kullanım: python ingest/backfill_form4.py 2026-07-10 2026-07-28
"""
import sys

from common import select, upsert, run_job
from form4 import sec_get, parse_filing


def issuer_ciks(symbols: set[str]) -> dict[str, str]:
    """sembol → CIK eşlemesi (SEC'in resmi listesi, tek istek)."""
    data = sec_get("https://www.sec.gov/files/company_tickers.json").json()
    out = {}
    for row in data.values():
        t = row["ticker"].upper().replace(".", "-")
        if t in symbols:
            out[t] = str(row["cik_str"])
    return out


def form4_accessions(cik: str, start: str, end: str) -> list[str]:
    """Şirketin submissions listesinden tarih aralığındaki Form 4 index URL'leri."""
    try:
        data = sec_get(f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json").json()
    except Exception:  # noqa: BLE001
        return []
    recent = data.get("filings", {}).get("recent", {})
    urls = []
    for form, acc, fdate in zip(recent.get("form", []), recent.get("accessionNumber", []),
                                recent.get("filingDate", [])):
        if form == "4" and start <= fdate <= end:
            nodash = acc.replace("-", "")
            urls.append(f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{nodash}/{acc}-index.htm")
    return urls


def main():
    start = sys.argv[1] if len(sys.argv) > 1 else None
    end = sys.argv[2] if len(sys.argv) > 2 else None
    if not start or not end:
        raise RuntimeError("kullanım: backfill_form4.py BAŞLANGIÇ BİTİŞ (YYYY-MM-DD)")
    sp500 = {r["symbol"] for r in select("stocks", "select=symbol")}
    existing = {r["form_url"] for r in select("insider_trades", "select=form_url")}
    ciks = issuer_ciks(sp500)
    print(f"{len(ciks)} şirket için {start}..{end} taranıyor")

    all_rows, scanned = [], 0
    for i, (sym, cik) in enumerate(sorted(ciks.items())):
        for url in form4_accessions(cik, start, end):
            if url in existing:
                continue
            scanned += 1
            try:
                all_rows.extend(parse_filing(url, sp500))
            except Exception:  # noqa: BLE001
                continue
        if i % 50 == 49:
            print(f"  {i+1}/{len(ciks)} şirket, {len(all_rows)} işlem birikti")

    all_rows = list({r["id"]: r for r in all_rows}.values())
    n = upsert("insider_trades", all_rows, on_conflict="id")
    return f"{scanned} bildirim tarandı, {n} işlem yazıldı"


if __name__ == "__main__":
    run_job("backfill_form4", main)
