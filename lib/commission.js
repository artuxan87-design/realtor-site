'use strict';
// Расчёт партнёрских начислений. Суммы в копейках.
// Ставки задаются отдельно для решений (type "solution") и услуг (type "service").
// Потолок и глубина зашиты в код и из админки не меняются.

const CAP_PERCENT = 25;
const MAX_LINES = 3;
const TYPES = ['solution', 'service'];

function normPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : d;
}

function validateRates(l1, l2, l3) {
  const r = [l1, l2, l3].map(Number);
  if (r.some(x => !Number.isFinite(x) || x < 0)) return 'Ставки должны быть неотрицательными числами';
  const sum = r.reduce((a, b) => a + b, 0);
  if (sum > CAP_PERCENT) return `Сумма ставок ${sum}% выше потолка ${CAP_PERCENT}%`;
  return null;
}

function applyCap(rates) {
  const sum = rates.reduce((a, b) => a + b, 0);
  if (sum <= CAP_PERCENT) return rates.slice();
  const k = CAP_PERCENT / sum;
  return rates.map(r => r * k);
}

// Цепочка спонсоров вверх, начиная с партнёра линии 1. Без компрессии:
// заблокированный партнёр не пропускается, его доля остаётся у владельца сайта.
function chainFrom(line1Id, byId) {
  const chain = [];
  const seen = new Set();
  let cur = line1Id ? byId.get(line1Id) : null;
  for (let i = 0; i < MAX_LINES && cur && !seen.has(cur.id); i++) {
    seen.add(cur.id);
    chain.push(cur);
    cur = cur.sponsorId ? byId.get(cur.sponsorId) : null;
  }
  return chain;
}

// Кто получает линию 1: партнёр-покупатель (тогда его спонсор) > закреплённый покупатель > код в форме > ссылка.
function resolveAttribution({ buyerContact, enteredCode, cookieCode, partners, customers }) {
  const phone = normPhone(buyerContact);
  const byCode = c => c && partners.find(p => p.code === String(c).trim().toUpperCase());
  const buyerPartner = phone.length === 10 ? partners.find(p => normPhone(p.phone) === phone) : null;
  if (buyerPartner) return { line1PartnerId: buyerPartner.sponsorId || null, buyerPartnerId: buyerPartner.id, reason: 'покупка партнёра: линия 1 его спонсору' };
  const bound = phone.length === 10 ? customers.find(c => c.phone === phone && c.partnerId) : null;
  if (bound) return { line1PartnerId: bound.partnerId, buyerPartnerId: null, reason: 'клиент закреплён за партнёром' };
  const e = byCode(enteredCode);
  if (e) return { line1PartnerId: e.id, buyerPartnerId: null, reason: 'код партнёра в заявке' };
  const c = byCode(cookieCode);
  if (c) return { line1PartnerId: c.id, buyerPartnerId: null, reason: 'реферальная ссылка' };
  return { line1PartnerId: null, buyerPartnerId: null, reason: 'без партнёра' };
}

// items: [{type, amount}] оплаченные позиции. rates: {solution:{l1,l2,l3}, service:{...}}.
// Возвращает начисления по линиям, суммы разных типов складываются внутри линии.
function calcAccruals({ items, line1PartnerId, partnersById, rates }) {
  if (!line1PartnerId) return [];
  const chain = chainFrom(line1PartnerId, partnersById);
  const lines = [];
  chain.forEach((p, i) => { lines[i] = { line: i + 1, partnerId: p.id, base: 0, amount: 0, blocked: !!p.blocked }; });
  let baseTotal = 0;
  for (const t of TYPES) {
    const base = items.filter(x => x.type === t).reduce((s, x) => s + x.amount, 0);
    if (!(base > 0) || !rates[t]) continue;
    baseTotal += base;
    const capped = applyCap([rates[t].l1, rates[t].l2, rates[t].l3]);
    chain.forEach((p, i) => {
      if (p.blocked) return;
      lines[i].base += base;
      lines[i].amount += Math.round(base * capped[i] / 100);
    });
  }
  const out = lines.filter(l => l && !l.blocked && l.amount > 0).map(l => ({ line: l.line, partnerId: l.partnerId, base: l.base, amount: l.amount, rate: Math.round(l.amount / l.base * 1000) / 10 }));
  if (out.reduce((s, a) => s + a.amount, 0) > Math.floor(baseTotal * CAP_PERCENT / 100) + out.length) throw new Error('Превышен потолок выплат');
  return out;
}

function stornoAmounts(accruals, refund, total) {
  if (!(total > 0)) return [];
  const share = Math.min(1, refund / total);
  return accruals.map(a => {
    const left = a.amount - (a.storno || 0);
    return { id: a.id, amount: share >= 1 ? left : Math.min(left, Math.round(left * share)) };
  }).filter(x => x.amount > 0);
}

function accrualStatus(a, { order, payout, holdDays, now = new Date() }) {
  if (a.kind === 'debt') return payout ? (payout.status === 'paid' ? 'удержано из выплаты' : 'в заявке') : 'удержание за возврат';
  if (a.storno >= a.amount && !a.payoutId) return 'сторнировано';
  if (payout && payout.status === 'paid') return 'выплачено';
  if (payout && payout.status === 'requested') return 'в заявке на выплату';
  if (!order || !order.doneAt) return 'в удержании';
  return now.getTime() >= new Date(order.doneAt).getTime() + holdDays * 86400000 ? 'к выплате' : 'в удержании';
}

module.exports = { CAP_PERCENT, MAX_LINES, TYPES, normPhone, validateRates, applyCap, chainFrom, resolveAttribution, calcAccruals, stornoAmounts, accrualStatus };
