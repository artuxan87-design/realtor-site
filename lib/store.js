'use strict';
const crypto = require('crypto');
const C = require('./commission');

function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(String(pw), salt, 32).toString('hex');
}
function checkPassword(pw, stored) {
  if (!stored) return false;
  const [salt, h] = stored.split(':');
  const t = crypto.scryptSync(String(pw), salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(t, 'hex'));
}

class Store {
  constructor(db, clock = () => new Date()) { this.db = db; this.now = clock; }
  get d() { return this.db.data; }
  get s() { return this.d.settings; }
  save() { this.db.save(); }
  log(actor, action, details = '') { this.d.log.push({ at: this.now().toISOString(), actor, action, details }); }

  partnersById() { return new Map(this.d.partners.map(p => [p.id, p])); }
  partner(id) { return this.d.partners.find(p => p.id === Number(id)); }
  partnerByCode(c) { return c ? this.d.partners.find(p => p.code === String(c).trim().toUpperCase()) : undefined; }
  lead(id) { return this.d.leads.find(l => l.id === Number(id)); }
  order(id) { return this.d.orders.find(o => o.id === Number(id)); }
  payment(id) { return this.d.payments.find(p => p.id === Number(id)); }

  addPayment({ orderId, provider, method, amount, email, phone }) {
    const p = { id: this.db.nextId('payment'), orderId, provider, method, amount, status: 'pending', externalId: '', refunded: 0, refundIds: [], email, phone, createdAt: this.now().toISOString() };
    this.d.payments.push(p);
    this.save();
    return p;
  }

  newCode() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (;;) {
      let c = 'P';
      for (let i = 0; i < 5; i++) c += abc[crypto.randomInt(abc.length)];
      if (!this.partnerByCode(c)) return c;
    }
  }

  // ---------- Заявки ----------
  addLead({ name, contact, solution, text, code, cookieCode, consent, ip }) {
    const errors = [];
    name = String(name || '').trim().slice(0, 100);
    contact = String(contact || '').trim().slice(0, 100);
    if (name.length < 2) errors.push('Укажите имя');
    if (contact.length < 3) errors.push('Укажите телефон или ник в мессенджере');
    if (!consent) errors.push('Нужно согласие на обработку персональных данных');
    if (errors.length) return { errors };
    const lead = {
      id: this.d.leads.length ? Math.max(...this.d.leads.map(l => l.id)) + 1 : 1,
      at: this.now().toISOString(), name, contact, solution: String(solution || '').slice(0, 200),
      text: String(text || '').slice(0, 3000), enteredCode: String(code || '').trim().toUpperCase().slice(0, 12),
      cookieCode: String(cookieCode || '').toUpperCase().slice(0, 12), status: 'new', consentAt: this.now().toISOString(), ip,
    };
    this.d.leads.push(lead);
    this.save();
    return { lead };
  }

  // ---------- Партнёры ----------
  registerPartner({ name, phone, email, password, sponsorCode, adult, rules, pd }) {
    const errors = [];
    name = String(name || '').trim(); email = String(email || '').trim().toLowerCase();
    const ph = C.normPhone(phone);
    if (name.length < 3) errors.push('Укажите ФИО');
    if (ph.length !== 10) errors.push('Укажите телефон в формате +7 XXX XXX-XX-XX');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('Укажите e-mail');
    if (String(password || '').length < 6) errors.push('Пароль не короче 6 символов');
    if (!adult) errors.push('Участие в программе с 18 лет');
    if (!rules) errors.push('Нужно принять правила программы');
    if (!pd) errors.push('Нужно согласие на обработку персональных данных');
    if (this.d.partners.some(p => C.normPhone(p.phone) === ph)) errors.push('Партнёр с таким телефоном уже есть');
    if (this.d.partners.some(p => p.email === email)) errors.push('Партнёр с таким e-mail уже есть');
    let sponsor = null;
    if (sponsorCode) { sponsor = this.partnerByCode(sponsorCode); if (!sponsor) errors.push('Код пригласившего партнёра не найден'); }
    if (errors.length) return { errors };
    const p = {
      id: this.db.nextId('partner'), code: this.newCode(), name, phone: '+7' + ph, email,
      pass: hashPassword(password), sponsorId: sponsor ? sponsor.id : null, blocked: false,
      createdAt: this.now().toISOString(), payoutDetails: null,
    };
    this.d.partners.push(p);
    this.log('partner:' + p.id, 'регистрация партнёра', p.name);
    this.save();
    return { partner: p };
  }
  loginPartner(email, password) {
    const p = this.d.partners.find(x => x.email === String(email || '').trim().toLowerCase());
    return p && !p.blocked && checkPassword(password, p.pass) ? p : null;
  }

  downline(partnerId) {
    const lines = [[], [], []];
    let level = [partnerId];
    for (let i = 0; i < 3; i++) {
      const next = this.d.partners.filter(p => level.includes(p.sponsorId));
      lines[i] = next; level = next.map(p => p.id);
    }
    return lines;
  }

  // ---------- Заказы ----------
  // items: [{type: 'solution'|'service', title, amount в копейках}]
  createOrder(leadId, items, actor = 'admin') {
    const lead = this.lead(leadId);
    if (!lead) return { error: 'Заявка не найдена' };
    items = items.filter(i => i.amount > 0).map(i => ({ type: i.type === 'service' ? 'service' : 'solution', title: String(i.title).slice(0, 200), amount: Math.round(i.amount) }));
    if (!items.length) return { error: 'Выберите хотя бы одну позицию с суммой' };
    const attr = C.resolveAttribution({ buyerContact: lead.contact, enteredCode: lead.enteredCode, cookieCode: lead.cookieCode, partners: this.d.partners, customers: this.d.customers });
    const o = {
      id: this.db.nextId('order'), leadId: lead.id, at: this.now().toISOString(), buyerName: lead.name, buyerContact: lead.contact,
      items, total: items.reduce((s, i) => s + i.amount, 0), status: 'new', refunded: 0, token: crypto.randomBytes(12).toString('hex'),
      line1PartnerId: attr.line1PartnerId, buyerPartnerId: attr.buyerPartnerId, reason: attr.reason,
    };
    this.d.orders.push(o);
    lead.status = 'order';
    this.log(actor, 'заказ создан', `№${o.id}, ${o.total / 100} ₽, ${attr.reason}`);
    this.save();
    return { order: o };
  }

  markPaid(orderId, actor = 'admin') {
    const o = this.order(orderId);
    if (!o) return 'Заказ не найден';
    if (o.status !== 'new') return 'Заказ уже оплачен или отменён';
    o.status = 'paid'; o.paidAt = this.now().toISOString();
    const rates = this.s.rates;
    const acc = C.calcAccruals({ items: o.items, line1PartnerId: o.line1PartnerId, partnersById: this.partnersById(), rates });
    for (const a of acc) this.d.accruals.push({ id: this.db.nextId('accrual'), orderId: o.id, createdAt: o.paidAt, storno: 0, payoutId: null, kind: 'accrual', ...a });
    // Закрепление клиента за партнёром после первого оплаченного заказа
    const ph = C.normPhone(o.buyerContact);
    if (ph.length === 10 && o.line1PartnerId && !this.d.customers.some(c => c.phone === ph)) this.d.customers.push({ phone: ph, partnerId: o.line1PartnerId });
    this.log(actor, 'заказ оплачен', `№${o.id}, начислений: ${acc.length}`);
    this.save();
    return null;
  }

  markDone(orderId, actor = 'admin') {
    const o = this.order(orderId);
    if (!o || o.status !== 'paid') return 'Сделка закрывается по оплаченному заказу';
    o.status = 'done'; o.doneAt = this.now().toISOString();
    this.log(actor, 'сделка закрыта', `№${o.id}`);
    this.save();
    return null;
  }

  cancelOrder(orderId, actor = 'admin') {
    const o = this.order(orderId);
    if (!o || o.status !== 'new') return 'Отменить можно только неоплаченный заказ';
    o.status = 'cancelled';
    this.log(actor, 'заказ отменён', `№${o.id}`);
    this.save();
    return null;
  }

  refund(orderId, amount, actor = 'admin') {
    const o = this.order(orderId);
    if (!o || !['paid', 'done'].includes(o.status)) return 'Возврат возможен по оплаченному заказу';
    amount = Math.round(amount);
    if (!(amount > 0) || amount > o.total - o.refunded) return 'Сумма возврата больше остатка по заказу';
    const accs = this.d.accruals.filter(a => a.orderId === o.id && a.kind === 'accrual');
    const total = o.total;
    // доля возврата считается от всей суммы заказа с учётом уже возвращённого
    const share = (o.refunded + amount) / total;
    for (const a of accs) {
      const target = share >= 1 ? a.amount : Math.round(a.amount * share);
      const add = Math.max(0, Math.min(a.amount, target) - (a.storno || 0));
      if (!add) continue;
      a.storno = (a.storno || 0) + add;
      const payout = a.payoutId && this.d.payouts.find(p => p.id === a.payoutId);
      if (payout && payout.status === 'paid') {
        this.d.accruals.push({ id: this.db.nextId('accrual'), orderId: o.id, partnerId: a.partnerId, line: a.line, kind: 'debt', amount: -add, base: 0, rate: 0, storno: 0, payoutId: null, createdAt: this.now().toISOString() });
      }
    }
    o.refunded += amount;
    this.log(actor, 'возврат', `заказ №${o.id}, ${amount / 100} ₽`);
    this.save();
    return null;
  }

  // ---------- Начисления и выплаты ----------
  accrualsOf(partnerId) { return this.d.accruals.filter(a => a.partnerId === Number(partnerId)); }
  statusOf(a) {
    return C.accrualStatus(a, { order: this.order(a.orderId), payout: a.payoutId ? this.d.payouts.find(p => p.id === a.payoutId) : null, holdDays: this.s.holdDays, now: this.now() });
  }
  net(a) { return a.kind === 'debt' ? a.amount : a.amount - (a.storno || 0); }
  summary(partnerId) {
    const r = { hold: 0, ready: 0, requested: 0, paid: 0, debt: 0 };
    for (const a of this.accrualsOf(partnerId)) {
      const st = this.statusOf(a), n = this.net(a);
      if (a.kind === 'debt') { if (!a.payoutId) r.debt += n; continue; }
      if (st === 'в удержании') r.hold += n;
      else if (st === 'к выплате') r.ready += n;
      else if (st === 'в заявке на выплату') r.requested += n;
      else if (st === 'выплачено') r.paid += n;
    }
    r.available = r.ready + r.debt;
    return r;
  }

  savePayoutDetails(partnerId, f) {
    const p = this.partner(partnerId);
    const kind = ['selfemployed', 'ip'].includes(f.kind) ? f.kind : '';
    const inn = String(f.inn || '').replace(/\D/g, '');
    if (!kind) return 'Выберите налоговый статус: самозанятый или ИП';
    if (![10, 12].includes(inn.length) || (kind === 'selfemployed' && inn.length !== 12)) return 'Проверьте ИНН (у физлица и ИП 12 цифр)';
    if (String(f.fio || '').trim().length < 5) return 'Укажите ФИО полностью';
    if (String(f.requisites || '').trim().length < 10) return 'Укажите реквизиты для выплаты: карта или счёт';
    p.payoutDetails = { kind, inn, fio: String(f.fio).trim(), requisites: String(f.requisites).trim().slice(0, 300) };
    this.log('partner:' + p.id, 'реквизиты выплат обновлены', '');
    this.save();
    return null;
  }

  requestPayout(partnerId) {
    const p = this.partner(partnerId);
    if (!p.payoutDetails) return 'Сначала заполните реквизиты для выплат';
    if (this.d.payouts.some(x => x.partnerId === p.id && x.status === 'requested')) return 'Заявка уже подана';
    const sm = this.summary(p.id);
    if (sm.available < this.s.minPayout) return `Минимальная выплата ${this.s.minPayout / 100} ₽, доступно ${Math.max(0, sm.available) / 100} ₽`;
    const po = { id: this.db.nextId('payout'), partnerId: p.id, status: 'requested', amount: sm.available, at: this.now().toISOString(), details: p.payoutDetails };
    this.d.payouts.push(po);
    for (const a of this.accrualsOf(p.id)) {
      const st = this.statusOf(a);
      if ((a.kind === 'debt' && !a.payoutId) || st === 'к выплате') a.payoutId = po.id;
    }
    this.log('partner:' + p.id, 'заявка на выплату', `${po.amount / 100} ₽`);
    this.save();
    return null;
  }

  resolvePayout(id, paid, actor = 'admin') {
    const po = this.d.payouts.find(x => x.id === Number(id));
    if (!po || po.status !== 'requested') return 'Заявка не найдена или уже закрыта';
    po.status = paid ? 'paid' : 'rejected'; po.closedAt = this.now().toISOString();
    if (!paid) for (const a of this.d.accruals) if (a.payoutId === po.id) a.payoutId = null;
    this.log(actor, paid ? 'выплата проведена' : 'выплата отклонена', `№${po.id}, ${po.amount / 100} ₽`);
    this.save();
    return null;
  }

  setRates(type, l1, l2, l3, actor = 'admin') {
    const e = C.validateRates(l1, l2, l3);
    if (e) return e;
    if (!C.TYPES.includes(type)) return 'Неизвестный тип';
    this.s.rates[type] = { l1: Number(l1), l2: Number(l2), l3: Number(l3) };
    this.log(actor, 'ставки изменены', `${type}: ${l1}/${l2}/${l3}`);
    this.save();
    return null;
  }
}

module.exports = { Store, hashPassword, checkPassword };
require('./settings')(Store);
require('./service')(Store);
