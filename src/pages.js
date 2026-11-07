'use strict';
// Публичные страницы сайта агента по недвижимости. Данные берутся из базы (правятся в админке),
// стартовое наполнение лежит в content/*.json.
const fs = require('fs');
const path = require('path');
const S = require('../lib/seo');
const R = require('../lib/richtext');
const V = require('../lib/visuals');

const ROOT = path.join(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', f), 'utf8'));
const { icon, badge: ibadge } = V;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rub = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
const rubK = k => rub(Math.round(k / 100));
const price = (p, from, unit) => p == null ? (unit ? esc(unit) : '<span class="tbd">Цена по договорённости</span>') : (from ? 'от ' : '') + rubK(p) + (unit ? ' <small>' + esc(unit) + '</small>' : '');
const plainPrice = (p, from) => p == null ? '' : (from ? 'от ' : '') + rubK(p);
const dateRu = iso => iso ? new Date(iso + (String(iso).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

function files() { return { site: read('site.json'), solutions: read('solutions.json'), services: read('services.json'), cases: read('cases.json'), blog: read('blog.json') }; }

function load(store) {
  const base = read('solutions.json');
  return { settings: store.s, site: store.c.site, sol: { categories: base.categories, base: base.base, items: store.c.solutions }, srv: { items: store.c.services }, cases: { items: store.c.cases }, posts: store.publishedPosts(), allPosts: store.c.posts || [] };
}

// Что владельцу осталось заполнить: список {text, href}
function missing(d, store, paySettings) {
  const out = [], s = d.site, c = s.contacts;
  const add = (text, href) => out.push({ text, href });
  if (!store.d.admin.passHash) add('Задать свой пароль администратора', '/admin/settings');
  if (!s.domain) add('Указать домен сайта (до этого сайт закрыт от поисковиков)', '/admin/site');
  if (!c.telegram && !c.whatsappPhone && !c.email && !c.phone) add('Указать контакты для связи: телефон, Telegram, WhatsApp или e-mail', '/admin/site');
  if (!s.operator.name || !s.operator.inn) add('Заполнить реквизиты оператора персональных данных (ФИО, ИНН)', '/admin/site');
  if (!(s.trainer && s.trainer.photo)) add('Загрузить портрет для первого экрана и страницы «Об агенте»', '/admin/home')
  if (!(s.about && s.about.photo)) add('Загрузить фото процесса консультации для блока «Обо мне»', '/admin/home')
  if ((s.hero && s.hero.facts || []).some(f => f.proposal && !f.confirmed) || (s.hero && s.hero.sticker && s.hero.sticker.proposal && !s.hero.sticker.confirmed)) add('Подтвердить или убрать цифры и обещания на главной: сделки, сроки, экономия клиентов (без подтверждения они не показываются)', '/admin/home')
  if (!(s.contacts.channel || s.contacts.vk)) add('Добавить ссылки на Telegram-канал и ВКонтакте', '/admin/home');
  if (!(s.gallery && s.gallery.length)) add('Добавить фото в галерею (офис, команда, сделки)', '/admin/site');
  if (!(s.seo && s.seo.metrikaId)) add('Подключить Яндекс Метрику: указать номер счётчика', '/admin/site');
  if (!(s.seo && s.seo.yandexVerification)) add('Подтвердить сайт в Яндекс Вебмастере: вставить код проверки', '/admin/site');
  const noSrv = d.srv.items.filter(i => i.price == null).length;
  if (noSrv) add(`Указать цены услуг (без цены: ${noSrv})`, '/admin/services');
  const noObj = d.sol.items.filter(i => i.price == null).length;
  if (noObj) add(`Указать цены объектов (без цены: ${noObj})`, '/admin/solutions');
  const noPhoto = d.sol.items.filter(i => !i.image && !(i.photos || []).length).length;
  if (noPhoto) add(`Загрузить фото объектов (без фото: ${noPhoto}), пока показываются рисунки`, '/admin/solutions');
  if (d.sol.items.some(i => i.demoData)) add('Заменить демонстрационные объекты на реальные и удалить лишние', '/admin/solutions');
  if (!d.allPosts.some(p => p.published)) add('Написать первую статью в блог', '/admin/posts');
  const real = paySettings.available.filter(p => p.id !== 'test');
  if (!real.length) add('Подключить оплату: ввести ключи ЮKassa, Робокассы или другого провайдера', '/admin/payments');
  if (paySettings.testMode && real.length) add('Выключить тестовый режим оплаты, когда проверите платёж', '/admin/payments');
  if (!paySettings.baseUrl && real.length) add('Указать адрес сайта (https://...) для уведомлений от банка', '/admin/payments');
  return out;
}

const cityIn = d => (d.site.seo && d.site.seo.cityIn) || (d.site.contacts.city ? 'в городе ' + d.site.contacts.city : '');
const initials = n => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'А';

const NAV = [['objects/', '/objects/', 'Каталог'], ['services/', '/services/', 'Услуги'], ['steps', '/#steps', 'Этапы'], ['about/', '/about/', 'Обо мне'], ['stories/', '/stories/', 'Отзывы'], ['blog/', '/blog/', 'Блог'], ['contact/', '/contact/', 'Контакты']];

// Знак: дом, арка и ключ в одну линию
const LOGO_MARK = '<svg class="logo-svg" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 18.5L20 4.5l16.5 14"/><path d="M8 15.5V35h24V15.5"/><path d="M14.5 35V24a5.5 5.5 0 0 1 11 0v11"/><circle cx="20" cy="22.2" r="2"/><path d="M20 24.2V31M20 28h2.4M20 30.6h1.8"/></svg>';
const logoHtml = (site, where) => {
  const b = site.brand || {}, t = b.title || site.name;
  if (where === 'foot' && b.logo) return `<img class="logo-img logo-full" src="${esc(b.logo)}" alt="${esc(t)}" height="120">`;
  if (b.mark) return `<img class="logo-img" src="${esc(b.mark)}" alt="" height="50"><span class="logo-text"><b>${esc(t)}</b>${b.subtitle ? `<small>${esc(b.subtitle)}</small>` : ''}</span>`;
  if (b.logo) return `<img class="logo-img" src="${esc(b.logo)}" alt="${esc(t)}" height="52">`;
  return `${LOGO_MARK}<span class="logo-text"><b>${esc(t)}</b>${b.subtitle ? `<small>${esc(b.subtitle)}</small>` : ''}</span>`;
};

// opts: title, desc, path (без path страница закрыта от индексации), active, body, image, type, jsonld, noindex
function layout(d, o) {
  const site = d.site, c = site.contacts, seo = site.seo || {};
  const base = d.base || '';
  const noindex = o.noindex || !d.open || o.path === undefined;
  const title = o.rawTitle || (o.title ? o.title + ' — ' + site.name : (seo.title || site.name + ': ' + site.role));
  const headTags = S.head({ site, base, path: o.path === undefined ? '/' : o.path, title, desc: o.desc || seo.description, image: o.image, type: o.type, noindex, jsonld: o.jsonld || [], published: o.published, modified: o.modified });
  const active = o.active;
  const phoneHref = c.phone ? 'tel:' + c.phone.replace(/[^\d+]/g, '') : '';
  const wa = c.whatsappPhone ? 'https://wa.me/' + c.whatsappPhone.replace(/\D/g, '') : '';
  const op = site.operator || {};
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${headTags}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
${S.metrika(seo.metrikaId)}
</head>
<body>
<a class="skip" href="#main">К содержимому</a>
${d.demo ? `<div class="demobar"><div class="wrap"><span>Демонстрационный сайт: объекты, цены и данные вымышленные. Такой же сайт можно купить для себя или своего агентства.</span> <a href="${esc(d.demoUrl)}" rel="noopener" target="_blank">Узнать подробнее</a></div></div>` : ''}
<header class="top">
  <div class="wrap top-in">
    <a class="logo" href="/" aria-label="${esc(site.name)}, на главную">${logoHtml(site)}</a>
    <div class="top-contacts">
      ${c.phone ? `<a class="tc" href="${esc(phoneHref)}">${icon('phone', 16)}<span class="tc-txt">${esc(c.phone)}</span></a>` : ''}
      ${wa ? `<a class="tc" href="${esc(wa)}" rel="noopener">WhatsApp</a>` : ''}
      ${c.telegram ? `<a class="tc" href="https://t.me/${esc(c.telegram)}" rel="noopener">Telegram</a>` : ''}
      <a class="btn btn-sm" href="/contact/?s=${encodeURIComponent('Обратный звонок')}">Обратный звонок</a>
    </div>
    <button class="burger" aria-label="Меню" aria-expanded="false"><span></span><span></span></button>
  </div>
  <div class="navbar"><div class="wrap"><nav class="nav" aria-label="Основное меню">
    ${NAV.map(([k, h, t]) => `<a href="${h}"${active === k ? ' aria-current="page"' : ''}>${t}</a>`).join('')}
    <a class="btn btn-sm nav-cta" href="/contact/?s=${encodeURIComponent('Обратный звонок')}">Обратный звонок</a>
  </nav></div></div>
</header>
<main id="main">
${o.body}
</main>
<footer class="foot">
  <div class="wrap foot-in">
    <div>
      <div class="logo">${logoHtml(site, 'foot')}</div>
      <p class="muted">${esc(site.role)}</p>
      <p class="foot-reqs">${[op.name, op.inn ? 'ИНН ' + op.inn : '', op.ogrnip ? 'ОГРНИП ' + op.ogrnip : '', op.address].filter(Boolean).map(esc).join('<br>') || '<span class="tbd">Реквизиты заполняются в админке</span>'}</p>
    </div>
    <div class="foot-links">
      ${NAV.filter(n => n[0] !== 'steps').map(([k, h, t]) => `<a href="${h}">${t}</a>`).join('')}
      <a href="/partners/">Партнёрам</a>
      <a href="/privacy/">Политика обработки персональных данных</a>
    </div>
    <div class="foot-links">
      ${c.phone ? `<a href="${esc(phoneHref)}">${esc(c.phone)}</a>` : ''}
      ${wa ? `<a href="${esc(wa)}" rel="noopener">WhatsApp</a>` : ''}
      ${c.telegram ? `<a href="https://t.me/${esc(c.telegram)}" rel="noopener">Telegram</a>` : ''}
      ${c.channel ? `<a href="${esc(c.channel)}" rel="noopener">Telegram-канал</a>` : ''}
      ${c.vk ? `<a href="${esc(c.vk)}" rel="noopener">ВКонтакте</a>` : ''}
      ${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}
      ${c.city ? `<span class="muted">${esc(c.city)}</span>` : ''}
    </div>
  </div>
  <div class="wrap muted small">© ${new Date().getFullYear()} ${esc(site.name)}</div>
</footer>
<script src="/assets/main.js"></script>
</body>
</html>
`;
}

// ---------- Общие блоки ----------
const imgOrCover = (src, alt, type, acc, ic, cls = '') => src
  ? `<img class="photo ${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`
  : V.cover(type || 'flat', acc || 'blue', ic || 'home');

function svcCard(s) {
  return `<a class="card svc-card acc-${V.accent(s.accent)}" href="/services/${esc(s.id)}/">
    <div class="card-img">${imgOrCover(s.image, s.title, 'flat', s.accent, s.icon)}<span class="card-ico">${icon(s.icon || 'home', 22)}</span></div>
    <h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>
    <div class="card-foot"><span class="price">${price(s.price, s.from, s.unit)}</span><span class="muted small">Подробнее →</span></div>
  </a>`;
}

// ---------- Объекты ----------
const DEAL = { sale: 'Продажа', rent: 'Аренда' };
const STATUS = { active: '', reserved: 'В резерве', sold: 'Продано' };
const roomsShort = r => (r === 0 || r === '0') ? 'Студия' : r ? r + '-к' : '';
const objPrice = i => i.price == null ? 'Цена по запросу' : rubK(i.price) + (i.deal === 'rent' ? ' <small>в месяц</small>' : '');
const num1 = n => String(n).replace('.', ',');
// Комиссия агента по объекту в рублях (для оформления заказа в админке)
function commissionOf(i) {
  if (i.price == null) return null;
  const pct = Number.isFinite(Number(i.commission)) ? Number(i.commission) : (i.deal === 'rent' ? 50 : 2);
  return Math.round(i.price * pct / 100) / 100;
}
const pricePerM = i => i.deal === 'sale' && i.price != null && i.area ? rub(Math.round(i.price / 100 / i.area)) + ' за м²' : '';
function specs(i) {
  const f = (a, b) => b !== undefined && b !== null && b !== '' ? [a, b] : null;
  return [
    f('Комнат', i.rooms === 0 || i.rooms === '0' ? 'студия' : i.rooms), f('Площадь', i.area ? num1(i.area) + ' м²' : ''), f('Кухня', i.kitchen ? num1(i.kitchen) + ' м²' : ''),
    f('Этаж', i.floor ? i.floor + (i.floors ? ' из ' + i.floors : '') : ''), f('Год постройки', i.year), f('Дом', i.houseType), f('Состояние', i.condition), f('Район', i.district),
    f('Ипотека', i.deal === 'sale' ? (i.mortgage ? 'возможна' : 'не рассматривается') : ''), f('Цена за м²', pricePerM(i)),
  ].filter(Boolean);
}

function objectCard(i) {
  const cover = i.image || ((i.photos || [])[0] && i.photos[0].src);
  const st = STATUS[i.status] || '';
  const facts = [roomsShort(i.rooms), i.area ? num1(i.area) + ' м²' : '', i.floor ? i.floor + (i.floors ? '/' + i.floors : '') + ' эт.' : ''].filter(Boolean).join(' · ');
  return `<a class="card obj${i.status === 'sold' ? ' is-sold' : ''} acc-${V.accent(i.accent)}" href="/objects/${esc(i.slug)}/">
    <div class="card-img">${imgOrCover(cover, i.title, 'flat', i.accent, i.icon)}<span class="deal deal-${esc(i.deal || 'sale')}">${esc(DEAL[i.deal] || 'Продажа')}</span>${st ? `<span class="deal-st">${esc(st)}</span>` : ''}</div>
    <div class="card-top"><span class="muted small">${esc([i.district, facts].filter(Boolean).join(' · '))}</span></div>
    <h3>${esc(i.title)}</h3><p>${esc(i.summary)}</p>
    <div class="card-foot"><span class="price">${objPrice(i)}</span><span class="muted small">${esc(pricePerM(i))}</span></div>
  </a>`;
}
const sortObjects = list => list.slice().sort((a, b) => ((a.status === 'sold') - (b.status === 'sold')) || ((a.status === 'reserved') - (b.status === 'reserved')));

function postCard(p) {
  return `<a class="card post-card" href="/blog/${esc(p.slug)}/">
    ${p.cover ? `<div class="card-img"><img class="photo" src="${esc(p.cover)}" alt="${esc(p.title)}" loading="lazy" decoding="async"></div>` : `<div class="card-img acc-teal">${V.cover('flat', 'blue', 'book')}<span class="card-ico">${icon('book', 22)}</span></div>`}
    <div class="card-top"><span class="muted small">${esc(dateRu(p.date))}</span></div>
    <h3>${esc(p.title)}</h3><p>${esc(p.excerpt || R.plain(p.body, 140))}</p>
  </a>`;
}

function crumbs(items) { return `<p class="crumbs">${items.map(([t, h]) => h ? `<a href="${h}">${esc(t)}</a>` : esc(t)).join(' / ')}</p>`; }

function cta(d) {
  return `<section class="sec"><div class="wrap"><div class="cta">
    <div><h2>Расскажите о вашей задаче</h2><p>Продать, купить или сдать квартиру: оставьте заявку, я перезвоню, уточню детали и назову порядок действий. Первая консультация по телефону бесплатная.</p></div>
    <a class="btn btn-light" href="/contact/">Оставить заявку</a>
  </div></div></section>`;
}

// Цифры из настроек партнёрской программы
function facts_(d) { return facts(d); }
function facts(d, extra = []) {
  const s = d.settings, r = s.rates.service, sum = r.l1 + r.l2 + r.l3;
  const list = [
    { icon: 'tree', value: '3', label: 'линии партнёров' },
    { icon: 'percent', value: `${r.l1}/${r.l2}/${r.l3} %`, label: `ставки по линиям на услуги, сумма ${sum} %` },
    { icon: 'clock', value: `${s.holdDays} дн.`, label: 'удержание до выплаты' },
    { icon: 'wallet', value: rubK(s.minPayout), label: 'минимальная выплата' },
  ].concat(extra);
  return `<div class="facts-band">${list.map(f => `<div class="fact">${ibadge(f.icon, 'teal', 22)}<b>${esc(f.value)}</b><span>${esc(f.label)}</span></div>`).join('')}</div>`;
}

function flow(d) {
  const f = d.sol.base.partnerFlow || [];
  return `<ol class="flow">${f.map((s, n) => `<li>${ibadge(s.icon, 'teal', 24)}<b>${esc(s.title)}</b><span>${esc(s.text)}</span>${n < f.length - 1 ? `<i class="flow-arrow">${icon('arrow', 18)}</i>` : ''}</li>`).join('')}</ol>`;
}

function commissionViz(d, type = 'service', sample = 2000, what = 'заказ') {
  const s = d.settings, r = s.rates[type], cap = 25, sum = r.l1 + r.l2 + r.l3;
  const rows = [['1-я линия', 'Вы привели клиента', r.l1], ['2-я линия', 'Клиента привёл партнёр, которого пригласили вы', r.l2], ['3-я линия', 'Следующий уровень цепочки', r.l3]];
  return `<div class="viz"><div class="viz-bars">${rows.map(([t, x, v], n) => `<div class="viz-row"><div class="viz-lbl"><b>${t}</b><small>${x}</small></div><div class="viz-track"><div class="viz-fill l${n + 1}" style="width:${Math.max(4, v / cap * 100)}%"></div></div><div class="viz-val">${v} %</div></div>`).join('')}</div>
  <div class="viz-total"><div class="viz-track"><div class="viz-fill all" style="width:${sum / cap * 100}%"></div></div><small>Сумма ставок ${sum} % из возможных ${cap} %</small></div>
  <div class="viz-example"><b>Пример расчёта</b><span>Пример: ${what} ${rub(sample)}. 1-я линия получает ${rub(Math.round(sample * r.l1 / 100))}, 2-я ${rub(Math.round(sample * r.l2 / 100))}, 3-я ${rub(Math.round(sample * r.l3 / 100))}.</span></div></div>`;
}

function metrics(k) {
  return k.metrics && k.metrics.length ? `<div class="metrics">${k.metrics.map(m => `<div class="metric"><b>${esc(m.value)}</b><span>${esc(m.label)}</span></div>`).join('')}</div>` : '';
}

// ---------- Главная ----------
function consentLabel() { return '<label class="consent-mini"><input type="checkbox" name="consent" value="1" required> <span>Согласен на обработку персональных данных по <a href="/privacy/" target="_blank">политике</a></span></label>'; }

function home(d) {
  const site = d.site, t = site.trainer || {}, seo = site.seo || {}, hero = site.hero || {}, about = site.about || {}, quiz = site.quiz || {}, mag = site.leadMagnet || {};
  const k = d.cases.items.filter(x => x.public);
  const posts = d.posts.slice(0, 3);
  const faqs = d.sol.base.faq || [];
  const live = sortObjects(d.sol.items).filter(i => i.status !== 'sold').slice(0, 6);
  const sticker = hero.sticker && hero.sticker.confirmed && hero.sticker.text ? hero.sticker.text : '';
  const facts = (hero.facts || []).map(f => f.confirmed && f.value ? `<li><b>${esc(f.value)}</b><span>${esc(f.label)}</span></li>` : `<li class="nov"><b>${icon('check', 22)}</b><span>${esc(f.label)}</span></li>`).join('');
  const aboutPhoto = about.photo || t.photo;
  const cityName = site.contacts.city || '';
  return layout(d, {
    path: '/', active: '', desc: seo.description, body: `
<section class="hero">
  <div class="wrap hero-in">
    <div>
      ${hero.badge ? `<span class="badge-pill">${esc(hero.badge)}</span>` : ''}
      <h1>${esc(hero.title || site.role)}</h1>
      <p class="lead">${esc(hero.subtitle || site.tagline)}</p>
      <ul class="hero-facts">${facts}</ul>
      <form class="quick" method="post" action="/contact">
        <input name="name" placeholder="Ваше имя" required autocomplete="name" aria-label="Ваше имя">
        <input name="contact" placeholder="Телефон или Telegram" required autocomplete="tel" aria-label="Телефон">
        <input type="hidden" name="solution" value="Быстрая заявка с главной">
        <button class="btn" type="submit">${esc(hero.cta || 'Получить консультацию')}</button>
        ${consentLabel()}
      </form>
      ${hero.micro ? `<p class="muted small">${esc(hero.micro)}</p>` : ''}
    </div>
    <div class="hero-photo${t.photo ? ' has' : ' noimg'}">${t.photo ? `<img class="photo" src="${esc(t.photo)}" alt="${esc(site.name)}, брокер по недвижимости ${esc(cityName)}" width="520" height="650" fetchpriority="high">` : V.cover('flat', 'indigo', 'home')}${sticker ? `<div class="sticker">${esc(sticker)}</div>` : ''}</div>
  </div>
</section>

${quiz.enabled !== false && (quiz.goals || []).length ? `<section class="sec" id="quiz"><div class="wrap">
  <div class="quiz" data-quiz>
    <h2>${esc(quiz.title || 'Подберу варианты под вашу задачу')}</h2>
    <div class="quiz-steps"><i class="on"></i><i></i><i></i><i></i></div>
    <div class="quiz-step on" data-step="0"><p class="quiz-q">Что вы хотите сделать?</p><div class="quiz-opts">${quiz.goals.map(x => `<button type="button" data-k="goal" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>
    <div class="quiz-step" data-step="1"><p class="quiz-q">Какой у вас бюджет?</p><div class="quiz-opts">${(quiz.budgets || []).map(x => `<button type="button" data-k="budget" data-v="${esc(x)}">${esc(x)}</button>`).join('')}<button type="button" data-k="budget" data-v="Пока не определился">Пока не определился</button></div><button type="button" class="quiz-back">Назад</button></div>
    <div class="quiz-step" data-step="2"><p class="quiz-q">Какой район интересует?</p><div class="quiz-opts">${(quiz.districts || []).map(x => `<button type="button" data-k="district" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div><button type="button" class="quiz-back">Назад</button></div>
    <div class="quiz-step" data-step="3"><p class="quiz-sum" data-sum></p>
      <form method="post" action="/contact"><input type="hidden" name="solution" value="Подбор через квиз"><input type="hidden" name="text" data-text>
        <input name="name" placeholder="Ваше имя" required autocomplete="name"><input name="contact" placeholder="Телефон или Telegram" required autocomplete="tel">${consentLabel()}
        <button class="btn" type="submit">Получить подборку</button></form><button type="button" class="quiz-back">Назад</button></div>
    <noscript><p><a class="btn" href="/contact/">Оставить заявку</a></p></noscript>
  </div>
</div></section>` : ''}

${live.length ? `<section class="sec alt"><div class="wrap">
  <div class="sec-head"><h2>Каталог объектов</h2><a href="/objects/">Все объекты →</a></div>
  <div class="grid">${live.map(objectCard).join('')}</div>
</div></section>` : ''}

<section class="sec"><div class="wrap about-home">
  <div class="ph">${aboutPhoto ? `<img class="photo" src="${esc(aboutPhoto)}" alt="${esc(site.name)} за работой с клиентом" loading="lazy" width="520" height="650">` : V.cover('flat', 'indigo', 'home')}</div>
  <div><p class="eyebrow">Обо мне</p><h2>${esc(about.title || t.name || site.name)}</h2>
  ${(about.paragraphs || t.about || []).map(x => `<p>${esc(x)}</p>`).join('')}
  <div class="principles">${(about.principles || []).map(x => `<div class="principle"><span class="gico">${icon(x.icon || 'check', 22)}</span><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`).join('')}</div>
  <a class="btn btn-ghost" href="/about/">Подробнее обо мне</a></div>
</div></section>

<section class="sec alt"><div class="wrap">
  <div class="sec-head"><h2>Услуги и специализация</h2><a href="/services/">Все услуги →</a></div>
  <div class="grid">${d.srv.items.slice(0, 3).map(svcCard).join('')}</div>
</div></section>

<section class="sec" id="steps"><div class="wrap">
  <h2>Пошаговый путь к вашей цели</h2>
  <ol class="road">${(site.steps || []).map(x => `<li><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></li>`).join('')}</ol>
</div></section>

${k.length ? `<section class="sec alt"><div class="wrap"><div class="sec-head"><h2>Кейсы и отзывы</h2><a href="/stories/">Все истории →</a></div>
<div class="slider">${k.map(c => `<a class="case-card" href="/stories/#${esc(c.slug)}" style="text-decoration:none;color:inherit"><div class="im">${c.photo ? `<img class="photo" src="${esc(c.photo)}" alt="${esc(c.title)}" loading="lazy">` : V.cover('flat', 'pink', 'heart')}</div><div class="tx"><h3>${esc(c.title)}</h3><p>${esc(c.task)}</p><p class="gain">${esc(c.status)}</p></div></a>`).join('')}</div></div></section>` : ''}

${posts.length ? `<section class="sec ${k.length ? '' : 'alt'}"><div class="wrap"><div class="sec-head"><h2>Блог о недвижимости</h2><a href="/blog/">Все статьи →</a></div>
<div class="grid">${posts.map(postCard).join('')}</div></div></section>` : ''}

${mag.enabled !== false && mag.title ? `<section class="sec"><div class="wrap"><div class="magnet">
  <div><p class="eyebrow">Бесплатно</p><h2>${esc(mag.title)}</h2><p>${esc(mag.text)}</p>${mag.href ? `<p><a href="${esc(mag.href)}">Читать на сайте →</a></p>` : ''}</div>
  <form method="post" action="/contact"><input type="hidden" name="solution" value="Чек-лист"><input name="name" placeholder="Ваше имя" required autocomplete="name"><input name="contact" placeholder="Телефон, Telegram или e-mail" required>${consentLabel()}<button class="btn" type="submit">${esc(mag.button || 'Получить чек-лист')}</button></form>
</div></div></section>` : ''}

<section class="sec alt"><div class="wrap split">
  <div><p class="eyebrow">Партнёрская программа</p><h2>Рекомендуйте брокера и получайте процент от комиссии</h2>
  <p>Юристам, ипотечным брокерам, застройщикам и знакомым, которые знают, кто ищет жильё: приводите клиентов по личной ссылке и получайте вознаграждение с закрытых сделок. Вход бесплатный.</p>
  <a class="btn btn-ghost" href="/partners/">Условия программы</a></div>
  ${facts_(d)}
</div></section>

${faqs.length ? `<section class="sec"><div class="wrap narrow"><h2>Частые вопросы</h2>${faqs.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>` : ''}

<section class="sec alt" id="lead"><div class="wrap"><div class="cta">
  <div><h2>Планируете покупку или продажу в ближайшие месяцы?</h2><p>Опишите задачу или задайте вопрос: подготовлю оценку стоимости вашего объекта или обзор рынка под ваш бюджет.</p></div>
  <form class="lead-form" method="post" action="/contact"><input type="hidden" name="solution" value="Заявка из подвала главной">
    <input name="name" placeholder="Ваше имя" required autocomplete="name"><input name="contact" placeholder="Номер телефона" required autocomplete="tel">
    <div class="chan"><span>Где удобнее ответ:</span><label><input type="radio" name="text" value="Ответ: WhatsApp" checked> WhatsApp</label><label><input type="radio" name="text" value="Ответ: Telegram"> Telegram</label><label><input type="radio" name="text" value="Ответ: звонок"> Звонок</label></div>
    ${consentLabel()}<button class="btn btn-light" type="submit">Заказать консультацию</button></form>
</div></div></section>
`,
    jsonld: [S.business(site, d.base), ...(faqs.length ? [S.faq(faqs)] : [])],
  });
}

function storyCard(c) {
  return `<a class="card" href="/stories/#${esc(c.slug)}">
    <div class="card-img acc-pink">${c.photo ? `<img class="photo" src="${esc(c.photo)}" alt="${esc(c.title)}" loading="lazy" decoding="async">` : V.cover('flat', 'pink', 'heart')}</div>
    <h3>${esc(c.title)}</h3><p>${esc(c.task)}</p></a>`;
}

// ---------- Услуги и цены ----------
function servicesPage(d) {
  const site = d.site, ci = cityIn(d);
  return layout(d, {
    path: '/services/', active: 'services/', title: `Услуги агента по недвижимости ${ci} и цены`,
    desc: `Продажа, покупка и аренда квартир ${ci}: услуги агента, комиссия, консультация и юридическая проверка объекта. ${site.name}.`,
    body: `
<section class="page-head"><div class="wrap">
  ${crumbs([['Главная', '/'], ['Услуги и цены']])}
  <h1>Услуги агента по недвижимости ${esc(ci)} и цены</h1>
  <p class="lead">Размер вознаграждения называю до начала работы и фиксирую в договоре. Если задача нестандартная, стоимость обсуждаем после первой встречи.</p>
</div></section>
<section class="sec tight"><div class="wrap">
  <div class="grid svc-grid">${d.srv.items.map(svcCard).join('')}</div>
</div></section>
<section class="sec alt"><div class="wrap">
  <div class="sec-head"><h2>Объекты</h2><a href="/objects/">Все объекты →</a></div>
  <div class="grid">${sortObjects(d.sol.items).filter(i => i.status !== 'sold').slice(0, 3).map(objectCard).join('')}</div>
</div></section>
${cta(d)}`,
    jsonld: [S.breadcrumbs(d.base, [['Главная', '/'], ['Услуги и цены', '/services/']])],
  });
}

function servicePage(d, s) {
  const site = d.site, ci = cityIn(d);
  const url = `/services/${s.id}/`;
  const others = d.srv.items.filter(x => x.id !== s.id);
  return layout(d, {
    path: url, active: 'services/', title: `${s.title} ${ci}`, desc: s.seoDesc || `${s.title} ${ci}. ${s.text}`, image: s.image,
    body: `
<section class="page-head"><div class="wrap sol-head">
  <div>
    ${crumbs([['Главная', '/'], ['Услуги и цены', '/services/'], [s.title]])}
    <h1>${esc(s.title)} ${esc(ci)}</h1>
    <p class="lead">${esc(s.text)}</p>
    ${s.image ? `<img class="photo wide" src="${esc(s.image)}" alt="${esc(s.title)}" loading="lazy">` : ''}
  </div>
  <aside class="buy acc-${V.accent(s.accent)}">
    <div class="buy-price">${price(s.price, s.from, s.unit)}</div>
    <a class="btn" href="/contact/?s=${encodeURIComponent(s.title)}">Оставить заявку</a>
    <p class="small muted">Условия и порядок оплаты фиксируются в договоре. Консультацию можно оплатить на сайте после согласования.</p>
  </aside>
</div></section>
${(s.details || []).length ? `<section class="sec tight"><div class="wrap"><h2>Что входит</h2><ul class="checks">${s.details.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></section>` : ''}
${others.length ? `<section class="sec alt"><div class="wrap"><h2>Другие услуги</h2><div class="grid">${others.map(svcCard).join('')}</div></div></section>` : ''}
${cta(d)}`,
    jsonld: [S.breadcrumbs(d.base, [['Главная', '/'], ['Услуги и цены', '/services/'], [s.title, url]]), {
      '@context': 'https://schema.org', '@type': 'Service', name: s.title, description: s.text, provider: { '@id': d.base + '/#business' },
      ...(site.contacts.city ? { areaServed: { '@type': 'City', name: site.contacts.city } } : {}),
      ...(s.price != null ? { offers: { '@type': 'Offer', price: String(Math.round(s.price / 100)), priceCurrency: 'RUB', availability: 'https://schema.org/InStock' } } : {}),
    }],
  });
}

// ---------- Объекты ----------
function objectsPage(d, q = {}) {
  const ci = cityIn(d);
  const all = sortObjects(d.sol.items);
  const districts = [...new Set(all.map(i => i.district).filter(Boolean))];
  const deal = ['sale', 'rent'].includes(q.deal) ? q.deal : '';
  const rooms = q.rooms !== undefined && q.rooms !== '' && /^\d+$/.test(q.rooms) ? Number(q.rooms) : null;
  const district = districts.includes(q.district) ? q.district : '';
  const sortKey = ['asc', 'desc'].includes(q.sort) ? q.sort : '';
  let list = all.filter(i => (!deal || i.deal === deal) && (rooms === null || (rooms >= 4 ? Number(i.rooms) >= 4 : Number(i.rooms) === rooms)) && (!district || i.district === district));
  if (sortKey) list = list.slice().sort((a, b) => ((a.price ?? Infinity) - (b.price ?? Infinity)) * (sortKey === 'asc' ? 1 : -1));
  const opt = (v, t, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(t)}</option>`;
  const filtered = deal || rooms !== null || district || sortKey;
  return layout(d, {
    path: '/objects/', active: 'objects/', title: `Квартиры ${ci}: продажа и аренда`,
    desc: `Квартиры ${ci}: продажа и аренда, цены, площадь, район, фото. Показ по записи. Агент по недвижимости ${d.site.name}.`,
    noindex: !!filtered,
    body: `
<section class="page-head"><div class="wrap">
  ${crumbs([['Главная', '/'], ['Объекты']])}
  <h1>Квартиры ${esc(ci)}: продажа и аренда</h1>
  <p class="lead">Показываю объекты, которые проверила сама. Не нашли подходящий вариант: оставьте заявку, подберу под ваш бюджет, в том числе из тех, что ещё не опубликованы.</p>
</div></section>
<section class="sec tight"><div class="wrap">
  <form class="filter" method="get" action="/objects/">
    <label>Тип<select name="deal">${opt('', 'Продажа и аренда', deal)}${opt('sale', 'Продажа', deal)}${opt('rent', 'Аренда', deal)}</select></label>
    <label>Комнат<select name="rooms">${opt('', 'Любое', rooms === null ? '' : rooms)}${opt('0', 'Студия', rooms)}${opt('1', '1', rooms)}${opt('2', '2', rooms)}${opt('3', '3', rooms)}${opt('4', '4 и больше', rooms)}</select></label>
    <label>Район<select name="district">${opt('', 'Любой', district)}${districts.map(x => opt(x, x, district)).join('')}</select></label>
    <label>Сортировка<select name="sort">${opt('', 'Сначала актуальные', sortKey)}${opt('asc', 'Сначала дешевле', sortKey)}${opt('desc', 'Сначала дороже', sortKey)}</select></label>
    <button class="btn btn-sm" type="submit">Показать</button>${filtered ? ' <a class="btn btn-ghost btn-sm" href="/objects/">Сбросить</a>' : ''}
  </form>
  ${list.length ? `<div class="grid">${list.map(objectCard).join('')}</div>` : '<p class="lead">По вашим условиям объектов нет. Оставьте заявку: подберу варианты, которые ещё не опубликованы.</p>'}
</div></section>
${cta(d)}`,
    jsonld: [S.breadcrumbs(d.base, [['Главная', '/'], ['Объекты', '/objects/']])],
  });
}

function objectPage(d, i) {
  const site = d.site, ci = cityIn(d);
  const url = `/objects/${i.slug}/`;
  const faqs = d.sol.base.faq || [];
  const photos = (i.photos || []).filter(x => x.src);
  const main = i.image || (photos[0] && photos[0].src) || '';
  const rest = i.image ? photos : photos.slice(1);
  const st = STATUS[i.status] || '';
  const sp = specs(i);
  const others = sortObjects(d.sol.items).filter(x => x.slug !== i.slug && x.status !== 'sold' && x.deal === i.deal).slice(0, 3);
  const avail = i.status === 'sold' ? 'https://schema.org/SoldOut' : i.status === 'reserved' ? 'https://schema.org/LimitedAvailability' : 'https://schema.org/InStock';
  const cta2 = i.status === 'sold' ? 'Подобрать похожий объект' : 'Записаться на просмотр';
  return layout(d, {
    path: url, active: 'objects/', title: i.seoTitle || `${i.title}, ${i.deal === 'rent' ? 'аренда' : 'продажа'} ${ci}`, rawTitle: i.seoTitle ? i.seoTitle + ' — ' + site.name : '', desc: i.seoDesc || i.summary, image: main,
    body: `
<section class="page-head"><div class="wrap sol-head">
  <div>
    ${crumbs([['Главная', '/'], ['Объекты', '/objects/'], [i.title]])}
    <p class="badges"><span class="deal deal-${esc(i.deal || 'sale')} inline">${esc(DEAL[i.deal] || 'Продажа')}</span>${st ? `<span class="deal-st inline">${esc(st)}</span>` : ''}${i.district ? `<span class="muted small">${esc(i.district)}</span>` : ''}</p>
    <h1>${esc(i.title)}</h1>
    <p class="lead">${esc(i.summary)}</p>
    ${main ? `<img class="photo wide" src="${esc(main)}" alt="${esc(i.title)}" fetchpriority="high">` : `<div class="obj-cover acc-${V.accent(i.accent)}">${V.cover('flat', i.accent, i.icon)}</div>`}
    ${rest.length ? `<div class="gallery">${rest.map(x => `<figure><a href="${esc(x.src)}" target="_blank" rel="noopener"><img class="photo" src="${esc(x.src)}" alt="${esc(x.alt || i.title)}" loading="lazy" decoding="async"></a></figure>`).join('')}</div>` : ''}
  </div>
  <aside class="buy acc-${V.accent(i.accent)}">
    <div class="buy-price">${objPrice(i)}</div>
    ${pricePerM(i) ? `<div class="muted">${esc(pricePerM(i))}</div>` : ''}
    ${i.address ? `<div class="muted">${esc(i.address)}</div>` : ''}
    <a class="btn" href="/contact/?s=${encodeURIComponent(i.title)}">${cta2}</a>
    <p class="small muted">Показ по записи. Цена и условия сделки уточняются при обращении. Информация на сайте не является публичной офертой (ст. 437 ГК РФ).</p>
  </aside>
</div></section>
${sp.length ? `<section class="sec tight"><div class="wrap"><h2>Характеристики</h2><dl class="specs">${sp.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl></div></section>` : ''}
${(i.description || []).length ? `<section class="sec alt"><div class="wrap narrow"><h2>Об объекте</h2>${i.description.map(x => `<p>${esc(x)}</p>`).join('')}${i.video ? R.render('@видео ' + i.video) : ''}</div></section>` : ''}
${(i.features || []).length ? `<section class="sec tight"><div class="wrap"><h2>Преимущества</h2><ul class="checks">${i.features.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></section>` : ''}
${others.length ? `<section class="sec alt"><div class="wrap"><h2>Похожие объекты</h2><div class="grid">${others.map(objectCard).join('')}</div></div></section>` : ''}
${faqs.length ? `<section class="sec"><div class="wrap narrow"><h2>Вопросы и ответы</h2>${faqs.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>` : ''}
${cta(d)}`,
    jsonld: [S.breadcrumbs(d.base, [['Главная', '/'], ['Объекты', '/objects/'], [i.title, url]]), {
      '@context': 'https://schema.org', '@type': 'Product', name: i.title, description: i.summary, url: d.base + url,
      ...(main ? { image: S.abs(d.base, main) } : {}),
      ...(i.price != null ? { offers: { '@type': 'Offer', price: String(Math.round(i.price / 100)), priceCurrency: 'RUB', availability: avail, url: d.base + url, ...(i.deal === 'rent' ? { priceSpecification: { '@type': 'UnitPriceSpecification', price: String(Math.round(i.price / 100)), priceCurrency: 'RUB', unitText: 'MON' } } : {}) } } : {}),
      additionalProperty: sp.map(([name, value]) => ({ '@type': 'PropertyValue', name, value: String(value) })),
    }, ...(faqs.length ? [S.faq(faqs)] : [])],
  });
}

// ---------- Истории ----------
function storiesPage(d) {
  const items = d.cases.items.filter(c => c.public);
  const ci = cityIn(d);
  return layout(d, {
    path: '/stories/', active: '', title: `Отзывы и сделки: результаты работы агента ${ci}`,
    desc: `Реальные истории клиентов: с чем пришли, как проходила сделка и какой получился результат. Агент по недвижимости ${d.site.name}.`,
    body: `
<section class="page-head"><div class="wrap">
  ${crumbs([['Главная', '/'], ['Отзывы и сделки']])}
  <h1>Отзывы и сделки</h1>
  <p class="lead">С чем приходят клиенты, как проходит сделка и что получается в итоге.</p>
</div></section>
<section class="sec tight"><div class="wrap">
  ${items.length ? items.map(c => `<article class="case" id="${esc(c.slug)}">
    <div><h2>${esc(c.title)}</h2><p class="muted">${esc(c.client)}</p>
    ${c.photo || c.photoAfter ? `<div class="ba">${c.photo ? `<figure><img class="photo" src="${esc(c.photo)}" alt="${esc(c.title)}" loading="lazy"><figcaption>Было</figcaption></figure>` : ''}${c.photoAfter ? `<figure><img class="photo" src="${esc(c.photoAfter)}" alt="${esc(c.title)}" loading="lazy"><figcaption>Стало</figcaption></figure>` : ''}</div>` : ''}
    ${metrics(c)}
    <h3>Задача</h3><p>${esc(c.task)}</p>
    <h3>Результат</h3><p>${esc(c.status)}</p>
    ${c.video ? R.render('@видео ' + c.video) : ''}</div>
    <div><h3>Что сделано</h3><ul class="checks">${(c.done || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
  </article>`).join('') : '<p class="lead">Истории появятся здесь после согласования с клиентами.</p>'}
</div></section>
${cta(d)}`,
    jsonld: [S.breadcrumbs(d.base, [['Главная', '/'], ['Отзывы и сделки', '/stories/']])],
  });
}

// ---------- Блог ----------
function blogPage(d) {
  const ci = cityIn(d);
  return layout(d, {
    path: '/blog/', active: 'blog/', title: 'Блог о недвижимости',
    desc: `Статьи агента по недвижимости ${ci}: как продать, купить и сдать квартиру, проверка документов, ипотека, налоги, выбор района.`,
    body: `
<section class="page-head"><div class="wrap">
  ${crumbs([['Главная', '/'], ['Блог']])}
  <h1>Блог о недвижимости</h1>
  <p class="lead">Практические советы: как продать, купить и сдать квартиру, проверить документы и не потерять деньги.</p>
</div></section>
<section class="sec tight"><div class="wrap">
  ${d.posts.length ? `<div class="grid">${d.posts.map(postCard).join('')}</div>` : '<p class="lead">Статьи скоро появятся.</p>'}
</div></section>
${cta(d)}`,
    jsonld: [S.breadcrumbs(d.base, [['Главная', '/'], ['Блог', '/blog/']])],
  });
}

function postPage(d, p) {
  const site = d.site, url = `/blog/${p.slug}/`;
  const body = R.render(p.body);
  const more = d.posts.filter(x => x.slug !== p.slug).slice(0, 3);
  const desc = p.seoDesc || p.excerpt || R.plain(p.body, 160);
  return layout(d, {
    path: url, active: 'blog/', rawTitle: (p.seoTitle || p.title) + ' — ' + site.name, desc, image: p.cover, type: 'article', published: p.date, modified: p.updated || p.date,
    body: `
<article class="page-head post"><div class="wrap narrow">
  ${crumbs([['Главная', '/'], ['Блог', '/blog/'], [p.title]])}
  <h1>${esc(p.title)}</h1>
  <p class="muted small"><time datetime="${esc(p.date)}">${esc(dateRu(p.date))}</time> · ${R.readMinutes(p.body)} мин чтения · ${esc(site.name)}</p>
  ${p.cover ? `<img class="photo wide" src="${esc(p.cover)}" alt="${esc(p.title)}" fetchpriority="high">` : ''}
  <div class="post-body">${body}</div>
  ${(p.tags || []).length ? `<p class="tags">${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</p>` : ''}
</div></article>
<section class="sec"><div class="wrap narrow"><div class="cta"><div><h2>Нужна помощь со сделкой?</h2><p>Оставьте заявку: обсудим вашу задачу и порядок действий.</p></div><a class="btn btn-light" href="/contact/">Оставить заявку</a></div></div></section>
${more.length ? `<section class="sec alt"><div class="wrap"><h2>Читайте также</h2><div class="grid">${more.map(postCard).join('')}</div></div></section>` : ''}`,
    jsonld: [S.breadcrumbs(d.base, [['Главная', '/'], ['Блог', '/blog/'], [p.title, url]]), {
      '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: desc, datePublished: p.date, dateModified: p.updated || p.date,
      ...(p.cover ? { image: S.abs(d.base, p.cover) } : {}),
      author: { '@type': 'Person', name: (site.trainer && site.trainer.name) || site.name }, publisher: { '@id': d.base + '/#business' }, mainEntityOfPage: d.base + url,
    }],
  });
}

// ---------- Об агенте, заявка, служебные ----------
function aboutPage(d) {
  const site = d.site, t = site.trainer || {}, ci = cityIn(d);
  const g = site.gallery || [];
  return layout(d, {
    path: '/about/', active: 'about/', title: `Об агенте: ${t.name || site.name}`,
    desc: `${t.name || site.name}: агент по недвижимости ${ci}${t.experience ? ', опыт ' + t.experience.toLowerCase() : ''}. ${(t.credentials || []).join(', ')}.`, image: t.photo,
    body: `
<section class="page-head"><div class="wrap about">
  <div class="about-photo acc-blue${t.photo ? '' : ' noimg'}">${t.photo ? `<img class="photo" src="${esc(t.photo)}" alt="${esc(t.name || site.name)}, агент по недвижимости" width="454" height="605">` : V.cover('flat', 'blue', 'home')}</div>
  <div>
    ${crumbs([['Главная', '/'], ['Об агенте']])}
    <h1>${esc(t.name || site.name)}</h1>
    <p class="lead">${esc(site.role)}</p>
    ${(t.about || []).map(p => `<p>${esc(p)}</p>`).join('')}
    ${(t.credentials || []).length ? `<ul class="checks">${t.credentials.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${(site.areas || []).length ? `<h3>Где работаю</h3><ul class="checks">${site.areas.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <div class="actions"><a class="btn" href="/contact/">Оставить заявку</a><a class="btn btn-ghost" href="/services/">Услуги и цены</a></div>
  </div>
</div></section>
${g.length ? `<section class="sec tight"><div class="wrap"><h2>Фото</h2><div class="gallery">${g.map(x => `<figure><a href="${esc(x.src)}" target="_blank" rel="noopener"><img class="photo" src="${esc(x.src)}" alt="${esc(x.alt || 'Фото')}" loading="lazy" decoding="async"></a></figure>`).join('')}</div></div></section>` : ''}
${cta(d)}`,
    jsonld: [S.business(site, d.base), S.breadcrumbs(d.base, [['Главная', '/'], ['Об агенте', '/about/']])],
  });
}

function contactPage(d, { s = '', ref = '', errs = [], form = {} } = {}) {
  const sel = form.solution || s || '';
  const c = d.site.contacts;
  const opts = d.srv.items.map(i => i.title).concat(d.sol.items.filter(i => i.status !== 'sold').map(i => i.title)).concat(['Другое']);
  return layout(d, {
    path: '/contact/', active: '', title: 'Оставить заявку', desc: `Заявка агенту по недвижимости ${cityIn(d)}: продажа, покупка, аренда, консультация. Оставьте контакт, и я перезвоню.`,
    body: `
<section class="page-head"><div class="wrap narrow">
  <h1>Оставить заявку</h1>
  <p class="lead">Коротко расскажите, что хотите продать, купить или сдать. Перезвоню в течение рабочего дня.</p>
  ${c.phone || c.telegram || c.whatsappPhone ? `<p class="actions">${c.phone ? `<a class="btn btn-ghost" href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${icon('phone', 18)} ${esc(c.phone)}</a>` : ''}${c.telegram ? `<a class="btn btn-ghost" href="https://t.me/${esc(c.telegram)}" rel="noopener">Telegram</a>` : ''}${c.whatsappPhone ? `<a class="btn btn-ghost" href="https://wa.me/${esc(c.whatsappPhone.replace(/\D/g, ''))}" rel="noopener">WhatsApp</a>` : ''}</p>` : ''}
  ${errs.length ? `<div class="alert">${errs.map(e => `<div>${esc(e)}</div>`).join('')}</div>` : ''}
  <form class="form" method="post" action="/contact">
    <label>Имя<input name="name" required autocomplete="name" value="${esc(form.name)}"></label>
    <label>Телефон или ник в мессенджере<input name="contact" required autocomplete="tel" value="${esc(form.contact)}"></label>
    <label>Что интересует<select name="solution"><option value="">Пока не выбрал</option>${opts.map(o => `<option${o === sel ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>
    <label>О задаче<textarea name="text" rows="4" placeholder="Район, тип квартиры, бюджет, сроки">${esc(form.text)}</textarea></label>
    <label>Код партнёра, если вас пригласили<input name="code" value="${esc(form.code || ref)}" placeholder="необязательно" maxlength="12"></label>
    <label class="check"><input type="checkbox" name="consent" value="1" required> <span>Согласен на обработку персональных данных по <a href="/privacy/" target="_blank">политике</a></span></label>
    <button class="btn" type="submit">Отправить заявку</button>
  </form>
</div></section>`,
    jsonld: [S.breadcrumbs(d.base, [['Главная', '/'], ['Записаться', '/contact/']])],
  });
}

function thanksPage(d, lead) {
  const c = d.site.contacts;
  const msg = encodeURIComponent(`Здравствуйте! Заявка №${lead.id} с сайта, ${lead.name}.`);
  const links = [
    c.telegram ? `<a class="btn btn-ghost" href="https://t.me/${esc(c.telegram)}">Написать в Telegram</a>` : '',
    c.whatsappPhone ? `<a class="btn btn-ghost" href="https://wa.me/${esc(c.whatsappPhone.replace(/\D/g, ''))}?text=${msg}">Написать в WhatsApp</a>` : '',
  ].join('');
  return layout(d, { title: 'Заявка принята', body: `
<section class="page-head"><div class="wrap narrow">
  <h1>Заявка №${lead.id} принята</h1>
  <p class="lead">Перезвоню по контакту, который вы оставили.</p>
  ${links ? `<div class="actions">${links}</div>` : ''}
  <p><a href="/">На главную</a></p>
</div></section>` });
}

function privacyPage(d) {
  const o = d.site.operator;
  const v = x => x ? esc(x) : '<span class="tbd">уточняется</span>';
  return layout(d, { path: '/privacy/', title: 'Политика обработки персональных данных', body: `
<section class="page-head"><div class="wrap narrow doc">
  <h1>Политика обработки персональных данных</h1>
  <p class="tbd-note">Черновик. Перед публикацией сайта заполнить реквизиты оператора в админке и согласовать текст с юристом.</p>
  <h2>1. Оператор</h2>
  <p>${v(o.name)}, ИНН ${v(o.inn)}${o.ogrnip ? ', ОГРНИП ' + esc(o.ogrnip) : ''}, адрес: ${v(o.address)}. Политика опубликована во исполнение ч. 2 ст. 18.1 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных».</p>
  <h2>2. Какие данные и зачем</h2>
  <p>Посетители, оставившие заявку: имя, телефон или ник в мессенджере, сведения о задаче и объекте недвижимости, код партнёра. Цель: ответ на заявку, заключение и исполнение договора на оказание услуг по недвижимости.</p>
  <p>Партнёры: ФИО, телефон, e-mail, пароль (хранится в виде хеша), сведения о налоговом статусе, ИНН и реквизиты для выплат. Цель: участие в партнёрской программе, расчёт и выплата вознаграждения.</p>
  <h2>3. Основание</h2>
  <p>Согласие субъекта, которое он даёт отметкой в форме (п. 1 ч. 1 ст. 6 и ст. 9 152-ФЗ), а также исполнение договора (п. 5 ч. 1 ст. 6).</p>
  <h2>4. Как обрабатываются</h2>
  <p>Данные хранятся в базе на сервере оператора на территории РФ (ч. 5 ст. 18 152-ФЗ). Передача третьим лицам: платёжному сервису, банку и Росреестру по сделке (при необходимости) и налоговым органам в объёме, необходимом для оплаты и выплат. На сайте может работать Яндекс Метрика: она собирает обезличенную статистику посещений.</p>
  <h2>5. Срок</h2>
  <p>Заявки: до достижения цели или отзыва согласия, но не дольше 1 года. Данные партнёров: на время участия и далее в пределах сроков, установленных налоговым и бухгалтерским законодательством.</p>
  <h2>6. Права субъекта</h2>
  <p>Получить сведения об обработке, потребовать уточнения или удаления данных, отозвать согласие (ст. 14 и ч. 2 ст. 9 152-ФЗ). Запрос направляется по контактам на сайте.</p>
</div></section>` });
}

function notFound(d) {
  return layout(d, { title: 'Страница не найдена', body: `<section class="page-head"><div class="wrap narrow"><h1>Страница не найдена</h1><p class="lead">Возможно, ссылка устарела. Загляните в раздел <a href="/objects/">«Объекты»</a>, <a href="/services/">«Услуги и цены»</a> или <a href="/blog/">блог</a>.</p><a class="btn" href="/">На главную</a></div></section>` });
}

module.exports = { files, load, missing, facts, flow, commissionViz, metrics, layout, esc, rub, price, cta, commissionOf, home, servicesPage, servicePage, objectsPage, objectPage, storiesPage, blogPage, postPage, aboutPage, contactPage, thanksPage, privacyPage, notFound, cityIn };
