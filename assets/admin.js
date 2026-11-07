// Помощники админки: загрузка фото и вставка в статью.
(function () {
  function upload(file, status) {
    if (status) status.textContent = 'Загружаю...';
    return fetch('/admin/upload', { method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream' }, credentials: 'same-origin' })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || j.error) throw new Error(j.error || 'Не удалось загрузить'); return j; }); })
      .then(function (j) { if (status) status.textContent = 'Готово'; return j; })
      .catch(function (e) { if (status) status.textContent = e.message; throw e; });
  }
  function statusOf(el) { var box = el.closest('.imgrow, .toolbar, .box'); return box ? box.querySelector('.upl-status') : null; }
  function insertAt(ta, text) {
    var s = ta.selectionStart || 0, e = ta.selectionEnd || 0;
    ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
    ta.focus(); ta.selectionStart = ta.selectionEnd = s + text.length;
  }
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.matches('[data-upload]')) {
      var f = t.files[0]; if (!f) return;
      var form = t.closest('form'), inp = form.querySelector('[name="' + t.getAttribute('data-upload') + '"]');
      upload(f, statusOf(t)).then(function (j) {
        inp.value = j.url;
        var row = t.closest('.imgrow'), img = row.querySelector('.thumb');
        if (!img) { img = document.createElement('img'); img.className = 'thumb'; img.alt = ''; row.appendChild(img); }
        img.src = j.url;
      }).catch(function () {});
      t.value = '';
    } else if (t.matches('[data-insert-photo]')) {
      var f2 = t.files[0]; if (!f2) return;
      var ta = document.getElementById(t.getAttribute('data-insert-photo'));
      var alt = window.prompt('Подпись к фото (её увидят читатели и поисковики):', '') || '';
      upload(f2, statusOf(t)).then(function (j) { insertAt(ta, '\n\n![' + alt.replace(/[\[\]\n]/g, ' ') + '](' + j.url + ')\n\n'); }).catch(function () {});
      t.value = '';
    } else if (t.matches('[data-library]')) {
      var files = Array.prototype.slice.call(t.files), st = statusOf(t), n = 0;
      files.reduce(function (p, file) { return p.then(function () { return upload(file, st).then(function () { n++; }); }); }, Promise.resolve())
        .then(function () { location.href = '/admin/media?msg=' + encodeURIComponent('Загружено файлов: ' + n); })
        .catch(function () {});
    }
  });
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-insert],[data-video]'); if (!b) return;
    var ta = document.getElementById(b.getAttribute('data-insert') || b.getAttribute('data-video'));
    if (b.hasAttribute('data-insert')) insertAt(ta, b.getAttribute('data-text').replace(/\\n/g, '\n'));
    else {
      var u = window.prompt('Ссылка на видео (YouTube, RuTube, VK Видео или файл .mp4):', '');
      if (u) insertAt(ta, '\n\n@видео ' + u.trim() + '\n\n');
    }
  });
})();
