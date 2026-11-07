'use strict';
// Админка сайта агента: сайт и SEO, объекты, услуги, отзывы, блог, фото.
// Эти страницы заменяют одноимённые из pages-app.js.
const A = require('./pages-app');
const P = require('./pages');
const V = require('../lib/visuals');
const { esc } = P;
const { adminShell, inp, sel, rubIn, flash, errs, POST } = A;

const SCRIPT = '<script src="/assets/admin.js"></script>';

// Поле с картинкой: ссылка или загрузка файла с компьютера
const imgField = (label, name, v, hint) => `<div class="imgfield"><label>${label}<input name="${name}" value="${esc(v || '')}" placeholder="Загрузите файл или вставьте ссылку https://..."></label>
<div class="imgrow"><label class="btn btn-ghost btn-sm upl">Загрузить фото<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden data-upload="${name}"></label><span class="upl-status muted small"></span>${v ? `<img class="thumb" src="${esc(v)}" alt="">` : ''}</div>${hint ? `<small class="muted">${hint}</small>` : ''}</div>`;
const chk = (label, name, on) => `<label class="check"><input type="checkbox" name="${name}" value="1"${on ? ' checked' : ''}> <span>${label}</span></label>`;

function adminSite(d, ctx, msg, e = []) {
  const s = d.site, c = s.contacts, o = s.operator, seo = s.seo || {}, t = s.trainer || {};
  return adminShell(d, ctx, 'site', `${flash(msg)}${errs(e)}${SCRIPT}<form class="form" method="post" action="/admin/site">
<h3>Главное</h3>
${inp('Имя или название', 'name', s.name)}${inp('Чем занимаетесь (это заголовок главной страницы)', 'role', s.role, { hint: 'Включите в заголовок специальность и город, например «Агент по недвижимости в Калининграде: продажа, аренда и подбор квартир».' })}${inp('Подзаголовок на главной', 'tagline', s.tagline, { textarea: 1, rows: 2 })}
${inp('Домен сайта', 'domain', s.domain, { ph: 'example.ru', hint: 'Без http:// и слэшей. Пока домен пустой, сайт закрыт от поисковиков. Укажите домен, когда сайт готов к запуску.' })}
<h3>Контакты</h3>
${inp('Телефон', 'phone', c.phone)}${inp('Telegram', 'telegram', c.telegram, { ph: 'ivan_ivanov', hint: 'Только имя пользователя' })}${inp('WhatsApp', 'whatsappPhone', c.whatsappPhone, { ph: '79001234567', hint: 'Номер с кодом страны, цифрами' })}${inp('E-mail', 'email', c.email)}${inp('Город', 'city', c.city)}
<h3>Об агенте</h3>
${inp('Имя на странице «Об агенте»', 'trainerName', t.name)}${inp('Опыт', 'experience', t.experience, { ph: 'Например: 8 лет на рынке Калининграда' })}
${imgField('Фото агента', 'trainerPhoto', t.photo, 'Лучше вертикальное фото, лицо крупно.')}
${inp('Рассказ о себе: каждый абзац с новой строки', 'about', (t.about || []).join('\n'), { textarea: 1, rows: 7 })}
${inp('Преимущества и подтверждения (опыт, сертификаты, членство): каждый пункт с новой строки', 'credentials', (t.credentials || []).join('\n'), { textarea: 1, rows: 3 })}
${inp('Где работаете (районы, города): каждый пункт с новой строки', 'areas', (s.areas || []).join('\n'), { textarea: 1, rows: 3 })}
<h3>Галерея</h3>
${inp('Фото галереи: по одному в строке, «адрес | подпись»', 'gallery', (s.gallery || []).map(g => g.src + ' | ' + g.alt).join('\n'), { textarea: 1, rows: 5, hint: 'Загрузите фото в разделе «Фото», скопируйте адрес и вставьте сюда. Подпись нужна для поисковиков.' })}
<h3>Поиск (SEO)</h3>
<p class="muted small">Эти поля влияют на то, как сайт выглядит в Яндексе и Google. Для каждой страницы заголовок и описание формируются автоматически, здесь общие значения для главной.</p>
${inp('Город в предложном падеже', 'cityIn', seo.cityIn, { ph: 'в Калининграде', hint: 'Подставляется в заголовки страниц: «Услуги агента по недвижимости в Калининграде».' })}
${inp('Заголовок главной в поиске (до 70 знаков)', 'seoTitle', seo.title)}${inp('Описание главной в поиске (до 160 знаков)', 'seoDescription', seo.description, { textarea: 1, rows: 2 })}
${imgField('Картинка для ссылок в соцсетях и мессенджерах', 'ogImage', seo.ogImage, 'Рекомендуемый размер 1200×630.')}
${inp('Номер счётчика Яндекс Метрики', 'metrikaId', seo.metrikaId, { inputmode: 'numeric', hint: 'Только цифры. Счётчик создаётся на metrika.yandex.ru.' })}
${inp('Код подтверждения Яндекс Вебмастера', 'yandexVerification', seo.yandexVerification, { hint: 'Содержимое поля content из мета-тега yandex-verification.' })}${inp('Код подтверждения Google Search Console', 'googleVerification', seo.googleVerification)}
<h3>Оператор персональных данных</h3><p class="muted small">Попадает в политику обработки персональных данных.</p>
${inp('ФИО или название организации', 'opName', o.name)}${inp('ИНН', 'inn', o.inn)}${inp('ОГРНИП или ОГРН', 'ogrnip', o.ogrnip)}${inp('Адрес', 'opAddress', o.address)}
<button class="btn">Сохранить</button></form>`);
}

function adminSolutions(d, ctx, msg, e = []) {
  const items = ctx.store.c.solutions;
  const D = { sale: 'Продажа', rent: 'Аренда' }, ST = { active: 'В продаже / сдаётся', reserved: 'В резерве (задаток внесён)', sold: 'Продано / сдано' };
  const form = (it, action, btn) => `<form class="box form" method="post" action="${action}"><h3>${esc(it.title || 'Новый объект')} ${it.demoData ? '<span class="badge">демо</span>' : ''}</h3>
${inp('Название (в заголовке и поиске)', 'title', it.title, { ph: '2-комнатная 58 м² в центре, евроремонт' })}
<div class="trio">${sel('Тип сделки', 'deal', D, it.deal || 'sale')}${sel('Статус', 'status', ST, it.status || 'active')}${inp('Цена, ₽', 'price', rubIn(it.price), { inputmode: 'decimal', hint: 'Для аренды укажите плату за месяц. Пусто: «цена по запросу»' })}</div>
${inp('Краткое описание для карточки', 'summary', it.summary, { textarea: 1, rows: 2 })}
<div class="trio">${inp('Район', 'district', it.district, { ph: 'Центральный' })}${inp('Адрес или ориентир (точный адрес можно не раскрывать)', 'address', it.address)}${inp('Тип дома', 'houseType', it.houseType, { ph: 'кирпичный, панельный, монолитный' })}</div>
<div class="trio">${inp('Комнат (0 — студия)', 'rooms', it.rooms ?? '', { inputmode: 'numeric' })}${inp('Площадь, м²', 'area', it.area ?? '', { inputmode: 'decimal' })}${inp('Кухня, м²', 'kitchen', it.kitchen ?? '', { inputmode: 'decimal' })}</div>
<div class="trio">${inp('Этаж', 'floor', it.floor ?? '', { inputmode: 'numeric' })}${inp('Этажей в доме', 'floors', it.floors ?? '', { inputmode: 'numeric' })}${inp('Год постройки', 'year', it.year ?? '', { inputmode: 'numeric' })}</div>
<div class="trio">${inp('Состояние и ремонт', 'condition', it.condition)}${inp('Комиссия агента, %', 'commission', it.commission ?? (it.deal === 'rent' ? 50 : 2), { inputmode: 'decimal', hint: 'Подставляется в заказ при оформлении сделки. Продажа: процент от цены, аренда: процент от месячной платы.' })}${chk('Возможна ипотека', 'mortgage', it.mortgage)}</div>
${inp('Подробное описание: каждый абзац с новой строки', 'description', (it.description || []).join('\n'), { textarea: 1, rows: 6 })}
${inp('Преимущества: каждый пункт с новой строки', 'features', (it.features || []).join('\n'), { textarea: 1, rows: 4 })}
${imgField('Главное фото', 'image', it.image, 'Без фото показывается рисунок. Фото до 6 МБ, загрузите файл или вставьте ссылку.')}
${inp('Остальные фото: по одному в строке, «адрес | подпись»', 'photos', (it.photos || []).map(g => g.src + ' | ' + g.alt).join('\n'), { textarea: 1, rows: 4, hint: 'Загрузите фото в разделе «Фото», скопируйте адрес и вставьте сюда. Добавить, убрать и поменять порядок можно в любой момент.' })}
${inp('Видео-обзор (YouTube, RuTube, VK Видео или ссылка на .mp4)', 'video', it.video)}
<div class="trio">${sel('Иконка', 'icon', V.ICON_NAMES, it.icon || 'home')}${sel('Цвет', 'accent', V.ACCENT_NAMES, it.accent || 'blue')}</div>
<h4>Для поисковиков</h4>${inp('Заголовок страницы в поиске (необязательно)', 'seoTitle', it.seoTitle)}${inp('Описание в поиске (необязательно)', 'seoDesc', it.seoDesc, { textarea: 1, rows: 2 })}
<div class="actions"><button class="btn btn-sm">${btn}</button>${it.slug ? ` <a class="btn btn-ghost btn-sm" href="/objects/${esc(it.slug)}/" target="_blank">Посмотреть на сайте</a>` : ''}</div></form>`;
  return adminShell(d, ctx, 'solutions', `${flash(msg)}${errs(e)}${SCRIPT}<p class="muted">Объекты недвижимости на витрине. У каждого своя страница, фото и цена правятся здесь. Метка «демо» — тестовый объект: замените его своим или удалите.</p>
<h2>Добавить объект</h2>${form({ status: 'active', deal: 'sale', mortgage: true }, '/admin/solutions/new', 'Добавить')}
<h2>Объекты (${items.length})</h2>
${items.map(it => form(it, `/admin/solutions/${it.slug}`, 'Сохранить') + POST(`/admin/solutions/${it.slug}/delete`, '<button class="btn btn-ghost btn-sm" onclick="return confirm(\'Удалить объект?\')">Удалить объект</button>')).join('')}`);
}

function adminServices(d, ctx, msg, e = []) {
  const items = ctx.store.c.services;
  const form = (it, action, btn) => `<form class="box form" method="post" action="${action}"><h3>${esc(it.title || 'Новая услуга')}</h3>
${inp('Название', 'title', it.title)}${inp('Описание', 'text', it.text, { textarea: 1, rows: 3 })}
<div class="trio">${inp('Цена, ₽', 'price', rubIn(it.price), { inputmode: 'decimal', hint: 'Пусто: «цена по договорённости»' })}${inp('Единица цены', 'unit', it.unit, { ph: '2% от цены сделки', hint: 'Если цены нет, этот текст показывается вместо неё: «2% от цены сделки». Если цена есть: «за консультацию», «за объект»' })}${chk('Показывать «от»', 'from', it.from)}</div>
${inp('Что входит: каждый пункт с новой строки', 'details', (it.details || []).join('\n'), { textarea: 1, rows: 4 })}
${imgField('Фото услуги', 'image', it.image, 'Без фото показывается рисунок.')}
<div class="trio">${sel('Иконка', 'icon', V.ICON_NAMES, it.icon || 'paw')}${sel('Цвет', 'accent', V.ACCENT_NAMES, it.accent || 'teal')}</div>
${inp('Описание в поиске (необязательно)', 'seoDesc', it.seoDesc, { textarea: 1, rows: 2 })}
<div class="actions"><button class="btn btn-sm">${btn}</button></div></form>`;
  return adminShell(d, ctx, 'services', `${flash(msg)}${errs(e)}${SCRIPT}<p class="muted">Услуги и тарифы. У каждой своя страница на сайте, цена и фото меняются здесь.</p>${items.map(it => form(it, `/admin/services/${it.id}`, 'Сохранить') + POST(`/admin/services/${it.id}/delete`, '<button class="btn btn-ghost btn-sm">Удалить</button>')).join('')}<h2>Добавить услугу</h2>${form({}, '/admin/services/new', 'Добавить')}`);
}

function adminCases(d, ctx, msg, e = []) {
  const items = ctx.store.c.cases;
  const form = (it, action, btn) => `<form class="box form" method="post" action="${action}"><h3>${esc(it.title || 'Новый отзыв или сделка')}</h3>
${inp('Заголовок', 'title', it.title, { ph: 'Продажа двухкомнатной квартиры в центре' })}${inp('Клиент (имя, как согласовано)', 'client', it.client)}${inp('С какой задачей пришёл клиент', 'task', it.task, { textarea: 1, rows: 2 })}${inp('Что сделано: каждый пункт с новой строки', 'done', (it.done || []).join('\n'), { textarea: 1, rows: 4 })}${inp('Результат', 'status', it.status, { textarea: 1, rows: 2 })}
${inp('Цифры: «значение | подпись», до 4 строк', 'metrics', (it.metrics || []).map(m => m.value + ' | ' + m.label).join('\n'), { textarea: 1, rows: 3, hint: 'Только проверяемые цифры.' })}
<div class="trio">${imgField('Фото объекта или клиента', 'photo', it.photo)}${imgField('Ещё одно фото', 'photoAfter', it.photoAfter)}</div>
${inp('Видео (YouTube, RuTube, VK Видео или ссылка на .mp4)', 'video', it.video)}${inp('Описание в поиске (необязательно)', 'seoDesc', it.seoDesc, { textarea: 1, rows: 2 })}
${chk('Показывать на сайте (только с согласия клиента)', 'public', it.public)}
<div class="actions"><button class="btn btn-sm">${btn}</button></div></form>`;
  return adminShell(d, ctx, 'cases', `${flash(msg)}${errs(e)}${SCRIPT}<p class="muted">Отзывы и сделки: до показа получите письменное согласие клиента на публикацию имени, фото и сведений о сделке.</p>${items.map(it => form(it, `/admin/cases/${it.slug}`, 'Сохранить') + POST(`/admin/cases/${it.slug}/delete`, '<button class="btn btn-ghost btn-sm">Удалить</button>')).join('')}<h2>Добавить отзыв или сделку</h2>${form({}, '/admin/cases/new', 'Добавить')}`);
}

function adminPosts(d, ctx, msg, e = []) {
  const items = (ctx.store.c.posts || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const form = (it, action, btn) => `<form class="box form post-form" method="post" action="${action}"><h3>${esc(it.title || 'Новая статья')} ${it.published === false ? '<span class="badge">черновик</span>' : ''}</h3>
${inp('Заголовок', 'title', it.title)}
<div class="trio">${inp('Дата публикации', 'date', it.date || new Date().toISOString().slice(0, 10), { type: 'date' })}${inp('Адрес страницы', 'slug', it.slug, { ph: 'создастся из заголовка', hint: 'Латиница и дефисы. Если пусто, создаётся автоматически. После публикации не меняйте.' })}${inp('Метки через запятую', 'tags', (it.tags || []).join(', '))}</div>
${imgField('Главное фото статьи', 'cover', it.cover)}
${inp('Короткое описание для списка статей', 'excerpt', it.excerpt, { textarea: 1, rows: 2 })}
<label>Текст статьи
<div class="toolbar"><label class="btn btn-ghost btn-sm upl">Вставить фото<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden data-insert-photo="body"></label><button type="button" class="btn btn-ghost btn-sm" data-insert="body" data-text="\\n\\n## Подзаголовок\\n\\n">Подзаголовок</button><button type="button" class="btn btn-ghost btn-sm" data-insert="body" data-text="\\n- пункт списка\\n- второй пункт\\n">Список</button><button type="button" class="btn btn-ghost btn-sm" data-video="body">Вставить видео</button><span class="upl-status muted small"></span></div>
<textarea name="body" id="body" rows="18">${esc(it.body)}</textarea>
<small class="muted">Пишите обычным текстом, абзацы разделяйте пустой строкой. Подзаголовок: «## Заголовок». Список: строки с «- ». Жирный: **слово**. Ссылка: [текст](https://адрес). Фото и видео вставляются кнопками выше.</small></label>
<h4>Для поисковиков</h4>${inp('Заголовок в поиске (необязательно, до 70 знаков)', 'seoTitle', it.seoTitle)}${inp('Описание в поиске (необязательно, до 160 знаков)', 'seoDesc', it.seoDesc, { textarea: 1, rows: 2 })}
<label class="check"><input type="checkbox" name="published" value="1"${it.published !== false ? ' checked' : ''}> <span>Опубликована (если не отмечено, статья остаётся черновиком)</span></label>
<div class="actions"><button class="btn btn-sm">${btn}</button>${it.slug ? ` <a class="btn btn-ghost btn-sm" href="/blog/${esc(it.slug)}/" target="_blank">Посмотреть на сайте</a>` : ''}</div></form>`;
  return adminShell(d, ctx, 'posts', `${flash(msg)}${errs(e)}${SCRIPT}<p class="muted">Блог помогает сайту подниматься в поиске: пишите про вопросы, которые клиенты задают вам чаще всего: цены, документы, ипотека, налоги, районы.</p>
<h2>Добавить статью</h2>${form({ published: true }, '/admin/posts/new', 'Опубликовать')}
<h2>Статьи (${items.length})</h2>
${items.map(it => form(it, `/admin/posts/${it.slug}`, 'Сохранить') + POST(`/admin/posts/${it.slug}/delete`, '<button class="btn btn-ghost btn-sm" onclick="return confirm(\'Удалить статью?\')">Удалить статью</button>')).join('')}`);
}

function adminMedia(d, ctx, msg, files = []) {
  return adminShell(d, ctx, 'media', `${flash(msg)}${SCRIPT}<p class="muted">Все загруженные фото. Нажмите на адрес, чтобы скопировать, и вставьте в нужное поле. Фото до 6 МБ, форматы JPG, PNG, WEBP, GIF.</p>
<div class="box"><label class="btn upl">Загрузить фото<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden multiple data-library="1"></label> <span class="upl-status muted small"></span></div>
<div class="media-grid">${files.length ? files.map(f => `<figure class="media-item"><img src="${esc(f.url)}" alt="" loading="lazy"><input class="copy" readonly value="${esc(f.url)}" onclick="this.select()">${POST(`/admin/media/${f.name}/delete`, '<button class="btn btn-ghost btn-sm" onclick="return confirm(\'Удалить файл? Если он где-то используется, там фото пропадёт.\')">Удалить</button>')}</figure>`).join('') : '<p class="muted">Фото ещё нет.</p>'}</div>
<p class="muted small">Внимание: на бесплатном тарифе Render загруженные файлы пропадают при перезапуске сервера. На постоянном сервере (VPS) или с подключённым диском они сохраняются.</p>`);
}

module.exports = { adminSite, adminSolutions, adminServices, adminCases, adminPosts, adminMedia };
