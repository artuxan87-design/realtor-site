'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../server');

function client(port) {
  const jar = {};
  return async (method, path, form) => new Promise((resolve, reject) => {
    const body = form ? new URLSearchParams(form).toString() : '';
    const req = http.request({ port, path, method, headers: { cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } : {}) } }, res => {
      for (const c of res.headers['set-cookie'] || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
      let t = ''; res.on('data', x => t += x); res.on('end', () => resolve({ status: res.statusCode, text: t, location: res.headers.location }));
    });
    req.on('error', reject); req.end(body);
  });
}

test('сквозной сценарий: партнёр, заявка по ссылке, заказ, оплата, начисление', async () => {
  const { server, store } = createApp({ dataFile: null, config: { port: 0, adminPassword: 'adm-pass', secret: 's3cret' } });
  Object.assign(store.s, { holdDays: 14, minPayout: 100000 }); store.s.rates.service = { l1: 10, l2: 4, l3: 2 }; store.s.rates.solution = { l1: 10, l2: 4, l3: 2 };
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  try {
    const partner = client(port), visitor = client(port), admin = client(port);

    let r = await partner('POST', '/partner/register', { name: 'Анна Партнёр', phone: '+7 900 111-22-33', email: 'a@t.ru', password: 'secret1', adult: '1', rules: '1', pd: '1' });
    assert.equal(r.status, 303);
    const code = store.d.partners[0].code;
    assert.equal((await partner('GET', '/partner')).status, 200);

    r = await visitor('GET', '/?ref=' + code);
    assert.equal(r.status, 200);
    r = await visitor('POST', '/contact', { name: 'Клиент', contact: 'tg_client', solution: 'Магазин косметики и ухода', consent: '1' });
    assert.equal(r.status, 200);
    assert.match(r.text, /Заявка №1 принята/);
    assert.equal(store.d.leads[0].cookieCode, code);
    r = await visitor('POST', '/contact', { name: 'К', contact: 'x' });
    assert.equal(r.status, 400);

    assert.match((await admin('GET', '/admin')).text, /Пароль/);
    assert.equal((await admin('POST', '/admin/login', { password: 'wrong' })).status, 400);
    assert.equal((await admin('POST', '/admin/login', { password: 'adm-pass' })).status, 303);
    r = await admin('POST', '/admin/leads/1/order', { use0: '1', type0: 'solution', title0: 'Магазин', amount0: '100 000', use1: '1', type1: 'service', title1: 'Оплата', amount1: '20000' });
    assert.equal(r.location, '/admin/orders/1');
    assert.equal((await admin('POST', '/admin/orders/1/pay', {})).status, 303);
    assert.equal(store.d.accruals.length, 1);
    assert.equal(store.d.accruals[0].amount, 1200000);
    assert.match((await partner('GET', '/partner/accruals')).text, /12\s000/);

    r = await admin('POST', '/admin/settings/rates', { type: 'solution', l1: '20', l2: '5', l3: '5' });
    assert.equal(r.status, 400);
    assert.match(r.text, /выше потолка/);
  } finally { server.close(); }
});

test('кабинет и админка закрыты без входа, сайт закрыт от индексации без домена', async () => {
  const { server } = createApp({ dataFile: null, config: { port: 0, adminPassword: 'x', secret: 's' } });
  await new Promise(r => server.listen(0, r));
  const c = client(server.address().port);
  try {
    assert.equal((await c('GET', '/partner')).location, '/partner/login');
    assert.equal((await c('POST', '/admin/orders/1/pay', {})).status, 200);
    assert.match((await c('GET', '/robots.txt')).text, /Disallow: \/\n/);
  } finally { server.close(); }
});

test('служебный адрес /healthz и публичные страницы', async () => {
  const { server } = createApp({ dataFile: null, config: { port: 0, adminPassword: 'x', secret: 's' } });
  await new Promise(r => server.listen(0, r));
  const c = client(server.address().port);
  try {
    assert.equal((await c('GET', '/healthz')).text, 'ok');
    for (const u of ['/', '/services/', '/services/prodazha/', '/objects/', '/objects/?deal=rent&rooms=1', '/objects/dvushka-centr/', '/stories/', '/blog/', '/blog/kak-proverit-kvartiru-pered-pokupkoy/', '/about/', '/contact/', '/privacy/', '/partners/', '/docs/rules/']) {
      const r = await c('GET', u);
      assert.equal(r.status, 200, u);
      assert.match(r.text, /<h1/, 'заголовок на ' + u);
      assert.match(r.text, /<link rel="canonical"/, 'canonical на ' + u);
    }
    assert.equal((await c('GET', '/blog/net-takoj/')).status, 404);
    assert.equal((await c('GET', '/solutions/')).location, '/objects/');
    assert.equal((await c('GET', '/courses/dvushka-centr/')).location, '/objects/dvushka-centr/');
    assert.match((await c('GET', '/objects/dvushka-centr/')).text, /9 900 000/);
    const rent = (await c('GET', '/objects/?deal=rent')).text;
    assert.match(rent, /Аренда 2-комнатной/);
    assert.doesNotMatch(rent, /Студия 28/);
  } finally { server.close(); }
});

test('SEO: пока домена нет, сайт закрыт; с доменом открыт, есть карта сайта и микроразметка', async () => {
  const { server, store } = createApp({ dataFile: null, config: { port: 0, adminPassword: 'x', secret: 's' } });
  await new Promise(r => server.listen(0, r));
  const c = client(server.address().port);
  try {
    assert.match((await c('GET', '/')).text, /noindex/);
    assert.match((await c('GET', '/robots.txt')).text, /Disallow: \/\n/);
    assert.equal((await c('GET', '/sitemap.xml')).status, 404);
    store.c.site.domain = 'kinolog.ru';
    store.c.site.seo.metrikaId = '12345678';
    const home = (await c('GET', '/')).text;
    assert.doesNotMatch(home, /content="noindex/);
    assert.match(home, /rel="canonical" href="https:\/\/kinolog\.ru\/"/);
    assert.match(home, /application\/ld\+json/);
    assert.match(home, /"@type":"RealEstateAgent"/);
    assert.match(home, /"@type":"FAQPage"/);
    assert.match(home, /ym\(12345678/);
    const sm = (await c('GET', '/sitemap.xml')).text;
    assert.match(sm, /https:\/\/kinolog\.ru\/blog\/kak-proverit-kvartiru-pered-pokupkoy\//);
    assert.match(sm, /https:\/\/kinolog\.ru\/services\/prodazha\//);
    assert.doesNotMatch(sm, /admin|partner\/|pay\//);
    assert.match((await c('GET', '/robots.txt')).text, /Sitemap: https:\/\/kinolog\.ru\/sitemap\.xml/);
    const post = (await c('GET', '/blog/kak-proverit-kvartiru-pered-pokupkoy/')).text;
    assert.match(post, /"@type":"Article"/);
    assert.match(post, /og:type" content="article"/);
    assert.match((await c('GET', '/services/konsultaciya/')).text, /"price":"3000"/);
    // кабинет и админка не индексируются
    assert.match((await c('GET', '/partner/login')).text, /noindex/);
  } finally { server.close(); }
});

test('разметка статей экранирует опасное и встраивает видео только с разрешённых сайтов', () => {
  const R = require('../lib/richtext');
  const h = R.render('## Заголовок\n\n<script>alert(1)</script> **жирный**\n\n![подпись](javascript:alert(1))\n![ок](https://a.ru/x.jpg)\n@видео https://youtu.be/dQw4w9WgXcQ\n@видео https://evil.example/video\n[ссылка](javascript:alert(1))');
  assert.doesNotMatch(h, /<script/);
  assert.match(h, /&lt;script&gt;/);
  assert.match(h, /<strong>жирный<\/strong>/);
  assert.doesNotMatch(h, /(href|src)="javascript/);
  assert.match(h, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  assert.doesNotMatch(h, /evil\.example"/);
  assert.match(h, /<img src="https:\/\/a\.ru\/x\.jpg"/);
});

test('админка: блог, загрузка фото, проверка типа файла', async () => {
  const os = require('os'), fs = require('fs'), path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kin-'));
  const { server, store } = createApp({ dataFile: path.join(dir, 'db.json'), config: { port: 0, adminPassword: 'adm', secret: 's' } });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const admin = client(port), visitor = client(port);
  try {
    await admin('POST', '/admin/login', { password: 'adm' });
    let r = await admin('POST', '/admin/posts/new', { title: 'Первая статья', body: '## Раздел\n\nТекст про щенка.\n\n@видео https://rutube.ru/video/0123456789abcdef0123456789abcdef/', published: '1', tags: 'щенок, уход', seoDesc: 'Описание' });
    assert.equal(r.status, 303);
    const slug = store.c.posts.at(-1).slug;
    assert.equal(slug, 'pervaya-statya');
    const page = (await visitor('GET', `/blog/${slug}/`)).text;
    assert.match(page, /Текст про щенка/);
    assert.match(page, /rutube\.ru\/play\/embed/);
    // черновик не виден посетителю, но виден админу
    await admin('POST', `/admin/posts/${slug}`, { title: 'Первая статья', body: 'x', date: '2026-01-01' });
    assert.equal(store.post(slug).published, false);
    assert.equal((await visitor('GET', `/blog/${slug}/`)).status, 404);
    assert.equal((await admin('GET', `/blog/${slug}/`)).status, 200);
    assert.doesNotMatch((await visitor('GET', '/blog/')).text, /Первая статья/);
    // загрузка: png проходит, скрипт под видом картинки нет
    const upload = (buf, cookie) => new Promise((resolve, reject) => {
      const q = http.request({ port, path: '/admin/upload', method: 'POST', headers: { cookie, 'Content-Type': 'application/octet-stream', 'Content-Length': buf.length } }, res => { let t = ''; res.on('data', x => t += x); res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(t) })); });
      q.on('error', reject); q.end(buf);
    });
    const login = await new Promise(resolve => { const q = http.request({ port, path: '/admin/login', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, res => resolve(res.headers['set-cookie'].map(x => x.split(';')[0]).join('; '))); q.end('password=adm'); });
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
    const ok = await upload(png, login);
    assert.equal(ok.status, 200);
    assert.match(ok.json.url, /^\/uploads\/[a-f0-9]{20}\.png$/);
    const got = await visitor('GET', ok.json.url);
    assert.equal(got.status, 200);
    const bad = await upload(Buffer.from('<script>alert(1)</script>'.repeat(5)), login);
    assert.equal(bad.status, 400);
    assert.equal((await upload(png, '')).status, 403);
    assert.equal((await visitor('GET', '/uploads/../server.js')).status, 404);
    // ссылка на фото принимается только на свой файл или https
    assert.equal(require('../lib/media').imageUrl('javascript:alert(1)'), '');
    assert.equal(require('../lib/media').imageUrl(ok.json.url), ok.json.url);
  } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('все иконки и обложки из контента существуют', () => {
  const V = require('../lib/visuals');
  const f = require('../src/pages').files();
  for (const i of f.solutions.items) { assert.ok(V.ICONS[i.icon], i.slug); assert.ok(V.COVERS[i.cover], i.slug); assert.ok(V.ACCENTS[i.accent], i.slug); }
  for (const s of f.services.items) { assert.ok(V.ICONS[s.icon], s.id); assert.ok(V.ACCENTS[s.accent], s.id); }
  for (const s of f.site.steps) assert.ok(V.ICONS[s.icon]);
  for (const s of f.solutions.base.partnerFlow) assert.ok(V.ICONS[s.icon]);
});

test('админка: добавление объекта, фильтры, статус «продано» и комиссия в заказе', async () => {
  const { server, store } = createApp({ dataFile: null, config: { port: 0, adminPassword: 'adm', secret: 's' } });
  await new Promise(r => server.listen(0, r));
  const c = client(server.address().port);
  try {
    await c('POST', '/admin/login', { password: 'adm' });
    let r = await c('POST', '/admin/solutions/new', { title: 'Тест 3-к', deal: 'sale', status: 'active', price: '12 000 000', rooms: '3', area: '75,5', district: 'Московский', commission: '2', photos: 'https://a.ru/1.jpg | Кухня' });
    assert.equal(r.status, 303);
    const it = store.c.solutions.at(-1);
    assert.equal(it.slug, 'test-3-k');
    assert.equal(it.price, 1200000000);
    assert.equal(it.area, 75.5);
    assert.equal(it.photos[0].alt, 'Кухня');
    assert.match((await c('GET', '/objects/test-3-k/')).text, /a\.ru\/1\.jpg/);
    assert.equal((await c('POST', '/admin/solutions/test-3-k', { title: 'Тест 3-к', price: 'abc' })).status, 400);
    assert.equal(require('../src/pages').commissionOf(it), 240000);
    assert.equal(require('../src/pages').commissionOf({ price: 4500000, deal: 'rent', commission: 50 }), 22500);
    await c('POST', '/admin/solutions/test-3-k', { title: 'Тест 3-к', deal: 'sale', status: 'sold', price: '12000000' });
    assert.match((await c('GET', '/objects/')).text, /Продано/);
  } finally { server.close(); }
});
