'use strict';
// Описание полей провайдеров: по нему админка строит формы. Секретные поля не показываются целиком.
module.exports = {
  yookassa: {
    title: 'ЮKassa', beta: false,
    help: 'Личный кабинет ЮKassa: Интеграция → Ключи API. HTTP-уведомления: включите события payment.succeeded, payment.canceled, refund.succeeded и укажите адрес ниже.',
    fields: [{ key: 'shopId', label: 'Идентификатор магазина (shopId)' }, { key: 'secretKey', label: 'Секретный ключ', secret: true }],
  },
  robokassa: {
    title: 'Робокасса', beta: false,
    help: 'Личный кабинет Робокассы: Мои магазины → Технические настройки. Result URL (метод POST) укажите адрес ниже, алгоритм подписи должен совпадать с выбранным здесь. Тестовые пароли отдельные.',
    fields: [
      { key: 'login', label: 'Идентификатор магазина' },
      { key: 'password1', label: 'Пароль №1', secret: true }, { key: 'password2', label: 'Пароль №2', secret: true },
      { key: 'testPassword1', label: 'Тестовый пароль №1', secret: true }, { key: 'testPassword2', label: 'Тестовый пароль №2', secret: true },
      { key: 'hash', label: 'Алгоритм подписи', options: ['md5', 'sha256', 'sha512', 'sha384', 'sha1'] },
    ],
  },
  tbank: {
    title: 'Т-Банк (эквайринг)', beta: true,
    help: 'Личный кабинет Т-Банка: Интернет-эквайринг → Терминал. Адрес уведомлений укажите ниже. Интеграция реализована без сверки с документацией: сначала тестовый терминал и тестовый платёж.',
    fields: [{ key: 'terminalKey', label: 'Ключ терминала (TerminalKey)' }, { key: 'password', label: 'Пароль терминала', secret: true }],
  },
  cloudpayments: {
    title: 'CloudPayments', beta: true,
    help: 'Личный кабинет CloudPayments: Сайты → Настройки. Для уведомлений Pay, Fail, Refund укажите адреса ниже. Интеграция реализована без сверки с документацией: сначала тестовый платёж.',
    fields: [{ key: 'publicId', label: 'Public ID' }, { key: 'apiSecret', label: 'Пароль для API', secret: true }],
  },
};
