'use strict';
const crypto = require('crypto');

// Суммы внутри сайта хранятся в копейках, провайдерам отдаём строку «123.45».
const money = kop => (Math.round(kop) / 100).toFixed(2);
const kopFrom = v => Math.round(Number(String(v).replace(',', '.')) * 100);
const hash = (algo, s) => crypto.createHash(algo).update(s, 'utf8').digest('hex');
const hmacB64 = (secret, raw) => crypto.createHmac('sha256', secret).update(raw).digest('base64');
const eqSafe = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// HTTP-клиент по умолчанию. В тестах подменяется.
async function http(url, { method = 'POST', headers = {}, json, timeoutMs = 15000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: json === undefined ? undefined : JSON.stringify(json), signal: ctl.signal });
    let data = null;
    try { data = await res.json(); } catch { /* не JSON */ }
    return { status: res.status, json: data };
  } finally { clearTimeout(t); }
}

const basic = (u, p) => 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');
const cut = (s, n) => String(s || '').slice(0, n);

module.exports = { money, kopFrom, hash, hmacB64, eqSafe, http, basic, cut };
