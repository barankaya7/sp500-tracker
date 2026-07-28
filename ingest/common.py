"""Supabase PostgREST yardımcıları — tüm ingestion scriptleri bunu kullanır."""
import os
import sys
import json
import time
import datetime as dt
import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    # Secrets kurulmamışsa job'ı DÜŞÜRME — başarısız run bildirimi yağmasın diye
    # sessizce başarılı çık. Kurulum: bash scripts/setup_secrets.sh
    print("[uyarı] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tanımlı değil — iş atlandı.")
    print("[uyarı] Kurulum için: bash scripts/setup_secrets.sh")
    sys.exit(0)


def _db_reachable() -> bool:
    try:
        requests.head(f"{SUPABASE_URL}/rest/v1/", timeout=10)
        return True
    except requests.RequestException:
        return False


if not _db_reachable():
    # DB uykuda/erişilemez: yine düşme, e-posta seli olmasın. Günlük digest saatinde
    # Telegram'dan tek uyarı gönder (DB'siz dedupe yapılamadığı için sadece o job'da).
    print("[uyarı] Supabase'e ulaşılamıyor — iş atlandı (proje uyumuş olabilir).")
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat = os.environ.get("TELEGRAM_CHAT_ID", "")
    if token and chat and os.path.basename(sys.argv[0]) == "digest.py":
        try:
            requests.post(f"https://api.telegram.org/bot{token}/sendMessage", timeout=15, json={
                "chat_id": chat,
                "text": "⚠️ RADAR·500: Veritabanına ulaşılamıyor (Supabase uyumuş olabilir). "
                        "Supabase panelinden projeyi 'Restore' etmek gerekiyor.",
            })
        except requests.RequestException:
            pass
    sys.exit(0)

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

CHUNK = 500


def upsert(table: str, rows: list[dict], on_conflict: str | None = None) -> int:
    """Satırları upsert eder (merge-duplicates). Toplam yazılan satır sayısını döner."""
    if not rows:
        return 0
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    params = {}
    if on_conflict:
        params["on_conflict"] = on_conflict
    headers = {**HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"}
    total = 0
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i : i + CHUNK]
        for attempt in range(3):
            r = requests.post(url, params=params, headers=headers, data=json.dumps(chunk), timeout=60)
            if r.status_code < 300:
                total += len(chunk)
                break
            if attempt == 2:
                raise RuntimeError(f"upsert {table} failed {r.status_code}: {r.text[:500]}")
            time.sleep(2 * (attempt + 1))
    return total


def select(table: str, query: str = "select=*") -> list[dict]:
    url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
    out, offset, page = [], 0, 1000
    while True:
        headers = {**HEADERS, "Range": f"{offset}-{offset + page - 1}"}
        r = requests.get(url, headers=headers, timeout=60)
        r.raise_for_status()
        batch = r.json()
        out.extend(batch)
        if len(batch) < page:
            return out
        offset += page


def delete_where(table: str, filter_query: str) -> None:
    """Örn: delete_where('news', 'published_at=lt.2026-05-01')"""
    url = f"{SUPABASE_URL}/rest/v1/{table}?{filter_query}"
    r = requests.delete(url, headers=HEADERS, timeout=60)
    if r.status_code >= 300:
        raise RuntimeError(f"delete {table} failed {r.status_code}: {r.text[:300]}")


def mark_job(job: str, status: str, detail: str = "") -> None:
    upsert("job_runs", [{
        "job": job,
        "last_run": dt.datetime.now(dt.timezone.utc).isoformat(),
        "status": status,
        "detail": detail[:500],
    }])


def run_job(job: str, fn) -> None:
    """Job'ı çalıştır, sonucu job_runs'a yaz, hata olursa exit 1."""
    try:
        detail = fn() or ""
        mark_job(job, "ok", str(detail))
        print(f"[{job}] ok: {detail}")
    except Exception as e:  # noqa: BLE001
        mark_job(job, "error", str(e))
        print(f"[{job}] ERROR: {e}", file=sys.stderr)
        sys.exit(1)
