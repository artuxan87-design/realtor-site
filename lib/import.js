'use strict';
// Импорт объектов из выгрузки Авито: XML автозагрузки, Excel (.xlsx) и CSV. Только файлы и ссылки на файлы,
// которые даёт сам владелец объявлений. Страницы Авито не читаются (автоматический сбор запрещён правилами площадки).
const zlib = require('zlib');
const dns = require('dns').promises;
const net = require('net');
const crypto = require('crypto');
const Media = require('./media');

const MAX_FEED = 8 * 1024 * 1024;
const MAX_ITEMS = 100;
const MAX_PHOTOS = 8;

const ent = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = s => String(s).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const c = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ''; }
  return ent[e.toLowerCase()] ?? m;
});
const unwrap = s => { const m = String(s).match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/); return m ? m[1] : decode(s); };

// ---------- Синонимы заголовков (CSV и Excel) и тегов (XML) ----------
const SYN = {
  id: ['id', 'avitoid', 'номер объявления', 'идентификатор', 'id объявления', 'номер', 'внешний id'],
  title: ['title', 'название', 'название объявления', 'заголовок'],
  description: ['description', 'описание', 'текст объявления'],
  price: ['price', 'цена', 'цена, ₽', 'цена, руб', 'цена, руб.'],
  op: ['operationtype', 'operation', 'тип объявления', 'тип сделки', 'вид объявления', 'тип'],
  rooms: ['rooms', 'количество комнат', 'комнат', 'комнаты', 'число комнат'],
  area: ['square', 'площадь', 'общая площадь', 'общая площадь, м²', 'площадь, м²', 'площадь, м2'],
  kitchen: ['kitchenspace', 'площадь кухни', 'площадь кухни, м²'],
  floor: ['floor', 'этаж'],
  floors: ['floors', 'этажей в доме', 'этажность', 'всего этажей'],
  house: ['housetype', 'тип дома', 'материал дома'],
  address: ['address', 'адрес'],
  district: ['district', 'район'],
  condition: ['renovation', 'ремонт', 'состояние'],
  year: ['buildyear', 'yearbuilt', 'год постройки', 'год постройки дома'],
  video: ['videourl', 'видео', 'ссылка на видео'],
  images: ['imageurls', 'images', 'imageurl', 'фото', 'ссылки на фото', 'ссылки на изображения'],
};
const LOOKUP = {}; for (const [k, list] of Object.entries(SYN)) for (const n of list) LOOKUP[n] = k;
const canon = h => LOOKUP[String(h ?? '').trim().toLowerCase().replace(/\s+/g, ' ')];

// ---------- XML автозагрузки ----------
function parseXml(text) {
  const out = [];
  let blocks = [...text.matchAll(/<Ad\b[^>]*>([\s\S]*?)<\/Ad>/gi)].map(m => m[1]);
  if (!blocks.length) blocks = [...text.matchAll(/<offer\b[^>]*>([\s\S]*?)<\/offer>/gi)].map(m => m[1]);
  for (const b of blocks) {
    const imgs = [];
    const imgSec = (b.match(/<Images\b[^>]*>([\s\S]*?)<\/Images>/i) || [])[1] || '';
    for (const m of (imgSec || b).matchAll(/<Image\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Image>)/gi)) {
      const attr = (m[1].match(/\burl\s*=\s*["']([^"']+)["']/i) || [])[1];
      imgs.push(decode(attr || unwrap(m[2] || '').trim()));
    }
    const rest = b.replace(/<Images\b[\s\S]*?<\/Images>/gi, '');
    const raw = {};
    for (const m of rest.matchAll(/<([A-Za-z][\w-]*)\b[^>]*>(<!\[CDATA\[[\s\S]*?\]\]>|[^<]*)<\/\1>/g)) {
      const k = canon(m[1]); if (k && raw[k] === undefined) raw[k] = unwrap(m[2]).trim();
    }
    // описание может содержать теги <p>, <br>: берём его целиком
    const d = rest.match(/<Description\b[^>]*>([\s\S]*?)<\/Description>/i);
    if (d) raw.description = unwrap(d[1]).trim();
    if (imgs.length) raw.images = imgs;
    out.push(raw);
  }
  return out;
}

// ---------- CSV ----------
function parseCsvRows(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row);
  return rows;
}

function rowsToRaw(rows) {
  let h = rows.findIndex(r => r.filter(c => canon(c)).length >= 2);
  if (h < 0) h = 0;
  const keys = (rows[h] || []).map(canon);
  return rows.slice(h + 1).map(r => { const o = {}; keys.forEach((k, i) => { if (k && o[k] === undefined && String(r[i] ?? '').trim() !== '') o[k] = String(r[i]).trim(); }); return o; }).filter(o => Object.keys(o).length);
}

// ---------- XLSX (zip + xml, без библиотек) ----------
function unzip(buf) {
  let e = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('Файл не похож на Excel (.xlsx)');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16);
  const files = {};
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nl).toString('utf8');
    p += 46 + nl + el + cl;
    if (!/^xl\/(sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(name)) continue;
    const ds = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const data = buf.slice(ds, ds + csize);
    files[name] = method === 0 ? data : zlib.inflateRawSync(data, { maxOutputLength: 40 * 1024 * 1024 });
  }
  return files;
}
const colIdx = ref => { let n = 0; for (const c of ref.replace(/\d+/g, '')) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
function parseXlsxRows(buf) {
  const f = unzip(buf);
  const names = Object.keys(f).filter(n => n.startsWith('xl/worksheets/')).sort();
  if (!names.length) throw new Error('В файле нет листов');
  const shared = f['xl/sharedStrings.xml'] ? [...f['xl/sharedStrings.xml'].toString('utf8').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m => decode([...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''))) : [];
  const xml = f[names.includes('xl/worksheets/sheet1.xml') ? 'xl/worksheets/sheet1.xml' : names[0]].toString('utf8');
  const rows = [];
  for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = (cm[1].match(/\br="([A-Z]+\d+)"/) || [])[1]; if (!ref) continue;
      const t = (cm[1].match(/\bt="(\w+)"/) || [])[1], body = cm[2] || '';
      let v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      if (t === 's') v = shared[Number(v)];
      else if (t === 'inlineStr') v = decode([...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''));
      else if (v !== undefined) v = decode(v);
      row[colIdx(ref)] = v === undefined ? '' : String(v);
    }
    if (row.some(x => x && String(x).trim())) rows.push(Array.from(row, x => x ?? ''));
  }
  return rows;
}

// ---------- Приведение к полям объекта ----------
const numOf = v => { const s = String(v ?? '').replace(/[\s ]/g, '').replace(',', '.').replace(/[^\d.]/g, ''); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const plainText = html => decode(String(html || '').replace(/<\s*br\s*\/?>|<\/p>|<\/li>/gi, '\n').replace(/<[^>]+>/g, '')).split('\n').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
function normalize(raw) {
  const rooms = /студ/i.test(raw.rooms || '') ? 0 : numOf(String(raw.rooms || '').match(/\d+/));
  const area = numOf(raw.area), price = numOf(raw.price);
  const deal = /сда|аренд/i.test(raw.op || '') ? 'rent' : 'sale';
  let imgs = raw.images || [];
  if (typeof imgs === 'string') imgs = imgs.split(/[\s;,|]+/);
  imgs = [...new Set(imgs.map(x => String(x).trim()).filter(x => /^https:\/\/[^\s"'<>]+$/.test(x)))].slice(0, MAX_PHOTOS);
  const title = String(raw.title || '').trim() || [rooms === 0 ? 'Студия' : rooms ? rooms + '-комнатная квартира' : 'Квартира', area ? String(area).replace('.', ',') + ' м²' : ''].filter(Boolean).join(', ');
  const description = plainText(raw.description);
  const address = String(raw.address || '').trim();
  const sid = String(raw.id || '').trim() || 'h' + crypto.createHash('sha1').update(title + '|' + address + '|' + price).digest('hex').slice(0, 12);
  return {
    sid: sid.slice(0, 40), title: title.slice(0, 160), deal, price, rooms, area, kitchen: numOf(raw.kitchen), floor: numOf(raw.floor), floors: numOf(raw.floors), year: numOf(raw.year),
    houseType: String(raw.house || '').trim().slice(0, 60), condition: String(raw.condition || '').trim().slice(0, 120), address: address.slice(0, 160), district: String(raw.district || '').trim().slice(0, 60),
    description: description.slice(0, 10).map(x => x.slice(0, 900)), video: /^https:\/\//.test(raw.video || '') ? raw.video : '', images: imgs,
  };
}

function parseAny(buf) {
  const warnings = [];
  let raws;
  if (buf.slice(0, 2).toString('latin1') === 'PK') raws = rowsToRaw(parseXlsxRows(buf));
  else {
    let text = buf.toString('utf8');
    if (text.includes('�')) text = new TextDecoder('windows-1251').decode(buf);
    raws = text.trimStart().startsWith('<') ? parseXml(text) : rowsToRaw(parseCsvRows(text));
  }
  let items = raws.map(normalize).filter(i => i.price != null || i.description.length);
  const seen = new Set(); items = items.filter(i => !seen.has(i.sid) && seen.add(i.sid));
  if (items.length > MAX_ITEMS) { warnings.push(`В файле больше ${MAX_ITEMS} объявлений, взяты первые ${MAX_ITEMS}. Остальные импортируйте отдельным файлом.`); items = items.slice(0, MAX_ITEMS); }
  return { items, warnings };
}

// ---------- Сеть: только публичные https/http адреса ----------
const isPrivateIp = ip => net.isIPv4(ip) ? /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip) : /^(::1|::|fc|fd|fe80)/i.test(ip);
async function safeGet(url, max, accept) {
  let u; try { u = new URL(url); } catch { throw new Error('Некорректная ссылка'); }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) throw new Error('Ссылка должна начинаться с http:// или https://');
  const addrs = await dns.lookup(u.hostname, { all: true }).catch(() => { throw new Error('Не удалось найти сайт по ссылке'); });
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error('Эта ссылка не разрешена');
  const r = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { Accept: accept || '*/*', 'User-Agent': 'realtor-site-import/1.0' } });
  if (r.status !== 200) throw new Error('Сайт ответил кодом ' + r.status + (r.status >= 300 && r.status < 400 ? ' (перенаправление не поддерживается, возьмите конечную ссылку)' : ''));
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > max) throw new Error('Файл слишком большой');
  return buf;
}
const fetchFeed = url => safeGet(url, MAX_FEED, 'application/xml,text/xml,text/csv,*/*');

// ---------- Подготовка и применение ----------
async function prepare(body) {
  let buf;
  if (body.b64) buf = Buffer.from(String(body.b64), 'base64');
  else if (String(body.url || '').trim()) buf = await fetchFeed(String(body.url).trim());
  else throw new Error('Выберите файл выгрузки или вставьте ссылку на него');
  if (!buf.length) throw new Error('Файл пустой');
  if (buf.length > MAX_FEED) throw new Error('Файл больше 8 МБ');
  let r;
  try { r = parseAny(buf); } catch (e) { throw new Error('Не удалось прочитать файл: ' + e.message); }
  if (!r.items.length) throw new Error('В файле не нашлось объявлений. Подходят XML автозагрузки Авито, Excel (.xlsx) и CSV со столбцами «Название», «Цена», «Описание», «Фото» и другими.');
  return r;
}

async function downloadPhotos(urls, uploadsDir, get = safeGet) {
  const out = [];
  for (let i = 0; i < urls.length; i += 4) {
    const part = await Promise.all(urls.slice(i, i + 4).map(async u => {
      try { const r = Media.save(uploadsDir, await get(u, Media.MAX, 'image/*')); return r.error ? null : r.url; } catch { return null; }
    }));
    out.push(...part);
  }
  return out;
}

async function apply(store, items, { uploadsDir, photos = true, get } = {}) {
  const { slugify } = require('./service');
  const V = require('./visuals');
  const res = { created: 0, updated: 0, photosOk: 0, photosFail: 0 };
  for (const it of items) {
    const list = store.c.solutions;
    let o = list.find(x => x.source && x.source.type === 'avito' && x.source.id === it.sid);
    const isNew = !o;
    if (isNew) {
      let s = slugify(it.title), k = 2; const base = s;
      while (list.some(x => x.slug === s)) s = base + '-' + k++;
      o = { slug: s, category: 'flat', status: 'active', summary: '', features: [], photos: [], image: '', seoTitle: '', seoDesc: '', icon: 'home', cover: 'flat', accent: V.accent('blue'), mortgage: true, commission: it.deal === 'rent' ? 50 : 2, title: it.title };
      list.push(o);
    }
    const put = (k, v) => { if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)) o[k] = v; };
    Object.assign(o, { deal: it.deal, price: it.price == null ? null : Math.round(it.price * 100), demoData: false, source: { type: 'avito', id: it.sid, at: new Date().toISOString() } });
    for (const k of ['rooms', 'area', 'kitchen', 'floor', 'floors', 'year', 'houseType', 'condition', 'address', 'district', 'video']) put(k, it[k]);
    if (it.description.length) o.description = it.description;
    if (isNew || !o.summary) o.summary = (it.description[0] || it.title).slice(0, 220);
    if (!(o.photos || []).length && !o.image && it.images.length) {
      if (photos) {
        const urls = await downloadPhotos(it.images, uploadsDir, get);
        res.photosOk += urls.filter(Boolean).length; res.photosFail += urls.filter(x => !x).length;
        o.photos = urls.filter(Boolean).map(src => ({ src, alt: it.title }));
      } else o.photos = it.images.map(src => ({ src, alt: it.title }));
    }
    res[isNew ? 'created' : 'updated']++;
  }
  store.log('admin', 'импорт объектов из выгрузки Авито', `новых ${res.created}, обновлено ${res.updated}`);
  store.save();
  return res;
}

module.exports = { parseAny, parseXml, parseCsvRows, parseXlsxRows, normalize, prepare, apply, fetchFeed, isPrivateIp, MAX_ITEMS };
