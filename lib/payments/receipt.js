'use strict';
// Данные для кассового чека по 54-ФЗ. Каждый провайдер получает позиции в своём формате.
// Настройки (config.payments.receipt):
//   mode: "provider" — чек пробивает облачная касса провайдера; "none" — чек не передаём
//         (например, самозанятый сам формирует чек в «Мой налог», 422-ФЗ);
//   taxation: osn | usn_income | usn_income_outcome | envd | esn | patent;
//   vat: none | vat0 | vat10 | vat20 (ставка НДС для позиций).
const { money, cut } = require('./util');

const YK_TAX_SYSTEM = { osn: 1, usn_income: 2, usn_income_outcome: 3, envd: 4, esn: 5, patent: 6 };
const YK_VAT = { none: 1, vat0: 2, vat10: 3, vat20: 4 };
const CP_VAT = { none: null, vat0: 0, vat10: 10, vat20: 20 };
const CP_TAX_SYSTEM = { osn: 0, usn_income: 1, usn_income_outcome: 2, envd: 3, esn: 4, patent: 5 };

function normalize(cfg) {
  return { mode: cfg && cfg.mode === 'provider' ? 'provider' : 'none', taxation: (cfg && cfg.taxation) || 'usn_income', vat: (cfg && cfg.vat) || 'none' };
}

const need = c => c.mode === 'provider';

function yookassa(items, customer, cfg) {
  const c = normalize(cfg);
  if (!need(c)) return undefined;
  return {
    customer: customer.email ? { email: customer.email } : { phone: customer.phone },
    tax_system_code: YK_TAX_SYSTEM[c.taxation],
    items: items.map(i => ({ description: cut(i.name, 128), quantity: '1.00', amount: { value: money(i.amount), currency: 'RUB' }, vat_code: YK_VAT[c.vat], payment_mode: 'full_payment', payment_subject: 'service' })),
  };
}

// Робокасса: sum — полная сумма позиции в рублях (число).
function robokassa(items, cfg) {
  const c = normalize(cfg);
  if (!need(c)) return undefined;
  return { sno: c.taxation, items: items.map(i => ({ name: cut(i.name, 128), quantity: 1, sum: Number(money(i.amount)), payment_method: 'full_payment', payment_object: 'service', tax: c.vat })) };
}

// Т-Банк: суммы в копейках.
function tbank(items, customer, cfg) {
  const c = normalize(cfg);
  if (!need(c)) return undefined;
  const r = { Taxation: c.taxation, Items: items.map(i => ({ Name: cut(i.name, 128), Price: i.amount, Quantity: 1, Amount: i.amount, Tax: c.vat, PaymentMethod: 'full_payment', PaymentObject: 'service' })) };
  if (customer.email) r.Email = customer.email; else r.Phone = customer.phone;
  return r;
}

function cloudpayments(items, customer, cfg) {
  const c = normalize(cfg);
  if (!need(c)) return undefined;
  return { Items: items.map(i => ({ label: cut(i.name, 128), price: Number(money(i.amount)), quantity: 1, amount: Number(money(i.amount)), vat: CP_VAT[c.vat], method: 4, object: 4 })), taxationSystem: CP_TAX_SYSTEM[c.taxation], email: customer.email || '', phone: customer.phone || '' };
}

module.exports = { normalize, yookassa, robokassa, tbank, cloudpayments };
