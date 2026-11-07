'use strict';
// Шифрование ключей провайдеров в базе (AES-256-GCM). Ключ шифрования берётся из config.json (secret).
const crypto = require('crypto');
const keyOf = secret => crypto.createHash('sha256').update('secrets:' + secret).digest();

function encrypt(text, secret) {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', keyOf(secret), iv);
  const enc = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return 'enc1:' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
function decrypt(s, secret) {
  if (!s) return '';
  if (!String(s).startsWith('enc1:')) return String(s);
  const buf = Buffer.from(String(s).slice(5), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', keyOf(secret), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}
// Для показа в админке: только последние 4 символа
const mask = v => (v ? '••••••••' + String(v).slice(-4) : '');

module.exports = { encrypt, decrypt, mask };
