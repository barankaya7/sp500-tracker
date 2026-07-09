"""Telegram bildirim yardımcıları. Token yoksa sessizce atlar (lokal test için)."""
import os
import requests

from common import select, upsert

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")


def send_message(text: str) -> bool:
    if not TOKEN or not CHAT_ID:
        print("[telegram] token yok, atlanıyor:", text[:80])
        return False
    r = requests.post(
        f"https://api.telegram.org/bot{TOKEN}/sendMessage",
        json={"chat_id": CHAT_ID, "text": text, "parse_mode": "HTML",
              "disable_web_page_preview": True},
        timeout=30,
    )
    return r.ok


def send_alert(kind: str, text: str, dedupe_key: str, symbol: str | None = None) -> None:
    """Aynı alarmı iki kez göndermez (alerts_log.dedupe_key unique)."""
    existing = select("alerts_log", f"select=id&dedupe_key=eq.{dedupe_key}&limit=1")
    if existing:
        return
    if send_message(text):
        try:
            upsert("alerts_log", [{
                "kind": kind, "symbol": symbol, "message": text[:500], "dedupe_key": dedupe_key,
            }])
        except Exception:  # noqa: BLE001  log hatası alarmı engellemesin
            pass
