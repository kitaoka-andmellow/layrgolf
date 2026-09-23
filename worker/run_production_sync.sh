#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-search}"
DATA_ROOT="${COURSE_CODE_DATA_DIR:-/data}"
mkdir -p "$DATA_ROOT" "$DATA_ROOT/cache"
export COURSE_CODE_CACHE_DIR="$DATA_ROOT/cache"

required=(RAKUTEN_APP_ID RAKUTEN_ACCESS_KEY SUPABASE_URL)
for name in "${required[@]}"; do
  if [ -z "${!name:-}" ]; then
    echo "$name is required" >&2
    exit 2
  fi
done

if [ -z "${SUPABASE_SECRET_KEY:-}" ] && [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) is required" >&2
  exit 2
fi

case "$MODE" in
  search)
    OUT="$DATA_ROOT/search"
    mkdir -p "$OUT"
    python3 scripts/sync_gora_api.py --search-only --out "$OUT" --min-interval "${RAKUTEN_MIN_INTERVAL:-0.8}"
    python3 publish_to_supabase.py --input-dir "$OUT" --mode search
    ;;
  full)
    OUT="$DATA_ROOT/full"
    mkdir -p "$OUT"
    python3 scripts/sync_gora_api.py --out "$OUT" --refresh-details --min-interval "${RAKUTEN_MIN_INTERVAL:-0.8}"
    python3 publish_to_supabase.py --input-dir "$OUT" --mode full
    ;;
  ads)
    if [ -z "${RAKUTEN_AFFILIATE_ID:-}" ]; then
      echo "RAKUTEN_AFFILIATE_ID is required for affiliate ad refresh" >&2
      exit 2
    fi
    python3 sync_rakuten_ads.py
    ;;
  *)
    echo "usage: $0 {search|full|ads}" >&2
    exit 2
    ;;
esac
