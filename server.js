'use strict';
// Сайт агента по недвижимости: витрина объектов, услуги, блог, заявки, партнёрская программа, админка.
// Запуск: npm start (или start.bat в Windows). Сторонние библиотеки не нужны.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { DB } = require('./lib/db');
const { Store } = require('./lib/store');
const P = require('./src/pages');
const A = Object.assign({}, require('./src/pages-app'), require('./src/pages-admin-service'));
const Media = require('./lib/media');
const Imp = require('./lib/import');
const SEO = require('./lib/seo');
const { Payments } = require('./lib/payment-service');

const ROOT = __dirname;
const CONFIG_FILE = process.env.CONFIG_FILE || path.join(ROOT, 'config.json');
const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };

function loadConfig() {
  let cfg = {};
  if (fs.existsSync(CONFIG_FILE)) cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  let changed = false;
  if (!cfg.port) { cfg.port = 3000; changed = true; }
  if (!cfg.adminPassword) { cfg.adminPassword = crypto.randomBytes(6).toString('hex'); cfg.adminPasswordIsNew = true; changed = true; }
  if (!cfg.secret) { cfg.secret = crypto.randomBytes(24).toString('hex'); changed = true; }
  if (changed && !process.env.CONFIG_FILE_READONLY) fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...cfg, adminPasswordIsNew: undefined }, null, 2));
  if (process.env.PORT) cfg.port = Number(process.env.PORT);
  if (process.env.ADMIN_PASSWORD) cfg.adminPassword = process.env.ADMIN_PASSWORD;
  if (process.env.SECRET) cfg.secret = process.env.SECRET; // на хостинге задаётся в переменных окружения, чтобы не терялся при пересоздании сервера
  if (process.env.HOST) cfg.host = process.env.HOST;
  return cfg;
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) { try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* пропустить */ } }
  }
  return out;
}
// Поля формы; у повторяющегося поля pick (выбор объектов при импорте) собираем список
function formData(raw) {
  const o = {};
  for (const [k, v] of new URLSearchParams(raw)) o[k] = k === 'pick' ? [].concat(o[k] || [], v) : v;
  return o;
}
function readBody(req, max = 1.5e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > max) { reject(new Error('too big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let data = {};
      try { data = String(req.headers['content-type'] || '').includes('json') ? JSON.parse(raw || '{}') : formData(raw); } catch { data = {}; }
      resolve({ raw, data });
    });
    req.on('error', reject);
  });
}
const num = v => { const n = Number(String(v || '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const toKop = v => Math.round(num(v) * 100);

// Простое ограничение попыток входа: 10 за 10 минут с одного адреса
function limiter() {
  const hits = new Map();
  return ip => {
    const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 600000);
    arr.push(now); hits.set(ip, arr);
    return arr.length <= 10;
  };
}

function createApp({ dataFile = process.env.DATA_FILE || path.join(ROOT, 'data', 'db.json'), config = loadConfig(), clock, httpClient, env } = {}) {
  const db = new DB(dataFile);
  const store = new Store(db, clock);
  store.seedContent(P.files());
  store.backfillContent(P.files());
  store.ensureService(P.files());
  const uploadsDir = path.join(path.dirname(dataFile || path.join(ROOT, 'data', 'db.json')), 'uploads');
  const pay = new Payments({ store, secret: config.secret, http: httpClient, env });
  const sign = v => v + '.' + crypto.createHmac('sha256', config.secret).update(v).digest('hex').slice(0, 32);
  const unsign = s => { if (!s) return null; const i = s.lastIndexOf('.'); const v = s.slice(0, i); return sign(v) === s ? v : null; };
  const tryLogin = limiter();
  const pending = new Map(); // подготовленные к импорту выгрузки: токен -> данные

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    let p = url.pathname;
    const q = Object.fromEntries(url.searchParams);
    const cookies = parseCookies(req);
    const setCookies = [];
    const secure = String(req.headers['x-forwarded-proto'] || '').startsWith('https') ? '; Secure' : '';
    const cookie = (name, value, days) => setCookies.push(`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}${days !== undefined ? '; Max-Age=' + Math.round(days * 86400) : ''}`);
    const baseHeaders = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' };
    const send = (code, body, type = 'text/html; charset=utf-8', extra = {}) => {
      res.writeHead(code, { ...baseHeaders, 'Content-Type': type, ...(code === 200 && type.startsWith('text/html') ? { 'Cache-Control': 'no-store' } : {}), ...(setCookies.length ? { 'Set-Cookie': setCookies } : {}), ...extra });
      res.end(body);
    };
    const redirect = to => { res.writeHead(303, { ...baseHeaders, Location: to, ...(setCookies.length ? { 'Set-Cookie': setCookies } : {}) }); res.end(); };
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

    // Статика
    if (p.startsWith('/assets/')) {
      const f = path.normalize(path.join(ROOT, p));
      if (f.startsWith(path.join(ROOT, 'assets') + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile()) return send(200, fs.readFileSync(f), MIME[path.extname(f)] || 'application/octet-stream', { 'Cache-Control': 'no-cache' });
      return send(404, 'Not found', 'text/plain');
    }

    const d = P.load(store);
    let m0;
    const open = !!d.site.domain; // пока домен не указан, сайт закрыт от индексации
    if (p === '/healthz') return send(200, 'ok', 'text/plain');
    if (String(req.headers['x-forwarded-proto'] || '').startsWith('https')) baseHeaders['Strict-Transport-Security'] = 'max-age=15552000';
    d.open = open;
    d.demo = (process.env.DEMO_MODE || '') === '1';
    d.demoUrl = process.env.DEMO_URL || 'https://artyushkin-site-demo.onrender.com';
    const origin0 = `${String(req.headers['x-forwarded-proto'] || 'http').split(',')[0]}://${req.headers.host}`;
    d.base = SEO.baseUrl(d.site, origin0);
    if (p === '/robots.txt') return send(200, open ? `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /partner\nDisallow: /pay/\nSitemap: ${d.base}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n', 'text/plain; charset=utf-8');
    if (p === '/sitemap.xml' && open) {
      const last = d.allPosts.map(x => x.updated || x.date).sort().pop();
      const entries = [['/', last], ['/objects/'], ['/services/'], ['/blog/', last], ['/about/'], ['/contact/'], ['/partners/'], ['/privacy/']]
        .concat(d.srv.items.map(i => ['/services/' + i.id + '/']), d.sol.items.map(i => ['/objects/' + i.slug + '/']), d.posts.map(x => ['/blog/' + x.slug + '/', x.updated || x.date]));
      if (d.cases.items.some(c => c.public)) entries.push(['/stories/']);
      return send(200, SEO.sitemap(d.base, entries), 'application/xml; charset=utf-8');
    }
    if ((m0 = p.match(/^\/uploads\/([\w.]+)$/))) {
      const f = Media.read(uploadsDir, m0[1]);
      return f ? send(200, f.body, f.type, { 'Cache-Control': 'public, max-age=2592000, immutable' }) : send(404, 'Not found', 'text/plain');
    }
    if (!open) baseHeaders['X-Robots-Tag'] = 'noindex, nofollow';

    // Реферальная ссылка ?ref=КОД
    let refCookie = cookies.ref || '';
    if (q.ref && store.partnerByCode(q.ref)) { refCookie = q.ref.trim().toUpperCase(); cookie('ref', refCookie, store.s.cookieDays); }

    const partnerId = unsign(cookies.ps);
    const partner = partnerId ? store.partner(partnerId) : null;
    const isAdmin = unsign(cookies.as) === 'admin';
    const origin = `${String(req.headers['x-forwarded-proto'] || 'http').split(',')[0]}://${req.headers.host}`;
    let m;
    const ctx = { store, settings: store.s, partner: partner && !partner.blocked ? partner : null, refCookie, origin, pay, secret: config.secret, get missing() { return P.missing(d, store, { available: pay.available(), testMode: pay.settings.testMode, baseUrl: pay.settings.baseUrl }); } };
    // Загрузка фото из админки: тело запроса — сам файл, до 6 МБ
    if (req.method === 'POST' && p === '/admin/upload') {
      if (!isAdmin) return send(403, JSON.stringify({ error: 'Войдите в админку' }), 'application/json');
      const chunks = []; let size = 0, tooBig = false;
      await new Promise(resolve => { req.on('data', c => { size += c.length; if (size > Media.MAX + 1024) { tooBig = true; } else chunks.push(c); }); req.on('end', resolve); req.on('error', resolve); });
      if (tooBig) return send(413, JSON.stringify({ error: 'Файл больше 6 МБ. Уменьшите фото' }), 'application/json');
      const r = Media.save(uploadsDir, Buffer.concat(chunks));
      return send(r.error ? 400 : 200, JSON.stringify(r), 'application/json');
    }
    const parsed = req.method === 'POST' ? await readBody(req, p.startsWith('/admin/import') ? 9e6 : undefined).catch(() => null) : { raw: '', data: {} };
    if (!parsed) return send(413, 'Слишком большой запрос', 'text/plain; charset=utf-8');
    const body = parsed.data;

    // Вебхуки провайдеров: подлинность проверяет модуль оплаты (подпись или запрос статуса в API)
    if ((m = p.match(/^\/pay\/webhook\/(\w+)$/))) {
      const r = await pay.webhook(m[1], { method: req.method, headers: req.headers, query: q, body, raw: parsed.raw });
      return send(r.status, r.reply, String(r.reply).startsWith('{') ? 'application/json' : 'text/plain; charset=utf-8');
    }
    const page = html => send(200, html);
    const notFound = () => send(404, P.notFound(d));
    if (req.method === 'GET' && p.length > 1 && !p.endsWith('/') && !path.extname(p) && !/^\/(partner|admin)(\/|$)/.test(p)) return redirect(p + '/' + (url.search || ''));
    if (p.length > 1 && p.endsWith('/') && /^\/(partner|admin)\//.test(p)) p = p.replace(/\/+$/, '');
    if (req.method === 'GET') {
      if (p === '/') return page(P.home(d));
      if (p === '/objects/') return page(P.objectsPage(d, q));
      if ((m = p.match(/^\/objects\/([\w-]+)\/$/))) { const i = d.sol.items.find(x => x.slug === m[1]); return i ? page(P.objectPage(d, i)) : notFound(); }
      if ((m = p.match(/^\/courses\/([\w-]*)\/?$/))) return redirect('/objects/' + (m[1] ? m[1] + '/' : ''));
      if ((m = p.match(/^\/services\/([\w-]+)\/$/))) { const i = d.srv.items.find(x => x.id === m[1]); return i ? page(P.servicePage(d, i)) : notFound(); }
      if (p === '/blog/') return page(P.blogPage(d));
      if ((m = p.match(/^\/blog\/([\w-]+)\/$/))) { const i = d.posts.find(x => x.slug === m[1]) || (isAdmin ? d.allPosts.find(x => x.slug === m[1]) : null); return i ? page(P.postPage(d, i)) : notFound(); }
      if (p === '/stories/') return page(P.storiesPage(d));
      if (p === '/solutions/' || p === '/cases/') return redirect(p === '/cases/' ? '/stories/' : '/objects/');
      if (p === '/services/') return page(P.servicesPage(d));
      if (p === '/about/') return page(P.aboutPage(d));
      if (p === '/contact/') return page(P.contactPage(d, { s: q.s, ref: refCookie }));
      if (p === '/privacy/') return page(P.privacyPage(d));
      if (p === '/partners/') return page(A.partnersLanding(d, ctx));
      if (p === '/docs/rules/') return page(A.rulesPage(d, ctx));
      if (p === '/partner/register') return page(A.register(d, ctx));
      if (p === '/partner/login') return page(A.login(d));
    }

    if (req.method === 'POST' && p === '/contact') {
      const r = store.addLead({ ...body, cookieCode: refCookie, ip });
      if (r.errors) return send(400, P.contactPage(d, { errs: r.errors, form: body, ref: refCookie }));
      return page(P.thanksPage(d, r.lead));
    }

    // ---------- Оплата заказа ----------
    if ((m = p.match(/^\/pay\/test\/(\d+)\/$/))) {
      const pm = store.payment(m[1]);
      if (!pm || !pay.settings.testMode || pm.provider !== 'test') return notFound();
      if (req.method === 'GET') return page(A.payTest(d, ctx, pm));
    }
    if ((m = p.match(/^\/pay\/test\/(\d+)\/confirm$/)) && req.method === 'POST') {
      const pm = store.payment(m[1]);
      if (!pm || !pay.settings.testMode || pm.provider !== 'test') return notFound();
      await pay.webhook('test', { method: 'POST', headers: req.headers, query: {}, body: { paymentId: pm.id }, raw: '' });
      const o = store.order(pm.orderId);
      return redirect(`/pay/${o.id}/?t=${o.token}&return=1`);
    }
    if ((m = p.match(/^\/pay\/(\d+)\/$/)) && req.method === 'GET') {
      const o = store.order(m[1]);
      return o && o.token && o.token === q.t ? page(A.payPage(d, ctx, o, { returned: !!q.return })) : notFound();
    }
    if ((m = p.match(/^\/pay\/(\d+)\/start$/)) && req.method === 'POST') {
      const o = store.order(m[1]);
      if (!o || !o.token || o.token !== body.t) return notFound();
      const [provider, method] = String(body.choice || '').split(':');
      try {
        const r = await pay.start(o, { provider, method, email: body.email, phone: body.phone, siteUrl: origin });
        return r.form ? send(200, A.payRedirect(d, r.form)) : redirect(r.url);
      } catch (e) { return send(400, A.payPage(d, ctx, o, { errs: [e.message], form: body })); }
    }

    // ---------- Партнёр ----------
    if (p === '/partner/register' && req.method === 'POST') {
      const r = store.registerPartner({ ...body, sponsorCode: body.sponsorCode || refCookie });
      if (r.errors) return send(400, A.register(d, ctx, body, r.errors));
      cookie('ps', sign(String(r.partner.id)), 30);
      return redirect('/partner');
    }
    if (p === '/partner/login' && req.method === 'POST') {
      if (!tryLogin(ip)) return send(429, A.login(d, ['Слишком много попыток. Подождите 10 минут.']));
      const u = store.loginPartner(body.email, body.password);
      if (!u) return send(400, A.login(d, ['Неверный e-mail или пароль']));
      cookie('ps', sign(String(u.id)), 30);
      return redirect('/partner');
    }
    if (p === '/partner/logout' && req.method === 'POST') { cookie('ps', '', 0); return redirect('/partners/'); }
    if (p === '/partner' || p.startsWith('/partner/')) {
      if (!ctx.partner) return redirect('/partner/login');
      if (req.method === 'GET') {
        if (p === '/partner') return page(A.cabDashboard(d, ctx, q.msg));
        if (p === '/partner/tree') return page(A.cabTree(d, ctx));
        if (p === '/partner/accruals') return page(A.cabAccruals(d, ctx));
        if (p === '/partner/payout') return page(A.cabPayout(d, ctx, q.msg));
        if (p === '/partner/materials') return page(A.cabMaterials(d, ctx));
        if (p === '/partner/report.csv') return send(200, A.accrualsCsv(ctx), 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="accruals.csv"' });
      } else {
        if (p === '/partner/payout/details') { const e = store.savePayoutDetails(ctx.partner.id, body); return e ? send(400, A.cabPayout(d, ctx, '', [e])) : redirect('/partner/payout?msg=' + encodeURIComponent('Реквизиты сохранены')); }
        if (p === '/partner/payout/request') { const e = store.requestPayout(ctx.partner.id); return e ? send(400, A.cabPayout(d, ctx, '', [e])) : redirect('/partner/payout?msg=' + encodeURIComponent('Заявка на выплату принята')); }
      }
      return notFound();
    }

    // ---------- Админка ----------
    if (p === '/admin/login' && req.method === 'POST') {
      if (!tryLogin(ip)) return send(429, A.adminLogin(d, ['Слишком много попыток. Подождите 10 минут.']));
      if (!store.checkAdminPassword(body.password || '', config.adminPassword)) return send(400, A.adminLogin(d, ['Неверный пароль']));
      cookie('as', sign('admin'), 1);
      return redirect('/admin');
    }
    if (p === '/admin' || p.startsWith('/admin/')) {
      if (!isAdmin) return page(A.adminLogin(d));
      if (req.method === 'GET') {
        if (p === '/admin') return page(A.adminDash(d, ctx, q.msg));
        if (p === '/admin/leads') return page(A.adminLeads(d, ctx));
        if ((m = p.match(/^\/admin\/leads\/(\d+)$/))) { const l = store.lead(m[1]); return l ? page(A.adminLead(d, ctx, l)) : notFound(); }
        if (p === '/admin/orders') return page(A.adminOrders(d, ctx));
        if ((m = p.match(/^\/admin\/orders\/(\d+)$/))) { const o = store.order(m[1]); return o ? page(A.adminOrder(d, ctx, o, q.msg)) : notFound(); }
        if (p === '/admin/partners') return page(A.adminPartners(d, ctx));
        if (p === '/admin/payouts') return page(A.adminPayouts(d, ctx, q.msg));
        if (p === '/admin/payouts.csv') return send(200, A.payoutsCsv(ctx), 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="payouts.csv"' });
        if (p === '/admin/settings') return page(A.adminSettings(d, ctx, q.msg));
        if (p === '/admin/log') return page(A.adminLog(d, ctx));
        if (p === '/admin/site') return page(A.adminSite(d, ctx, q.msg));
        if (p === '/admin/solutions') return page(A.adminSolutions(d, ctx, q.msg));
        if (p === '/admin/services') return page(A.adminServices(d, ctx, q.msg));
        if (p === '/admin/cases') return page(A.adminCases(d, ctx, q.msg));
        if (p === '/admin/posts') return page(A.adminPosts(d, ctx, q.msg));
        if (p === '/admin/import') return page(A.adminImport(d, ctx, q.msg));
        if (p === '/admin/media') return page(A.adminMedia(d, ctx, q.msg, Media.list(uploadsDir)));
        if (p === '/admin/payments') return page(A.adminPayments(d, ctx, q.msg));
        return notFound();
      }
      if (p === '/admin/import/preview') {
        try {
          const r = await Imp.prepare(body);
          for (const [k, v] of pending) if (Date.now() - v.at > 1800000) pending.delete(k);
          const token = crypto.randomBytes(12).toString('hex');
          pending.set(token, { at: Date.now(), items: r.items });
          const known = new Set(store.c.solutions.filter(x => x.source && x.source.type === 'avito').map(x => x.source.id));
          return page(A.adminImport(d, ctx, '', [], { token, items: r.items, warnings: r.warnings, known, photos: body.photos === '1' }));
        } catch (e) { return send(400, A.adminImport(d, ctx, '', [e.message])); }
      }
      if (p === '/admin/import/apply') {
        const job = pending.get(body.token);
        if (!job) return send(400, A.adminImport(d, ctx, '', ['Срок подготовки истёк, загрузите файл заново']));
        pending.delete(body.token);
        const pick = new Set([].concat(body.pick || []));
        const items = job.items.filter(i => pick.has(i.sid));
        if (!items.length) return send(400, A.adminImport(d, ctx, '', ['Ничего не выбрано']));
        const r = await Imp.apply(store, items, { uploadsDir, photos: body.photos === '1' });
        return redirect('/admin/solutions?msg=' + encodeURIComponent(`Импорт готов: новых ${r.created}, обновлено ${r.updated}` + (body.photos === '1' ? `, фото загружено ${r.photosOk}, не удалось ${r.photosFail}` : '')));
      }
      if (p === '/admin/logout') { cookie('as', '', 0); return redirect('/'); }
      if ((m = p.match(/^\/admin\/leads\/(\d+)\/close$/))) { const l = store.lead(m[1]); if (l) { l.status = 'lost'; store.log('admin', 'заявка закрыта', '№' + l.id); store.save(); } return redirect('/admin/leads'); }
      if ((m = p.match(/^\/admin\/leads\/(\d+)\/order$/))) {
        const l = store.lead(m[1]); if (!l) return notFound();
        const items = [];
        for (let i = 0; body['title' + i] !== undefined; i++) if (body['use' + i]) items.push({ type: body['type' + i], title: body['title' + i], amount: toKop(body['amount' + i]) });
        const r = store.createOrder(l.id, items);
        return r.error ? send(400, A.adminLead(d, ctx, l, [r.error])) : redirect('/admin/orders/' + r.order.id);
      }
      if ((m = p.match(/^\/admin\/orders\/(\d+)\/(pay|done|cancel|refund)$/))) {
        const o = store.order(m[1]); if (!o) return notFound();
        const act = m[2];
        let e, note = 'Готово';
        if (act === 'refund') {
          const amt = toKop(body.amount);
          if (!(amt > 0)) e = 'Введите сумму возврата';
          else {
            const r = await pay.refund(o, amt);
            if (r.error) e = r.error;
            else if (r.manual) { e = store.refund(o.id, amt); note = `Возврат записан, начисления пересчитаны. Деньги покупателю верните вручную: ${r.reason}.`; }
            else note = 'Деньги возвращены через платёжный сервис, начисления пересчитаны.';
          }
        } else e = act === 'pay' ? store.markPaid(o.id) : act === 'done' ? store.markDone(o.id) : store.cancelOrder(o.id);
        return e ? send(400, A.adminOrder(d, ctx, o, '', [e])) : redirect(`/admin/orders/${o.id}?msg=` + encodeURIComponent(note));
      }
      if ((m = p.match(/^\/admin\/partners\/(\d+)\/block$/))) { const pr = store.partner(m[1]); if (pr) { pr.blocked = !pr.blocked; store.log('admin', pr.blocked ? 'партнёр заблокирован' : 'партнёр разблокирован', pr.name); store.save(); } return redirect('/admin/partners'); }
      if ((m = p.match(/^\/admin\/payouts\/(\d+)\/(paid|reject)$/))) { const e = store.resolvePayout(m[1], m[2] === 'paid'); return redirect('/admin/payouts?msg=' + encodeURIComponent(e || 'Готово')); }
      const back = (page, errs, msg) => errs && errs.length ? send(400, A[{ site: 'adminSite', solutions: 'adminSolutions', services: 'adminServices', cases: 'adminCases', posts: 'adminPosts', payments: 'adminPayments' }[page]](d, ctx, '', errs)) : redirect(`/admin/${page}?msg=` + encodeURIComponent(msg || 'Сохранено'));
      if (p === '/admin/site') return back('site', store.saveSite(body));
      if ((m = p.match(/^\/admin\/posts\/([\w-]+)(\/delete)?$/))) { if (m[2]) { store.deletePost(m[1]); return back('posts', [], 'Статья удалена'); } return back('posts', store.savePost(m[1] === 'new' ? '' : m[1], body)); }
      if ((m = p.match(/^\/admin\/media\/([\w.]+)\/delete$/))) { Media.remove(uploadsDir, m[1]); return redirect('/admin/media?msg=' + encodeURIComponent('Файл удалён')); }
      if ((m = p.match(/^\/admin\/solutions\/([\w-]+)(\/delete)?$/))) { if (m[2]) { store.deleteSolution(m[1]); return back('solutions', [], 'Удалено'); } return back('solutions', store.saveSolution(m[1] === 'new' ? '' : m[1], body)); }
      if ((m = p.match(/^\/admin\/services\/([\w-]+)(\/delete)?$/))) { if (m[2]) { store.deleteService(m[1]); return back('services', [], 'Удалено'); } return back('services', store.saveService(m[1] === 'new' ? '' : m[1], body)); }
      if ((m = p.match(/^\/admin\/cases\/([\w-]+)(\/delete)?$/))) { if (m[2]) { store.deleteCase(m[1]); return back('cases', [], 'Удалено'); } return back('cases', store.saveCase(m[1] === 'new' ? '' : m[1], body)); }
      if (p === '/admin/payments/common') return back('payments', store.savePaymentCommon({ ...body, testMode: body.testMode === '1' }));
      if ((m = p.match(/^\/admin\/payments\/(\w+)\/check$/))) {
        const r = await pay.check(m[1]);
        return send(200, A.adminPayments(d, ctx, '', [], { id: m[1], ...r }));
      }
      if ((m = p.match(/^\/admin\/payments\/(\w+)$/))) return back('payments', store.saveProvider(m[1], { ...body, enabled: body.enabled === '1', verified: body.verified === '1', test: body.test === '1' }, config.secret));
      if (p === '/admin/settings/password') { const e = store.setAdminPassword(body.password); return e ? send(400, A.adminSettings(d, ctx, '', [e])) : redirect('/admin/settings?msg=' + encodeURIComponent('Пароль изменён')); }
      if (p === '/admin/settings/rates') { const e = store.setRates(body.type, body.l1, body.l2, body.l3); return e ? send(400, A.adminSettings(d, ctx, '', [e])) : redirect('/admin/settings?msg=' + encodeURIComponent('Ставки сохранены')); }
      if (p === '/admin/settings/terms') {
        const h = num(body.holdDays), mp = num(body.minPayout), c = num(body.cookieDays);
        if (![h, mp, c].every(x => Number.isFinite(x) && x >= 0)) return send(400, A.adminSettings(d, ctx, '', ['Введите числа']));
        Object.assign(store.s, { holdDays: Math.round(h), minPayout: Math.round(mp * 100), cookieDays: Math.round(c) });
        store.log('admin', 'сроки изменены', `${h}/${mp}/${c}`); store.save();
        return redirect('/admin/settings?msg=' + encodeURIComponent('Сохранено'));
      }
      return notFound();
    }
    return notFound();
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch(err => {
      console.error(err);
      if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Ошибка сервера'); }
    });
  });
  return { server, store, config };
}

module.exports = { createApp, loadConfig };

if (require.main === module) {
  const { server, config } = createApp();
  server.listen(config.port, config.host || '0.0.0.0', () => {
    console.log(`Сайт запущен: http://localhost:${config.port}`);
    console.log(`Админка: http://localhost:${config.port}/admin`);
    console.log(config.adminPasswordIsNew ? `Пароль админки (создан при первом запуске, сохранён в config.json): ${config.adminPassword}` : 'Пароль админки лежит в файле config.json');
  });
}
