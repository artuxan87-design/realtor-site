#!/usr/bin/env bash
# Первичная установка на чистый сервер Ubuntu 22.04 или 24.04 (запускать от root в папке с сайтом).
# Использование: sudo bash deploy/setup.sh example.ru
set -euo pipefail
DOMAIN="${1:?Укажите домен: sudo bash deploy/setup.sh example.ru}"
APP=/opt/kinolog-site
DATA=/var/lib/kinolog-site

apt-get update
apt-get install -y curl ca-certificates debian-keyring debian-archive-keyring apt-transport-https gnupg ufw
# Node.js 22 (NodeSource) и Caddy (официальный репозиторий)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

id site >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin site
mkdir -p "$APP" "$DATA"
rsync -a --delete --exclude data --exclude config.json --exclude node_modules --exclude .git ./ "$APP"/ 2>/dev/null || cp -r ./. "$APP"/
chown -R root:root "$APP"
chown -R site:site "$DATA"

if [ ! -f /etc/kinolog-site.env ]; then
  cp "$APP/deploy/env.example" /etc/kinolog-site.env
  sed -i "s|^SECRET=.*|SECRET=$(openssl rand -hex 32)|" /etc/kinolog-site.env
  sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$(openssl rand -hex 6)|" /etc/kinolog-site.env
  chmod 600 /etc/kinolog-site.env
  echo "Создан /etc/kinolog-site.env. Пароль админки и ключ шифрования внутри файла."
fi

cp "$APP/deploy/kinolog-site.service" /etc/systemd/system/
sed "s/example.ru/$DOMAIN/g" "$APP/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now kinolog-site
systemctl restart caddy

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Ежедневная копия базы
install -m 755 "$APP/deploy/backup.sh" /usr/local/bin/artyushkin-backup
echo "17 3 * * * root /usr/local/bin/artyushkin-backup" > /etc/cron.d/artyushkin-backup

echo "Готово. Проверьте: https://$DOMAIN и https://$DOMAIN/admin"
echo "Пароль админки: grep ADMIN_PASSWORD /etc/kinolog-site.env"
