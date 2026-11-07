(function () {
  var b = document.querySelector('.burger'), n = document.querySelector('.nav');
  if (b && n) b.addEventListener('click', function () {
    var o = n.classList.toggle('open'); b.setAttribute('aria-expanded', o ? 'true' : 'false');
  });
})();

(function () {
  var q = document.querySelector('[data-quiz]'); if (!q) return;
  var steps = q.querySelectorAll('.quiz-step'), bars = q.querySelectorAll('.quiz-steps i'), ans = {}, cur = 0;
  function show(n) {
    cur = n;
    steps.forEach(function (s, i) { s.classList.toggle('on', i === n); });
    bars.forEach(function (b, i) { b.classList.toggle('on', i <= n); });
    if (n === 3) {
      var parts = ['Цель: ' + ans.goal, 'Бюджет: ' + ans.budget, 'Район: ' + ans.district];
      q.querySelector('[data-sum]').textContent = parts.join(' · ');
      q.querySelector('[data-text]').value = parts.join('. ') + '.';
    }
  }
  q.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('quiz-back')) { show(Math.max(0, cur - 1)); return; }
    if (b.dataset.k) { ans[b.dataset.k] = b.dataset.v; b.setAttribute('aria-pressed', 'true'); show(cur + 1); }
  });
})();
