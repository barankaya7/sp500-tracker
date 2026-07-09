"""Günlük Telegram özeti — her sabah 16:00 TR (piyasa öncesi)."""
import datetime as dt
import os

from common import select, run_job
from telegram_utils import send_alert

SITE = os.environ.get("SITE_URL", "")


def main():
    today = dt.date.today()
    yesterday = (today - dt.timedelta(days=1)).isoformat()

    scores = select("scores_daily", "select=*&order=date.desc,total.desc&limit=300")
    latest_day = scores[0]["date"] if scores else None
    top = [s for s in scores if s["date"] == latest_day][:5]
    deltas = sorted(
        [s for s in scores if s["date"] == latest_day and s["delta"] is not None],
        key=lambda s: -s["delta"])[:3]

    big_buys = select(
        "insider_trades",
        f"select=*&transaction_code=eq.P&value=gte.500000&filing_date=gte.{yesterday}"
        "&order=value.desc&limit=5")
    cg = select("congress_trades", f"select=*&disclosure_date=gte.{yesterday}&order=amount_mid.desc.nullslast&limit=5")
    earnings = select("earnings_calendar", f"select=symbol&earnings_date=eq.{today.isoformat()}")
    quotes = select("quotes_latest", "select=symbol,change_pct")
    valid = [q_ for q_ in quotes if q_["change_pct"] is not None]
    up = len([q_ for q_ in valid if q_["change_pct"] > 0])

    lines = [f"📡 <b>RADAR·500 Günlük Özet</b> — {today.strftime('%d.%m.%Y')}", ""]
    if valid:
        avg = sum(q_["change_pct"] for q_ in valid) / len(valid)
        lines.append(f"Piyasa: {up}/{len(valid)} yükseldi · ort. {'+' if avg >= 0 else ''}{avg:.2f}%")
        lines.append("")
    if top:
        lines.append("🎯 <b>Günün Sinyalleri</b>")
        for s in top:
            lines.append(f"  <b>{s['symbol']}</b> — {s['total']:.0f}/100")
        lines.append("")
    if deltas:
        lines.append("📈 <b>Skoru En Çok Artanlar</b>")
        for s in deltas:
            lines.append(f"  <b>{s['symbol']}</b> +{s['delta']:.0f} → {s['total']:.0f}")
        lines.append("")
    if big_buys:
        lines.append("💼 <b>Büyük Insider Alımları (24s)</b>")
        for t in big_buys:
            lines.append(f"  <b>{t['symbol']}</b> — {t['filer_name']}: ${(t['value'] or 0)/1e6:.1f}M")
        lines.append("")
    if cg:
        lines.append("🏛 <b>Yeni Kongre Bildirimleri</b>")
        for t in cg:
            tt = "ALIŞ" if t["transaction_type"] == "buy" else "SATIŞ"
            lines.append(f"  <b>{t['symbol'] or '?'}</b> — {t['politician']}: {tt} {t['amount_range'] or ''}")
        lines.append("")
    if earnings:
        syms = ", ".join(e["symbol"] for e in earnings[:12])
        lines.append(f"📊 <b>Bugün bilanço:</b> {syms}")
        lines.append("")
    if SITE:
        lines.append(f'<a href="{SITE}">Panele git →</a>')

    send_alert(kind="daily_digest", symbol=None,
               dedupe_key=f"digest-{today.isoformat()}", text="\n".join(lines))
    return "özet gönderildi"


if __name__ == "__main__":
    run_job("digest", main)
