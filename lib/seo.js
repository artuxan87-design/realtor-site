'use strict';
// Поисковая оптимизация: адреса, мета-теги, Open Graph, микроразметка schema.org, карта сайта.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cut = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };

// Основной адрес сайта: домен из настроек, пока его нет, адрес, по которому открыли сайт
function baseUrl(site, origin) {
  const dom = site && site.domain;
  return dom ? 'https://' + dom : String(origin || '').replace(/\/$/, '');
}
const abs = (base, u) => !u ? '' : /^https?:\/\//.test(u) ? u : base + (u.startsWith('/') ? u : '/' + u);

function ld(obj) { return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`; }

function business(site, base) {
  const c = site.contacts || {};
  const sameAs = [c.telegram ? 'https://t.me/' + c.telegram : ''].filter(Boolean);
  return {
    '@context': 'https://schema.org', '@type': 'RealEstateAgent', '@id': base + '/#business',
    name: site.name, url: base + '/', description: site.tagline,
    ...(c.phone ? { telephone: c.phone } : {}), ...(c.email ? { email: c.email } : {}),
    ...(site.seo && site.seo.ogImage ? { image: abs(base, site.seo.ogImage) } : {}),
    ...(c.city ? { address: { '@type': 'PostalAddress', addressLocality: c.city, addressCountry: 'RU' }, areaServed: { '@type': 'City', name: c.city } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

function breadcrumbs(base, items) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: base + path })) };
}

function faq(list) {
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: list.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
}

// Теги для <head>. Страницы, которые нельзя в выдачу (кабинет, админка, оплата), получают noindex.
function head({ site, base, path, title, desc, image, type = 'website', noindex = false, jsonld = [], published, modified }) {
  const seo = site.seo || {};
  const url = base + path;
  const img = abs(base, image || seo.ogImage || '');
  const t = cut(title, 70), dsc = cut(desc || site.tagline, 200);
  const out = [
    `<title>${esc(t)}</title>`,
    `<meta name="description" content="${esc(dsc)}">`,
    noindex ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow, max-image-preview:large">',
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="${type}"><meta property="og:site_name" content="${esc(site.name)}"><meta property="og:locale" content="ru_RU">`,
    `<meta property="og:title" content="${esc(t)}"><meta property="og:description" content="${esc(dsc)}"><meta property="og:url" content="${esc(url)}">`,
    img ? `<meta property="og:image" content="${esc(img)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(img)}">` : '<meta name="twitter:card" content="summary">',
    published ? `<meta property="article:published_time" content="${esc(published)}">` : '',
    modified ? `<meta property="article:modified_time" content="${esc(modified)}">` : '',
    seo.yandexVerification ? `<meta name="yandex-verification" content="${esc(seo.yandexVerification)}">` : '',
    seo.googleVerification ? `<meta name="google-site-verification" content="${esc(seo.googleVerification)}">` : '',
    ...jsonld.map(ld),
  ];
  return out.filter(Boolean).join('\n');
}

// Код Яндекс Метрики: ставится только если владелец ввёл номер счётчика
function metrika(id) {
  const n = String(id || '').replace(/\D/g, '');
  if (!n) return '';
  return `<script>(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${n},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:false});</script><noscript><div><img src="https://mc.yandex.ru/watch/${n}" style="position:absolute;left:-9999px" alt=""></div></noscript>`;
}

function sitemap(base, entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(([p, last]) => `  <url><loc>${esc(base + p)}</loc>${last ? `<lastmod>${esc(String(last).slice(0, 10))}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
}

module.exports = { esc, cut, baseUrl, abs, head, business, breadcrumbs, faq, metrika, sitemap };
