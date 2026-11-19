/* Masajes a domicilio · Oscar — JS del sitio (sin dependencias) */
(function () {
  'use strict';
  var WA = '34670409550';
  document.documentElement.classList.add('js');

  function waLink(text) {
    return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
  }

  /* Cabecera: sólida al hacer scroll (solo si es transparente sobre el hero) */
  var header = document.querySelector('.header--over');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-solid', window.scrollY > 40); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Menú móvil */
  var burger = document.getElementById('burger');
  var menu = document.getElementById('mobileMenu');
  if (burger && menu) {
    var toggle = function (open) {
      burger.classList.toggle('is-open', open);
      menu.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
      if (header) header.classList.toggle('is-solid', open ? false : window.scrollY > 40);
    };
    burger.addEventListener('click', function () { toggle(!menu.classList.contains('is-open')); });
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { toggle(false); }); });
  }

  /* Aparición suave al hacer scroll */
  var rev = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    rev.forEach(function (el) { io.observe(el); });
  } else { rev.forEach(function (el) { el.classList.add('is-in'); }); }

  /* Vídeo de intro: una sola reproducción, sin sonido, elige versión móvil o escritorio */
  var vid = document.getElementById('introVideo');
  if (vid) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var saveData = navigator.connection && navigator.connection.saveData;
    if (!reduce && !saveData) {
      var portrait = window.matchMedia('(max-width: 760px)').matches;
      vid.src = portrait ? vid.dataset.movil : vid.dataset.escritorio;
      vid.muted = true; vid.setAttribute('playsinline', '');
      var p = vid.play();
      if (p && p.catch) p.catch(function () { /* si el navegador no deja autoplay, queda el póster */ });
    }
  }

  /* Reserva rápida → mensaje de WhatsApp con el masaje elegido */
  document.querySelectorAll('[data-booking]').forEach(function (box) {
    var chips = Array.prototype.slice.call(box.querySelectorAll('[data-chip]'));
    var zona = box.querySelector('[data-zona]');
    var dia = box.querySelector('[data-dia]');
    var franja = box.querySelector('[data-franja]');
    var total = box.querySelector('[data-total]');
    var go = box.querySelector('[data-go]');
    var sel = chips[0];

    function pick(chip) {
      sel = chip;
      chips.forEach(function (c) { c.setAttribute('aria-checked', String(c === chip)); });
      update();
    }
    function update() {
      var d = sel.dataset;
      if (total) total.textContent = d.price + ' €';
      var partes = ['Hola Oscar, me gustaría reservar un *' + d.name + '* (' + d.dur + ' · ' + d.price + ' €) a domicilio.'];
      if (zona && zona.value) partes.push('Zona: ' + zona.value + '.');
      if (dia && dia.value) partes.push('Día: ' + dia.value + '.');
      if (franja && franja.value) partes.push('Franja: ' + franja.value + '.');
      partes.push('¿Qué disponibilidad tienes?');
      if (go) go.href = waLink(partes.join(' '));
    }
    chips.forEach(function (c) { c.addEventListener('click', function () { pick(c); }); });
    [zona, dia, franja].forEach(function (f) { if (f) f.addEventListener('change', update); });

    var tipo = box.dataset.pre || new URLSearchParams(location.search).get('tipo');
    var pre = chips.filter(function (c) { return c.dataset.slug === tipo; })[0];
    pick(pre || chips[0]);
  });
})();
