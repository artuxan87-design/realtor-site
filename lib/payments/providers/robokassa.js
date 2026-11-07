'use strict';
// Робокасса. Сверено с https://docs.robokassa.ru 04.11.2026 (форма оплаты, ResultURL, фискализация).
// В кабинете: Result URL = <сайт>/pay/webhook/robokassa (метод POST), алгоритм подписи как в настройке config.hash.
// Платёж засчитывается только по ResultURL, SuccessURL только показывает страницу.
const { money, hash, eqSafe } = require('../util');
const R = require('../receipt');
const ALGOS = ['md5', 'sha1', 'sha256', 'sha384', 'sha512'];
const FORM = 'https://auth.robokassa.ru/Merchant/Index.aspx';

const algo = cfg => (ALGOS.includes(String(cfg.hash).toLowerCase()) ? String(cfg.hash).toLowerCase() : 'md5');
const pass = (cfg, n) => (cfg.test ? cfg['testPassword' + n] : cfg['password' + n]);

module.exports = {
  id: 'robokassa',
  title: 'Карты, СБП и другие способы (Робокасса)',
  methods: [{ id: 'any', title: 'Выбрать способ на странице Робокассы' }],
  configured: cfg => !!(cfg && cfg.login && pass(cfg, 1) && pass(cfg, 2)),
  supportsRefund: false, // возврат через API Робокассы требует JWT и OpKey, выполняется вручную в кабинете

  async init({ payment, description, customer, items, cfg, receiptCfg }) {
    const outSum = money(payment.amount);
    const rc = R.robokassa(items, receiptCfg);
    const receiptEnc = rc ? encodeURIComponent(JSON.stringify(rc)) : null;
    const sigParts = [cfg.login, outSum, String(payment.id)];
    if (receiptEnc) sigParts.push(receiptEnc);
    sigParts.push(pass(cfg, 1));
    const fields = { MerchantLogin: cfg.login, OutSum: outSum, InvId: String(payment.id), Description: String(description).replace(/[^\p{L}\p{N} .,\-]/gu, '').slice(0, 100), SignatureValue: hash(algo(cfg), sigParts.join(':')), Culture: 'ru', Encoding: 'utf-8' };
    if (customer.email) fields.Email = customer.email;
    if (receiptEnc) fields.Receipt = receiptEnc;
    if (cfg.test) fields.IsTest = '1';
    return { form: { action: FORM, fields }, externalId: String(payment.id) };
  },

  // Параметры ResultURL: OutSum, InvId, SignatureValue. Подпись: OutSum:InvId:Пароль#2
  async webhook({ req, cfg, getPayment }) {
    const q = { ...(req.query || {}), ...(req.body || {}) };
    if (!q.OutSum || !q.InvId || !q.SignatureValue) return { ok: false, status: 400, reply: 'bad request' };
    const check = hash(algo(cfg), `${q.OutSum}:${q.InvId}:${pass(cfg, 2)}`);
    if (!eqSafe(check.toLowerCase(), String(q.SignatureValue).toLowerCase())) return { ok: false, status: 400, reply: 'bad sign' };
    const pay = getPayment(Number(q.InvId));
    if (!pay) return { ok: false, status: 400, reply: 'unknown invoice' };
    const kop = Math.round(Number(q.OutSum) * 100);
    return { ok: true, status: 200, reply: `OK${q.InvId}`, event: { type: 'paid', paymentId: pay.id, externalId: String(q.InvId), amount: kop } };
  },
};
