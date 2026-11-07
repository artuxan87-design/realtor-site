'use strict';
// Встроенная графика: иконки, обложки решений и услуг, цветовые акценты. Без внешних файлов.
const ICONS = {
  shop: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9v11h16V9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M10 20v-6h4v6"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.4 11.5a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 7H6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.5a5 5 0 0 1 4.5 5"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2"/><circle cx="16" cy="14.5" r="1.2"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  rocket: '<path d="M5 15c-1.5 1-2 4-2 6 2 0 5-.5 6-2"/><path d="M9 15l-3-3c1-4 4.5-8 12-9 0 7.5-5 11-9 12z"/><circle cx="15" cy="9" r="1.5"/>',
  bot: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4"/><circle cx="12" cy="3.5" r="1"/><circle cx="9" cy="13" r="1.2"/><circle cx="15" cy="13" r="1.2"/><path d="M9.5 16.5h5"/>',
  code: '<path d="M8 8l-5 4 5 4"/><path d="M16 8l5 4-5 4"/><path d="M13.5 5l-3 14"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><path d="M6 15h4"/>',
  truck: '<path d="M2 6h11v10H2z"/><path d="M13 9h4l4 3.5V16h-8"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3z"/>',
  server: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2.2-.5-1.3.3-2.3 1.7-2.3H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
  headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/><path d="M19 20c0 1.5-2 2-5 2"/>',
  percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  tree: '<circle cx="12" cy="5" r="2.5"/><circle cx="5.5" cy="19" r="2.5"/><circle cx="18.5" cy="19" r="2.5"/><path d="M12 7.5v4M12 11.5H5.5v5M12 11.5h6.5v5"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  zap: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  gift: '<rect x="3" y="9" width="18" height="4" rx="1"/><path d="M5 13v7h14v-7M12 9v11"/><path d="M12 9c-2-4-6-3.5-5-1.5S12 9 12 9zM12 9c2-4 6-3.5 5-1.5S12 9 12 9z"/>',
  heart: '<path d="M12 20s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.2 12 20 12 20z"/>',
  coffee: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z"/>',
  paw: '<ellipse cx="7" cy="11" rx="2" ry="2.6"/><ellipse cx="17" cy="11" rx="2" ry="2.6"/><ellipse cx="10.5" cy="6.5" rx="2" ry="2.6"/><ellipse cx="13.5" cy="6.5" rx="2" ry="2.6"/><path d="M12 12.5c-3 0-5.5 3-5.5 5.2 0 1.6 1.4 2.3 3 2 1.1-.2 1.6-.5 2.5-.5s1.4.3 2.5.5c1.6.3 3-.4 3-2 0-2.2-2.5-5.2-5.5-5.2z"/>',
  bone: '<path d="M7 9.5a2.5 2.5 0 1 1 1.6-4.2L10 6.7h4l1.4-1.4A2.5 2.5 0 1 1 17 9.5l-1 1v3l1 1a2.5 2.5 0 1 1-1.6 4.2L14 17.3h-4l-1.4 1.4A2.5 2.5 0 1 1 7 14.5l1-1v-3z"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h2M12 14h2M16 14h.01M8 18h2M12 18h2"/>',
  pin: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>',
  camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 4.5V21.5M8 7h8M8 11h6"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  building: '<path d="M5 21V4h9v17"/><path d="M14 9h5v12"/><path d="M3 21h18"/><path d="M8 8h3M8 12h3M8 16h3M16.5 13h.01M16.5 17h.01"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9"/><path d="M16 7l3 3M14 9l2 2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  ruler: '<rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6.5 8v3M10.5 8v4M14.5 8v3M18.5 8v4"/>',
  bed: '<path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.8"/>',
  doc: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
};

const ACCENTS = {
  indigo: ['#9A5A36', '#C8A26A'], teal: ['#A98466', '#D3B48A'], orange: ['#B8693F', '#E2B27F'],
  pink: ['#A8606A', '#D9A2A8'], green: ['#7C8A5A', '#B3BE8F'], blue: ['#8A6F56', '#C9AE8C'],
};
const ACCENT_NAMES = { indigo: 'Терракот', teal: 'Песочный', orange: 'Золотой', pink: 'Розовая глина', green: 'Олива', blue: 'Капучино' };
const ICON_NAMES = {
  building: 'Дом многоэтажный', key: 'Ключ', search: 'Поиск', ruler: 'Площадь', bed: 'Спальня', doc: 'Документы', home: 'Дом', paw: 'Лапа', calendar: 'Календарь', pin: 'Метка', play: 'Видео', camera: 'Фото', book: 'Книга', award: 'Награда', phone: 'Телефон',
  shop: 'Магазин', cart: 'Корзина', users: 'Люди', link: 'Ссылка', chart: 'График', wallet: 'Кошелёк', shield: 'Защита', clock: 'Время', rocket: 'Запуск', bot: 'Бот', code: 'Код', mail: 'Почта', check: 'Галочка', card: 'Карта', truck: 'Доставка', globe: 'Сайт', server: 'Сервер', palette: 'Дизайн', file: 'Документ', headset: 'Поддержка', percent: 'Процент', tree: 'Структура', star: 'Звезда', box: 'Товар', sliders: 'Настройка', chat: 'Чат', zap: 'Автоматизация', lock: 'Безопасность', gift: 'Подарок', heart: 'Забота', coffee: 'Чай и кофе', sparkle: 'Косметика', arrow: 'Стрелка',
};
const COVERS = { flat: 'Квартира', shop: 'Магазин', bot: 'Бот', landing: 'Лендинг', flow: 'Автоматизация', dog: 'Собака' };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const accent = n => (ACCENTS[n] ? n : 'indigo');

function icon(name, size = 24, cls = '') {
  const body = ICONS[name] || ICONS.star;
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

// Плитка с иконкой в цвете акцента
const badge = (name, acc = 'indigo', size = 24) => `<span class="ibadge acc-${accent(acc)}">${icon(name, size)}</span>`;

let seq = 0;
// Обложка карточки: градиент акцента, схематичный экран по типу решения и иконка
function cover(type, acc, iconName) {
  const id = 'g' + (++seq), [c1, c2] = ACCENTS[accent(acc)];
  const W = 'fill="#fff"';
  const scenes = {
    shop: `<rect x="70" y="26" width="180" height="112" rx="10" ${W} opacity=".95"/><rect x="70" y="26" width="180" height="16" rx="10" fill="#fff" opacity=".6"/><circle cx="82" cy="34" r="2.5" fill="${c1}"/><circle cx="91" cy="34" r="2.5" fill="${c2}"/>
      <rect x="82" y="52" width="46" height="40" rx="6" fill="${c1}" opacity=".18"/><rect x="137" y="52" width="46" height="40" rx="6" fill="${c2}" opacity=".3"/><rect x="192" y="52" width="46" height="40" rx="6" fill="${c1}" opacity=".18"/>
      <rect x="82" y="98" width="30" height="5" rx="2.5" fill="${c1}" opacity=".5"/><rect x="137" y="98" width="24" height="5" rx="2.5" fill="${c1}" opacity=".5"/><rect x="192" y="98" width="28" height="5" rx="2.5" fill="${c1}" opacity=".5"/>
      <rect x="82" y="114" width="156" height="16" rx="8" fill="${c1}"/><rect x="132" y="120" width="56" height="4" rx="2" fill="#fff"/>`,
    bot: `<rect x="62" y="26" width="196" height="112" rx="14" ${W} opacity=".95"/>
      <rect x="76" y="40" width="96" height="22" rx="11" fill="${c1}" opacity=".2"/><rect x="88" y="48" width="60" height="6" rx="3" fill="${c1}" opacity=".6"/>
      <rect x="148" y="70" width="96" height="22" rx="11" fill="${c1}"/><rect x="160" y="78" width="58" height="6" rx="3" fill="#fff"/>
      <rect x="76" y="100" width="76" height="22" rx="11" fill="${c2}" opacity=".35"/><rect x="88" y="108" width="44" height="6" rx="3" fill="${c1}" opacity=".6"/>`,
    landing: `<rect x="62" y="24" width="196" height="116" rx="12" ${W} opacity=".95"/><rect x="76" y="40" width="108" height="10" rx="5" fill="${c1}"/><rect x="76" y="58" width="132" height="6" rx="3" fill="${c1}" opacity=".35"/><rect x="76" y="70" width="112" height="6" rx="3" fill="${c1}" opacity=".35"/>
      <rect x="76" y="88" width="54" height="18" rx="9" fill="${c2}"/><rect x="196" y="40" width="48" height="52" rx="8" fill="${c2}" opacity=".35"/><rect x="76" y="116" width="50" height="10" rx="5" fill="${c1}" opacity=".2"/><rect x="132" y="116" width="50" height="10" rx="5" fill="${c1}" opacity=".2"/><rect x="188" y="116" width="50" height="10" rx="5" fill="${c1}" opacity=".2"/>`,
    flat: `<rect x="62" y="24" width="196" height="116" rx="14" ${W} opacity=".95"/><rect x="84" y="46" width="62" height="82" rx="4" fill="${c1}" opacity=".85"/><rect x="154" y="64" width="46" height="64" rx="4" fill="${c2}" opacity=".7"/><rect x="208" y="84" width="34" height="44" rx="4" fill="${c1}" opacity=".35"/>
      <g fill="#fff" opacity=".9"><rect x="94" y="56" width="12" height="12" rx="2"/><rect x="114" y="56" width="12" height="12" rx="2"/><rect x="94" y="78" width="12" height="12" rx="2"/><rect x="114" y="78" width="12" height="12" rx="2"/><rect x="94" y="100" width="12" height="12" rx="2"/><rect x="114" y="100" width="12" height="12" rx="2"/><rect x="162" y="74" width="10" height="10" rx="2"/><rect x="178" y="74" width="10" height="10" rx="2"/><rect x="162" y="94" width="10" height="10" rx="2"/><rect x="178" y="94" width="10" height="10" rx="2"/></g>
      <rect x="72" y="128" width="176" height="3" rx="1.5" fill="${c1}" opacity=".4"/>`,
    dog: `<rect x="62" y="24" width="196" height="116" rx="14" ${W} opacity=".95"/><g fill="${c1}" opacity=".85"><ellipse cx="124" cy="92" rx="9" ry="12"/><ellipse cx="156" cy="92" rx="9" ry="12"/><ellipse cx="138" cy="66" rx="9" ry="12"/><ellipse cx="148" cy="66" rx="9" ry="12"/><path d="M140 96c-14 0-25 13-25 24 0 7 6 10 13 9 5-1 7-2 12-2s7 1 12 2c7 1 13-2 13-9 0-11-11-24-25-24z"/></g><g fill="${c2}" opacity=".5"><ellipse cx="212" cy="62" rx="5" ry="7"/><ellipse cx="228" cy="62" rx="5" ry="7"/><ellipse cx="205" cy="82" rx="5" ry="7"/><ellipse cx="235" cy="82" rx="5" ry="7"/><path d="M220 86c-9 0-16 8-16 15 0 5 4 6 9 6 4-1 5-1 7-1s3 0 7 1c5 0 9-1 9-6 0-7-7-15-16-15z"/></g>`,
    flow: `<rect x="62" y="24" width="196" height="116" rx="12" ${W} opacity=".95"/>
      <rect x="76" y="62" width="42" height="36" rx="9" fill="${c1}"/><rect x="140" y="40" width="42" height="30" rx="9" fill="${c2}" opacity=".55"/><rect x="140" y="92" width="42" height="30" rx="9" fill="${c2}" opacity=".55"/><rect x="204" y="62" width="42" height="36" rx="9" fill="${c1}"/>
      <path d="M118 80C130 80 128 55 140 55M118 80C130 80 128 107 140 107M182 55C194 55 192 80 204 80M182 107C194 107 192 80 204 80" fill="none" stroke="${c1}" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>`,
  };
  const scene = scenes[COVERS[type] ? type : 'shop'];
  return `<svg class="cover" viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="320" height="160" fill="url(#${id})"/><circle cx="276" cy="18" r="62" fill="#fff" opacity=".10"/><circle cx="26" cy="150" r="48" fill="#fff" opacity=".10"/>${scene}</svg>`;
}

module.exports = { ICONS, ACCENTS, ACCENT_NAMES, ICON_NAMES, COVERS, icon, badge, cover, accent, esc };
