'use strict';
// CloudPayments (orders/create, уведомления Pay/Fail/Refund, payments/refund).
// ВНИМАНИЕ: разделы API на developers.cloudpayments.ru не удалось прочитать автоматически,
// реализовано по памяти и не сверено (подпись HMAC-SHA256 от тела запроса ключом «Пароль для API»,
// заголовки X-Content-HMAC и Content-HMAC, ответ {"code":0}). Провайдер включается флагом cfg.verified = true.
// В кабинете для каждого уведомления задать URL: <сайт>/pay/webhook/cloudpayments?event=pay | fail | refund
const { hmacB64, eqSafe, basic, cut } = require('../util');
const R = require('../receipt');
const API = 'https://api.cloudpayments.ru';

module.exports = {
  id: 'cloudpayments',
  title: 'Банковская карта (CloudPayments)',
  methods: [{ id: 'card', title: 'Банковская карта' }],
  configured: cfg => !!(cfg && cfg.publicId && cfg.apiSecret && cfg.verified === true),
  supportsRefund: true,

  async check({ cfg, http }) {
    const r = await http(`${API}/test`, { headers: { Authorization: basic(cfg.publicId, cfg.apiSecret) }, json: {} });
    if (r.json && r.json.Success) return { ok: true, message: 'Подключение работает: CloudPayments приняла данные.' };
    return { ok: false, message: 'CloudPayments не приняла данные: проверьте Public ID и пароль для API.' };
  },

  async init({ payment, description, customer, items, urls, cfg, receiptCfg, http }) {
    const body = { Amount: payment.amount / 100, Currency: 'RUB', Description: cut(description, 250), InvoiceId: String(payment.id), RequireConfirmation: false, SuccessRedirectUrl: urls.back, FailRedirectUrl: urls.back, CultureName: 'ru-RU' };
    if (customer.email) body.Email = customer.email;
    const rc = R.cloudpayments(items, customer, receiptCfg);
    if (rc) body.CloudPayments = { CustomerReceipt: rc };
    const r = await http(`${API}/orders/create`, { headers: { Authorization: basic(cfg.publicId, cfg.apiSecret) }, json: body });
    if (!r.json || !r.json.Success || !r.json.Model) throw new Error(`CloudPayments: ${r.json && r.json.Message || 'ошибка ' + r.status}`);
    return { url: r.json.Model.Url, externalId: String(r.json.Model.Id || '') };
  },

  async webhook({ req, cfg, getPayment }) {
    const sig = req.headers['x-content-hmac'] || req.headers['content-hmac'];
    if (!sig || !eqSafe(hmacB64(cfg.apiSecret, req.raw), sig)) return { ok: false, status: 400, reply: JSON.stringify({ code: 13 }) };
    const b = req.body || {};
    const pay = getPayment(Number(b.InvoiceId));
    if (!pay) return { ok: false, status: 200, reply: JSON.stringify({ code: 10 }) };
    const ok = { ok: true, status: 200, reply: JSON.stringify({ code: 0 }) };
    const ev = (req.query && req.query.event) || 'pay';
    if (ev === 'pay') return { ...ok, event: { type: 'paid', paymentId: pay.id, externalId: String(b.TransactionId), amount: Math.round(Number(b.Amount) * 100) } };
    if (ev === 'fail') return { ...ok, event: { type: 'failed', paymentId: pay.id } };
    if (ev === 'refund') return { ...ok, event: { type: 'refunded', paymentId: pay.id, refundExternalId: `${b.TransactionId}:${b.Amount}`, amount: Math.round(Number(b.Amount) * 100) } };
    return { ...ok, event: { type: 'ignore' } };
  },

  async refund({ payment, amount, cfg, http }) {
    const r = await http(`${API}/payments/refund`, { headers: { Authorization: basic(cfg.publicId, cfg.apiSecret) }, json: { TransactionId: Number(payment.externalId), Amount: amount / 100 } });
    if (!r.json || !r.json.Success) throw new Error(`CloudPayments: возврат не выполнен (${r.json && r.json.Message || r.status})`);
    return { externalId: `${payment.externalId}:${(payment.refunded + amount) / 100}` };
  },
};
