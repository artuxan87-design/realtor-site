#!/usr/bin/env bash
# Обновление сайта новой версией кода (запускать от root в папке с новой версией). База и ключи не трогаются.
set -euo pipefail
APP=/opt/kinolog-site
/usr/local/bin/artyushkin-backup
rsync -a --delete --exclude data --exclude config.json --exclude node_modules --exclude .git ./ "$APP"/
cp "$APP/deploy/kinolog-site.service" /etc/systemd/system/
systemctl daemon-reload
systemctl restart kinolog-site
sleep 2
curl -fsS http://127.0.0.1:3000/healthz && echo " сайт работает"
