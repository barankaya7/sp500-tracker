"""Haber akışı — yfinance şirket haberleri + genel piyasa RSS'leri.

Günde 2 kez çalışır. FINNHUB_API_KEY tanımlıysa Finnhub company-news de eklenir.
"""
import datetime as dt
import hashlib
import os
import time
import xml.etree.ElementTree as ET

import requests
import yfinance as yf

from common import select, upsert, run_job

RSS_FEEDS = [
    ("CNBC", "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
    ("MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_topstories"),
    ("Yahoo Finance", "https://finance.yahoo.com/news/rssindex"),
]
FINNHUB_KEY = os.environ.get("FINNHUB_API_KEY", "")


def news_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()


def from_yfinance(symbols: list[str]) -> list[dict]:
    rows = []
    for i, sym in enumerate(symbols):
        try:
            items = yf.Ticker(sym).news or []
        except Exception:  # noqa: BLE001
            continue
        for it in items[:5]:
            c = it.get("content") or it  # yeni/eski yfinance şeması
            url = ((c.get("clickThroughUrl") or {}).get("url")
                   or (c.get("canonicalUrl") or {}).get("url") or it.get("link"))
            title = c.get("title") or it.get("title")
            if not url or not title:
                continue
            pub = c.get("pubDate") or it.get("providerPublishTime")
            if isinstance(pub, (int, float)):
                pub = dt.datetime.fromtimestamp(pub, dt.timezone.utc).isoformat()
            provider = ((c.get("provider") or {}).get("displayName")
                        or it.get("publisher") or "Yahoo Finance")
            rows.append({
                "id": news_id(url), "symbol": sym, "headline": title[:400],
                "summary": (c.get("summary") or "")[:600] or None,
                "source": provider, "url": url, "published_at": pub,
            })
        if i % 40 == 39:
            time.sleep(1)
    return rows


def from_rss() -> list[dict]:
    rows = []
    for source, feed in RSS_FEEDS:
        try:
            xml = requests.get(feed, headers={"User-Agent": "sp500-tracker"}, timeout=30).text
            root = ET.fromstring(xml)
        except Exception:  # noqa: BLE001
            continue
        for item in root.iter("item"):
            def t(tag):
                e = item.find(tag)
                return e.text.strip() if e is not None and e.text else None
            url, title = t("link"), t("title")
            if not url or not title:
                continue
            pub = t("pubDate")
            try:
                pub_iso = dt.datetime.strptime(pub, "%a, %d %b %Y %H:%M:%S %z").isoformat() if pub else None
            except ValueError:
                pub_iso = None
            rows.append({
                "id": news_id(url), "symbol": None, "headline": title[:400],
                "summary": (t("description") or "")[:600] or None,
                "source": source, "url": url, "published_at": pub_iso,
            })
    return rows


def from_finnhub(symbols: list[str]) -> list[dict]:
    if not FINNHUB_KEY:
        return []
    rows = []
    frm = (dt.date.today() - dt.timedelta(days=2)).isoformat()
    to = dt.date.today().isoformat()
    for i, sym in enumerate(symbols):
        try:
            r = requests.get("https://finnhub.io/api/v1/company-news",
                             params={"symbol": sym, "from": frm, "to": to, "token": FINNHUB_KEY},
                             timeout=20)
            if r.status_code == 429:
                time.sleep(30)
                continue
            for it in (r.json() or [])[:5]:
                if not it.get("url"):
                    continue
                rows.append({
                    "id": news_id(it["url"]), "symbol": sym,
                    "headline": (it.get("headline") or "")[:400],
                    "summary": (it.get("summary") or "")[:600] or None,
                    "source": it.get("source") or "Finnhub", "url": it["url"],
                    "published_at": dt.datetime.fromtimestamp(it["datetime"], dt.timezone.utc).isoformat() if it.get("datetime") else None,
                })
        except Exception:  # noqa: BLE001
            continue
        if i % 50 == 49:
            time.sleep(1.2)  # 60 çağrı/dk limiti
    return rows


def main():
    symbols = [r["symbol"] for r in select("stocks", "select=symbol")]
    rows = from_rss()
    rows += from_finnhub(symbols) if FINNHUB_KEY else from_yfinance(symbols)
    # aynı id iki kez gelmesin
    seen, unique = set(), []
    for r in rows:
        if r["id"] not in seen and r["headline"]:
            seen.add(r["id"])
            unique.append(r)
    n = upsert("news", unique, on_conflict="id")
    return f"{n} haber"


if __name__ == "__main__":
    run_job("news", main)
