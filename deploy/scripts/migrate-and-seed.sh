#!/usr/bin/env bash
# Выполнить из каталога backend с настроенным DATABASE_URL (или через --env-file).
set -euo pipefail
cd "$(dirname "$0")/../../backend"
npx prisma generate
npx prisma migrate deploy
if [[ "${SKIP_SEED:-0}" == "1" ]]; then
  echo "SKIP_SEED=1 — сид пропущен"
  exit 0
fi
npx prisma db seed
