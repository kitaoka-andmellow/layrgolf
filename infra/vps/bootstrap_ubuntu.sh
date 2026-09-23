#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo ./bootstrap_ubuntu.sh" >&2
  exit 1
fi

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 ufw ca-certificates curl
systemctl enable --now docker

# Worker has no public web port. Keep the VPS closed except SSH.
ufw allow OpenSSH
ufw --force enable

mkdir -p /opt/course-code
cat <<'EOF'
Bootstrap complete.

Next:
1. Copy the project to /opt/course-code
2. cp /opt/course-code/infra/vps/.env.example /opt/course-code/infra/vps/.env
3. Fill .env
4. cd /opt/course-code/infra/vps
5. docker compose build
6. docker compose run --rm worker search
EOF
