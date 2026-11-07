'use strict';
// Т-Банк, интернет-эквайринг (Init, уведомления, Cancel).
// ВНИМАНИЕ: страницы документации developer.tbank.ru закрыты для автоматического чтения,
// формат и алгоритм Token реализованы по памяти и не сверены. Перед боевым запуском
// сверить с документацией и прогнать платёж на тестовом терминале. Провайдер включается флагом cfg.verified = true.
const { hash, eqSafe } = require('../util');
const R = require('../receipt');
const API = 'https://securepay.tinkoff.ru/v2';

// Token: значения корневых скалярных полей вместе с Password, отсортированные по имени поля, склеены, SHA-256.
// Вложенные объекты (Receipt, DATA) в подпись не входят.
function token(params, password) {
  const all = { ...params, Password: password };
  delete all.Token;
  return hash('sha256', Object.keys(all).filter(k => all[k] !== null && typeof all[k] !== 'object').sort().map(k => String(all[k])).join(''));
}

module.exports = {
  id: 'tbank',
  title: 'Банковская карта (Т-Банк)',
  methods: [{ id: 'card', title: 'Банковская карта' }],
  configured: cfg => !!(cfg && cfg.terminalKey && cfg.password && cfg.verified === true),
  supportsRefund: true,
  token,

  async init({ payment, description, customer, items, urls, cfg, receiptCfg, http }) {
    const body = { TerminalKey: cfg.terminalKey, Amount: payment.amount, OrderId: String(payment.id), Description: String(description).slice(0, 140), SuccessURL: urls.back, FailURL: urls.back, NotificationURL: urls.notify };
    const rc = R.tbank(items, customer, receiptCfg);
    if (rc) body.Receipt = rc;
    body.Token = token(body, cfg.password);
    const r = await http(`${API}/Init`, { json: body });
    if (!r.json || !r.json.Success) throw new Error(`Т-Банк: ${r.json && (r.json.Details || r.json.Message) || 'ошибка ' + r.status}`);
    return { url: r.json.PaymentURL, externalId: String(r.json.PaymentId) };
  },

  async webhook({ req, cfg, getPayment }) {
    const b = req.body || {};
    if (!b.Token || !b.OrderId) return { ok: false, status: 400, reply: 'bad request' };
    if (!eqSafe(token(b, cfg.password), b.Token)) return { ok: false, status: 400, reply: 'bad token' };
    const pay = getPayment(Number(b.OrderId));
    if (!pay) return { ok: false, status: 400, reply: 'unknown order' };
    const ok = { ok: true, status: 200, reply: 'OK' };
    if (b.Status === 'CONFIRMED') return { ...ok, event: { type: 'paid', paymentId: pay.id, externalId: String(b.PaymentId), amount: Number(b.Amount) } };
    if (['REJECTED', 'CANCELED', 'DEADLINE_EXPIRED', 'AUTH_FAIL'].includes(b.Status)) return { ...ok, event: { type: 'failed', paymentId: pay.id } };
    if (['REFUNDED', 'PARTIAL_REFUNDED'].includes(b.Status)) return { ...ok, event: { type: 'refunded', paymentId: pay.id, refundExternalId: `${b.PaymentId}:${b.Amount}`, amount: Number(b.Amount) } };
    return { ...ok, event: { type: 'ignore' } };
  },

  async refund({ payment, amount, cfg, http }) {
    const body = { TerminalKey: cfg.terminalKey, PaymentId: payment.externalId, Amount: amount };
    body.Token = token(body, cfg.password);
    const r = await http(`${API}/Cancel`, { json: body });
    if (!r.json || !r.json.Success) throw new Error(`Т-Банк: возврат не выполнен (${r.json && (r.json.Details || r.json.Message) || r.status})`);
    return { externalId: `${payment.externalId}:${payment.refunded + amount}` };
  },
};
