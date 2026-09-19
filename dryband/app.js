(function () {
  'use strict';

  var STORAGE_KEY = 'dryband_waitlist';

  function getWaitlist() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }

  function saveEmail(email) {
    var list = getWaitlist();
    var normalized = email.trim().toLowerCase();
    if (list.indexOf(normalized) === -1) {
      list.push(normalized);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
    return list.length;
  }

  function showFeedback(form, message, isError) {
    var feedback = form.parentElement.querySelector('[data-form-feedback]');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.remove('hidden', 'is-error');
    if (isError) {
      feedback.classList.add('is-error');
    }
  }

  function updateCount() {
    var countEl = document.querySelector('[data-waitlist-count]');
    if (!countEl) return;
    var count = getWaitlist().length;
    if (count > 0) {
      countEl.textContent = count + ' ' + (count === 1 ? 'person' : 'people') + ' on the prototype waitlist (this device).';
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var input = form.querySelector('input[type="email"]');
    if (!input) return;

    var email = input.value.trim();
    if (!email || !input.checkValidity()) {
      showFeedback(form, 'Please enter a valid email address.', true);
      input.focus();
      return;
    }

    var total = saveEmail(email);
    input.value = '';
    showFeedback(
      form,
      "You're on the prototype waitlist. If this concept moves, you'll hear at " + email + '.',
      false
    );
    updateCount();

    var mailto = 'mailto:hello@dryband.example?subject=' +
      encodeURIComponent('DryBand prototype waitlist') +
      '&body=' +
      encodeURIComponent('Please add me to the DryBand concept waitlist: ' + email);
    if (navigator.userAgent.indexOf('bot') === -1) {
      /* Optional: uncomment to open mail client on submit */
      /* window.location.href = mailto; */
    }
  }

  document.querySelectorAll('[data-waitlist-form]').forEach(function (form) {
    form.addEventListener('submit', handleSubmit);
  });

  updateCount();
})();
