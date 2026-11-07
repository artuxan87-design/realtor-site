'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const I = require('../lib/import');
const { createApp } = require('../server');
const { DB } = require('../lib/db');
const { Store } = require('../lib/store');
const P = require('../src/pages');

const XML = `<?xml version="1.0"?><Ads><Ad><Id>A1</Id><OperationType>Продам</OperationType><Title>1-к. квартира, 40 м²</Title><Description><![CDATA[<p>Уютная.</p><p>Ремонт &amp; мебель</p>]]></Description><Price>6 100 000</Price><Rooms>1</Rooms><Square>40,5</Square><Floor>4</Floor><Floors>9</Floors><Address>Калининград</Address><Images><Image url="https://example.com/1.jpg"/><Image url="http://insecure.com/2.jpg"/></Images></Ad><Ad><Id>A2</Id><OperationType>Сдам</OperationType><Description>Аренда</Description><Price>40000</Price><Rooms>Студия</Rooms></Ad></Ads>`;

test('импорт: XML автозагрузки, CSV в windows-1251, пропуск небезопасных ссылок на фото', () => {
  const r = I.parseAny(Buffer.from(XML));
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.items[0].description, ['Уютная.', 'Ремонт & мебель']);
  assert.equal(r.items[0].price, 6100000);
  assert.equal(r.items[0].area, 40.5);
  assert.deepEqual(r.items[0].images, ['https://example.com/1.jpg']);
  assert.equal(r.items[1].deal, 'rent');
  assert.equal(r.items[1].rooms, 0);
  const csv = I.parseAny(Buffer.from('Название;Цена;Описание\n"Тест, ""кавычки""";5 000 000;Текст\n', 'utf8'));
  assert.equal(csv.items[0].title, 'Тест, "кавычки"');
  assert.equal(csv.items[0].price, 5000000);
});

test('импорт: Excel (.xlsx) читается без библиотек', () => {
  const f = path.join(__dirname, 'fixtures', 'avito.xlsx');
  const r = I.parseAny(fs.readFileSync(f));
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].sid, '111');
  assert.deepEqual(r.items[0].images, ['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  assert.equal(r.items[1].rooms, 0);
});

test('импорт: адреса из закрытых сетей запрещены', () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.20.0.1', '169.254.169.254', '::1']) assert.ok(I.isPrivateIp(ip), ip);
  assert.ok(!I.isPrivateIp('93.184.216.34'));
});

test('импорт: создание, повторный импорт обновляет, правки владельца сохраняются, фото скачиваются', async () => {
  const st = new Store(new DB(null));
  st.seedContent(P.files());
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imp-'));
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
  const get = async url => { if (url.includes('bad')) throw new Error('нет'); return png; };
  const items = I.parseAny(Buffer.from(XML)).items;
  items[0].images.push('https://example.com/bad.jpg');
  const before = st.c.solutions.length;
  let r = await I.apply(st, items, { uploadsDir: dir, photos: true, get });
  assert.deepEqual([r.created, r.updated, r.photosOk, r.photosFail], [2, 0, 1, 1]);
  assert.equal(st.c.solutions.length, before + 2);
  const o = st.c.solutions.find(x => x.source && x.source.id === 'A1');
  assert.equal(o.price, 610000000);
  assert.match(o.photos[0].src, /^\/uploads\//);
  o.title = 'Моё название';
  items[0].price = 5900000;
  r = await I.apply(st, items, { uploadsDir: dir, photos: true, get });
  assert.deepEqual([r.created, r.updated], [0, 2]);
  assert.equal(st.c.solutions.length, before + 2);
  assert.equal(o.price, 590000000);
  assert.equal(o.title, 'Моё название');
  assert.equal(o.photos.length, 1);
});

test('импорт через админку: загрузка, предпросмотр, выбор, применение', async () => {
  const { server, store } = createApp({ dataFile: null, config: { port: 0, adminPassword: 'adm', secret: 's' } });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port, jar = {};
  const call = (method, p, form) => new Promise((resolve, reject) => {
    const body = form ? new URLSearchParams(form).toString() : '';
    const req = http.request({ port, path: p, method, headers: { cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } : {}) } }, res => {
      for (const c of res.headers['set-cookie'] || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
      let t = ''; res.on('data', x => t += x); res.on('end', () => resolve({ status: res.statusCode, text: t, location: res.headers.location }));
    });
    req.on('error', reject); req.end(body);
  });
  try {
    assert.equal((await call('GET', '/admin/import')).status, 200);
    await call('POST', '/admin/login', { password: 'adm' });
    assert.match((await call('GET', '/admin/import')).text, /Импорт|Откуда взять/);
    assert.equal((await call('POST', '/admin/import/preview', {})).status, 400);
    assert.equal((await call('POST', '/admin/import/preview', { url: 'http://127.0.0.1:1/x.xml' })).status, 400);
    const pv = await call('POST', '/admin/import/preview', { b64: Buffer.from(XML).toString('base64') });
    assert.equal(pv.status, 200);
    assert.match(pv.text, /Найдено объявлений: 2/);
    const token = pv.text.match(/name="token" value="(\w+)"/)[1];
    const n = store.c.solutions.length;
    const body = new URLSearchParams([['token', token], ['pick', 'A1']]).toString();
    const ap = await new Promise(resolve => { const req = http.request({ port, path: '/admin/import/apply', method: 'POST', headers: { cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, res => { res.resume(); res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location })); }); req.end(body); });
    assert.equal(ap.status, 303);
    assert.equal(store.c.solutions.length, n + 1);
    assert.equal(store.c.solutions.at(-1).source.id, 'A1');
    assert.equal((await call('POST', '/admin/import/apply', { token, pick: 'A1' })).status, 400);
  } finally { server.close(); }
});
