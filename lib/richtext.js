'use strict';
// Простая разметка статей блога. Владелец пишет обычный текст, служебные символы такие:
//   ## Заголовок        подзаголовок второго уровня
//   ### Заголовок       третьего уровня
//   - пункт             маркированный список (каждая строка с «- »)
//   > цитата            цитата
//   ![подпись](адрес)   фото (адрес из загрузки в админке или https://...)
//   @видео адрес        видео: YouTube, RuTube, VK Видео или файл .mp4
//   **жирный**, [текст](https://адрес)   внутри абзаца
// Всё остальное экранируется, поэтому вставить скрипт в статью нельзя.
const { imageUrl } = require('./media');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function videoEmbed(raw) {
  const u = String(raw || '').trim();
  let m;
  if ((m = u.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/))) return { kind: 'iframe', src: 'https://www.youtube-nocookie.com/embed/' + m[1] };
  if ((m = u.match(/^https?:\/\/rutube\.ru\/(?:video|play\/embed)\/([a-f0-9]{32})/i))) return { kind: 'iframe', src: 'https://rutube.ru/play/embed/' + m[1] };
  if ((m = u.match(/^https?:\/\/(?:www\.)?(?:vk\.com|vkvideo\.ru)\/video(-?\d+)_(\d+)/))) return { kind: 'iframe', src: `https://vk.com/video_ext.php?oid=${m[1]}&id=${m[2]}&hd=2` };
  if (/^https:\/\/[^\s"'<>]+\.(mp4|webm)(\?[^\s"'<>]*)?$/i.test(u) || /^\/uploads\/[a-f0-9]{20}\.(mp4|webm)$/.test(u)) return { kind: 'file', src: u };
  return null;
}

function inline(t) {
  let s = esc(t);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)"']+|\/[\w\-./]*)\)/g, (_, txt, href) => `<a href="${href}"${href.startsWith('http') ? ' rel="noopener" target="_blank"' : ''}>${txt}</a>`);
  return s;
}

function render(markup, { lazyFrom = 0 } = {}) {
  const lines = String(markup || '').replace(/\r/g, '').split('\n');
  const out = [];
  let para = [], list = [];
  let n = 0;
  const flushP = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
  const flushL = () => { if (list.length) { out.push('<ul>' + list.map(x => '<li>' + inline(x) + '</li>').join('') + '</ul>'); list = []; } };
  for (const raw of lines) {
    const l = raw.trim();
    let m;
    if (!l) { flushP(); flushL(); continue; }
    if ((m = l.match(/^(#{2,3})\s+(.+)$/))) { flushP(); flushL(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if ((m = l.match(/^[-•]\s+(.+)$/))) { flushP(); list.push(m[1]); continue; }
    if ((m = l.match(/^>\s?(.+)$/))) { flushP(); flushL(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    if ((m = l.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) {
      flushP(); flushL();
      const src = imageUrl(m[2]);
      if (src) { n++; out.push(`<figure><img src="${esc(src)}" alt="${esc(m[1])}" loading="lazy" decoding="async">${m[1] ? `<figcaption>${esc(m[1])}</figcaption>` : ''}</figure>`); }
      continue;
    }
    if ((m = l.match(/^@(?:видео|video)\s+(\S+)$/i))) {
      flushP(); flushL();
      const v = videoEmbed(m[1]);
      if (!v) out.push(`<p><a href="${esc(m[1])}" rel="noopener" target="_blank">Смотреть видео</a></p>`);
      else if (v.kind === 'iframe') out.push(`<div class="video"><iframe src="${esc(v.src)}" title="Видео" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`);
      else out.push(`<div class="video"><video controls preload="metadata" playsinline src="${esc(v.src)}"></video></div>`);
      continue;
    }
    flushL(); para.push(l);
  }
  flushP(); flushL();
  return out.join('\n');
}

// Первые слова статьи без разметки: для описания в поисковой выдаче, если владелец не написал своё
function plain(markup, max = 160) {
  const t = String(markup || '').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/@(?:видео|video)\s+\S+/gi, ' ').replace(/[#>*\-\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

function readMinutes(markup) { return Math.max(1, Math.round(plain(markup, 1e6).split(' ').length / 180)); }

module.exports = { render, plain, videoEmbed, readMinutes, esc };
