#!/bin/bash
set -e
cd "$(dirname "$0")/.."
export SUPABASE_URL=$(cat ~/.sp500-url)
export SUPABASE_SERVICE_ROLE_KEY=$(cat ~/.sp500-service)
PY=.venv/bin/python

echo "=== whales13f ===" && $PY ingest/whales13f.py
echo "=== fundamentals ===" && $PY ingest/fundamentals.py
echo "=== scores ==="     && $PY ingest/scores.py
echo "=== quotes ==="     && $PY ingest/quotes.py
echo "=== form4 ==="      && $PY ingest/form4.py
echo "TAMAM"
