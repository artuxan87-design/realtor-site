'use strict';
// Содержимое сайта специалиста: блог, фото, SEO-поля. Всё правится в админке и хранится в базе.
const { imageUrl } = require('./media');
const str = (v, n = 300) => String(v ?? '').trim().slice(0, n);
const lines = (v, n = 20, len = 300) => String(v ?? '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, n).map(x => x.slice(0, len));
const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
const slugify = s => String(s).toLowerCase().split('').map(c => TR[c] !== undefined ? TR[c] : c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'post';
const today = () => new Date().toISOString().slice(0, 10);
const price = v => { const s = String(v ?? '').replace(/\s/g, '').replace(',', '.'); if (s === '') return null; const n = Number(s); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN; };

module.exports = function install(Store) {
  const orig = {
    saveSite: Store.prototype.saveSite,
    saveService: Store.prototype.saveService, saveCase: Store.prototype.saveCase,
  };
  const lastOrFind = (list, key, id) => (id && list.find(x => x[key] === id)) || list[list.length - 1];

  Object.assign(Store.prototype, {
    // Дополняет уже созданную базу блогом и новыми полями. Ничего не затирает.
    ensureService(files) {
      if (!this.d.content) return;
      const c = this.c;
      let ch = false;
      if (!c.posts) { c.posts = (files.blog && files.blog.items || []).map(p => ({ ...p })); ch = true; }
      const site = c.site, f = files.site;
      for (const k of ['seo', 'trainer', 'gallery', 'areas']) if (site[k] === undefined && f[k] !== undefined) { site[k] = JSON.parse(JSON.stringify(f[k])); ch = true; }
      if (ch) this.save();
    },

    saveSite(f) {
      const e = orig.saveSite.call(this, f);
      if (e.length) return e;
      const site = this.c.site;
      const seo = site.seo || (site.seo = {});
      Object.assign(seo, {
        cityIn: str(f.cityIn, 60), title: str(f.seoTitle, 120), description: str(f.seoDescription, 300),
        ogImage: imageUrl(f.ogImage), metrikaId: str(f.metrikaId, 20).replace(/\D/g, ''),
        yandexVerification: str(f.yandexVerification, 80).replace(/[^\w-]/g, ''), googleVerification: str(f.googleVerification, 80).replace(/[^\w-]/g, ''),
      });
      site.trainer = { ...(site.trainer || {}), name: str(f.trainerName, 100), photo: imageUrl(f.trainerPhoto), experience: str(f.experience, 100), about: lines(f.about, 8, 900), credentials: lines(f.credentials, 12, 200) };
      site.areas = lines(f.areas, 12, 80);
      site.gallery = lines(f.gallery, 24, 400).map(l => { const [src, ...alt] = l.split('|'); return { src: imageUrl(src), alt: str(alt.join('|'), 160) }; }).filter(g => g.src);
      this.save();
      return [];
    },

    saveService(id, f) {
      const e = orig.saveService.call(this, id, f);
      if (e.length) return e;
      const it = lastOrFind(this.c.services, 'id', id);
      Object.assign(it, { image: imageUrl(f.image), unit: str(f.unit, 40), details: lines(f.details, 10), seoDesc: str(f.seoDesc, 300), group: str(f.group, 60) });
      this.save();
      return [];
    },
    saveCase(slug, f) {
      const e = orig.saveCase.call(this, slug, f);
      if (e.length) return e;
      const it = lastOrFind(this.c.cases, 'slug', slug);
      Object.assign(it, { photo: imageUrl(f.photo), photoAfter: imageUrl(f.photoAfter), video: str(f.video, 300), seoDesc: str(f.seoDesc, 300) });
      this.save();
      return [];
    },

    // ---------- Блог ----------
    post(slug) { return (this.c.posts || []).find(p => p.slug === slug); },
    publishedPosts() { return (this.c.posts || []).filter(p => p.published && p.date <= today()).sort((a, b) => (a.date < b.date ? 1 : -1)); },
    savePost(slug, f) {
      const title = str(f.title, 160);
      if (title.length < 3) return ['Заголовок не короче 3 символов'];
      const date = /^\d{4}-\d{2}-\d{2}$/.test(str(f.date, 10)) ? str(f.date, 10) : today();
      const posts = this.c.posts || (this.c.posts = []);
      let it = slug && posts.find(p => p.slug === slug);
      let want = slugify(str(f.slug, 60) || title);
      if (!it || (it.slug !== want)) {
        let s = want, n = 2; while (posts.some(p => p.slug === s && p !== it)) s = want + '-' + n++;
        want = s;
      }
      if (!it) { it = {}; posts.push(it); }
      Object.assign(it, { slug: want, title, date, updated: today(), cover: imageUrl(f.cover), excerpt: str(f.excerpt, 300), tags: str(f.tags, 200).split(',').map(x => x.trim()).filter(Boolean).slice(0, 6), body: String(f.body ?? '').slice(0, 60000), seoTitle: str(f.seoTitle, 120), seoDesc: str(f.seoDesc, 300), published: f.published === '1' || f.published === true || f.published === 'on' });
      this.log('admin', 'статья сохранена', title); this.save();
      return [];
    },
    deletePost(slug) { const a = this.c.posts || [], i = a.findIndex(p => p.slug === slug); if (i >= 0) { this.log('admin', 'статья удалена', a[i].title); a.splice(i, 1); this.save(); } },
  });
};
module.exports.slugify = slugify;
