/**
 * main.js — Lógica global de Masajesadomicilio.com
 * Gestiona: Nav mobile, animaciones de entrada, FAQ accordion, Hero parallax
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ═══════════════════════════════════════
     1. NAVEGACIÓN MOBILE (Hamburger)
  ═══════════════════════════════════════ */
  const burger     = document.getElementById('burgerBtn');
  const mobileMenu = document.getElementById('mobileMenu');

  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      const isOpen = burger.classList.toggle('is-open');
      mobileMenu.classList.toggle('is-open', isOpen);
      burger.setAttribute('aria-expanded', isOpen);
      // Bloquear scroll solo si es estrictamente necesario, pero permitir elástico
      document.body.style.overflow = isOpen ? 'hidden' : 'visible';
    });

    // Cerrar menú al hacer click en un enlace
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        burger.classList.remove('is-open');
        mobileMenu.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = 'visible';
      });
    });
  }

  /* ═══════════════════════════════════════
     2. ANIMACIONES DE ENTRADA (IntersectionObserver)
     Añade class .is-visible a los elementos con .fade-up
  ═══════════════════════════════════════ */
  const fadeEls = document.querySelectorAll('.fade-up');
  if (fadeEls.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target); // solo una vez
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    fadeEls.forEach((el, i) => {
      // Escalonar la animación para elementos contiguos
      el.style.transitionDelay = `${(i % 4) * 0.1}s`;
      io.observe(el);
    });
  } else {
    // Fallback: mostrar todo si no hay soporte
    fadeEls.forEach(el => el.classList.add('is-visible'));
  }

  /* ═══════════════════════════════════════
     3. FAQ ACCORDION
  ═══════════════════════════════════════ */
  document.querySelectorAll('.faq-item__q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item    = btn.closest('.faq-item');
      const isOpen  = item.classList.contains('is-open');

      // Cierra todos los demás
      document.querySelectorAll('.faq-item.is-open').forEach(openItem => {
        if (openItem !== item) {
          openItem.classList.remove('is-open');
          openItem.querySelector('.faq-item__q').setAttribute('aria-expanded', 'false');
        }
      });

      // Toggle del actual
      item.classList.toggle('is-open', !isOpen);
      btn.setAttribute('aria-expanded', !isOpen);
    });
  });

  /* ═══════════════════════════════════════
     4. HERO PARALLAX SUAVE (solo en desktop para rendimiento)
  ═══════════════════════════════════════ */
  const heroBg = document.getElementById('heroBg');
  if (heroBg && window.matchMedia('(min-width: 1024px)').matches) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.pageYOffset;
          heroBg.style.transform = `scale(1.04) translateY(${scrollY * 0.3}px)`;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ═══════════════════════════════════════
     5. BOTÓN "ABRIR BOT" DESDE HERO
  ═══════════════════════════════════════ */
  const openBotBtn = document.getElementById('openBotBtn');
  if (openBotBtn) {
    openBotBtn.addEventListener('click', () => {
      const botWindow = document.getElementById('botWindow');
      const botToggle = document.getElementById('botToggle');
      if (botWindow && !botWindow.classList.contains('is-open')) {
        botWindow.classList.add('is-open');
        if (botToggle) botToggle.setAttribute('aria-expanded', 'true');
      }
    });
  }

  /* ═══════════════════════════════════════
     6. FOOTER: Año dinámico
  ═══════════════════════════════════════ */
  document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

});
