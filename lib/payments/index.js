'use strict';
// Платёжный модуль: реестр провайдеров и настройки. Не зависит от магазина,
// можно переносить в другие сайты вместе с папкой payments.
const providers = {
  test: require('./providers/test'),
  yookassa: require('./providers/yookassa'),
  robokassa: require('./providers/robokassa'),
  tbank: require('./providers/tbank'),
  cloudpayments: require('./providers/cloudpayments'),
};

const ENV = {
  yookassa: { shopId: 'YOOKASSA_SHOP_ID', secretKey: 'YOOKASSA_SECRET_KEY' },
  robokassa: { login: 'ROBOKASSA_LOGIN', password1: 'ROBOKASSA_PASSWORD1', password2: 'ROBOKASSA_PASSWORD2', testPassword1: 'ROBOKASSA_TEST_PASSWORD1', testPassword2: 'ROBOKASSA_TEST_PASSWORD2' },
  tbank: { terminalKey: 'TBANK_TERMINAL_KEY', password: 'TBANK_PASSWORD' },
  cloudpayments: { publicId: 'CLOUDPAYMENTS_PUBLIC_ID', apiSecret: 'CLOUDPAYMENTS_API_SECRET' },
};

// Настройки из config.payments, ключи можно задать переменными окружения (не хранить в файле).
function resolve(config = {}, env = process.env) {
  const p = config.payments || {};
  const out = { testMode: p.testMode !== false, baseUrl: p.baseUrl || '', receipt: p.receipt || { mode: 'none' }, providers: {} };
  if (env.PAYMENTS_TEST_MODE !== undefined) out.testMode = env.PAYMENTS_TEST_MODE !== '0' && env.PAYMENTS_TEST_MODE !== 'false';
  for (const id of Object.keys(ENV)) {
    const c = { ...(p.providers && p.providers[id]) };
    for (const [k, name] of Object.entries(ENV[id])) if (env[name]) c[k] = env[name];
    out.providers[id] = c;
  }
  out.providers.robokassa.test = out.providers.robokassa.test !== false && out.testMode;
  return out;
}

function isEnabled(id, settings) {
  const pr = providers[id];
  if (!pr) return false;
  if (id === 'test') return !!settings.testMode;
  const c = settings.providers[id];
  return !!(c && c.enabled !== false && pr.configured(c, settings));
}

function available(settings) {
  return Object.values(providers).filter(p => isEnabled(p.id, settings)).map(p => ({ id: p.id, title: p.title, methods: p.methods }));
}

module.exports = { providers, resolve, isEnabled, available };
