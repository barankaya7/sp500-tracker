# RADAR·500

An S&P 500 tracking and signal dashboard. It pulls price data, fundamentals, insider transactions (SEC Form 4), institutional holdings (13F), congressional trades and news into one panel, and produces a daily 0–100 composite score per ticker.

## Architecture

```
GitHub Actions (Python, cron) → Supabase Postgres → Next.js (Vercel)
        └→ Telegram (daily digest + critical alerts)
```

| Directory | Contents |
|---|---|
| `ingest/` | Python collectors — yfinance, SEC EDGAR, congressional trades, news, and the scoring engine |
| `supabase/migrations/` | Database schema |
| `web/` | Next.js 16 app (App Router + Tailwind) |
| `.github/workflows/` | Scheduled ingestion jobs |

## Schedule (UTC)

| Workflow | When | What |
|---|---|---|
| `intraday.yml` | every 30 min during market hours | price snapshot, Form 4 poll, movement alerts |
| `daily.yml` | weekdays 21:30 | full ingest, scoring, pruning |
| `digest.yml` | weekdays 13:00 | Telegram daily digest |

## Configuration

GitHub Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and optionally `FINNHUB_API_KEY`. Vars: `SITE_URL`.

## Status

Shelved as of 31 July 2026 — the ingestion and scoring work, but I stopped maintaining it to focus on my exam-prep business. It can be restarted.

## Disclaimer

Nothing this project produces is investment advice. 13F data is structurally delayed by roughly 45 days, and the composite score is a heuristic, not a prediction.
