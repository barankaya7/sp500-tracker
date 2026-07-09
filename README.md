# RADAR·500

S&P 500 takip ve sinyal paneli — fiyat, temel veri, insider (SEC Form 4), balina (13F), kongre işlemleri ve haber akışını tek panelde toplar; her hisseye günlük 0-100 kompozit skor üretir.

## Mimari

```
GitHub Actions (Python, cron) → Supabase Postgres → Next.js (Vercel)
        └→ Telegram (günlük özet + kritik alarmlar)
```

| Klasör | İçerik |
|---|---|
| `ingest/` | Python veri toplayıcılar (yfinance, SEC EDGAR, kongre, haber, skor motoru) |
| `supabase/migrations/` | Veritabanı şeması |
| `web/` | Next.js 16 uygulaması (App Router + Tailwind) |
| `.github/workflows/` | Zamanlanmış ingestion işleri |

## Zamanlama (UTC)

- `intraday.yml` — piyasa saatlerinde 30 dk'da bir: fiyat snapshot + Form 4 poll + hareket alarmları
- `daily.yml` — hafta içi 21:30: tüm veri + skorlar + budama
- `digest.yml` — hafta içi 13:00 (16:00 TR): Telegram günlük özeti

## Gerekli GitHub Secrets

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, opsiyonel `FINNHUB_API_KEY`. Vars: `SITE_URL`.

## Not

Bu projedeki hiçbir çıktı yatırım tavsiyesi değildir. 13F verileri yapısal olarak ~45 gün gecikmelidir.
