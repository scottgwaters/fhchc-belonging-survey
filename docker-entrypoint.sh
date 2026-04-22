#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
npx --no-install prisma migrate deploy

if [ -n "$ADMIN_SEED_EMAIL" ] && [ -n "$ADMIN_SEED_PASSWORD" ]; then
  echo "[entrypoint] Seeding admin user..."
  node prisma/seed-admin.mjs
else
  echo "[entrypoint] ADMIN_SEED_EMAIL/PASSWORD not set; skipping admin seed."
fi

echo "[entrypoint] Starting Next.js server..."
exec node server.js
