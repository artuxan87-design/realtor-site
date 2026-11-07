'use strict';
// Связка платёжного модуля с магазином: платежи, вебхуки, возвраты, начисления партнёрам.
// Деньги засчитываются только по подтверждённому событию провайдера (подпись или запрос статуса в API).
// Начисление партнёрам делает store.markPaid, поэтому проценты идут только с оплаченных заказов.
const P = require('./payments');
const { http: defaultHttp } = require('./payments/util');

class Payments {
  // Настройки читаются из базы при каждом обращении: изменения в админке действуют сразу.
  constructor({ store, secret, http = defaultHttp, env = process.env }) {
    this.store = store; this.http = http; this.secret = secret; this.env = env;
  }
  get settings() { return P.resolve({ payments: this.store.paymentsConfig(this.secret) }, this.env); }

  available() { return P.available(this.settings); }
  isEnabled(id) { return P.isEnabled(id, this.settings); }
  providerConfig(id) { return this.settings.providers[id]; }

  // Кнопка «Проверить подключение» в админке
  async check(id) {
    const pr = P.providers[id], cfg = this.providerConfig(id);
    if (!pr || id === 'test') return { ok: false, message: 'Для этого способа проверка не нужна.' };
    const fields = require('./payments/fields')[id].fields.filter(f => !f.options && !(f.key.startsWith('test') && !cfg.test));
    const miss = fields.filter(f => !cfg[f.key]).map(f => f.label);
    if (miss.length) return { ok: false, message: 'Не заполнено: ' + miss.join(', ') };
    if (!pr.check) return { ok: true, message: 'Поля заполнены. Банк не позволяет проверить ключи без платежа: сделайте тестовый платёж.' };
    try { return await pr.check({ cfg, http: this.http }); } catch (e) { return { ok: false, message: 'Нет связи с провайдером: ' + String(e.message).slice(0, 100) }; }
  }

  // Создать платёж по заказу и получить, куда отправить покупателя: {url} или {form}
  async start(order, { provider, method, email, phone, siteUrl }) {
    const st = this.store;
    if (order.status !== 'new') throw new Error('Заказ уже оплачен или отменён');
    if (!this.isEnabled(provider)) throw new Error('Этот способ оплаты не подключён');
    const pr = P.providers[provider];
    email = String(email || '').trim(); phone = String(phone || '').replace(/[^\d+]/g, '');
    if (this.settings.receipt.mode === 'provider' && provider !== 'test') {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && phone.replace(/\D/g, '').length < 10) throw new Error('Укажите e-mail или телефон, чтобы получить чек');
    }
    const site = (this.settings.baseUrl || siteUrl).replace(/\/+$/, '');
    const payment = st.addPayment({ orderId: order.id, provider, method: method || pr.methods[0].id, amount: order.total, email, phone });
    const urls = { site, back: `${site}/pay/${order.id}/?t=${order.token}&return=1`, notify: `${site}/pay/webhook/${provider}` };
    try {
      const res = await pr.init({ payment, method: payment.method, description: `Заказ №${order.id}`, customer: { email, phone }, items: order.items.map(i => ({ name: i.title, amount: i.amount })), urls, cfg: this.providerConfig(provider), receiptCfg: this.settings.receipt, http: this.http });
      payment.externalId = res.externalId || '';
      st.save();
      return res;
    } catch (e) {
      payment.status = 'failed'; payment.error = String(e.message).slice(0, 300);
      st.log('payments', 'ошибка создания платежа', `№${payment.id}, ${provider}: ${payment.error}`); st.save();
      throw e;
    }
  }

  // Вход вебхука: req = {method, headers, query, body, raw}. Возвращает {status, reply}.
  async webhook(providerId, req) {
    const pr = P.providers[providerId];
    if (!pr || !this.isEnabled(providerId)) return { status: 404, reply: 'not found' };
    if (providerId === 'test' && !this.settings.testMode) return { status: 404, reply: 'not found' };
    let r;
    try {
      r = await pr.webhook({ req, cfg: this.providerConfig(providerId), http: this.http, getPayment: id => this.store.payment(id), findPaymentByExternalId: x => this.store.d.payments.find(p => p.provider === providerId && p.externalId === x) });
    } catch (e) {
      this.store.log('payments', 'ошибка обработки вебхука', `${providerId}: ${String(e.message).slice(0, 200)}`);
      return { status: 500, reply: 'error' };
    }
    if (!r.ok) { this.store.log('payments', 'вебхук отклонён', `${providerId}: ${r.reply}`); this.store.save(); return { status: r.status, reply: r.reply }; }
    const note = this.applyEvent(r.event, providerId);
    // Провайдеру отвечаем «принято», даже если событие потребовало ручной проверки: повторять его бесполезно.
    return { status: r.status, reply: r.reply, note };
  }

  applyEvent(ev, providerId) {
    const st = this.store;
    if (!ev || ev.type === 'ignore') return 'ignored';
    const pay = st.payment(ev.paymentId);
    if (!pay || pay.provider !== providerId) return 'unknown payment';
    const order = st.order(pay.orderId);
    if (ev.type === 'paid') {
      if (pay.status === 'paid') return 'duplicate';
      if (ev.amount !== undefined && ev.amount !== pay.amount) {
        pay.status = 'mismatch'; pay.error = `сумма ${ev.amount / 100} вместо ${pay.amount / 100}`;
        st.log('payments', 'сумма оплаты не совпала', `платёж №${pay.id}, ${pay.error}. Заказ не отмечен оплаченным, проверить вручную`); st.save();
        return 'amount mismatch';
      }
      pay.status = 'paid'; pay.paidAt = st.now().toISOString(); if (ev.externalId) pay.externalId = ev.externalId;
      if (order.status !== 'new') {
        st.log('payments', 'оплата по заказу, который уже не ждёт оплаты', `платёж №${pay.id}, заказ №${order.id} (${order.status}). Начислений нет, при необходимости вернуть деньги`); st.save();
        return 'order not waiting';
      }
      const e = st.markPaid(order.id, `payment:${providerId}`);
      if (e) st.log('payments', 'не удалось отметить заказ', e);
      st.save();
      return 'paid';
    }
    if (ev.type === 'failed') { if (pay.status === 'pending') { pay.status = 'failed'; st.save(); } return 'failed'; }
    if (ev.type === 'refunded') {
      if (ev.refundExternalId && pay.refundIds.includes(ev.refundExternalId)) return 'duplicate';
      if (ev.refundExternalId) pay.refundIds.push(ev.refundExternalId);
      // возврат, сделанный в кабинете провайдера: фиксируем на сайте и пересчитываем начисления
      const amount = Math.min(ev.amount, order.total - order.refunded);
      if (amount > 0) { const e = st.refund(order.id, amount, `payment:${providerId}`); if (e) st.log('payments', 'возврат из кабинета не записан', e); pay.refunded += amount; }
      st.save();
      return 'refunded';
    }
    return 'ignored';
  }

  // Возврат денег покупателю. Если провайдер не умеет возвраты по API, возвращает {manual:true}:
  // деньги возвращают в кабинете провайдера, затем возврат записывается на сайте.
  async refund(order, amount) {
    const st = this.store;
    if (!['paid', 'done'].includes(order.status)) return { error: 'Возврат возможен по оплаченному заказу' };
    if (!(amount > 0) || amount > order.total - order.refunded) return { error: 'Сумма возврата больше остатка по заказу' };
    const pay = st.d.payments.find(p => p.orderId === order.id && p.status === 'paid');
    if (!pay) return { manual: true, reason: 'платёж через сайт не найден (оплата вне сайта)' };
    const pr = P.providers[pay.provider];
    if (!pr.supportsRefund || !this.isEnabled(pay.provider)) return { manual: true, reason: `у ${pay.provider} возврат делается в кабинете провайдера` };
    if (amount > pay.amount - pay.refunded) return { error: 'Сумма возврата больше оплаченной' };
    const r = await pr.refund({ payment: pay, amount, cfg: this.providerConfig(pay.provider), http: this.http });
    pay.refundIds.push(r.externalId);
    const e = st.refund(order.id, amount, 'admin');
    if (e) return { error: e };
    pay.refunded += amount; st.save();
    return { ok: true };
  }
}

module.exports = { Payments };
