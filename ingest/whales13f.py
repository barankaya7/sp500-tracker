"""SEC EDGAR 13F-HR — takip edilen büyük fonların çeyreklik pozisyonları.

Günlük çalışır; yeni 13F bildirimi varsa çeker, yoksa hızla biter.
CUSIP → sembol eşlemesi: cusip_map önbelleği → isim eşleme → OpenFIGI (ücretsiz).
"""
import json
import re
import time
import xml.etree.ElementTree as ET

import requests

from common import select, upsert, run_job

UA = {"User-Agent": "sp500-tracker barankaya1502@gmail.com"}

# (cik, görünen ad, yönetici)
FUNDS = [
    ("1067983", "Berkshire Hathaway", "Warren Buffett"),
    ("1350694", "Bridgewater Associates", "Ray Dalio"),
    ("1336528", "Pershing Square", "Bill Ackman"),
    ("1649339", "Scion Asset Management", "Michael Burry"),
    ("1656456", "Appaloosa", "David Tepper"),
    ("1037389", "Renaissance Technologies", "Jim Simons mirası"),
    ("1423053", "Citadel Advisors", "Ken Griffin"),
    ("1273087", "Millennium Management", "Izzy Englander"),
    ("1009207", "D.E. Shaw", "David Shaw"),
    ("1167483", "Tiger Global", "Chase Coleman"),
    ("1135730", "Coatue Management", "Philippe Laffont"),
    ("1061165", "Lone Pine Capital", "Stephen Mandel"),
    ("1103804", "Viking Global", "Andreas Halvorsen"),
    ("1040273", "Third Point", "Dan Loeb"),
    ("1079114", "Greenlight Capital", "David Einhorn"),
    ("921669", "Icahn Capital", "Carl Icahn"),
    ("1061768", "Baupost Group", "Seth Klarman"),
    ("1791786", "Elliott Investment Mgmt", "Paul Singer"),
    ("1536411", "Duquesne Family Office", "Stanley Druckenmiller"),
    ("1029160", "Soros Fund Management", "George Soros"),
    ("1697748", "ARK Invest", "Cathie Wood"),
    ("1166559", "Gates Foundation Trust", "Bill Gates"),
    ("850529", "Fisher Asset Management", "Ken Fisher"),
    ("1179392", "Two Sigma Investments", "Overdeck & Siegel"),
]

TOP_N = 75  # fon başına saklanan pozisyon sayısı


def sec_get(url: str):
    r = requests.get(url, headers=UA, timeout=30)
    r.raise_for_status()
    time.sleep(0.15)
    return r


def latest_13f(cik: str) -> tuple[str, str, str] | None:
    """(accession_nodash, report_quarter, filing_date) veya None."""
    data = sec_get(f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json").json()
    recent = data.get("filings", {}).get("recent", {})
    for form, acc, rdate, fdate in zip(
        recent.get("form", []), recent.get("accessionNumber", []),
        recent.get("reportDate", []), recent.get("filingDate", [])
    ):
        if form in ("13F-HR", "13F-HR/A"):
            y, m = rdate[:4], int(rdate[5:7])
            quarter = f"{y}Q{(m - 1) // 3 + 1}"
            return acc.replace("-", ""), quarter, fdate
    return None


def fetch_infotable(cik: str, acc: str) -> list[dict]:
    idx = sec_get(f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc}/index.json").json()
    names = [f["name"] for f in idx["directory"]["item"]]
    xml_name = next((n for n in names if n.lower().endswith(".xml") and "primary_doc" not in n.lower()), None)
    if not xml_name:
        return []
    doc = sec_get(f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc}/{xml_name}").text
    doc = re.sub(r'xmlns="[^"]+"', "", doc, count=10)  # namespace'leri temizle
    root = ET.fromstring(doc)
    holdings = {}
    for it in root.iter("infoTable"):
        def t(tag, el=it):
            e = el.find(f".//{tag}")
            return e.text.strip() if e is not None and e.text else None
        if (t("putCall") or "").lower() in ("put", "call"):
            continue
        cusip = t("cusip")
        if not cusip:
            continue
        val = float(t("value") or 0)
        sh = float(t("sshPrnamt") or 0)
        if cusip in holdings:  # aynı CUSIP birden çok satırda olabilir
            holdings[cusip]["value_usd"] += val
            holdings[cusip]["shares"] += sh
        else:
            holdings[cusip] = {"cusip": cusip, "issuer_name": t("nameOfIssuer"),
                               "value_usd": val, "shares": sh}
    return list(holdings.values())


def norm_name(s: str) -> str:
    s = re.sub(r"[^A-Z0-9 ]", "", s.upper())
    for suffix in (" INC", " CORP", " CO", " PLC", " LTD", " HOLDINGS", " GROUP", " COMPANY", " COM", " CL A", " CL B", " CL C", " NEW"):
        s = s.replace(suffix, "")
    return s.strip()


def build_symbol_resolver():
    cache = {r["cusip"]: r["symbol"] for r in select("cusip_map", "select=cusip,symbol")}
    stocks = select("stocks", "select=symbol,name")
    by_name = {norm_name(r["name"]): r["symbol"] for r in stocks}
    new_entries = []

    def resolve(cusip: str, issuer: str | None) -> str | None:
        if cusip in cache:
            return cache[cusip]
        sym = by_name.get(norm_name(issuer or ""))
        cache[cusip] = sym
        new_entries.append({"cusip": cusip, "symbol": sym, "source": "name_match" if sym else "unmatched"})
        return sym

    return resolve, cache, new_entries


def openfigi_fill(new_entries: list[dict], cache: dict):
    """İsimle eşleşmeyen CUSIP'leri OpenFIGI ile çözmeyi dener (ücretsiz, anahtar opsiyonel)."""
    unmatched = [e for e in new_entries if e["symbol"] is None]
    for i in range(0, len(unmatched), 5):
        batch = unmatched[i : i + 5]
        try:
            r = requests.post(
                "https://api.openfigi.com/v3/mapping",
                json=[{"idType": "ID_CUSIP", "idValue": e["cusip"], "exchCode": "US"} for e in batch],
                timeout=30,
            )
            if r.status_code == 429:
                time.sleep(10)
                continue
            if not r.ok:
                break
            for e, res in zip(batch, r.json()):
                data = res.get("data") or []
                if data:
                    e["symbol"] = data[0].get("ticker", "").replace("/", "-") or None
                    e["source"] = "openfigi"
                    cache[e["cusip"]] = e["symbol"]
        except requests.RequestException:
            break
        time.sleep(2.6)  # anahtarsız limit: 25 istek/dk


def main():
    upsert("whale_funds", [{"cik": c, "name": n, "manager": m, "slug": n.lower().replace(" ", "-")}
                           for c, n, m in FUNDS], on_conflict="cik")
    done = {(r["cik"], r["quarter"]) for r in select("whale_holdings", "select=cik,quarter")}
    resolve, cache, new_entries = build_symbol_resolver()
    total_rows = 0

    for cik, name, _ in FUNDS:
        try:
            info = latest_13f(cik)
        except Exception:  # noqa: BLE001
            continue
        if not info:
            continue
        acc, quarter, _fdate = info
        if (cik, quarter) in done:
            continue
        holdings = fetch_infotable(cik, acc)
        if not holdings:
            continue
        holdings.sort(key=lambda h: -h["value_usd"])
        top = holdings[:TOP_N]
        total_val = sum(h["value_usd"] for h in holdings) or 1

        # önceki çeyrek karşılaştırması
        prev = select("whale_holdings",
                      f"select=cusip,shares,quarter&cik=eq.{cik}&order=quarter.desc&limit=200")
        prev_q = prev[0]["quarter"] if prev else None
        prev_map = {r["cusip"]: r["shares"] for r in prev if r["quarter"] == prev_q}

        rows = []
        for h in top:
            sym = resolve(h["cusip"], h["issuer_name"])
            old = prev_map.get(h["cusip"])
            if old is None:
                change = "new" if prev_q else None
            elif h["shares"] > old * 1.02:
                change = "added"
            elif h["shares"] < old * 0.98:
                change = "reduced"
            else:
                change = "unchanged"
            rows.append({
                "cik": cik, "quarter": quarter, "symbol": sym, "cusip": h["cusip"],
                "issuer_name": h["issuer_name"], "shares": h["shares"],
                "value_usd": h["value_usd"],
                "pct_of_portfolio": round(h["value_usd"] / total_val * 100, 2),
                "change_type": change,
                "shares_change": (h["shares"] - old) if old is not None else None,
            })
        # tam çıkışlar
        cur_cusips = {h["cusip"] for h in top}
        for cusip, old_sh in prev_map.items():
            if cusip not in cur_cusips and old_sh:
                rows.append({
                    "cik": cik, "quarter": quarter, "symbol": cache.get(cusip),
                    "cusip": cusip, "issuer_name": None, "shares": 0, "value_usd": 0,
                    "pct_of_portfolio": 0, "change_type": "sold_out", "shares_change": -old_sh,
                })
        total_rows += upsert("whale_holdings", rows, on_conflict="cik,quarter,cusip")
        print(f"  {name}: {quarter} → {len(rows)} pozisyon")

    openfigi_fill(new_entries, cache)
    if new_entries:
        upsert("cusip_map", new_entries, on_conflict="cusip")
        # sembolü sonradan çözülenleri güncelle
        fixes = [e for e in new_entries if e["source"] == "openfigi" and e["symbol"]]
        for e in fixes:
            upsert("whale_holdings",
                   [{**r, "symbol": e["symbol"]} for r in select(
                       "whale_holdings", f"select=*&cusip=eq.{e['cusip']}")],
                   on_conflict="cik,quarter,cusip")
    return f"{total_rows} pozisyon yazıldı"


if __name__ == "__main__":
    run_job("whales13f", main)
