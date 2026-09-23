#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo ./install_timers.sh" >&2
  exit 1
fi
SRC="$(cd "$(dirname "$0")/systemd" && pwd)"
cp "$SRC"/*.service "$SRC"/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now course-code-search.timer course-code-full.timer
if grep -q '^RAKUTEN_AFFILIATE_ID=.' "$(dirname "$0")/.env" 2>/dev/null; then
  systemctl enable --now course-code-ads.timer
else
  echo "Affiliate ID is blank: course-code-ads.timer was not enabled."
fi
systemctl list-timers 'course-code-*'
