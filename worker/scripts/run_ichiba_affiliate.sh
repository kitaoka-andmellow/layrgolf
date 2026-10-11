#!/bin/sh
# Run from the existing Lolipop fixed-IP host, not GitHub Actions or Vercel.
set -eu
cd "$HOME/apps/layrgolf"
# Export plain variables from the existing private environment file for Python.
set -a
. "$HOME/.course-code.env"
set +a
exec "$HOME/.course-code-venv/bin/python" worker/scripts/sync_ichiba_affiliate.py "$@"
