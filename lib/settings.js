'use strict';
// Настройки, которые владелец вводит в админке: сайт, решения, услуги, кейсы, оплата, пароль.
// Всё хранится в базе. При первом запуске база заполняется из файлов content/*.json.
const C = require('./commission');
const { encrypt, decrypt, mask } = require('./secrets');
const { hashPassword, checkPassword } = require('./store');
const FIELDS = require('./payments/fields');

const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
const slugify = s => String(s).toLowerCase().split('').map(c => TRANSLIT[c] !== undefined ? TRANSLIT[c] : c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'item';
const priceKop = v => { const s = String(v ?? '').replace(/\s/g, '').replace(',', '.'); if (s === '') return null; const n = Number(s); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN; };
const str = (v, n = 300) => String(v ?? '').trim().slice(0, n);
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

module.exports = function install(Store) {
  Object.defineProperty(Store.prototype, 'c', { get() { return this.d.content; } });
  Object.assign(Store.prototype, {
    // ---------- Первичное наполнение ----------
    seedContent(files) {
      if (this.d.content) return;
      const toKop = p => (p == null ? null : Math.round(p * 100));
      this.d.content = {
        site: { ...files.site, contacts: { telegram: '', whatsappPhone: '', phone: '', email: '', city: '', ...Object.fromEntries(Object.entries(files.site.contacts).map(([k, v]) => [k, v || ''])) }, operator: { name: '', inn: '', ogrnip: '', address: '', ...Object.fromEntries(Object.entries(files.site.operator).filter(([k]) => k[0] !== '_').map(([k, v]) => [k, v || ''])) }, domain: files.site.domain || '' },
        solutions: files.solutions.items.map(i => this.solFromFile(i)),
        services: files.services.items.map(i => ({ ...i, price: toKop(i.price) })),
        cases: files.cases.items.map(i => ({ ...i })),
      };
      delete this.d.content.site._comment;
      this.save();
    },
    solFromFile(i) {
      const toKop = p => (p == null ? null : Math.round(p * 100));
      return { ...i, price: toKop(i.price), photos: (i.photos || []).map(x => ({ ...x })), features: (i.features || []).slice(), description: (i.description || []).slice() };
    },
    // Дозаполнение оформления у уже созданной базы: добавляет только отсутствующие поля
    backfillContent(files) {
      if (!this.d.content) return;
      let changed = false;
      for (const f of files.solutions.items) {
        const it = this.c.solutions.find(x => x.slug === f.slug); if (!it) continue;
        const src = this.solFromFile(f);
        for (const k of ['icon', 'cover', 'accent']) if (it[k] === undefined && src[k] !== undefined) { it[k] = src[k]; changed = true; }
      }
      for (const f of files.services.items) {
        const it = this.c.services.find(x => x.id === f.id); if (!it) continue;
        for (const k of ['icon', 'accent']) if (it[k] === undefined && f[k] !== undefined) { it[k] = f[k]; changed = true; }
      }
      for (const f of files.cases.items) {
        const it = this.c.cases.find(x => x.slug === f.slug); if (!it) continue;
        if (it.metrics === undefined && f.metrics) { it.metrics = f.metrics; changed = true; }
      }
      if (changed) this.save();
    },

    // ---------- Сайт ----------
    saveSite(f) {
      const e = [];
      const domain = str(f.domain, 100).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (domain && !/^[a-zа-я0-9.-]+\.[a-zа-я0-9-]{2,}$/i.test(domain)) e.push('Домен укажите без http:// и без слэшей, например example.ru');
      const email = str(f.email, 100);
      if (email && !EMAIL.test(email)) e.push('Проверьте e-mail');
      const tg = str(f.telegram, 100).replace(/^(https?:\/\/)?(t\.me\/|telegram\.me\/)/, '').replace(/^@/, '');
      if (tg && !/^[A-Za-z0-9_]{4,32}$/.test(tg)) e.push('Telegram: только имя пользователя, например ivan_ivanov');
      const wa = str(f.whatsappPhone, 30).replace(/[^\d]/g, '');
      if (wa && wa.length < 10) e.push('WhatsApp: номер с кодом страны');
      const inn = str(f.inn, 20).replace(/\D/g, '');
      if (inn && ![10, 12].includes(inn.length)) e.push('ИНН: 10 или 12 цифр');
      if (str(f.name).length < 2) e.push('Укажите имя или название');
      if (e.length) return e;
      Object.assign(this.c.site, { name: str(f.name, 100), role: str(f.role, 200), tagline: str(f.tagline, 300), domain });
      Object.assign(this.c.site.contacts, { telegram: tg, whatsappPhone: wa, phone: str(f.phone, 40), email, city: str(f.city, 100) });
      Object.assign(this.c.site.operator, { name: str(f.opName, 200), inn, ogrnip: str(f.ogrnip, 20).replace(/\D/g, ''), address: str(f.opAddress, 300) });
      this.log('admin', 'настройки сайта изменены'); this.save();
      return [];
    },

    // ---------- Решения и услуги ----------
    // Объект недвижимости (во внутренней модели «solutions»)
    saveSolution(slug, f) {
      const title = str(f.title, 160), price = priceKop(f.price);
      if (title.length < 3) return ['Название не короче 3 символов'];
      if (Number.isNaN(price)) return ['Цена: число в рублях или пусто'];
      const n = (v, int) => { const t = String(v ?? '').trim().replace(',', '.'); if (t === '') return null; const x = Number(t); return Number.isFinite(x) && x >= 0 ? (int ? Math.round(x) : x) : NaN; };
      const rooms = n(f.rooms, true), area = n(f.area), kitchen = n(f.kitchen), floor = n(f.floor, true), floors = n(f.floors, true), year = n(f.year, true), commission = n(f.commission);
      const bad = [['Комнаты', rooms], ['Площадь', area], ['Кухня', kitchen], ['Этаж', floor], ['Этажность', floors], ['Год постройки', year], ['Комиссия', commission]].filter(([, v]) => Number.isNaN(v)).map(([k]) => k + ': введите число');
      if (commission !== null && commission > 100) bad.push('Комиссия: процент от 0 до 100');
      if (bad.length) return bad;
      const V = require('./visuals');
      const lines = (v, max, len = 300) => String(v ?? '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, max).map(x => x.slice(0, len));
      const { imageUrl } = require('./media');
      let it = slug && this.c.solutions.find(x => x.slug === slug);
      if (!it) {
        let s = slugify(title), k = 2; const base = s;
        while (this.c.solutions.some(x => x.slug === s)) s = base + '-' + k++;
        it = { slug: s, category: 'flat' }; this.c.solutions.push(it);
      }
      const deal = f.deal === 'rent' ? 'rent' : 'sale';
      Object.assign(it, {
        title, deal, status: ['active', 'reserved', 'sold'].includes(f.status) ? f.status : 'active', summary: str(f.summary, 400), price,
        district: str(f.district, 60), address: str(f.address, 160), rooms, area, kitchen, floor, floors, year,
        houseType: str(f.houseType, 60), condition: str(f.condition, 120), mortgage: f.mortgage === '1' || f.mortgage === 'on',
        commission: commission === null ? (deal === 'rent' ? 50 : 2) : commission,
        features: lines(f.features, 12, 200), description: lines(f.description, 10, 900),
        photos: lines(f.photos, 30, 400).map(l => { const [src, ...alt] = l.split('|'); return { src: imageUrl(src), alt: str(alt.join('|'), 160) }; }).filter(x => x.src),
        video: str(f.video, 300), image: imageUrl(f.image), seoTitle: str(f.seoTitle, 120), seoDesc: str(f.seoDesc, 300),
        icon: str(f.icon, 20) in V.ICONS ? str(f.icon, 20) : 'home', cover: 'flat', accent: V.accent(str(f.accent, 20)), demoData: false,
      });
      this.log('admin', 'объект сохранён', title); this.save();
      return [];
    },
    deleteSolution(slug) { const i = this.c.solutions.findIndex(x => x.slug === slug); if (i >= 0) { this.log('admin', 'объект удалён', this.c.solutions[i].title); this.c.solutions.splice(i, 1); this.save(); } },

    saveService(id, f) {
      const title = str(f.title, 120), price = priceKop(f.price);
      if (title.length < 3) return ['Название не короче 3 символов'];
      if (Number.isNaN(price)) return ['Цена: число в рублях или пусто'];
      let it = id && this.c.services.find(x => x.id === id);
      if (!it) {
        let s = slugify(title), n = 2; const base = s;
        while (this.c.services.some(x => x.id === s)) s = base + '-' + n++;
        it = { id: s }; this.c.services.push(it);
      }
      const V = require('./visuals');
      Object.assign(it, { title, text: str(f.text, 500), price, from: !!f.from, icon: str(f.icon, 20) in V.ICONS ? str(f.icon, 20) : 'sliders', accent: V.accent(str(f.accent, 20)) });
      this.log('admin', 'услуга сохранена', title); this.save();
      return [];
    },
    deleteService(id) { const i = this.c.services.findIndex(x => x.id === id); if (i >= 0) { this.log('admin', 'услуга удалена', this.c.services[i].title); this.c.services.splice(i, 1); this.save(); } },

    saveCase(slug, f) {
      const title = str(f.title, 160);
      if (title.length < 3) return ['Название не короче 3 символов'];
      let it = slug && this.c.cases.find(x => x.slug === slug);
      if (!it) { let s = slugify(title), n = 2; const base = s; while (this.c.cases.some(x => x.slug === s)) s = base + '-' + n++; it = { slug: s }; this.c.cases.push(it); }
      Object.assign(it, { title, client: str(f.client, 200), task: str(f.task, 500), status: str(f.status, 300), done: String(f.done || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 12), public: !!f.public, metrics: String(f.metrics || '').split('\n').map(l => l.split('|')).map(([v, l]) => ({ value: str(v, 20), label: str(l, 60) })).filter(m => m.value && m.label).slice(0, 4) });
      this.log('admin', 'кейс сохранён', title); this.save();
      return [];
    },
    deleteCase(slug) { const i = this.c.cases.findIndex(x => x.slug === slug); if (i >= 0) { this.c.cases.splice(i, 1); this.save(); } },

    // ---------- Оплата ----------
    // Для платёжного модуля: настройки с расшифрованными ключами
    paymentsConfig(secret) {
      const p = this.s.payments, out = { testMode: p.testMode, baseUrl: p.baseUrl, receipt: p.receipt, providers: {} };
      for (const [id, spec] of Object.entries(FIELDS)) {
        const src = p.providers[id] || {}, c = { enabled: !!src.enabled, verified: !!src.verified, test: src.test };
        for (const f of spec.fields) c[f.key] = f.secret ? decrypt(src[f.key], secret) : (src[f.key] || '');
        out.providers[id] = c;
      }
      return out;
    },
    // Для показа в админке: секреты маскируются
    paymentsView(secret) {
      const cfg = this.paymentsConfig(secret);
      for (const [id, spec] of Object.entries(FIELDS)) for (const f of spec.fields) if (f.secret) cfg.providers[id][f.key] = mask(cfg.providers[id][f.key]);
      return cfg;
    },
    savePaymentCommon(f) {
      const base = str(f.baseUrl, 200).replace(/\/+$/, '');
      if (base && !/^https:\/\/[^\s/]+$/.test(base)) return ['Адрес сайта: https://домен, без слэша на конце. Банки требуют https для уведомлений'];
      if (!['none', 'provider'].includes(f.receiptMode)) return ['Выберите, как формируются чеки'];
      if (!['osn', 'usn_income', 'usn_income_outcome', 'envd', 'esn', 'patent'].includes(f.taxation)) return ['Выберите систему налогообложения'];
      if (!['none', 'vat0', 'vat10', 'vat20'].includes(f.vat)) return ['Выберите ставку НДС'];
      Object.assign(this.s.payments, { testMode: !!f.testMode, baseUrl: base, receipt: { mode: f.receiptMode, taxation: f.taxation, vat: f.vat } });
      this.log('admin', 'общие настройки оплаты', `тестовый режим: ${f.testMode ? 'да' : 'нет'}, чеки: ${f.receiptMode}`); this.save();
      return [];
    },
    // Пустое секретное поле означает «не менять»
    saveProvider(id, f, secret) {
      const spec = FIELDS[id];
      if (!spec) return ['Неизвестный провайдер'];
      const cur = this.s.payments.providers[id] || {}, next = { ...cur };
      for (const fld of spec.fields) {
        const v = str(f[fld.key], 200);
        if (fld.secret) { if (v && !v.startsWith('••••')) next[fld.key] = encrypt(v, secret); }
        else if (fld.options) next[fld.key] = fld.options.includes(v) ? v : (cur[fld.key] || fld.options[0]);
        else next[fld.key] = v;
      }
      next.enabled = !!f.enabled; next.verified = spec.beta ? !!f.verified : true;
      if (id === 'robokassa') next.test = !!f.test;
      if (next.enabled) {
        const miss = spec.fields.filter(x => !x.options && !(x.key.startsWith('test') && !next.test) && !next[x.key]).map(x => x.label);
        if (miss.length) return ['Чтобы включить, заполните: ' + miss.join(', ')];
      }
      this.s.payments.providers[id] = next;
      this.log('admin', 'провайдер оплаты сохранён', `${spec.title}, ${next.enabled ? 'включён' : 'выключен'}`); this.save();
      return [];
    },

    // ---------- Пароль администратора ----------
    setAdminPassword(pw) {
      if (String(pw || '').length < 8) return 'Пароль не короче 8 символов';
      this.d.admin.passHash = hashPassword(pw);
      this.log('admin', 'пароль администратора изменён'); this.save();
      return null;
    },
    checkAdminPassword(pw, fallback) {
      if (this.d.admin.passHash) return checkPassword(pw, this.d.admin.passHash);
      const a = Buffer.from(String(pw)), b = Buffer.from(String(fallback || ''));
      return !!fallback && a.length === b.length && require('crypto').timingSafeEqual(a, b);
    },
  });
};
