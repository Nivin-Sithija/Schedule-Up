#!/bin/sh
set -eu
mkdir -p /data
chown temporal:temporal /data
for file in /data/temporal.db*; do
  if [ -e "$file" ]; then chown temporal:temporal "$file"; fi
done
exec su -s /bin/sh temporal -c 'exec temporal server start-dev --ip 0.0.0.0 --port 7233 --http-port "${PORT:-7243}" --db-filename /data/temporal.db --headless'
