'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { DB } = require('../lib/db');
const { Store } = require('../lib/store');
const { Payments } = require('../lib/payment-service');
const P = require('../lib/payments');
const U = require('../lib/payments/util');
const tbank = require('../lib/payments/providers/tbank');
const { createApp } = require('../server');
const PagesFiles = require('../src/pages').files;

const SECRET = 'unit-secret';
const md5 = s => crypto.createHash('md5').update(s).digest('hex');
const rub = x => x * 100;

function setup({ env = {}, httpMock } = {}) {
  const st = new Store(new DB(null));
  st.seedContent(PagesFiles());
  const calls = [];
  const httpFn = httpMock ? async (url, opt) => { calls.push({ url, ...opt }); return httpMock(url, opt); } : async () => { throw new Error('нет сети'); };
  const pay = new Payments({ store: st, secret: SECRET, http: httpFn, env });
  return { st, pay, calls };
}
function paidScenario(st, { code } = {}) {
  const a = st.registerPartner({ name: 'Анна Партнёр', phone: '+79001112233', email: 'a@t.ru', password: 'secret1', adult: 1, rules: 1, pd: 1 }).partner;
  const lead = st.addLead({ name: 'Клиент', contact: 'tg_client', code: code || a.code, consent: 1 }).lead;
  const { order } = st.createOrder(lead.id, [{ type: 'solution', title: 'Магазин', amount: rub(100000) }]);
  return { a, order };
}
function enableRobokassa(st, test = false) {
  st.setAdminPassword; // метод существует
  assert.deepEqual(st.saveProvider('robokassa', { login: 'shop', password1: 'p1', password2: 'p2', testPassword1: 't1', testPassword2: 't2', hash: 'md5', enabled: true, test }, SECRET), []);
  st.s.payments.testMode = false;
}

test('Т-Банк: Token = SHA-256 от значений полей по алфавиту вместе с паролем, вложенные объекты не входят', () => {
  const t = tbank.token({ TerminalKey: 'T', Amount: 100, OrderId: '1', Receipt: { Items: [] } }, 'P');
  assert.equal(t, crypto.createHash('sha256').update('1001PT').digest('hex'));
});

test('Робокасса: подпись формы и проверка ResultURL', async () => {
  const { st, pay } = setup();
  enableRobokassa(st);
  const { order } = paidScenario(st);
  const r = await pay.start(order, { provider: 'robokassa', siteUrl: 'https://site.test' });
  const f = r.form.fields;
  assert.equal(f.SignatureValue, md5(`shop:100000.00:1:p1`));
  assert.equal(f.IsTest, undefined);
  // уведомление с неверной подписью
  let w = await pay.webhook('robokassa', { query: {}, body: { OutSum: '100000.00', InvId: '1', SignatureValue: 'bad' }, headers: {}, raw: '' });
  assert.equal(w.status, 400);
  assert.equal(st.order(order.id).status, 'new');
  // неверная сумма
  w = await pay.webhook('robokassa', { query: {}, body: { OutSum: '10.00', InvId: '1', SignatureValue: md5('10.00:1:p2').toUpperCase() }, headers: {}, raw: '' });
  assert.equal(w.note, 'amount mismatch');
  assert.equal(st.order(order.id).status, 'new');
  assert.equal(st.d.accruals.length, 0);
});

test('Робокасса: верное уведомление отмечает заказ оплаченным и начисляет партнёру, повтор не дублирует', async () => {
  const { st, pay } = setup();
  enableRobokassa(st);
  const { order, a } = paidScenario(st);
  await pay.start(order, { provider: 'robokassa', siteUrl: 'https://site.test' });
  const ev = { query: {}, body: { OutSum: '100000.000000', InvId: '1', SignatureValue: md5('100000.000000:1:p2') }, headers: {}, raw: '' };
  const w = await pay.webhook('robokassa', ev);
  assert.equal(w.reply, 'OK1');
  assert.equal(st.order(order.id).status, 'paid');
  assert.equal(st.accrualsOf(a.id)[0].amount, rub(20000));
  const w2 = await pay.webhook('robokassa', ev);
  assert.equal(w2.note, 'duplicate');
  assert.equal(st.d.accruals.length, 1);
});

test('Робокасса: в тестовом режиме используются тестовые пароли и IsTest=1', async () => {
  const { st, pay } = setup();
  enableRobokassa(st, true);
  st.s.payments.testMode = true;
  const { order } = paidScenario(st);
  const r = await pay.start(order, { provider: 'robokassa', siteUrl: 'https://site.test' });
  assert.equal(r.form.fields.IsTest, '1');
  assert.equal(r.form.fields.SignatureValue, md5('shop:100000.00:1:t1'));
});

test('чек: Receipt входит в подпись Робокассы в URL-кодировании', async () => {
  const { st, pay } = setup();
  enableRobokassa(st);
  st.savePaymentCommon({ testMode: false, baseUrl: '', receiptMode: 'provider', taxation: 'usn_income', vat: 'none' });
  const { order } = paidScenario(st);
  const r = await pay.start(order, { provider: 'robokassa', email: 'c@t.ru', siteUrl: 'https://site.test' });
  const f = r.form.fields;
  assert.match(decodeURIComponent(f.Receipt), /"sno":"usn_income"/);
  assert.equal(f.SignatureValue, md5(`shop:100000.00:1:${f.Receipt}:p1`));
  await assert.rejects(() => pay.start(order, { provider: 'robokassa', siteUrl: 'https://site.test' }), /чек/);
});

test('ЮKassa: создание платежа и проверка уведомления запросом в API', async () => {
  const { st, pay, calls } = setup({ httpMock: async (url, opt) => {
    if (url.endsWith('/v3/payments') && opt.method !== 'GET') return { status: 200, json: { id: 'yk-1', confirmation: { confirmation_url: 'https://yoomoney.test/pay' } } };
    if (url.endsWith('/v3/payments/yk-1')) return { status: 200, json: { id: 'yk-1', status: 'succeeded', paid: true, amount: { value: '100000.00' }, metadata: { payment_id: '1' } } };
    if (url.endsWith('/v3/refunds')) return { status: 200, json: { id: 'rf-1', status: 'succeeded' } };
    return { status: 404, json: null };
  } });
  assert.deepEqual(st.saveProvider('yookassa', { shopId: '123', secretKey: 'live_secret_key', enabled: true }, SECRET), []);
  st.s.payments.testMode = false;
  const { order, a } = paidScenario(st);
  const r = await pay.start(order, { provider: 'yookassa', method: 'sbp', siteUrl: 'https://site.test' });
  assert.equal(r.url, 'https://yoomoney.test/pay');
  const c = calls[0];
  assert.equal(c.headers['Idempotence-Key'], 'pay-1');
  assert.equal(c.headers.Authorization, 'Basic ' + Buffer.from('123:live_secret_key').toString('base64'));
  assert.deepEqual(c.json.payment_method_data, { type: 'sbp' });
  assert.equal(c.json.amount.value, '100000.00');
  assert.equal(c.json.metadata.payment_id, '1');
  assert.equal(c.json.receipt, undefined);
  // подделка: в теле «успех», но API говорит иначе, чем мы ждём (платёж не найден) — заказ не оплачен
  let w = await pay.webhook('yookassa', { body: { type: 'notification', event: 'payment.succeeded', object: { id: 'fake' } }, headers: {}, query: {}, raw: '' });
  assert.equal(w.status, 500);
  assert.equal(st.order(order.id).status, 'new');
  // настоящее уведомление
  w = await pay.webhook('yookassa', { body: { type: 'notification', event: 'payment.succeeded', object: { id: 'yk-1' } }, headers: {}, query: {}, raw: '' });
  assert.equal(w.status, 200);
  assert.equal(st.order(order.id).status, 'paid');
  // возврат через API ЮKassa, начисления сторнируются
  assert.deepEqual(await pay.refund(st.order(order.id), rub(100000)), { ok: true });
  assert.equal(calls.at(-1).json.payment_id, 'yk-1');
  assert.equal(st.order(order.id).refunded, rub(100000));
  assert.equal(st.summary(a.id).hold, 0);
});

test('CloudPayments: уведомление принимается только с верным HMAC', async () => {
  const { st, pay } = setup({ httpMock: async () => ({ status: 200, json: { Success: true, Model: { Url: 'https://cp.test/o/1', Id: 'o1' } } }) });
  assert.deepEqual(st.saveProvider('cloudpayments', { publicId: 'pk', apiSecret: 'api-secret', enabled: true, verified: true }, SECRET), []);
  st.s.payments.testMode = false;
  const { order } = paidScenario(st);
  const r = await pay.start(order, { provider: 'cloudpayments', siteUrl: 'https://site.test' });
  assert.equal(r.url, 'https://cp.test/o/1');
  const raw = 'TransactionId=777&Amount=100000.00&InvoiceId=1&Status=Completed';
  const body = Object.fromEntries(new URLSearchParams(raw));
  let w = await pay.webhook('cloudpayments', { query: { event: 'pay' }, body, raw, headers: { 'x-content-hmac': 'wrong' } });
  assert.equal(w.status, 400);
  assert.equal(st.order(order.id).status, 'new');
  w = await pay.webhook('cloudpayments', { query: { event: 'pay' }, body, raw, headers: { 'x-content-hmac': U.hmacB64('api-secret', raw) } });
  assert.equal(w.reply, '{"code":0}');
  assert.equal(st.order(order.id).status, 'paid');
});

test('Т-Банк: уведомление с неверным Token отклоняется, с верным принимается', async () => {
  const { st, pay } = setup();
  assert.deepEqual(st.saveProvider('tbank', { terminalKey: 'TK', password: 'pw', enabled: true, verified: true }, SECRET), []);
  st.s.payments.testMode = false;
  const { order } = paidScenario(st);
  st.addPayment({ orderId: order.id, provider: 'tbank', method: 'card', amount: order.total });
  const n = { TerminalKey: 'TK', OrderId: '1', Success: true, Status: 'CONFIRMED', PaymentId: 55, Amount: order.total };
  let w = await pay.webhook('tbank', { body: { ...n, Token: 'bad' }, headers: {}, query: {}, raw: '' });
  assert.equal(w.status, 400);
  w = await pay.webhook('tbank', { body: { ...n, Token: tbank.token(n, 'pw') }, headers: {}, query: {}, raw: '' });
  assert.equal(w.reply, 'OK');
  assert.equal(st.order(order.id).status, 'paid');
});

test('Т-Банк и CloudPayments выключены, пока не поставлена отметка бета-режима', () => {
  const { st, pay } = setup();
  st.saveProvider('tbank', { terminalKey: 'TK', password: 'pw', enabled: true }, SECRET);
  assert.equal(pay.isEnabled('tbank'), false);
});

test('ключи шифруются в базе, в админке маскируются, пустое поле не затирает ключ', () => {
  const { st } = setup();
  st.saveProvider('yookassa', { shopId: '123', secretKey: 'live_SUPERSECRET', enabled: false }, SECRET);
  assert.ok(!JSON.stringify(st.d).includes('SUPERSECRET'));
  assert.equal(st.paymentsView(SECRET).providers.yookassa.secretKey, '••••••••CRET');
  st.saveProvider('yookassa', { shopId: '124', secretKey: '', enabled: false }, SECRET);
  assert.equal(st.paymentsConfig(SECRET).providers.yookassa.secretKey, 'live_SUPERSECRET');
  assert.equal(st.paymentsConfig(SECRET).providers.yookassa.shopId, '124');
  st.saveProvider('yookassa', { shopId: '124', secretKey: '••••••••CRET', enabled: false }, SECRET);
  assert.equal(st.paymentsConfig(SECRET).providers.yookassa.secretKey, 'live_SUPERSECRET');
});

test('включить провайдера без ключей нельзя; проверка подключения ЮKassa', async () => {
  const { st, pay } = setup({ httpMock: async (url, opt) => ({ status: opt.headers.Authorization.includes(Buffer.from('1:good').toString('base64')) ? 200 : 401, json: {} }) });
  assert.match(st.saveProvider('yookassa', { shopId: '', secretKey: '', enabled: true }, SECRET)[0], /заполните/);
  st.saveProvider('yookassa', { shopId: '1', secretKey: 'bad', enabled: false }, SECRET);
  assert.equal((await pay.check('yookassa')).ok, false);
  st.saveProvider('yookassa', { shopId: '1', secretKey: 'good', enabled: false }, SECRET);
  assert.equal((await pay.check('yookassa')).ok, true);
  assert.match((await pay.check('robokassa')).message, /Не заполнено/);
});

test('ключи из переменных окружения подхватываются без записи в базу', () => {
  const { pay } = setup({ env: { YOOKASSA_SHOP_ID: '9', YOOKASSA_SECRET_KEY: 'k' } });
  assert.equal(pay.settings.providers.yookassa.shopId, '9');
});

test('тестовый провайдер недоступен при выключенном тестовом режиме', async () => {
  const { st, pay } = setup();
  assert.equal(pay.isEnabled('test'), true);
  st.s.payments.testMode = false;
  assert.equal(pay.isEnabled('test'), false);
  assert.equal((await pay.webhook('test', { body: { paymentId: 1 }, headers: {}, query: {}, raw: '' })).status, 404);
});

// ---------- Сквозной сценарий через HTTP ----------
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

test('сквозной сценарий: настройка в админке, оплата по ссылке, начисление, возврат', async () => {
  const { server, store } = createApp({ dataFile: null, config: { port: 0, adminPassword: 'adm-pass', secret: 's3cret' }, env: {} });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  try {
    const admin = client(port), visitor = client(port), partner = client(port);
    await admin('POST', '/admin/login', { password: 'adm-pass' });
    // настройка из админки
    let r = await admin('POST', '/admin/site', { name: 'Иван Иванов', role: 'Разработчик', tagline: 'Быстро', domain: 'https://ivan.ru/', telegram: '@ivan_ivanov', email: 'bad' });
    assert.equal(r.status, 400);
    r = await admin('POST', '/admin/site', { name: 'Иван Иванов', role: 'Разработчик', tagline: 'Быстро', domain: 'https://ivan.ru/', telegram: '@ivan_ivanov', email: 'i@ivan.ru', inn: '123456789012', opName: 'Иван Иванов' });
    assert.equal(r.status, 303);
    assert.equal(store.c.site.domain, 'ivan.ru');
    assert.equal(store.c.site.contacts.telegram, 'ivan_ivanov');
    r = await admin('POST', '/admin/solutions/studiya-centr-nizhnee-ozero', { title: 'Магазин косметики', niche: 'Косметика', summary: 'Описание', price: '99 000', term: '7 дней', status: 'ready', demoUrl: 'https://demo.ru' });
    assert.equal(r.status, 303);
    assert.equal(store.c.solutions[0].price, 9900000);
    assert.match((await visitor('GET', '/objects/studiya-centr-nizhnee-ozero/')).text, /99\s000/);
    r = await admin('POST', '/admin/solutions/new', { title: 'Бот для заявок', price: '15000' });
    assert.equal(store.c.solutions.at(-1).slug, 'bot-dlya-zayavok');
    assert.match((await admin('GET', '/admin')).text, /Что осталось заполнить/);
    assert.match((await visitor('GET', '/robots.txt')).text, /Allow: \//);

    // партнёр и заявка по ссылке
    await partner('POST', '/partner/register', { name: 'Анна Партнёр', phone: '+7 900 111-22-33', email: 'a@t.ru', password: 'secret1', adult: '1', rules: '1', pd: '1' });
    const code = store.d.partners[0].code;
    await visitor('GET', '/?ref=' + code);
    await visitor('POST', '/contact', { name: 'Клиент', contact: 'tg_client', consent: '1' });
    await admin('POST', '/admin/leads/1/order', { use0: '1', type0: 'solution', title0: 'Магазин', amount0: '100000' });
    const o = store.order(1);
    assert.ok(o.token);

    // страница оплаты: нужен токен, тестовый режим включён по умолчанию
    assert.equal((await visitor('GET', `/pay/1/`)).status, 404);
    const pg = await visitor('GET', `/pay/1/?t=${o.token}`);
    assert.equal(pg.status, 200);
    assert.match(pg.text, /Тестовая оплата/);
    r = await visitor('POST', '/pay/1/start', { t: o.token, choice: 'test:test' });
    assert.equal(r.status, 303);
    assert.match(r.location, /\/pay\/test\/1\/$/);
    assert.equal(store.order(1).status, 'new');
    r = await visitor('POST', '/pay/test/1/confirm', {});
    assert.equal(r.status, 303);
    assert.equal(store.order(1).status, 'paid');
    assert.equal(store.d.accruals[0].amount, 2000000);
    await visitor('POST', '/pay/test/1/confirm', {});
    assert.equal(store.d.accruals.length, 1);

    // возврат через админку (тестовый провайдер)
    r = await admin('POST', '/admin/orders/1/refund', { amount: '50000' });
    assert.equal(r.status, 303);
    assert.equal(store.order(1).refunded, 5000000);
    assert.equal(store.d.accruals[0].storno, 1000000);

    // внешний вебхук без настройки провайдера
    r = await visitor('POST', '/pay/webhook/yookassa', {});
    assert.equal(r.status, 404);

    // смена пароля
    assert.equal((await admin('POST', '/admin/settings/password', { password: 'short' })).status, 400);
    assert.equal((await admin('POST', '/admin/settings/password', { password: 'new-long-pass' })).status, 303);
    assert.equal((await client(port)('POST', '/admin/login', { password: 'adm-pass' })).status, 400);
    assert.equal((await client(port)('POST', '/admin/login', { password: 'new-long-pass' })).status, 303);
  } finally { server.close(); }
});
