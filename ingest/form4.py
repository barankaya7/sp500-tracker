"""SEC EDGAR Form 4 (insider işlemleri) — 30 dk'da bir son bildirimleri çeker.

Kaynak: EDGAR 'current events' Atom feed (resmi, ücretsiz, anahtar gerektirmez).
Sadece S&P 500 sembolleri kaydedilir. Büyük alımlar Telegram alarmı tetikler.
"""
import datetime as dt
import hashlib
import re
import time
import xml.etree.ElementTree as ET

import requests

from common import select, upsert, run_job
from telegram_utils import send_alert

UA = {"User-Agent": "sp500-tracker barankaya1502@gmail.com"}
ATOM_URL = ("https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent"
            "&type=4&company=&dateb=&owner=include&count=100&start={start}&output=atom")
NS = {"a": "http://www.w3.org/2005/Atom"}
BIG_BUY_USD = 1_000_000


def sec_get(url: str) -> requests.Response:
    r = requests.get(url, headers=UA, timeout=30)
    r.raise_for_status()
    time.sleep(0.15)  # SEC rate limit: 10 req/s altında kal
    return r


def list_recent_filings(pages: int = 4) -> list[str]:
    """Son Form 4 bildirimlerinin index URL'lerini döner."""
    urls = []
    for p in range(pages):
        xml = sec_get(ATOM_URL.format(start=p * 100)).text
        root = ET.fromstring(xml)
        for entry in root.findall("a:entry", NS):
            link = entry.find("a:link", NS)
            if link is not None:
                urls.append(link.attrib["href"])
    return list(dict.fromkeys(urls))


def parse_filing(index_url: str, sp500: set[str]) -> list[dict]:
    """Bir Form 4 bildiriminin XML'ini bulup işlemleri çıkarır."""
    # index sayfasından .xml belgesini bul
    html = sec_get(index_url).text
    m = re.findall(r'href="(/Archives/[^"]+\.xml)"', html)
    m = [p for p in m if "/xsl" not in p]  # XSL görüntüleyici linklerini atla
    xml_paths = [p for p in m if "primary_doc" not in p] or m
    if not xml_paths:
        return []
    doc = sec_get("https://www.sec.gov" + xml_paths[0]).text
    try:
        root = ET.fromstring(doc)
    except ET.ParseError:
        return []
    if root.tag != "ownershipDocument":
        return []

    def txt(path):
        el = root.find(path)
        return el.text.strip() if el is not None and el.text else None

    symbol = (txt(".//issuerTradingSymbol") or "").upper().replace(".", "-")
    if symbol not in sp500:
        return []
    filer = txt(".//rptOwnerName")
    officer_title = txt(".//officerTitle")
    is_director = txt(".//isDirector") in ("1", "true")
    title = officer_title or ("Director" if is_director else "10% Owner")
    accession = index_url.rstrip("/").split("/")[-1].replace("-index.htm", "")

    rows = []
    for i, tx in enumerate(root.findall(".//nonDerivativeTransaction")):
        def t(path, el=tx):
            e = el.find(path)
            return e.text.strip() if e is not None and e.text else None

        code = t(".//transactionCode")
        shares = t(".//transactionShares/value")
        price = t(".//transactionPricePerShare/value")
        tdate = t(".//transactionDate/value")
        after = t(".//sharesOwnedFollowingTransaction/value")
        if not code or not tdate:
            continue
        sh = float(shares) if shares else None
        pr = float(price) if price else None
        rid = hashlib.md5(f"{accession}-{i}".encode()).hexdigest()
        rows.append({
            "id": rid,
            "symbol": symbol,
            "filer_name": filer,
            "filer_title": title,
            "transaction_date": tdate,
            "filing_date": dt.datetime.now(dt.timezone.utc).isoformat(),
            "transaction_code": code,
            "shares": sh,
            "price": pr,
            "value": round(sh * pr, 2) if sh and pr else None,
            "shares_owned_after": float(after) if after else None,
            "form_url": index_url,
        })
    return rows


def main():
    sp500 = {r["symbol"] for r in select("stocks", "select=symbol")}
    if not sp500:
        raise RuntimeError("stocks tablosu boş")
    existing = {r["form_url"] for r in select(
        "insider_trades", "select=form_url&order=filing_date.desc&limit=2000")}

    urls = list_recent_filings()
    new_urls = [u for u in urls if u not in existing]
    all_rows, alerts = [], []
    for u in new_urls:
        try:
            rows = parse_filing(u, sp500)
        except Exception:  # noqa: BLE001  tek bildirim hatası akışı durdurmasın
            continue
        all_rows.extend(rows)
        # büyük alım alarmı
        for r in rows:
            if r["transaction_code"] == "P" and (r["value"] or 0) >= BIG_BUY_USD:
                alerts.append(r)

    # aynı bildirim owner+issuer CIK'leri altında iki kez listelenebilir — id bazında tekilleştir
    all_rows = list({r["id"]: r for r in all_rows}.values())
    alerts = list({a["id"]: a for a in alerts}.values())
    n = upsert("insider_trades", all_rows, on_conflict="id")
    for a in alerts:
        send_alert(
            kind="insider_big_buy",
            symbol=a["symbol"],
            dedupe_key=f"bigbuy-{a['id']}",
            text=(f"🐋 <b>Büyük Insider Alımı</b>\n"
                  f"<b>{a['symbol']}</b> — {a['filer_name']} ({a['filer_title']})\n"
                  f"${a['value']:,.0f} · {a['shares']:,.0f} adet @ ${a['price']:.2f}\n"
                  f"İşlem tarihi: {a['transaction_date']}"),
        )
    return f"{len(new_urls)} yeni bildirim tarandı, {n} işlem, {len(alerts)} alarm"


if __name__ == "__main__":
    run_job("form4", main)
