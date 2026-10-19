(function () {
  'use strict';

  const KEY = 'hood-cert-waitlist-email';

  function init() {
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
