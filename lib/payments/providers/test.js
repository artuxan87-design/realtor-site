'use strict';
// Тестовый провайдер без денег: для проверки сайта до подключения банка.
// Доступен только при config.payments.testMode = true. На боевом сайте testMode должен быть false.
module.exports = {
  id: 'test',
  title: 'Тестовая оплата (без списания денег)',
  methods: [{ id: 'test', title: 'Тестовая оплата' }],
  configured: (cfg, all) => !!(all && all.testMode),
  supportsRefund: true,
  async init({ payment, urls }) { return { url: `${urls.site}/pay/test/${payment.id}/`, externalId: 'test-' + payment.id }; },
  async webhook({ req, getPayment }) {
    const pay = getPayment(Number(req.body && req.body.paymentId));
    if (!pay) return { ok: false, status: 400, reply: 'unknown' };
    return { ok: true, status: 200, reply: 'OK', event: { type: 'paid', paymentId: pay.id, externalId: pay.externalId, amount: pay.amount } };
  },
  async refund({ payment }) { return { externalId: `test-refund-${payment.id}-${payment.refunded}` }; },
};
