(function () {
  'use strict';

  const KEY = 'hood-cert-waitlist-email';

  function initDesktopHeroImage() {
    const img = document.querySelector('.hero-preview__desktop .hero__preview-img');
    if (!img || !window.matchMedia('(min-width: 768px)').matches) {
      return;
    }
    const src = img.getAttribute('data-desktop-src');
    if (src && !img.getAttribute('src')) {
      img.setAttribute('src', src);
    }
  }

  function initHeroSampleMeta() {
    const board = window.HoodCertSampleBoard;
    if (!board) return;

    const nextDue = board.formatDate(board.nextDueFromSampleJob(new Date()));
    const dueEl = document.getElementById('hero-next-due');
    if (dueEl) {
      dueEl.textContent = `Next cleaning due: ${nextDue}`;
    }

    const { sampleServiceDate } = board.buildSampleAccounts(new Date());
    const times = board.samplePhotoTimes(sampleServiceDate);
    const beforeEl = document.getElementById('hero-before-time');
    const afterEl = document.getElementById('hero-after-time');
    if (beforeEl) beforeEl.textContent = times.beforeLabel;
    if (afterEl) afterEl.textContent = times.afterLabel;
  }

  function initLandingRebookBoard() {
    const root = document.getElementById('landing-rebook-root');
    const board = window.HoodCertSampleBoard;
    if (!root || !board) return;

    const { overdue, due } = board.landingRebookRows(new Date());
    root.replaceChildren();

    const intro = document.createElement('p');
    intro.className = 'hero__rebook-lede meta';
    intro.textContent = 'Sample rebook board rows from the demo restaurants load.';
    root.appendChild(intro);

    function renderSection(title, rows) {
      if (!rows.length) return;
      const section = document.createElement('section');
      section.className = 'landing-rebook__section';
      const heading = document.createElement('h2');
      heading.className = 'landing-rebook__title';
      heading.textContent = title;
      section.appendChild(heading);

      const table = document.createElement('div');
      table.className = 'landing-rebook__table';
      table.setAttribute('role', 'table');

      rows.forEach(({ account, bucket, meta, statusLine }) => {
        const row = document.createElement('div');
        row.className = 'landing-rebook__row';
        row.setAttribute('role', 'row');

        const nameCell = document.createElement('div');
        nameCell.className = 'landing-rebook__cell landing-rebook__cell--name';
        nameCell.setAttribute('role', 'cell');
        const name = document.createElement('p');
        name.className = 'landing-rebook__name';
        name.textContent = account.name;
        const metaEl = document.createElement('p');
        metaEl.className = 'landing-rebook__meta';
        metaEl.textContent = meta;
        nameCell.append(name, metaEl);

        const statusCell = document.createElement('div');
        statusCell.className = 'landing-rebook__cell landing-rebook__cell--status';
        statusCell.setAttribute('role', 'cell');
        const badge = document.createElement('span');
        badge.className = `badge ${bucket.badge}`;
        badge.textContent = bucket.label;
        statusCell.appendChild(badge);
        if (statusLine) {
          const line = document.createElement('span');
          line.className = 'landing-rebook__status-line';
          line.textContent = statusLine;
          statusCell.appendChild(line);
        }

        row.append(nameCell, statusCell);
        table.appendChild(row);
      });

      section.appendChild(table);
      root.appendChild(section);
    }

    renderSection(`Overdue (${overdue.length})`, overdue);
    renderSection(`Due in 30 days (${due.length})`, due);

    const cta = document.createElement('a');
    cta.className = 'btn btn-secondary btn-sm hero__rebook-cta';
    cta.href = '/hood-cert/app/?sample=1';
    cta.textContent = 'Open full board in the app';
    root.appendChild(cta);
  }

  function initDeferredSectionPreview() {
    const stash = window.__hoodCertSectionDefer;
    const picture = stash?.picture || document.querySelector('[data-defer-section-mobile]');
    if (!picture || !window.matchMedia('(max-width: 767px)').matches) {
      return;
    }

    const img = stash?.img || picture.querySelector('img');
    if (!img) {
      return;
    }

    const stashedSources = stash?.sources || Array.from(picture.querySelectorAll('source'));
    const fallbackSrc = stash?.fallbackSrc || img.getAttribute('src');

    const reveal = () => {
      stashedSources.forEach((source) => {
        picture.insertBefore(source, img);
      });
      img.removeAttribute('src');
      img.setAttribute('src', fallbackSrc);
      picture.removeAttribute('data-defer-section-mobile');
      delete window.__hoodCertSectionDefer;
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
    initDesktopHeroImage();
    initHeroSampleMeta();
    initLandingRebookBoard();
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
