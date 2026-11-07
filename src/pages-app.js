'use strict';
// Партнёрская программа (лендинг, кабинет) и админка.
const P = require('./pages');
const { esc, layout } = P;
const V = require('../lib/visuals');

const rub = k => { const v = Math.round(k) / 100; return (v < 0 ? '−' : '') + String(Math.abs(v).toFixed(Number.isInteger(v) ? 0 : 2).replace('.', ',')).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; };
const dt = s => s ? new Date(s).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const d10 = s => s ? new Date(s).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '';
const errs = a => a && a.length ? `<div class="alert">${a.map(e => `<div>${esc(e)}</div>`).join('')}</div>` : '';
const flash = m => m ? `<div class="flash">${esc(m)}</div>` : '';
const mask = n => { const [a, b] = String(n).split(' '); return b ? `${a} ${b[0]}.` : a; };
const POST = (action, inner, cls = '') => `<form method="post" action="${action}" class="inline ${cls}">${inner}</form>`;

const ORDER_STATUS = { new: 'ждёт оплаты', paid: 'оплачен', done: 'сделка закрыта', cancelled: 'отменён' };
const LEAD_STATUS = { new: 'новая', order: 'оформлен заказ', lost: 'закрыта' };

// ---------- Партнёрам ----------
function partnersLanding(d, ctx) {
  const s = ctx.settings;
  return layout(d, { title: 'Партнёрская программа', path: '/partners/', active: 'partners/', desc: 'Рекомендуйте агента по недвижимости и получайте процент от комиссии с закрытых сделок. Три линии партнёров, вход бесплатный.', body: `
<section class="page-head"><div class="wrap">
  <p class="eyebrow">Партнёрская программа</p>
  <h1>Рекомендуйте агента и получайте процент от комиссии</h1>
  <p class="lead">Вход бесплатный. Вознаграждение платится только после закрытия сделки и получения комиссии агентом, по клиентам, которых привели вы и ваши приглашённые. За регистрацию и обязательные закупки платить не нужно.</p>
  <div class="actions"><a class="btn" href="/partner/register">Стать партнёром</a><a class="btn btn-ghost" href="/partner/login">Войти в кабинет</a></div>
</div></section>
<section class="sec tight"><div class="wrap">${P.facts(d)}</div></section>
<section class="sec"><div class="wrap">
  <h2>Как это работает</h2>
  ${P.flow(d)}
</div></section>
<section class="sec alt"><div class="wrap">
  <h2>Сколько платим</h2>
  <p class="muted">Процент от комиссии агента по закрытой сделке или от стоимости услуги. Ставки зависят от того, что заказывает клиент. Глубже 3-й линии начислений нет.</p>
  <div class="split viz-split"><div><h3>Сделки с объектами</h3>${P.commissionViz(d, 'solution', 12000000, 'комиссия агента')}</div><div><h3>Услуги и консультации</h3>${P.commissionViz(d, 'service', 300000, 'услуга')}</div></div>
  <ol class="steps">
    <li><span class="step-ico">${V.icon('users', 22)}</span><h3>Регистрация</h3><p>Регистрируетесь и получаете личную ссылку и код.</p></li>
    <li><span class="step-ico">${V.icon('link', 22)}</span><h3>Рекомендации</h3><p>Рекомендуете агента знакомым, коллегам, клиентам и подписчикам. Клиент закрепляется за вами на ${s.cookieDays} дней, после первой оплаты навсегда.</p></li>
    <li><span class="step-ico">${V.icon('card', 22)}</span><h3>Сделка</h3><p>Сделка закрыта, агент получил комиссию, начисление появляется в кабинете.</p></li>
    <li><span class="step-ico">${V.icon('wallet', 22)}</span><h3>Выплата</h3><p>Через ${s.holdDays} дней после закрытия сделки деньги доступны к выплате. Минимум ${rub(s.minPayout)}.</p></li>
  </ol>
</div></section>
<section class="sec"><div class="wrap narrow">
  <h2>Условия</h2>
  <ul class="checks">
    <li>Сумма ставок всех линий не больше 25 % от суммы заказа. Для сделок заказом считается комиссия агента, а не цена объекта.</li>
    <li>При возврате денег клиенту начисления пересчитываются на ту же долю.</li>
    <li>Выплата самозанятым и ИП, нужен ИНН и реквизиты. Сумма выплаты считается без учёта налогов партнёра, он платит их сам.</li>
    <li>Если сам партнёр покупает, продаёт или арендует через агента, процент получает его пригласивший.</li>
    <li>Только честные рекомендации. Нельзя обещать клиенту цену, срок продажи или одобрение ипотеки: этого не гарантирует никто.</li>
  </ul>
  <p><a href="/docs/rules/">Правила программы</a></p>
</div></section>` });
}

function rulesPage(d, ctx) {
  const s = ctx.settings;
  return layout(d, { title: 'Правила партнёрской программы', path: '/docs/rules/', body: `
<section class="page-head"><div class="wrap narrow doc">
  <h1>Правила партнёрской программы</h1>
  <p class="tbd-note">Черновик. Перед запуском согласовать с юристом и заполнить реквизиты организатора (${esc(d.site.operator.name || 'уточняется')}).</p>
  <h2>1. Участие</h2><p>Участвовать могут совершеннолетние. Регистрация бесплатна. Обязательных покупок, взносов и обязательного привлечения других участников нет.</p>
  <h2>2. Вознаграждение</h2><p>Вознаграждение начисляется только с фактически оплаченных заказов клиентов на сумму оплаты по ставкам, указанным на странице «Партнёрам» и в кабинете на дату оплаты. За регистрацию партнёров вознаграждение не выплачивается. Общая сумма ставок по трём линиям не превышает 25 % от суммы заказа.</p>
  <h2>3. Закрепление клиента</h2><p>Клиент закрепляется за партнёром на ${s.cookieDays} дней после перехода по его ссылке или сразу при указании его кода в заявке и навсегда после первого оплаченного заказа. Партнёр, оформляющий заказ для себя, вознаграждения за него не получает.</p>
  <h2>4. Выплаты</h2><p>Начисление становится доступным к выплате через ${s.holdDays} дней после закрытия сделки с клиентом. Минимальная сумма выплаты ${rub(s.minPayout)}. Выплата производится по заявке партнёра в течение 10 рабочих дней на указанные реквизиты. Партнёр самостоятельно уплачивает налоги: самозанятый формирует чек в приложении «Мой налог», ИП учитывает доход по своей системе налогообложения.</p>
  <h2>5. Возвраты</h2><p>При возврате клиенту денег начисления уменьшаются пропорционально сумме возврата. Если вознаграждение уже выплачено, разница удерживается из следующих выплат.</p>
  <h2>6. Запреты</h2><p>Обещать клиентам свойства услуг и гарантии результата, которых нет в описании на сайте, рассылать спам, использовать чужие персональные данные, регистрировать фиктивных партнёров. При нарушении участие может быть прекращено, неподтверждённые начисления отменены.</p>
  <h2>7. Изменение правил</h2><p>Организатор может менять ставки и правила. Новые ставки действуют для заказов, оплаченных после изменения.</p>
</div></section>` });
}

function register(d, ctx, f = {}, e = []) {
  return layout(d, { title: 'Регистрация партнёра', depth: 1, active: 'partners/', body: `
<section class="page-head"><div class="wrap narrow"><h1>Регистрация партнёра</h1>${errs(e)}
<form class="form" method="post" action="/partner/register">
  <label>ФИО<input name="name" required value="${esc(f.name)}"></label>
  <label>Телефон<input name="phone" required value="${esc(f.phone)}" placeholder="+7 900 000-00-00"></label>
  <label>E-mail<input name="email" type="email" required value="${esc(f.email)}"></label>
  <label>Пароль (от 6 символов)<input name="password" type="password" required minlength="6"></label>
  <label>Код пригласившего партнёра<input name="sponsorCode" value="${esc(f.sponsorCode || ctx.refCookie)}" placeholder="необязательно"></label>
  <label class="check"><input type="checkbox" name="adult" value="1" required> <span>Мне есть 18 лет</span></label>
  <label class="check"><input type="checkbox" name="rules" value="1" required> <span>Принимаю <a href="/docs/rules/" target="_blank">правила программы</a></span></label>
  <label class="check"><input type="checkbox" name="pd" value="1" required> <span>Согласен на обработку персональных данных по <a href="/privacy/" target="_blank">политике</a></span></label>
  <button class="btn" type="submit">Зарегистрироваться</button>
</form></div></section>` });
}

function login(d, e = []) {
  return layout(d, { title: 'Вход для партнёров', depth: 1, active: 'partners/', body: `
<section class="page-head"><div class="wrap narrow"><h1>Вход в кабинет партнёра</h1>${errs(e)}
<form class="form" method="post" action="/partner/login">
  <label>E-mail<input name="email" type="email" required></label>
  <label>Пароль<input name="password" type="password" required></label>
  <button class="btn" type="submit">Войти</button>
  <p class="muted small">Нет кабинета? <a href="/partner/register">Зарегистрироваться</a></p>
</form></div></section>` });
}

function cabinet(d, ctx, tab, inner) {
  const tabs = [['', 'Сводка'], ['tree', 'Структура'], ['accruals', 'Начисления'], ['payout', 'Выплаты'], ['materials', 'Ссылка и материалы']];
  return layout(d, { title: 'Кабинет партнёра', depth: 1, active: 'partners/', body: `
<section class="page-head"><div class="wrap">
  <div class="sec-head"><h1>Кабинет партнёра</h1>${POST('/partner/logout', '<button class="btn btn-ghost btn-sm">Выйти</button>')}</div>
  <p class="muted">${esc(ctx.partner.name)}, код ${esc(ctx.partner.code)}</p>
  <nav class="tabs">${tabs.map(([k, t]) => `<a href="/partner/${k}"${k === tab ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
  ${inner}
</div></section>` });
}

const refLink = (ctx) => `${ctx.origin}/?ref=${ctx.partner.code}`;

function cabDashboard(d, ctx, msg) {
  const st = ctx.store, p = ctx.partner, sm = st.summary(p.id), dl = st.downline(p.id);
  const orders = st.d.orders.filter(o => st.d.accruals.some(a => a.orderId === o.id && a.partnerId === p.id && a.line === 1) && ['paid', 'done'].includes(o.status)).length;
  return cabinet(d, ctx, '', `${flash(msg)}
<div class="stats">
  <div class="stat"><b>${rub(sm.available)}</b><span>к выплате сейчас</span></div>
  <div class="stat"><b>${rub(sm.hold)}</b><span>в удержании</span></div>
  <div class="stat"><b>${rub(sm.paid)}</b><span>выплачено</span></div>
  <div class="stat"><b>${orders}</b><span>оплаченных заказов клиентов</span></div>
  <div class="stat"><b>${dl[0].length} / ${dl[1].length} / ${dl[2].length}</b><span>партнёров по линиям</span></div>
</div>
<div class="box"><h3>Ваша ссылка</h3><input class="copy" readonly value="${esc(refLink(ctx))}" onclick="this.select()"><p class="muted small">Клиент, пришедший по ссылке, закрепляется за вами на ${ctx.settings.cookieDays} дней. Можно назвать код ${esc(p.code)} при заявке.</p></div>`);
}

function cabTree(d, ctx) {
  const dl = ctx.store.downline(ctx.partner.id), r = ctx.settings.rates;
  return cabinet(d, ctx, 'tree', `<p class="muted">Показаны имя и фамилия. Контакты участников не раскрываются.</p>` +
    dl.map((l, i) => `<div class="box"><h3>${i + 1}-я линия: ${l.length} чел. <span class="muted small">сделки ${[r.solution.l1, r.solution.l2, r.solution.l3][i]} %, услуги ${[r.service.l1, r.service.l2, r.service.l3][i]} %</span></h3>${l.length ? `<p>${l.map(x => esc(mask(x.name))).join(', ')}</p>` : '<p class="muted">Пока никого.</p>'}</div>`).join(''));
}

function cabAccruals(d, ctx) {
  const st = ctx.store, list = st.accrualsOf(ctx.partner.id).slice().reverse();
  return cabinet(d, ctx, 'accruals', list.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Дата</th><th>Заказ</th><th>Линия</th><th>База</th><th>Ставка</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>${list.map(a => `<tr><td>${d10(a.createdAt)}</td><td>№${a.orderId}</td><td>${a.line}</td><td>${a.kind === 'debt' ? '' : rub(a.base)}</td><td>${a.kind === 'debt' ? '' : a.rate + ' %'}</td><td>${rub(st.net(a))}${a.storno && a.kind !== 'debt' ? `<br><small class="muted">возврат −${rub(a.storno)}</small>` : ''}</td><td>${esc(st.statusOf(a))}</td></tr>`).join('')}</tbody></table></div><p><a href="/partner/report.csv">Скачать CSV</a></p>` : '<p class="muted">Начислений пока нет.</p>');
}

function cabPayout(d, ctx, msg, e = []) {
  const st = ctx.store, p = ctx.partner, sm = st.summary(p.id), pd = p.payoutDetails || {};
  const my = st.d.payouts.filter(x => x.partnerId === p.id).slice().reverse();
  return cabinet(d, ctx, 'payout', `${flash(msg)}${errs(e)}
<div class="stats"><div class="stat"><b>${rub(sm.available)}</b><span>доступно к выплате (минимум ${rub(ctx.settings.minPayout)})</span></div>${sm.debt ? `<div class="stat"><b>${rub(sm.debt)}</b><span>удержание за возвраты</span></div>` : ''}</div>
<div class="split">
<form class="form" method="post" action="/partner/payout/details"><h3>Реквизиты для выплат</h3>
  <label>Налоговый статус<select name="kind"><option value="">Выберите</option><option value="selfemployed"${pd.kind === 'selfemployed' ? ' selected' : ''}>Самозанятый</option><option value="ip"${pd.kind === 'ip' ? ' selected' : ''}>ИП</option></select></label>
  <label>ФИО полностью<input name="fio" value="${esc(pd.fio)}"></label>
  <label>ИНН<input name="inn" value="${esc(pd.inn)}" inputmode="numeric"></label>
  <label>Карта или счёт для выплаты<textarea name="requisites" rows="2">${esc(pd.requisites)}</textarea></label>
  <button class="btn btn-ghost">Сохранить</button></form>
<div><h3>Заявка на выплату</h3>${POST('/partner/payout/request', '<button class="btn">Запросить выплату</button>')}<p class="muted small">Выплата в течение 10 рабочих дней. Чек самозанятого присылайте после получения денег.</p>
${my.length ? `<table class="tbl"><thead><tr><th>№</th><th>Дата</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>${my.map(x => `<tr><td>${x.id}</td><td>${d10(x.at)}</td><td>${rub(x.amount)}</td><td>${{ requested: 'в работе', paid: 'выплачено', rejected: 'отклонено' }[x.status]}</td></tr>`).join('')}</tbody></table>` : ''}</div></div>`);
}

function cabMaterials(d, ctx) {
  const link = refLink(ctx), sols = d.sol.items;
  return cabinet(d, ctx, 'materials', `<div class="box"><h3>Личная ссылка</h3><input class="copy" readonly value="${esc(link)}" onclick="this.select()"></div>
<div class="box"><h3>Ссылки на объекты</h3><ul class="plain">${sols.map(i => `<li>${esc(i.title)}: <input class="copy" readonly value="${esc(ctx.origin + '/objects/' + i.slug + '/?ref=' + ctx.partner.code)}" onclick="this.select()"></li>`).join('')}</ul></div>
<div class="box"><h3>Готовый текст</h3><textarea class="copy" rows="5" readonly onclick="this.select()">Рекомендую агента по недвижимости ${esc(d.site.name)}: продажа, аренда и подбор квартир, сопровождение сделки до получения ключей. Объекты и запись на консультацию: ${esc(link)}</textarea><p class="muted small">Не обещайте цену, сроки и одобрение ипотеки. Сравнения с конкурентами и гарантии дохода в тексты не добавляйте.</p></div>`);
}

function accrualsCsv(ctx) {
  const st = ctx.store;
  const rows = [['Дата', 'Заказ', 'Линия', 'База, руб', 'Ставка, %', 'Сумма, руб', 'Статус']].concat(st.accrualsOf(ctx.partner.id).map(a => [d10(a.createdAt), a.orderId, a.line, a.base / 100, a.rate, st.net(a) / 100, st.statusOf(a)]));
  return '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

// ---------- Админка ----------
function adminShell(d, ctx, tab, inner) {
  const tabs = [['', 'Сводка'], ['leads', 'Заявки'], ['orders', 'Заказы'], ['partners', 'Партнёры'], ['payouts', 'Выплаты'], ['solutions', 'Объекты'], ['import', 'Импорт с Авито'], ['services', 'Услуги и цены'], ['posts', 'Блог'], ['cases', 'Отзывы и сделки'], ['media', 'Фото'], ['site', 'Сайт и SEO'], ['payments', 'Оплата'], ['settings', 'Партнёрка и пароль'], ['log', 'Журнал']];
  return layout(d, { title: 'Админка', depth: 1, body: `<section class="page-head"><div class="wrap">
  <div class="sec-head"><h1>Админка</h1>${POST('/admin/logout', '<button class="btn btn-ghost btn-sm">Выйти</button>')}</div>
  <nav class="tabs">${tabs.map(([k, t]) => `<a href="/admin/${k}"${k === tab ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>${inner}</div></section>` });
}

function adminLogin(d, e = []) {
  return layout(d, { title: 'Вход в админку', depth: 1, body: `<section class="page-head"><div class="wrap narrow"><h1>Админка</h1>${errs(e)}<form class="form" method="post" action="/admin/login"><label>Пароль<input name="password" type="password" required autofocus></label><button class="btn">Войти</button></form></div></section>` });
}

function adminDash(d, ctx, msg) {
  const x = ctx.store.d;
  const newLeads = x.leads.filter(l => l.status === 'new').length;
  const unpaid = x.orders.filter(o => o.status === 'new').length;
  const toPay = x.payouts.filter(p => p.status === 'requested');
  const paid = x.orders.filter(o => ['paid', 'done'].includes(o.status)).reduce((s, o) => s + o.total - o.refunded, 0);
  const miss = ctx.missing;
  return adminShell(d, ctx, '', `${flash(msg)}<div class="stats">
  <div class="stat"><b>${newLeads}</b><span>новых заявок</span></div><div class="stat"><b>${unpaid}</b><span>заказов ждут оплаты</span></div>
  <div class="stat"><b>${toPay.length}</b><span>заявок на выплату (${rub(toPay.reduce((s, p) => s + p.amount, 0))})</span></div>
  <div class="stat"><b>${rub(paid)}</b><span>оплачено клиентами</span></div><div class="stat"><b>${x.partners.length}</b><span>партнёров</span></div></div>
  ${ctx.pay.settings.testMode ? '<div class="alert">Включён тестовый режим оплаты: настоящие деньги не принимаются. Выключите его в разделе «Оплата», когда проверите платёж.</div>' : ''}
  ${miss.length ? `<div class="box"><h3>Что осталось заполнить (${miss.length})</h3><ul class="plain">${miss.map(m => `<li><a href="${m.href}">${esc(m.text)}</a></li>`).join('')}</ul></div>` : '<div class="flash">Всё заполнено, сайт готов к работе.</div>'}`);
}

function adminLeads(d, ctx) {
  const l = ctx.store.d.leads.slice().reverse();
  return adminShell(d, ctx, 'leads', l.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>№</th><th>Дата</th><th>Имя</th><th>Контакт</th><th>Интерес</th><th>Партнёр</th><th>Статус</th></tr></thead><tbody>${l.map(x => { const p = ctx.store.partnerByCode(x.enteredCode) || ctx.store.partnerByCode(x.cookieCode); return `<tr><td><a href="/admin/leads/${x.id}">${x.id}</a></td><td>${dt(x.at)}</td><td>${esc(x.name)}</td><td>${esc(x.contact)}</td><td>${esc(x.solution)}</td><td>${p ? esc(p.name) : ''}</td><td>${LEAD_STATUS[x.status]}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">Заявок пока нет.</p>');
}

function adminLead(d, ctx, l, e = []) {
  const catalog = d.sol.items.map(i => ({ type: 'solution', title: (i.deal === 'rent' ? 'Аренда, комиссия: ' : 'Сделка, комиссия: ') + i.title, price: P.commissionOf(i) })).concat(d.srv.items.map(i => ({ type: 'service', title: i.title, price: i.price == null ? null : i.price / 100 })));
  const orders = ctx.store.d.orders.filter(o => o.leadId === l.id);
  return adminShell(d, ctx, 'leads', `<p><a href="/admin/leads">← Заявки</a></p>${errs(e)}
<div class="box"><h3>Заявка №${l.id} от ${dt(l.at)}</h3><p>${esc(l.name)}, ${esc(l.contact)}<br>Услуга: ${esc(l.solution) || '—'}<br>Код партнёра: ${esc(l.enteredCode || l.cookieCode) || '—'} (${l.enteredCode ? 'введён в форме' : l.cookieCode ? 'по ссылке' : 'нет'})<br>Согласие на ПДн: ${dt(l.consentAt)}</p><p>${esc(l.text)}</p>
${orders.map(o => `<p>Заказ <a href="/admin/orders/${o.id}">№${o.id}</a>, ${ORDER_STATUS[o.status]}</p>`).join('')}
${l.status === 'new' ? POST(`/admin/leads/${l.id}/close`, '<button class="btn btn-ghost btn-sm">Закрыть без заказа</button>') : ''}</div>
<form class="box" method="post" action="/admin/leads/${l.id}/order"><h3>Оформить заказ</h3><p class="muted small">Отметьте позиции и проверьте суммы в рублях. Для объекта подставлена комиссия агента по проценту из карточки: измените, если договорились иначе.</p>
<table class="tbl"><tbody>${catalog.map((c, i) => `<tr><td><label class="check"><input type="checkbox" name="use${i}" value="1"> <span>${esc(c.title)}</span></label><input type="hidden" name="type${i}" value="${c.type}"><input type="hidden" name="title${i}" value="${esc(c.title)}"></td><td class="muted small">${c.type === 'solution' ? 'объект' : 'услуга'}</td><td><input name="amount${i}" value="${c.price != null ? c.price : ''}" inputmode="decimal" placeholder="сумма" style="width:110px"></td></tr>`).join('')}</tbody></table>
<button class="btn">Создать заказ</button></form>`);
}

function adminOrders(d, ctx) {
  const o = ctx.store.d.orders.slice().reverse();
  return adminShell(d, ctx, 'orders', o.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>№</th><th>Дата</th><th>Клиент</th><th>Сумма</th><th>Партнёр 1-й линии</th><th>Статус</th></tr></thead><tbody>${o.map(x => { const p = ctx.store.partner(x.line1PartnerId); return `<tr><td><a href="/admin/orders/${x.id}">${x.id}</a></td><td>${dt(x.at)}</td><td>${esc(x.buyerName)}</td><td>${rub(x.total)}</td><td>${p ? esc(p.name) : ''}</td><td>${ORDER_STATUS[x.status]}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">Заказов пока нет.</p>');
}

function adminOrder(d, ctx, o, msg, e = []) {
  const st = ctx.store, acc = st.d.accruals.filter(a => a.orderId === o.id);
  const act = [];
  if (o.status === 'new') act.push(POST(`/admin/orders/${o.id}/pay`, '<button class="btn btn-sm">Отметить оплаченным</button>'), POST(`/admin/orders/${o.id}/cancel`, '<button class="btn btn-ghost btn-sm">Отменить</button>'));
  if (o.status === 'paid') act.push(POST(`/admin/orders/${o.id}/done`, '<button class="btn btn-sm">Сделка закрыта</button>'));
  if (['paid', 'done'].includes(o.status)) act.push(POST(`/admin/orders/${o.id}/refund`, `<input name="amount" placeholder="сумма возврата, ₽" inputmode="decimal" style="width:160px"> <button class="btn btn-ghost btn-sm">Вернуть деньги и оформить возврат</button>`));
  return adminShell(d, ctx, 'orders', `<p><a href="/admin/orders">← Заказы</a></p>${flash(msg)}${errs(e)}
<div class="box"><h3>Заказ №${o.id}: ${ORDER_STATUS[o.status]}</h3><p>${esc(o.buyerName)}, ${esc(o.buyerContact)}<br>Закрепление: ${esc(o.reason)}<br>Оплачен: ${dt(o.paidAt) || '—'}; сделка закрыта: ${dt(o.doneAt) || '—'}; возвращено: ${rub(o.refunded)}</p>
<table class="tbl"><tbody>${o.items.map(i => `<tr><td>${esc(i.title)}</td><td>${i.type === 'solution' ? 'объект' : 'услуга'}</td><td>${rub(i.amount)}</td></tr>`).join('')}<tr><th>Итого</th><td></td><th>${rub(o.total)}</th></tr></tbody></table>
<div class="actions">${act.join(' ')}</div>
${o.token ? `<p class="small">Ссылка на оплату для клиента: <input class="copy" readonly onclick="this.select()" value="${esc(ctx.origin + '/pay/' + o.id + '/?t=' + o.token)}"></p>` : ''}
${st.d.payments.filter(p => p.orderId === o.id).length ? `<table class="tbl"><thead><tr><th>Платёж</th><th>Способ</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>${st.d.payments.filter(p => p.orderId === o.id).map(p => `<tr><td>№${p.id}</td><td>${esc(p.provider)}</td><td>${rub(p.amount)}${p.refunded ? `, возвращено ${rub(p.refunded)}` : ''}</td><td>${{ pending: 'ждём оплату', paid: 'оплачен', failed: 'не прошёл', mismatch: 'сумма не совпала, проверить вручную' }[p.status] || p.status}${p.error ? `<br><small class="muted">${esc(p.error)}</small>` : ''}</td></tr>`).join('')}</tbody></table>` : ''}</div>
<div class="box"><h3>Начисления</h3>${acc.length ? `<table class="tbl"><thead><tr><th>Партнёр</th><th>Линия</th><th>Ставка</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>${acc.map(a => { const p = st.partner(a.partnerId); return `<tr><td>${esc(p ? p.name : '')}</td><td>${a.line}</td><td>${a.kind === 'debt' ? '' : a.rate + ' %'}</td><td>${rub(st.net(a))}</td><td>${esc(st.statusOf(a))}</td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">Нет (заказ не оплачен или без партнёра).</p>'}</div>`);
}

function adminPartners(d, ctx) {
  const st = ctx.store;
  return adminShell(d, ctx, 'partners', `<div class="tblwrap"><table class="tbl"><thead><tr><th>№</th><th>Партнёр</th><th>Код</th><th>Спонсор</th><th>Доступно</th><th>Выплачено</th><th></th></tr></thead><tbody>${st.d.partners.map(p => { const sm = st.summary(p.id), sp = st.partner(p.sponsorId); return `<tr><td>${p.id}</td><td>${esc(p.name)}<br><small class="muted">${esc(p.phone)}, ${esc(p.email)}</small></td><td>${p.code}</td><td>${sp ? esc(sp.name) : ''}</td><td>${rub(sm.available)}</td><td>${rub(sm.paid)}</td><td>${POST(`/admin/partners/${p.id}/block`, `<button class="btn btn-ghost btn-sm">${p.blocked ? 'Разблокировать' : 'Заблокировать'}</button>`)}</td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">Партнёров пока нет.</td></tr>'}</tbody></table></div>`);
}

function adminPayouts(d, ctx, msg) {
  const st = ctx.store, l = st.d.payouts.slice().reverse();
  return adminShell(d, ctx, 'payouts', `${flash(msg)}${l.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>№</th><th>Дата</th><th>Партнёр</th><th>Сумма</th><th>Реквизиты</th><th>Статус</th><th></th></tr></thead><tbody>${l.map(x => { const p = st.partner(x.partnerId); return `<tr><td>${x.id}</td><td>${dt(x.at)}</td><td>${esc(p.name)}</td><td>${rub(x.amount)}</td><td>${esc(x.details.fio)}, ИНН ${esc(x.details.inn)}, ${x.details.kind === 'ip' ? 'ИП' : 'самозанятый'}<br><small>${esc(x.details.requisites)}</small></td><td>${{ requested: 'ждёт выплаты', paid: 'выплачено', rejected: 'отклонено' }[x.status]}</td><td>${x.status === 'requested' ? POST(`/admin/payouts/${x.id}/paid`, '<button class="btn btn-sm">Выплачено</button>') + ' ' + POST(`/admin/payouts/${x.id}/reject`, '<button class="btn btn-ghost btn-sm">Отклонить</button>') : ''}</td></tr>`; }).join('')}</tbody></table></div><p><a href="/admin/payouts.csv">Скачать CSV</a></p>` : '<p class="muted">Заявок на выплату нет.</p>'}`);
}

function payoutsCsv(ctx) {
  const st = ctx.store;
  const rows = [['№', 'Дата', 'Партнёр', 'Статус налога', 'ИНН', 'Реквизиты', 'Сумма, руб', 'Статус']].concat(st.d.payouts.map(x => [x.id, d10(x.at), x.details.fio, x.details.kind === 'ip' ? 'ИП' : 'самозанятый', x.details.inn, x.details.requisites, x.amount / 100, x.status]));
  return '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

function adminSettings(d, ctx, msg, e = []) {
  const s = ctx.settings;
  const f = (t, name) => `<form class="form" method="post" action="/admin/settings/rates"><input type="hidden" name="type" value="${name}"><h3>${t}</h3><div class="trio"><label>1-я линия, %<input name="l1" value="${s.rates[name].l1}"></label><label>2-я, %<input name="l2" value="${s.rates[name].l2}"></label><label>3-я, %<input name="l3" value="${s.rates[name].l3}"></label></div><button class="btn btn-ghost btn-sm">Сохранить</button></form>`;
  return adminShell(d, ctx, 'settings', `${flash(msg)}${errs(e)}<p class="muted">Сумма трёх ставок не может быть больше 25 %. Новые ставки действуют для заказов, оплаченных после изменения.</p><div class="split">${f('Ставки на решения', 'solution')}${f('Ставки на услуги', 'service')}</div>
<form class="form" method="post" action="/admin/settings/terms"><h3>Сроки и минимум</h3><div class="trio"><label>Удержание, дней<input name="holdDays" value="${s.holdDays}"></label><label>Минимальная выплата, ₽<input name="minPayout" value="${s.minPayout / 100}"></label><label>Закрепление по ссылке, дней<input name="cookieDays" value="${s.cookieDays}"></label></div><button class="btn btn-ghost btn-sm">Сохранить</button></form>
<form class="form" method="post" action="/admin/settings/password"><h3>Пароль администратора</h3><label>Новый пароль (от 8 символов)<input name="password" type="password" minlength="8" autocomplete="new-password"></label><button class="btn btn-ghost btn-sm">Сменить пароль</button></form>`);
}

function adminLog(d, ctx) {
  return adminShell(d, ctx, 'log', `<div class="tblwrap"><table class="tbl"><thead><tr><th>Время</th><th>Кто</th><th>Действие</th><th>Подробности</th></tr></thead><tbody>${ctx.store.d.log.slice(-200).reverse().map(x => `<tr><td>${dt(x.at)}</td><td>${esc(x.actor)}</td><td>${esc(x.action)}</td><td>${esc(x.details)}</td></tr>`).join('')}</tbody></table></div>`);
}


// ---------- Админка: сайт, решения, услуги, кейсы, оплата ----------
const FIELDS = require('../lib/payments/fields');
const inp = (label, name, v, o = {}) => `<label>${label}${o.textarea ? `<textarea name="${name}" rows="${o.rows || 3}">${esc(v)}</textarea>` : `<input name="${name}" value="${esc(v)}"${o.type ? ` type="${o.type}"` : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.inputmode ? ` inputmode="${o.inputmode}"` : ''}>`}${o.hint ? `<small class="muted">${o.hint}</small>` : ''}</label>`;
const rubIn = k => (k == null ? '' : String(k / 100));
const sel = (label, name, map, cur) => `<label>${label}<select name="${name}">${Object.entries(map).map(([k, t]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;

function adminSite(d, ctx, msg, e = []) {
  const s = d.site, c = s.contacts, o = s.operator;
  return adminShell(d, ctx, 'site', `${flash(msg)}${errs(e)}<form class="form" method="post" action="/admin/site">
<h3>О вас</h3>
${inp('Имя или название', 'name', s.name)}${inp('Чем занимаетесь (одной строкой)', 'role', s.role)}${inp('Подзаголовок на главной', 'tagline', s.tagline)}
${inp('Домен сайта', 'domain', s.domain, { ph: 'example.ru', hint: 'Без http:// и слэшей. Пока домен пустой, сайт закрыт от поисковиков.' })}
<h3>Контакты</h3>
${inp('Telegram', 'telegram', c.telegram, { ph: 'ivan_ivanov', hint: 'Только имя пользователя' })}${inp('WhatsApp', 'whatsappPhone', c.whatsappPhone, { ph: '79001234567', hint: 'Номер с кодом страны, цифрами' })}${inp('Телефон', 'phone', c.phone)}${inp('E-mail', 'email', c.email)}${inp('Город', 'city', c.city)}
<h3>Оператор персональных данных</h3><p class="muted small">Попадает в политику обработки персональных данных.</p>
${inp('ФИО или название организации', 'opName', o.name)}${inp('ИНН', 'inn', o.inn)}${inp('ОГРНИП или ОГРН', 'ogrnip', o.ogrnip)}${inp('Адрес', 'opAddress', o.address)}
<button class="btn">Сохранить</button></form>`);
}

function adminSolutions(d, ctx, msg, e = [], editSlug = '') {
  const items = ctx.store.c.solutions;
  const form = (it, action, btn) => `<form class="box form" method="post" action="${action}"><h3>${esc(it.title || 'Новое решение')}</h3>
<div class="trio">${inp('Название', 'title', it.title)}${inp('Ниша', 'niche', it.niche)}${inp('Срок запуска', 'term', it.term, { ph: '5 рабочих дней' })}</div>
${inp('Краткое описание', 'summary', it.summary, { textarea: 1, rows: 2 })}
<div class="trio">${inp('Цена, ₽', 'price', rubIn(it.price), { inputmode: 'decimal', hint: 'Пусто: на сайте «цена уточняется»' })}<label>Статус<select name="status"><option value="soon"${it.status !== 'ready' ? ' selected' : ''}>Демо готовится</option><option value="ready"${it.status === 'ready' ? ' selected' : ''}>Готово</option></select></label>${inp('Ссылка на демо', 'demoUrl', it.demoUrl, { ph: 'https://...' })}</div>
${inp('Пример внедрения (необязательно)', 'example', it.example)}
<h4>Оформление и демо</h4>
<div class="trio">${sel('Иконка', 'icon', V.ICON_NAMES, it.icon || 'shop')}${sel('Цвет', 'accent', V.ACCENT_NAMES, it.accent || 'indigo')}${sel('Картинка без демо', 'cover', V.COVERS, it.cover || 'shop')}</div>
<div class="trio">${inp('Название магазина в демо', 'brand', (it.demo || {}).brand)}${inp('Слоган в демо', 'tagline', (it.demo || {}).tagline)}</div>
${inp('Товары в демо: по одному в строке, «название | цена»', 'demoProducts', ((it.demo || {}).products || []).map(p => p.name + ' | ' + (p.price / 100)).join('\n'), { textarea: 1, rows: 4, hint: 'Из них строится превью сайта и демо-магазин по ссылке /demo/адрес/. Ссылка на внешнее демо выше важнее.' })}
<div class="actions"><button class="btn btn-sm">${btn}</button></div></form>`;
  return adminShell(d, ctx, 'solutions', `${flash(msg)}${errs(e)}<p class="muted">Решения показываются на витрине и в списке при оформлении заказа. Описание того, что входит в магазин, одинаково для всех решений.</p>
${items.map(it => form(it, `/admin/solutions/${it.slug}`, 'Сохранить') + POST(`/admin/solutions/${it.slug}/delete`, '<button class="btn btn-ghost btn-sm">Удалить это решение</button>')).join('')}
<h2>Добавить решение</h2>${form({ status: 'soon' }, '/admin/solutions/new', 'Добавить')}`);
}

function adminServices(d, ctx, msg, e = []) {
  const items = ctx.store.c.services;
  const form = (it, action, btn) => `<form class="box form" method="post" action="${action}"><h3>${esc(it.title || 'Новая услуга')}</h3>
${inp('Название', 'title', it.title)}${inp('Описание', 'text', it.text, { textarea: 1, rows: 2 })}
<div class="trio">${inp('Цена, ₽', 'price', rubIn(it.price), { inputmode: 'decimal' })}${sel('Иконка', 'icon', V.ICON_NAMES, it.icon || 'sliders')}${sel('Цвет', 'accent', V.ACCENT_NAMES, it.accent || 'indigo')}</div><label class="check"><input type="checkbox" name="from" value="1"${it.from ? ' checked' : ''}> <span>Показывать «от»</span></label>
<div class="actions"><button class="btn btn-sm">${btn}</button></div></form>`;
  return adminShell(d, ctx, 'services', `${flash(msg)}${errs(e)}${items.map(it => form(it, `/admin/services/${it.id}`, 'Сохранить') + POST(`/admin/services/${it.id}/delete`, '<button class="btn btn-ghost btn-sm">Удалить</button>')).join('')}<h2>Добавить услугу</h2>${form({}, '/admin/services/new', 'Добавить')}`);
}

function adminCases(d, ctx, msg, e = []) {
  const items = ctx.store.c.cases;
  const form = (it, action, btn) => `<form class="box form" method="post" action="${action}"><h3>${esc(it.title || 'Новый кейс')}</h3>
${inp('Название', 'title', it.title)}${inp('Заказчик', 'client', it.client)}${inp('Задача', 'task', it.task, { textarea: 1, rows: 2 })}${inp('Что сделано (каждый пункт с новой строки)', 'done', (it.done || []).join('\n'), { textarea: 1, rows: 4 })}${inp('Статус проекта', 'status', it.status)}${inp('Цифры результата: «значение | подпись», до 4 строк', 'metrics', (it.metrics || []).map(m => m.value + ' | ' + m.label).join('\n'), { textarea: 1, rows: 3, hint: 'Только проверяемые цифры.' })}
<label class="check"><input type="checkbox" name="public" value="1"${it.public ? ' checked' : ''}> <span>Показывать на сайте (только с согласия заказчика)</span></label>
<div class="actions"><button class="btn btn-sm">${btn}</button></div></form>`;
  return adminShell(d, ctx, 'cases', `${flash(msg)}${errs(e)}${items.map(it => form(it, `/admin/cases/${it.slug}`, 'Сохранить') + POST(`/admin/cases/${it.slug}/delete`, '<button class="btn btn-ghost btn-sm">Удалить</button>')).join('')}<h2>Добавить кейс</h2>${form({}, '/admin/cases/new', 'Добавить')}`);
}

function adminPayments(d, ctx, msg, e = [], checkResult = null) {
  const cfg = ctx.store.paymentsView(ctx.secret), pay = ctx.pay, site = (cfg.baseUrl || ctx.origin).replace(/\/+$/, '');
  const common = `<form class="box form" method="post" action="/admin/payments/common"><h3>Общие настройки оплаты</h3>
<label class="check"><input type="checkbox" name="testMode" value="1"${cfg.testMode ? ' checked' : ''}> <span>Тестовый режим: оплата без реальных денег. Выключите перед приёмом настоящих платежей.</span></label>
${inp('Адрес сайта для уведомлений банков', 'baseUrl', cfg.baseUrl, { ph: 'https://example.ru', hint: 'Нужен https. Банк присылает подтверждения оплаты на этот адрес, поэтому сайт должен быть доступен из интернета. Пусто: берётся адрес, с которого открыта админка.' })}
<label>Чеки по 54-ФЗ<select name="receiptMode"><option value="none"${cfg.receipt.mode !== 'provider' ? ' selected' : ''}>Не передавать (самозанятый сам формирует чек в «Мой налог»)</option><option value="provider"${cfg.receipt.mode === 'provider' ? ' selected' : ''}>Передавать провайдеру для печати чека (нужна касса у провайдера)</option></select></label>
<div class="trio"><label>Налогообложение<select name="taxation">${[['usn_income', 'УСН доходы'], ['usn_income_outcome', 'УСН доходы минус расходы'], ['osn', 'ОСН'], ['patent', 'Патент'], ['envd', 'ЕНВД'], ['esn', 'ЕСХН']].map(([v, t]) => `<option value="${v}"${cfg.receipt.taxation === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
<label>НДС<select name="vat">${[['none', 'Без НДС'], ['vat0', '0 %'], ['vat10', '10 %'], ['vat20', '20 %']].map(([v, t]) => `<option value="${v}"${cfg.receipt.vat === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
<button class="btn btn-sm">Сохранить</button></form>`;
  const cards = Object.entries(FIELDS).map(([id, spec]) => {
    const c = cfg.providers[id], on = pay.isEnabled(id);
    const hooks = id === 'cloudpayments' ? ['pay', 'fail', 'refund'].map(ev => `${site}/pay/webhook/cloudpayments?event=${ev}`) : [`${site}/pay/webhook/${id}`];
    return `<form class="box form" method="post" action="/admin/payments/${id}"><h3>${esc(spec.title)} ${spec.beta ? '<span class="badge">бета</span>' : ''} ${on ? '<span class="badge ok">включён</span>' : '<span class="badge">выключен</span>'}</h3>
<p class="muted small">${esc(spec.help)}</p>
${spec.fields.map(f => f.options ? `<label>${f.label}<select name="${f.key}">${f.options.map(o => `<option${c[f.key] === o ? ' selected' : ''}>${o}</option>`).join('')}</select></label>` : f.secret ? inp(f.label, f.key, '', { ph: c[f.key] || 'не задан', hint: c[f.key] ? 'Сохранён. Оставьте пустым, чтобы не менять.' : '' }) : inp(f.label, f.key, c[f.key])).join('')}
${id === 'robokassa' ? `<label class="check"><input type="checkbox" name="test" value="1"${c.test !== false ? ' checked' : ''}> <span>Использовать тестовые пароли, пока включён тестовый режим</span></label>` : ''}
${spec.beta ? `<label class="check"><input type="checkbox" name="verified" value="1"${c.verified ? ' checked' : ''}> <span>Я понимаю, что интеграция в бета-режиме, и проведу тестовый платёж перед запуском</span></label>` : ''}
<label class="check"><input type="checkbox" name="enabled" value="1"${c.enabled ? ' checked' : ''}> <span>Включить на странице оплаты</span></label>
<p class="small">Адрес уведомлений для кабинета провайдера:<br>${hooks.map(h => `<input class="copy" readonly onclick="this.select()" value="${esc(h)}">`).join('')}</p>
<div class="actions"><button class="btn btn-sm">Сохранить</button><button class="btn btn-ghost btn-sm" formaction="/admin/payments/${id}/check">Проверить подключение</button></div>
${checkResult && checkResult.id === id ? `<div class="${checkResult.ok ? 'flash' : 'alert'}">${esc(checkResult.message)}</div>` : ''}</form>`;
  }).join('');
  const test = cfg.testMode ? `<div class="box"><h3>Тестовая оплата</h3><p class="muted small">Пока тестовый режим включён, на странице оплаты есть кнопка «Тестовая оплата» без списания денег. Так можно проверить заказы, начисления и возвраты.</p></div>` : '';
  return adminShell(d, ctx, 'payments', `${flash(msg)}${errs(e)}<p class="muted">Ключи шифруются в базе и после сохранения показываются только последними четырьмя символами. Проверка подключения работает у ЮKassa и CloudPayments, остальные банки проверяют ключи только настоящим платежом.</p>${common}${test}${cards}`);
}

// ---------- Страница оплаты для клиента ----------
function payPage(d, ctx, o, { errs: e = [], returned = false, form = {} } = {}) {
  const list = ctx.pay.available();
  const body = o.status === 'paid' || o.status === 'done'
    ? `<div class="flash">Оплата получена. Спасибо! Я свяжусь с вами по заказу.</div>`
    : o.status === 'cancelled' ? '<div class="alert">Заказ отменён.</div>'
    : `${returned ? '<div class="flash">Если вы уже оплатили, подтверждение придёт от банка в течение минуты: обновите страницу.</div>' : ''}${errs(e)}
${list.length ? `<form class="form" method="post" action="/pay/${o.id}/start"><input type="hidden" name="t" value="${esc(o.token)}">
${ctx.pay.settings.receipt.mode === 'provider' ? `${inp('E-mail для чека', 'email', form.email, { type: 'email' })}${inp('или телефон', 'phone', form.phone)}` : ''}
<fieldset class="methods"><legend>Способ оплаты</legend>${list.map(p => p.methods.map((m, i) => `<label class="check"><input type="radio" name="choice" value="${p.id}:${m.id}" required> <span>${esc(p.methods.length > 1 ? m.title + ' · ' + p.title.replace(/ \(.*\)/, '') : p.title)}</span></label>`).join('')).join('')}</fieldset>
<button class="btn" type="submit">Оплатить ${rub(o.total)}</button></form>` : '<div class="alert">Онлайн-оплата пока не подключена. Напишите мне, пришлю реквизиты.</div>'}`;
  return layout(d, { title: `Оплата заказа №${o.id}`, depth: 1, body: `<section class="page-head"><div class="wrap narrow"><h1>Заказ №${o.id}</h1>
<table class="tbl"><tbody>${o.items.map(i => `<tr><td>${esc(i.title)}</td><td>${rub(i.amount)}</td></tr>`).join('')}<tr><th>Итого</th><th>${rub(o.total)}</th></tr></tbody></table>${body}</div></section>` });
}

function payRedirect(d, form) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Переход к оплате</title></head><body><p>Переходим на страницу оплаты...</p><form id="f" method="post" action="${esc(form.action)}">${Object.entries(form.fields).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')}<noscript><button>Перейти к оплате</button></noscript></form><script>document.getElementById('f').submit()</script></body></html>`;
}

function payTest(d, ctx, p) {
  return layout(d, { title: 'Тестовая оплата', depth: 1, body: `<section class="page-head"><div class="wrap narrow"><h1>Тестовая оплата</h1><p class="lead">Платёж №${p.id} на ${rub(p.amount)}. Деньги не списываются.</p>
${POST(`/pay/test/${p.id}/confirm`, '<button class="btn">Подтвердить тестовую оплату</button>')}</div></section>` });
}

module.exports = { adminShell, inp, sel, rubIn, flash, errs, POST, adminSite, adminSolutions, adminServices, adminCases, adminPayments, payPage, payRedirect, payTest, partnersLanding, rulesPage, register, login, cabDashboard, cabTree, cabAccruals, cabPayout, cabMaterials, accrualsCsv, adminLogin, adminDash, adminLeads, adminLead, adminOrders, adminOrder, adminPartners, adminPayouts, payoutsCsv, adminSettings, adminLog, rub };
