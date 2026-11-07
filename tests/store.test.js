'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DB } = require('../lib/db');
const { Store } = require('../lib/store');
const C = require('../lib/commission');

function setup() {
  let now = new Date('2026-11-10T10:00:00Z');
  const st = new Store(new DB(null), () => now);
  Object.assign(st.s, { holdDays: 14, minPayout: 100000 }); st.s.rates.service = { l1: 10, l2: 4, l3: 2 }; st.s.rates.solution = { l1: 10, l2: 4, l3: 2 };
  st.advance = days => { now = new Date(now.getTime() + days * 86400000); };
  const reg = (name, n, sponsorCode) => st.registerPartner({ name, phone: '+7900000000' + n, email: `p${n}@t.ru`, password: 'secret1', sponsorCode, adult: 1, rules: 1, pd: 1 }).partner;
  return { st, reg };
}
const rub = x => x * 100;

test('потолок ставок 25 %', () => {
  assert.equal(C.validateRates(10, 10, 6), 'Сумма ставок 26% выше потолка 25%');
  assert.equal(C.validateRates(10, 4, 2), null);
});

test('начисления по 3 линиям: решение 100 000 и услуга 20 000', () => {
  const { st, reg } = setup();
  const a = reg('Анна Первая', '01'), b = reg('Борис Второй', '02', a.code), c = reg('Вера Третья', '03', b.code);
  const lead = st.addLead({ name: 'Клиент', contact: '+7 911 111-11-11', code: c.code, consent: 1 }).lead;
  const { order } = st.createOrder(lead.id, [{ type: 'solution', title: 'Магазин', amount: rub(100000) }, { type: 'service', title: 'Оплата', amount: rub(20000) }]);
  assert.equal(order.line1PartnerId, c.id);
  assert.equal(st.markPaid(order.id), null);
  const by = id => st.accrualsOf(id).reduce((s, x) => s + x.amount, 0);
  assert.equal(by(c.id), rub(12000)); // 10 %
  assert.equal(by(b.id), rub(4800));  // 4 %
  assert.equal(by(a.id), rub(2400));  // 2 %
});

test('разные ставки для решений и услуг', () => {
  const { st, reg } = setup();
  const a = reg('Анна Первая', '01');
  assert.equal(st.setRates('service', 5, 0, 0), null);
  const lead = st.addLead({ name: 'Клиент', contact: 'tg_client', code: a.code, consent: 1 }).lead;
  const { order } = st.createOrder(lead.id, [{ type: 'solution', title: 'Магазин', amount: rub(100000) }, { type: 'service', title: 'Оплата', amount: rub(20000) }]);
  st.markPaid(order.id);
  assert.equal(st.accrualsOf(a.id)[0].amount, rub(10000) + rub(1000));
});

test('регистрация партнёра ничего не начисляет, заблокированный теряет долю', () => {
  const { st, reg } = setup();
  const a = reg('Анна Первая', '01'), b = reg('Борис Второй', '02', a.code);
  assert.equal(st.d.accruals.length, 0);
  a.blocked = true;
  const lead = st.addLead({ name: 'Клиент', contact: 'x@y.ru', code: b.code, consent: 1 }).lead;
  const { order } = st.createOrder(lead.id, [{ type: 'solution', title: 'М', amount: rub(50000) }]);
  st.markPaid(order.id);
  assert.deepEqual(st.d.accruals.map(x => x.partnerId), [b.id]);
});

test('покупка партнёра: линия 1 его спонсору', () => {
  const { st, reg } = setup();
  const a = reg('Анна Первая', '01'), b = reg('Борис Второй', '02', a.code);
  const lead = st.addLead({ name: 'Борис', contact: b.phone, code: b.code, consent: 1 }).lead;
  const { order } = st.createOrder(lead.id, [{ type: 'solution', title: 'М', amount: rub(10000) }]);
  assert.equal(order.line1PartnerId, a.id);
  st.markPaid(order.id);
  assert.equal(st.d.accruals.length, 1);
  assert.equal(st.d.accruals[0].partnerId, a.id);
});

test('удержание, выплата от минимума, возврат после выплаты даёт долг', () => {
  const { st, reg } = setup();
  const a = reg('Анна Первая', '01');
  st.savePayoutDetails(a.id, { kind: 'selfemployed', inn: '123456789012', fio: 'Анна Первая Петровна', requisites: 'карта 2200 0000 0000 0000' });
  const lead = st.addLead({ name: 'Клиент', contact: 'tg_client', code: a.code, consent: 1 }).lead;
  const { order } = st.createOrder(lead.id, [{ type: 'solution', title: 'М', amount: rub(50000) }]);
  st.markPaid(order.id);
  assert.equal(st.summary(a.id).hold, rub(5000));
  st.markDone(order.id);
  assert.match(st.requestPayout(a.id), /Минимальная/);
  st.advance(15);
  assert.equal(st.summary(a.id).ready, rub(5000));
  assert.equal(st.requestPayout(a.id), null);
  assert.equal(st.resolvePayout(1, true), null);
  assert.equal(st.refund(order.id, rub(25000)), null);
  const sm = st.summary(a.id);
  assert.equal(sm.debt, -rub(2500));
  assert.equal(sm.paid, rub(2500));
});

test('возврат до выплаты сторнирует пропорционально', () => {
  const { st, reg } = setup();
  const a = reg('Анна Первая', '01');
  const lead = st.addLead({ name: 'Клиент', contact: 'tg_client', code: a.code, consent: 1 }).lead;
  const { order } = st.createOrder(lead.id, [{ type: 'solution', title: 'М', amount: rub(40000) }]);
  st.markPaid(order.id);
  st.refund(order.id, rub(10000));
  assert.equal(st.summary(a.id).hold, rub(3000));
  st.refund(order.id, rub(30000));
  assert.equal(st.summary(a.id).hold, 0);
});

test('заявка требует согласие и имя', () => {
  const { st } = setup();
  assert.equal(st.addLead({ name: 'А', contact: '1', consent: 0 }).errors.length, 3);
});

test('стартовые условия партнёрки для агента: 20/3/2 на сделки и услуги, выплата от 3000 ₽, удержание 14 дней', () => {
  const st = new Store(new DB(null));
  assert.deepEqual(st.s.rates.service, { l1: 20, l2: 3, l3: 2 });
  assert.deepEqual(st.s.rates.solution, { l1: 20, l2: 3, l3: 2 });
  assert.equal(st.s.holdDays, 14);
  assert.equal(st.s.minPayout, 300000);
});
