#!/usr/bin/env bash
# Копия базы с заявками, партнёрами и заказами. Хранит 14 последних копий в /var/backups/kinolog-site.
set -euo pipefail
DIR=/var/backups/kinolog-site
mkdir -p "$DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
install -m 600 /var/lib/kinolog-site/db.json "$DIR/db-$STAMP.json" 2>/dev/null || true
ls -1t "$DIR"/db-*.json 2>/dev/null | tail -n +15 | xargs -r rm -f
