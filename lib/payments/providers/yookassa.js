'use strict';
// ЮKassa (API v3). Сверено с https://yookassa.ru/developers 04.11.2026.
// Уведомления в ЮKassa не подписываются: подлинность проверяем запросом статуса платежа в API.
// В кабинете: Интеграция → HTTP-уведомления, события payment.succeeded, payment.canceled, refund.succeeded.
const { money, kopFrom, basic, cut } = require('../util');
const R = require('../receipt');
const API = 'https://api.yookassa.ru/v3';

const auth = cfg => ({ Authorization: basic(cfg.shopId, cfg.secretKey) });

module.exports = {
  id: 'yookassa',
  title: 'Банковская карта, СБП, SberPay (ЮKassa)',
  methods: [{ id: 'card', title: 'Банковская карта' }, { id: 'sbp', title: 'СБП' }],
  configured: cfg => !!(cfg && cfg.shopId && cfg.secretKey),
  supportsRefund: true,

  // Проверка ключей: запрос списка платежей (чтение). Неверный ключ даёт 401.
  async check({ cfg, http }) {
    const r = await http(`${API}/payments?limit=1`, { method: 'GET', headers: auth(cfg) });
    if (r.status === 200) return { ok: true, message: 'Подключение работает: ЮKassa приняла ключи.' };
    if (r.status === 401) return { ok: false, message: 'ЮKassa отклонила ключи: проверьте shopId и секретный ключ.' };
    return { ok: false, message: `ЮKassa ответила кодом ${r.status}. Повторите позже.` };
  },

  async init({ payment, method, description, customer, items, urls, cfg, receiptCfg, http }) {
    const body = {
      amount: { value: money(payment.amount), currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: urls.back },
      description: cut(description, 128),
      metadata: { payment_id: String(payment.id) },
    };
    if (method === 'sbp') body.payment_method_data = { type: 'sbp' };
    const receipt = R.yookassa(items, customer, receiptCfg);
    if (receipt) body.receipt = receipt;
    const r = await http(`${API}/payments`, { headers: { ...auth(cfg), 'Idempotence-Key': `pay-${payment.id}` }, json: body });
    if (r.status !== 200 || !r.json || !r.json.confirmation) throw new Error(`ЮKassa: ${r.json && r.json.description ? r.json.description : 'ошибка ' + r.status}`);
    return { url: r.json.confirmation.confirmation_url, externalId: r.json.id };
  },

  // Тело: {type:'notification', event, object:{id,status}}. Данные берём из API, а не из тела.
  async webhook({ req, cfg, http, findPaymentByExternalId }) {
    const ok = { ok: true, status: 200, reply: '' };
    const b = req.body || {};
    if (b.type !== 'notification' || !b.object || !b.object.id) return { ok: false, status: 400, reply: 'bad request' };
    const get = path => http(`${API}${path}`, { method: 'GET', headers: auth(cfg) });
    if (String(b.event).startsWith('payment.')) {
      const r = await get(`/payments/${encodeURIComponent(b.object.id)}`);
      if (r.status !== 200 || !r.json) return { ok: false, status: 500, reply: 'verify failed' };
      const p = r.json, pid = Number(p.metadata && p.metadata.payment_id);
      if (p.status === 'succeeded' && p.paid) return { ...ok, event: { type: 'paid', paymentId: pid, externalId: p.id, amount: kopFrom(p.amount.value) } };
      if (p.status === 'canceled') return { ...ok, event: { type: 'failed', paymentId: pid, externalId: p.id } };
      return { ...ok, event: { type: 'ignore' } };
    }
    if (b.event === 'refund.succeeded') {
      const r = await get(`/refunds/${encodeURIComponent(b.object.id)}`);
      if (r.status !== 200 || !r.json || r.json.status !== 'succeeded') return { ok: false, status: 500, reply: 'verify failed' };
      const pay = findPaymentByExternalId(r.json.payment_id);
      return { ...ok, event: pay ? { type: 'refunded', paymentId: pay.id, refundExternalId: r.json.id, amount: kopFrom(r.json.amount.value) } : { type: 'ignore' } };
    }
    return { ...ok, event: { type: 'ignore' } };
  },

  async refund({ payment, amount, cfg, http }) {
    const r = await http(`${API}/refunds`, { headers: { ...auth(cfg), 'Idempotence-Key': `refund-${payment.id}-${payment.refunded + amount}` }, json: { payment_id: payment.externalId, amount: { value: money(amount), currency: 'RUB' } } });
    if (r.status !== 200 || !r.json || r.json.status === 'canceled') throw new Error(`ЮKassa: возврат не выполнен (${r.json && r.json.description ? r.json.description : r.status})`);
    return { externalId: r.json.id };
  },
};
