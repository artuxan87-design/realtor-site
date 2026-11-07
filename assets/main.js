(function () {
  var b = document.querySelector('.burger'), n = document.querySelector('.nav');
  if (b && n) b.addEventListener('click', function () {
    var o = n.classList.toggle('open'); b.setAttribute('aria-expanded', o ? 'true' : 'false');
  });
})();
