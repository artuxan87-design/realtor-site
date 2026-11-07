'use strict';
// Загрузка фото из админки. Файлы лежат в папке uploads рядом с базой (на хостинге это постоянный диск).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX = 6 * 1024 * 1024;
const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

// Тип определяем по первым байтам файла, а не по имени и заголовку: так под фото не загрузить скрипт
function sniff(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (b.slice(0, 3).toString('latin1') === 'GIF') return 'gif';
  return null;
}

function save(dir, buf) {
  if (!buf || !buf.length) return { error: 'Файл пустой' };
  if (buf.length > MAX) return { error: 'Файл больше 6 МБ. Уменьшите фото и загрузите снова' };
  const ext = sniff(buf);
  if (!ext) return { error: 'Подходят только фото JPG, PNG, WEBP или GIF' };
  fs.mkdirSync(dir, { recursive: true });
  const name = crypto.randomBytes(10).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(dir, name), buf);
  return { name, url: '/uploads/' + name };
}

function read(dir, name) {
  if (!/^[a-f0-9]{20}\.(jpg|png|webp|gif)$/.test(name)) return null;
  const f = path.join(dir, name);
  if (!fs.existsSync(f)) return null;
  return { body: fs.readFileSync(f), type: TYPES[name.split('.').pop()] };
}

function list(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(n => /^[a-f0-9]{20}\.(jpg|png|webp|gif)$/.test(n)).map(n => ({ name: n, url: '/uploads/' + n, at: fs.statSync(path.join(dir, n)).mtimeMs })).sort((a, b) => b.at - a.at);
}

function remove(dir, name) {
  if (!/^[a-f0-9]{20}\.(jpg|png|webp|gif)$/.test(name)) return false;
  const f = path.join(dir, name);
  if (fs.existsSync(f)) { fs.unlinkSync(f); return true; }
  return false;
}

// Адрес картинки из поля формы: свой файл (/uploads/...) или ссылка https. Всё остальное отбрасываем.
function imageUrl(v) {
  const s = String(v ?? '').trim().slice(0, 500);
  if (!s) return '';
  if (/^\/uploads\/[a-f0-9]{20}\.(jpg|png|webp|gif)$/.test(s)) return s;
  if (/^https:\/\/[^\s"'<>]+$/.test(s)) return s;
  return '';
}

module.exports = { MAX, save, read, list, remove, imageUrl, sniff };
