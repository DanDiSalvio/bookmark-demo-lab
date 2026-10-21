(function () {
  'use strict';

  const KEY = 'hood-cert-waitlist-email';

  function initDeferredSectionPreview() {
    const picture = document.querySelector('[data-defer-section-mobile]');
    if (!picture || !window.matchMedia('(max-width: 767px)').matches) {
      return;
    }

    const img = picture.querySelector('img');
    if (!img) {
      return;
    }

    const sources = Array.from(picture.querySelectorAll('source'));
    const fallbackSrc = img.getAttribute('src');
    const placeholder =
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="726" viewBox="0 0 560 726"><rect width="100%" height="100%" fill="#f4f4f5"/></svg>'
      );

    const stashedSources = sources.map((source) => {
      picture.removeChild(source);
      return source;
    });
    img.src = placeholder;

    const reveal = () => {
      stashedSources.forEach((source) => {
        picture.insertBefore(source, img);
      });
      img.removeAttribute('src');
      img.setAttribute('src', fallbackSrc);
      picture.removeAttribute('data-defer-section-mobile');
      observer.disconnect();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        reveal();
      },
      { rootMargin: '0px', threshold: 0.01 }
    );
    observer.observe(img);
  }

  function init() {
    initDeferredSectionPreview();
    const form = document.getElementById('waitlist-form');
    const input = document.getElementById('waitlist-email');
    const confirm = document.getElementById('waitlist-confirm');
    if (!form || !input || !confirm) return;

    const saved = localStorage.getItem(KEY);
    if (saved) {
      confirm.textContent = `Saved locally for demo: ${saved}. We did not send an email.`;
      confirm.classList.remove('hidden');
      form.classList.add('hidden');
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = input.value.trim();
      if (!email) return;
      localStorage.setItem(KEY, email);
      confirm.textContent = `Thanks. Saved locally for demo: ${email}. We did not send an email.`;
      confirm.classList.remove('hidden');
      form.classList.add('hidden');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
