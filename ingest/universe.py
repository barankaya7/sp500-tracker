"""S&P 500 listesini Wikipedia'dan çekip stocks tablosuna yazar."""
import io
import requests
import pandas as pd
from common import upsert, run_job

WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
UA = {"User-Agent": "Mozilla/5.0 (sp500-tracker; barankaya1502@gmail.com)"}


def normalize_symbol(sym: str) -> str:
    """Wikipedia 'BRK.B' → yfinance 'BRK-B'. Kanonik format: tire."""
    return sym.strip().replace(".", "-")


def fetch_universe() -> list[dict]:
    html = requests.get(WIKI_URL, headers=UA, timeout=30).text
    tables = pd.read_html(io.StringIO(html))
    df = tables[0]  # ilk tablo: mevcut bileşenler
    rows = []
    for _, r in df.iterrows():
        rows.append({
            "symbol": normalize_symbol(str(r["Symbol"])),
            "name": str(r["Security"]),
            "sector": str(r["GICS Sector"]),
            "sub_industry": str(r["GICS Sub-Industry"]),
        })
    if len(rows) < 480:
        raise RuntimeError(f"Beklenmedik liste boyutu: {len(rows)}")
    return rows


def main():
    rows = fetch_universe()
    n = upsert("stocks", rows, on_conflict="symbol")
    return f"{n} sembol"


if __name__ == "__main__":
    run_job("universe", main)
