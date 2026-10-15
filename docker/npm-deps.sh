#!/bin/sh
# Entrypoint of the Node containers: installs dependencies into the shared node_modules volume when
# package-lock.json changed since the last install, then runs the given command.
set -e
hash=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ "$(cat node_modules/.lock-hash 2>/dev/null)" != "$hash" ]; then
  npm ci --no-audit --no-fund
  echo "$hash" > node_modules/.lock-hash
fi
exec "$@"
