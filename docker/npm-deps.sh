#!/bin/sh
# Entrypoint of the Node containers: installs dependencies into web/node_modules when
# package-lock.json changed since the last install, then runs the given command.
set -e
# web and e2e can start at the same time; a lock on the web/ directory keeps their installs from
# overlapping, without a lock file.
exec 9<.
flock 9
hash=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ "$(cat node_modules/.lock-hash 2>/dev/null)" != "$hash" ]; then
  npm ci --no-audit --no-fund
  echo "$hash" > node_modules/.lock-hash
fi
exec 9<&-
exec "$@"
