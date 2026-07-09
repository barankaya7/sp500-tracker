#!/bin/bash
# GitHub Actions secrets kurulumu — bir kez çalıştır: bash scripts/setup_secrets.sh
set -e
cd "$(dirname "$0")/.."
gh secret set SUPABASE_URL < ~/.sp500-url
gh secret set SUPABASE_SERVICE_ROLE_KEY < ~/.sp500-service
gh secret set TELEGRAM_BOT_TOKEN < ~/.sp500-tg-token
gh secret set TELEGRAM_CHAT_ID < ~/.sp500-tg-chat
gh secret list
echo "Secrets tamam — otomatik cron'lar artık çalışacak."
