(function () {
  'use strict';

  const STORAGE_KEY = 'crew-day-board-v1';
  const STATUS_CYCLE = ['scheduled', 'in progress', 'done'];

  const CLEANER_KEYS = ['cleaner', 'crew', 'crew member', 'employee', 'name', 'worker', 'tech'];
  const ADDRESS_KEYS = ['address', 'job', 'location', 'site', 'property', 'customer', 'client'];
  const STATUS_KEYS = ['status', 'state', 'stage'];
  const PAY_KEYS = ['pay', 'paid', 'payment', 'amount', 'rate', 'price'];

  /** @type {Array<{id: string, cleaner: string, address: string, status: string, pay: string, paid: boolean}>} */
  let jobs = [];
  let activeFilter = 'all';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    todayDate: $('#today-date'),
    summary: $('#summary'),
    statTotal: $('#stat-total'),
    statDone: $('#stat-done'),
    statUnpaid: $('#stat-unpaid'),
    importPanel: $('#import-panel'),
    pasteInput: $('#paste-input'),
    btnParsePaste: $('#btn-parse-paste'),
    fileInput: $('#file-input'),
    fileName: $('#file-name'),
    btnLoadSample: $('#btn-load-sample'),
    btnToggleImport: $('#btn-toggle-import'),
    importError: $('#import-error'),
    board: $('#board'),
    jobList: $('#job-list'),
    boardEmpty: $('#board-empty')
  };

  function formatToday() {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  }

  function uid() {
    return 'job-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function normalizeKey(key) {
    return String(key || '').trim().toLowerCase().replace(/[_\s]+/g, ' ');
  }

  function findColumnIndex(headers, candidates) {
    const normalized = headers.map(normalizeKey);
    for (const candidate of candidates) {
      const idx = normalized.indexOf(candidate);
      if (idx !== -1) return idx;
    }
    for (let i = 0; i < normalized.length; i++) {
      const h = normalized[i];
      for (const candidate of candidates) {
        if (h.includes(candidate) || candidate.includes(h)) return i;
      }
    }
    return -1;
  }

  function detectDelimiter(text) {
    const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || '';
    const tabs = (firstLine.match(/\t/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    return tabs > commas ? '\t' : ',';
  }

  function parseCSV(text) {
    const delimiter = detectDelimiter(text);
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(field);
        field = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(field);
        if (row.some((c) => c.trim())) rows.push(row);
        row = [];
        field = '';
        if (ch === '\r') i++;
      } else if (ch !== '\r') {
        field += ch;
      }
    }

    if (field || row.length) {
      row.push(field);
      if (row.some((c) => c.trim())) rows.push(row);
    }

    return rows;
  }

  function normalizeStatus(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s || s === 'pending' || s === 'todo' || s === 'scheduled' || s === 'new') return 'scheduled';
    if (s === 'in progress' || s === 'in-progress' || s === 'inprogress' || s === 'active' || s === 'started') {
      return 'in progress';
    }
    if (s === 'done' || s === 'complete' || s === 'completed' || s === 'finished') return 'done';
    return 'scheduled';
  }

  function parsePay(raw) {
    const s = String(raw || '').trim();
    if (!s) return { pay: 'unpaid', paid: false };
    const lower = s.toLowerCase();
    if (lower === 'paid' || lower === 'yes' || lower === 'y' || lower === 'true') {
      return { pay: 'paid', paid: true };
    }
    if (lower === 'unpaid' || lower === 'no' || lower === 'n' || lower === 'false' || lower === 'pending') {
      return { pay: 'unpaid', paid: false };
    }
    const amountMatch = s.match(/^\$?[\d,.]+$/);
    if (amountMatch) {
      const num = s.replace(/[$,]/g, '');
      return { pay: '$' + num, paid: false };
    }
    return { pay: s, paid: lower === 'paid' };
  }

  function rowsToJobs(rows) {
    if (!rows.length) throw new Error('No rows found. Paste or upload a spreadsheet with at least one data row.');

    const headers = rows[0].map((h) => String(h).trim());
    const dataRows = rows.slice(1).filter((r) => r.some((c) => String(c).trim()));

    if (!dataRows.length) {
      throw new Error('No data rows found below the header row.');
    }

    const cleanerIdx = findColumnIndex(headers, CLEANER_KEYS);
    const addressIdx = findColumnIndex(headers, ADDRESS_KEYS);
    const statusIdx = findColumnIndex(headers, STATUS_KEYS);
    const payIdx = findColumnIndex(headers, PAY_KEYS);

    if (cleanerIdx === -1 && addressIdx === -1) {
      if (headers.length >= 2 && dataRows[0].length >= 2) {
        return dataRows.map((row) => {
          const payInfo = parsePay(row[3] || '');
          return {
            id: uid(),
            cleaner: String(row[0] || 'Unassigned').trim() || 'Unassigned',
            address: String(row[1] || 'No address').trim() || 'No address',
            status: normalizeStatus(row[2]),
            pay: payInfo.pay,
            paid: payInfo.paid
          };
        });
      }
      throw new Error('Could not find cleaner or address columns. Expected headers like: cleaner, address, status, pay');
    }

    return dataRows.map((row) => {
      const payRaw = payIdx >= 0 ? row[payIdx] : '';
      const payInfo = parsePay(payRaw);
      return {
        id: uid(),
        cleaner: cleanerIdx >= 0 ? String(row[cleanerIdx] || 'Unassigned').trim() || 'Unassigned' : 'Unassigned',
        address: addressIdx >= 0 ? String(row[addressIdx] || 'No address').trim() || 'No address' : 'No address',
        status: statusIdx >= 0 ? normalizeStatus(row[statusIdx]) : 'scheduled',
        pay: payInfo.pay,
        paid: payInfo.paid
      };
    });
  }

  function showError(msg) {
    els.importError.textContent = msg;
    els.importError.classList.remove('hidden');
  }

  function clearError() {
    els.importError.textContent = '';
    els.importError.classList.add('hidden');
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    } catch (_) {
      /* quota or private mode */
    }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return false;
      jobs = parsed;
      return true;
    } catch (_) {
      return false;
    }
  }

  function updateSummary() {
    const total = jobs.length;
    const done = jobs.filter((j) => j.status === 'done').length;
    const unpaid = jobs.filter((j) => !j.paid).length;
    els.statTotal.textContent = String(total);
    els.statDone.textContent = String(done);
    els.statUnpaid.textContent = String(unpaid);
  }

  function statusLabel(status) {
    if (status === 'in progress') return 'In progress';
    if (status === 'done') return 'Done';
    return 'Scheduled';
  }

  function payLabel(job) {
    if (job.paid) return 'Paid';
    if (job.pay && job.pay !== 'unpaid') return job.pay + ' · unpaid';
    return 'Unpaid';
  }

  function renderBoard() {
    const filtered = activeFilter === 'all'
      ? jobs
      : jobs.filter((j) => j.status === activeFilter);

    els.jobList.innerHTML = '';

    if (!filtered.length) {
      els.boardEmpty.classList.remove('hidden');
      return;
    }

    els.boardEmpty.classList.add('hidden');

    for (const job of filtered) {
      const li = document.createElement('li');
      li.className = 'job-card';
      li.dataset.id = job.id;

      li.innerHTML =
        '<div class="job-card__header">' +
          '<p class="job-card__cleaner">' + escapeHtml(job.cleaner) + '</p>' +
        '</div>' +
        '<p class="job-card__address">' + escapeHtml(job.address) + '</p>' +
        '<div class="job-card__actions">' +
          '<button type="button" class="toggle-btn toggle-btn--status" data-action="status" data-status="' + job.status + '" aria-label="Toggle status for ' + escapeHtml(job.cleaner) + '">' +
            escapeHtml(statusLabel(job.status)) +
          '</button>' +
          '<button type="button" class="toggle-btn toggle-btn--pay" data-action="pay" data-paid="' + job.paid + '" aria-label="Toggle pay for ' + escapeHtml(job.cleaner) + '">' +
            escapeHtml(payLabel(job)) +
          '</button>' +
        '</div>';

      els.jobList.appendChild(li);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showBoard() {
    els.summary.hidden = false;
    els.board.hidden = false;
    els.importPanel.classList.add('is-collapsed');
    els.btnToggleImport.hidden = false;
    updateSummary();
    renderBoard();
  }

  function loadJobs(newJobs) {
    jobs = newJobs;
    save();
    clearError();
    showBoard();
  }

  function handleTextImport(text) {
    clearError();
    const trimmed = text.trim();
    if (!trimmed) {
      showError('Paste some spreadsheet rows first, or use Load sample day.');
      return;
    }
    try {
      const rows = parseCSV(trimmed);
      loadJobs(rowsToJobs(rows));
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not parse spreadsheet data.');
    }
  }

  function cycleStatus(job) {
    const idx = STATUS_CYCLE.indexOf(job.status);
    job.status = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
  }

  function togglePay(job) {
    job.paid = !job.paid;
    if (job.paid) {
      if (job.pay === 'unpaid' || !job.pay) job.pay = 'paid';
    } else if (job.pay === 'paid') {
      job.pay = 'unpaid';
    }
  }

  function setupTabs() {
    $$('.import__tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        $$('.import__tab').forEach((t) => {
          const active = t.dataset.tab === target;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        $('#panel-paste').classList.toggle('is-active', target === 'paste');
        $('#panel-paste').hidden = target !== 'paste';
        $('#panel-upload').classList.toggle('is-active', target === 'upload');
        $('#panel-upload').hidden = target !== 'upload';
      });
    });
  }

  function setupFilters() {
    $$('.chip[data-filter]').forEach((chip) => {
      chip.addEventListener('click', () => {
        activeFilter = chip.dataset.filter || 'all';
        $$('.chip[data-filter]').forEach((c) => c.classList.toggle('is-active', c === chip));
        renderBoard();
      });
    });
  }

  function setupJobActions() {
    els.jobList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const card = btn.closest('.job-card');
      if (!card) return;
      const job = jobs.find((j) => j.id === card.dataset.id);
      if (!job) return;

      if (btn.dataset.action === 'status') {
        cycleStatus(job);
      } else if (btn.dataset.action === 'pay') {
        togglePay(job);
      }

      save();
      updateSummary();
      renderBoard();
    });
  }

  async function loadSample() {
    clearError();
    try {
      const res = await fetch('sample.csv');
      if (!res.ok) throw new Error('Could not load sample.csv');
      const text = await res.text();
      els.pasteInput.value = text;
      handleTextImport(text);
    } catch (err) {
      const fallback =
        'cleaner,address,status,pay\n' +
        'Maria Garcia,142 Oak St - Deep clean,scheduled,unpaid\n' +
        'James Wilson,88 Park Ave - Standard,scheduled,$85\n' +
        'Sofia Chen,2201 Maple Dr - Move-out,in progress,$120\n' +
        'Devon Brooks,55 Cedar Ln - Weekly,done,paid\n' +
        'Ana Ruiz,901 Birch Ct - Standard,in progress,unpaid\n' +
        'Tyler Moss,14 Lakeview Rd - Deep clean,scheduled,$95\n' +
        'Priya Patel,330 Elm St - Standard,done,paid\n' +
        'Jordan Lee,77 Summit Way - Weekly,scheduled,unpaid';
      els.pasteInput.value = fallback;
      handleTextImport(fallback);
    }
  }

  function init() {
    els.todayDate.textContent = formatToday();
    setupTabs();
    setupFilters();
    setupJobActions();

    els.btnParsePaste.addEventListener('click', () => handleTextImport(els.pasteInput.value));
    els.btnLoadSample.addEventListener('click', loadSample);

    els.btnToggleImport.addEventListener('click', () => {
      els.importPanel.classList.remove('is-collapsed');
    });

    els.fileInput.addEventListener('change', () => {
      const file = els.fileInput.files?.[0];
      if (!file) return;
      els.fileName.textContent = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        els.pasteInput.value = text;
        handleTextImport(text);
      };
      reader.onerror = () => showError('Could not read the file. Try a .csv or .tsv export.');
      reader.readAsText(file);
    });

    if (loadFromStorage()) {
      showBoard();
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('sample') === '1') {
      loadSample();
    }
  }

  init();
})();
