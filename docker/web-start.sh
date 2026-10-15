#!/bin/sh
# Installs dependencies when package-lock.json changed since the last install, then starts Vite.
set -e
hash=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ "$(cat node_modules/.lock-hash 2>/dev/null)" != "$hash" ]; then
  npm ci --no-audit --no-fund
  echo "$hash" > node_modules/.lock-hash
fi
exec npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
