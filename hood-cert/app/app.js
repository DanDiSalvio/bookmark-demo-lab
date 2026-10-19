(function () {
  'use strict';

  const STORAGE_KEY = 'hood-cert-pack-v1';

  const CHECKLIST_AREAS = [
    { id: 'hood', label: 'Hood' },
    { id: 'filters', label: 'Filters' },
    { id: 'ductwork', label: 'Ductwork' },
    { id: 'fan', label: 'Fan' },
    { id: 'accessPanels', label: 'Access panels' },
    { id: 'greaseContainment', label: 'Grease containment' },
    { id: 'fireSuppressionNozzles', label: 'Fire-suppression nozzles visible/unobstructed' }
  ];

  const VOLUME_MONTHS = {
    high: 1,
    medium: 3,
    low: 6,
    minimal: 12
  };

  const VOLUME_LABELS = {
    high: 'High volume (monthly)',
    medium: 'Medium volume (quarterly)',
    low: 'Low volume (semiannual)',
    minimal: 'Minimal / seasonal (annual)'
  };

  /** @typedef {{ id: string, name: string, address: string, email: string, volume: string, lastServiceDate: string | null, jobs: string[] }} Account */
  /** @typedef {{ id: string, accountId: string, serviceDate: string, techName: string, checklist: ChecklistItem[], createdAt: number }} Job */
  /** @typedef {{ id: string, status: 'pass' | 'deficiency', note: string, beforePhoto: string | null, afterPhoto: string | null }} ChecklistItem */

  /** @type {{ companyName: string, techName: string, accounts: Account[], jobs: Job[] }} */
  let state = {
    companyName: 'Summit Hood Services',
    techName: 'Maria Lopez',
    accounts: [],
    jobs: []
  };

  let selectedAccountId = '';
  /** @type {Record<string, ChecklistItem>} */
  let draftChecklist = {};
  let jobStep = 0;
  let lastCompletedJob = null;

  const $ = (sel) => document.querySelector(sel);

  const els = {
    accountSelect: $('#account-select'),
    btnToggleAdd: $('#btn-toggle-add-account'),
    addAccountForm: $('#add-account-form'),
    newName: $('#new-name'),
    newAddress: $('#new-address'),
    newEmail: $('#new-email'),
    newVolume: $('#new-volume'),
    btnSaveAccount: $('#btn-save-account'),
    btnToChecklist: $('#btn-to-checklist'),
    jobStepAccount: $('#job-step-account'),
    jobStepChecklist: $('#job-step-checklist'),
    jobStepFinish: $('#job-step-finish'),
    checklistRoot: $('#checklist-root'),
    checklistAccountName: $('#checklist-account-name'),
    btnToFinish: $('#btn-to-finish'),
    btnBackAccount: $('#btn-back-account'),
    techName: $('#tech-name'),
    companyName: $('#company-name'),
    finishSummary: $('#finish-summary'),
    btnGeneratePdf: $('#btn-generate-pdf'),
    btnEmailSummary: $('#btn-email-summary'),
    btnNewJob: $('#btn-new-job'),
    finishBanner: $('#finish-banner'),
    boardList: $('#board-list'),
    boardEmpty: $('#board-empty'),
    settingsCompany: $('#settings-company'),
    settingsTech: $('#settings-tech'),
    btnSaveSettings: $('#btn-save-settings'),
    btnClearData: $('#btn-clear-data'),
    btnLoadSamples: $('#btn-load-samples'),
    jobSteps: $('#job-steps'),
    panelHeading: $('#panel-heading'),
    panelLede: $('#panel-lede'),
    panelJob: $('#panel-job'),
    panelBoard: $('#panel-board'),
    panelSettings: $('#panel-settings'),
    toast: $('#toast'),
    tabButtons: document.querySelectorAll('.tab-bar__btn')
  };

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        state = {
          companyName: parsed.companyName || state.companyName,
          techName: parsed.techName || state.techName,
          accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
          jobs: Array.isArray(parsed.jobs) ? parsed.jobs : []
        };
      }
    } catch (e) {
      console.error('Failed to load state', e);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    window.setTimeout(() => els.toast.classList.remove('is-visible'), 2800);
  }

  function formatDate(iso) {
    if (!iso) return 'Never';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function addMonths(iso, months) {
    const d = new Date(iso + 'T12:00:00');
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  }

  function daysUntil(iso) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(iso + 'T12:00:00');
    return Math.round((target - today) / 86400000);
  }

  function accountNextDue(account) {
    if (!account.lastServiceDate) return null;
    const months = VOLUME_MONTHS[account.volume] || 3;
    return addMonths(account.lastServiceDate, months);
  }

  function accountStatus(account) {
    const next = accountNextDue(account);
    if (!next) return { key: 'due', label: 'Due in 30 days', badge: 'badge--due' };
    const days = daysUntil(next);
    if (days < 0) return { key: 'overdue', label: 'Overdue', badge: 'badge--overdue' };
    if (days <= 30) return { key: 'due', label: 'Due in 30 days', badge: 'badge--due' };
    return { key: 'ok', label: 'OK', badge: 'badge--ok' };
  }

  function statusSortWeight(account) {
    const s = accountStatus(account).key;
    if (s === 'overdue') return 0;
    if (s === 'due') return 1;
    return 2;
  }

  function initDraftChecklist() {
    draftChecklist = {};
    CHECKLIST_AREAS.forEach((area) => {
      draftChecklist[area.id] = {
        id: area.id,
        status: 'pass',
        note: '',
        beforePhoto: null,
        afterPhoto: null
      };
    });
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxW = 800;
          const scale = Math.min(1, maxW / img.width);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas unavailable'));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Read failed'));
      reader.readAsDataURL(file);
    });
  }

  async function loadImageAsDataUrl(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function renderAccountSelect() {
    const prev = els.accountSelect.value;
    els.accountSelect.innerHTML = '<option value="">Choose a restaurant…</option>';
    state.accounts.forEach((acc) => {
      const opt = document.createElement('option');
      opt.value = acc.id;
      opt.textContent = acc.name;
      els.accountSelect.appendChild(opt);
    });
    if (prev && state.accounts.some((a) => a.id === prev)) {
      els.accountSelect.value = prev;
    }
    selectedAccountId = els.accountSelect.value;
    els.btnToChecklist.disabled = !selectedAccountId;
  }

  function renderChecklist() {
    const account = state.accounts.find((a) => a.id === selectedAccountId);
    els.checklistAccountName.textContent = account ? `${account.name} checklist` : 'Checklist';
    els.checklistRoot.innerHTML = '';

    CHECKLIST_AREAS.forEach((area) => {
      const item = draftChecklist[area.id];
      const wrap = document.createElement('div');
      wrap.className = 'checklist-item';
      wrap.dataset.areaId = area.id;

      const head = document.createElement('div');
      head.className = 'checklist-item__head';
      const name = document.createElement('span');
      name.className = 'checklist-item__name';
      name.textContent = area.label;

      const toggle = document.createElement('div');
      toggle.className = 'status-toggle';
      toggle.setAttribute('role', 'group');
      toggle.setAttribute('aria-label', `${area.label} status`);

      const btnPass = document.createElement('button');
      btnPass.type = 'button';
      btnPass.className = 'status-toggle__btn' + (item.status === 'pass' ? ' is-pass' : '');
      btnPass.textContent = 'Pass';
      btnPass.dataset.status = 'pass';

      const btnDef = document.createElement('button');
      btnDef.type = 'button';
      btnDef.className = 'status-toggle__btn' + (item.status === 'deficiency' ? ' is-def' : '');
      btnDef.textContent = 'Deficiency';
      btnDef.dataset.status = 'deficiency';

      toggle.appendChild(btnPass);
      toggle.appendChild(btnDef);
      head.appendChild(name);
      head.appendChild(toggle);

      const noteField = document.createElement('div');
      noteField.className = 'field';
      const noteLabel = document.createElement('label');
      noteLabel.className = 'field-label';
      noteLabel.textContent = 'Deficiency note (if any)';
      const noteInput = document.createElement('textarea');
      noteInput.className = 'field-textarea';
      noteInput.rows = 2;
      noteInput.value = item.note || '';
      noteField.appendChild(noteLabel);
      noteField.appendChild(noteInput);

      const photos = document.createElement('div');
      photos.className = 'photo-pair';

      ['before', 'after'].forEach((kind) => {
        const slot = document.createElement('div');
        slot.className = 'photo-slot';
        const label = document.createElement('span');
        label.className = 'photo-slot__label';
        label.textContent = kind === 'before' ? 'Before photo' : 'After photo';
        const preview = document.createElement('div');
        preview.className = 'photo-slot__preview';
        const data = kind === 'before' ? item.beforePhoto : item.afterPhoto;
        if (data) {
          const img = document.createElement('img');
          img.src = data;
          img.alt = `${area.label} ${kind}`;
          preview.appendChild(img);
        } else {
          const empty = document.createElement('span');
          empty.className = 'photo-slot__empty';
          empty.textContent = 'No photo';
          preview.appendChild(empty);
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.dataset.kind = kind;
        slot.appendChild(label);
        slot.appendChild(preview);
        slot.appendChild(input);
        photos.appendChild(slot);
      });

      wrap.appendChild(head);
      wrap.appendChild(noteField);
      wrap.appendChild(photos);
      els.checklistRoot.appendChild(wrap);

      toggle.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-status]');
        if (!btn) return;
        item.status = btn.dataset.status === 'deficiency' ? 'deficiency' : 'pass';
        btnPass.classList.toggle('is-pass', item.status === 'pass');
        btnDef.classList.toggle('is-def', item.status === 'deficiency');
      });

      noteInput.addEventListener('input', () => {
        item.note = noteInput.value;
      });

      wrap.querySelectorAll('input[type="file"]').forEach((input) => {
        input.addEventListener('change', async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          try {
            const dataUrl = await compressImage(file);
            if (input.dataset.kind === 'before') {
              item.beforePhoto = dataUrl;
            } else {
              item.afterPhoto = dataUrl;
            }
            renderChecklist();
          } catch (err) {
            showToast('Could not process photo');
            console.error(err);
          }
        });
      });
    });
  }

  function setJobStep(step) {
    jobStep = step;
    const dots = els.jobSteps.querySelectorAll('.job-step-indicator__dot');
    dots.forEach((dot, i) => {
      dot.classList.remove('is-done', 'is-current');
      if (i < step) dot.classList.add('is-done');
      if (i === step) dot.classList.add('is-current');
    });

    els.jobStepAccount.classList.toggle('hidden', step !== 0);
    els.jobStepChecklist.classList.toggle('hidden', step !== 1);
    els.jobStepFinish.classList.toggle('hidden', step !== 2);

    if (step === 1) renderChecklist();
    if (step === 2) updateFinishSummary();
  }

  function updateFinishSummary() {
    const account = state.accounts.find((a) => a.id === selectedAccountId);
    if (!account) return;
    const today = new Date().toISOString().slice(0, 10);
    const nextDue = addMonths(today, VOLUME_MONTHS[account.volume] || 3);
    const defCount = Object.values(draftChecklist).filter((c) => c.status === 'deficiency').length;
    els.finishSummary.textContent = `${account.name} · ${formatDate(today)} · ${defCount} deficiency note(s) · Next due ${formatDate(nextDue)}`;
    els.techName.value = state.techName;
    els.companyName.value = state.companyName;
  }

  function completeJob() {
    const account = state.accounts.find((a) => a.id === selectedAccountId);
    if (!account) return null;

    const serviceDate = new Date().toISOString().slice(0, 10);
    state.techName = els.techName.value.trim() || state.techName;
    state.companyName = els.companyName.value.trim() || state.companyName;

    const job = {
      id: uid(),
      accountId: account.id,
      serviceDate,
      techName: state.techName,
      checklist: CHECKLIST_AREAS.map((a) => ({ ...draftChecklist[a.id] })),
      createdAt: Date.now()
    };

    state.jobs.unshift(job);
    account.lastServiceDate = serviceDate;
    if (!account.jobs) account.jobs = [];
    account.jobs.unshift(job.id);

    saveState();
    lastCompletedJob = job;
    renderBoard();
    return job;
  }

  function renderBoard() {
    const sorted = [...state.accounts].sort((a, b) => {
      const sw = statusSortWeight(a) - statusSortWeight(b);
      if (sw !== 0) return sw;
      const na = accountNextDue(a);
      const nb = accountNextDue(b);
      if (!na && !nb) return 0;
      if (!na) return 1;
      if (!nb) return -1;
      return daysUntil(na) - daysUntil(nb);
    });

    els.boardList.innerHTML = '';
    if (sorted.length === 0) {
      els.boardEmpty.classList.remove('hidden');
      return;
    }
    els.boardEmpty.classList.add('hidden');

    sorted.forEach((account) => {
      const st = accountStatus(account);
      const next = accountNextDue(account);
      const li = document.createElement('li');
      li.className = 'board-row';

      const top = document.createElement('div');
      top.className = 'board-row__top';
      const name = document.createElement('p');
      name.className = 'board-row__name';
      name.textContent = account.name;
      const badge = document.createElement('span');
      badge.className = `badge ${st.badge}`;
      badge.textContent = st.label;
      top.appendChild(name);
      top.appendChild(badge);

      const meta = document.createElement('p');
      meta.className = 'board-row__meta';
      meta.textContent = `Last: ${formatDate(account.lastServiceDate)} · Next: ${next ? formatDate(next) : 'Set after first job'} · ${VOLUME_LABELS[account.volume] || account.volume}`;

      const actions = document.createElement('div');
      actions.className = 'board-row__actions';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn btn-secondary btn-sm';
      copyBtn.textContent = 'Copy rebook note';

      const emailBtn = document.createElement('button');
      emailBtn.type = 'button';
      emailBtn.className = 'btn btn-accent btn-sm';
      emailBtn.textContent = 'Send rebook note';

      actions.appendChild(copyBtn);
      actions.appendChild(emailBtn);

      li.appendChild(top);
      li.appendChild(meta);
      li.appendChild(actions);
      els.boardList.appendChild(li);

      const message = buildRebookMessage(account, next, st);

      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(message);
          showToast('Rebook note copied');
        } catch (_e) {
          showToast('Copy failed on this browser');
        }
      });

      emailBtn.addEventListener('click', () => {
        const subject = encodeURIComponent(`Hood cleaning rebook - ${account.name}`);
        const body = encodeURIComponent(message);
        const to = account.email ? encodeURIComponent(account.email) : '';
        window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
      });
    });
  }

  function buildRebookMessage(account, nextDue, st) {
    const company = state.companyName || 'Our hood cleaning team';
    const duePhrase = nextDue ? formatDate(nextDue) : 'soon';
    const urgency =
      st.key === 'overdue'
        ? `Your kitchen exhaust cleaning is overdue (was due ${duePhrase}).`
        : st.key === 'due'
          ? `Your next hood cleaning is due around ${duePhrase}.`
          : `Your hood cleaning schedule looks good. Next visit around ${duePhrase}.`;

    return [
      `Hi ${account.name} team,`,
      ``,
      `This is ${company}. ${urgency}`,
      ``,
      `We follow NFPA 96 style frequency for ${VOLUME_LABELS[account.volume] || 'your cooking volume'}. Reply with a good day/time to get on the calendar.`,
      ``,
      `Thank you,`,
      company
    ].join('\n');
  }

  function switchTab(tab) {
    els.tabButtons.forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    const headings = {
      job: ['New job', 'Select a restaurant, complete the hood checklist, and generate a service record PDF.'],
      board: ['Rebook board', 'Accounts sorted by urgency. Overdue first, then due within 30 days.'],
      settings: ['Settings', 'Defaults used on new jobs. Data stays in this browser only.']
    };

    const h = headings[tab] || headings.job;
    els.panelHeading.textContent = h[0];
    els.panelLede.textContent = h[1];

    els.panelJob.classList.toggle('is-active', tab === 'job');
    els.panelJob.hidden = tab !== 'job';
    els.panelBoard.classList.toggle('is-active', tab === 'board');
    els.panelBoard.hidden = tab !== 'board';
    els.panelSettings.classList.toggle('is-active', tab === 'settings');
    els.panelSettings.hidden = tab !== 'settings';

    if (tab === 'board') renderBoard();
    if (tab === 'settings') {
      els.settingsCompany.value = state.companyName;
      els.settingsTech.value = state.techName;
    }
  }

  async function loadSampleData() {
    const today = new Date();
    const iso = (offsetDays) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().slice(0, 10);
    };

    let beforeUrl;
    let afterUrl;
    try {
      beforeUrl = await loadImageAsDataUrl('samples/hood-before.jpg');
      afterUrl = await loadImageAsDataUrl('samples/hood-after.jpg');
    } catch (e) {
      console.warn('Sample images not loaded', e);
      beforeUrl = null;
      afterUrl = null;
    }

    const accounts = [
      {
        id: 'sample-1',
        name: 'Harbor Grill',
        address: '412 Dock St, Portland, OR 97204',
        email: 'manager@harborgrill.example',
        volume: 'medium',
        lastServiceDate: iso(-120),
        jobs: []
      },
      {
        id: 'sample-2',
        name: 'Wok Express 24',
        address: '88 Burnside Ave, Portland, OR 97209',
        email: 'ops@wokexpress.example',
        volume: 'high',
        lastServiceDate: iso(-45),
        jobs: []
      },
      {
        id: 'sample-3',
        name: 'Lakeview Diner',
        address: '2100 NE Sandy Blvd, Portland, OR 97232',
        email: 'owner@lakeviewdiner.example',
        volume: 'low',
        lastServiceDate: iso(-30),
        jobs: []
      },
      {
        id: 'sample-4',
        name: 'Brick Oven Pizza Co',
        address: '55 SE Morrison St, Portland, OR 97214',
        email: 'kitchen@brickoven.example',
        volume: 'medium',
        lastServiceDate: iso(-100),
        jobs: []
      },
      {
        id: 'sample-5',
        name: 'Summit Catering Kitchen',
        address: '900 NW 23rd Ave, Portland, OR 97210',
        email: 'facilities@summitcatering.example',
        volume: 'minimal',
        lastServiceDate: iso(-60),
        jobs: []
      },
      {
        id: 'sample-6',
        name: 'Riverside BBQ Pit',
        address: '1440 SE Powell Blvd, Portland, OR 97202',
        email: 'pitmaster@riversidebbq.example',
        volume: 'high',
        lastServiceDate: iso(-20),
        jobs: []
      }
    ];

    const completedChecklist = CHECKLIST_AREAS.map((area, i) => ({
      id: area.id,
      status: area.id === 'fan' ? 'deficiency' : 'pass',
      note: area.id === 'fan' ? 'Belt wear noted, fan cleaned and operational.' : '',
      beforePhoto: i < 3 ? beforeUrl : null,
      afterPhoto: i < 3 ? afterUrl : null
    }));

    const completedJob = {
      id: 'sample-job-1',
      accountId: 'sample-1',
      serviceDate: iso(-14),
      techName: 'Maria Lopez',
      checklist: completedChecklist,
      createdAt: Date.now() - 14 * 86400000
    };

    accounts[0].lastServiceDate = completedJob.serviceDate;
    accounts[0].jobs = [completedJob.id];

    state = {
      companyName: 'Summit Hood Services',
      techName: 'Maria Lopez',
      accounts,
      jobs: [completedJob]
    };

    saveState();
    renderAccountSelect();
    renderBoard();
    showToast('Sample restaurants loaded');
  }

  function wireEvents() {
    els.accountSelect.addEventListener('change', () => {
      selectedAccountId = els.accountSelect.value;
      els.btnToChecklist.disabled = !selectedAccountId;
    });

    els.btnToggleAdd.addEventListener('click', () => {
      els.addAccountForm.classList.toggle('hidden');
    });

    els.btnSaveAccount.addEventListener('click', () => {
      const name = els.newName.value.trim();
      const address = els.newAddress.value.trim();
      const email = els.newEmail.value.trim();
      const volume = els.newVolume.value;
      if (!name || !address) {
        showToast('Name and address required');
        return;
      }
      const acc = {
        id: uid(),
        name,
        address,
        email,
        volume,
        lastServiceDate: null,
        jobs: []
      };
      state.accounts.push(acc);
      saveState();
      renderAccountSelect();
      els.accountSelect.value = acc.id;
      selectedAccountId = acc.id;
      els.btnToChecklist.disabled = false;
      els.addAccountForm.classList.add('hidden');
      els.newName.value = '';
      els.newAddress.value = '';
      els.newEmail.value = '';
      showToast('Restaurant saved');
    });

    els.btnToChecklist.addEventListener('click', () => {
      if (!selectedAccountId) return;
      initDraftChecklist();
      setJobStep(1);
    });

    els.btnBackAccount.addEventListener('click', () => setJobStep(0));

    els.btnToFinish.addEventListener('click', () => setJobStep(2));

    els.btnGeneratePdf.addEventListener('click', () => {
      const account = state.accounts.find((a) => a.id === selectedAccountId);
      if (!account || !window.HoodCertPdf) {
        showToast('PDF library still loading');
        return;
      }

      const job = completeJob();
      if (!job) return;

      const nextDue = addMonths(job.serviceDate, VOLUME_MONTHS[account.volume] || 3);
      const filename = window.HoodCertPdf.generateServiceRecordPdf({
        companyName: state.companyName,
        techName: job.techName,
        account: { name: account.name, address: account.address },
        serviceDate: formatDate(job.serviceDate),
        nextDue: formatDate(nextDue),
        checklist: job.checklist
      });

      els.finishBanner.classList.remove('hidden');
      showToast(`Saved ${filename}`);
    });

    els.btnEmailSummary.addEventListener('click', () => {
      const account = state.accounts.find((a) => a.id === selectedAccountId);
      if (!account || !window.HoodCertPdf) return;
      const job = lastCompletedJob;
      const serviceDate = job ? job.serviceDate : new Date().toISOString().slice(0, 10);
      const nextDue = addMonths(serviceDate, VOLUME_MONTHS[account.volume] || 3);
      const defCount = Object.values(draftChecklist).filter((c) => c.status === 'deficiency').length;
      const href = window.HoodCertPdf.buildMailtoSummary({
        companyName: state.companyName,
        account: { name: account.name, email: account.email },
        serviceDate: formatDate(serviceDate),
        nextDue: formatDate(nextDue),
        deficiencyCount: defCount
      });
      window.location.href = href;
    });

    els.btnNewJob.addEventListener('click', () => {
      selectedAccountId = '';
      els.accountSelect.value = '';
      els.btnToChecklist.disabled = true;
      els.finishBanner.classList.add('hidden');
      lastCompletedJob = null;
      initDraftChecklist();
      setJobStep(0);
      switchTab('job');
    });

    els.btnSaveSettings.addEventListener('click', () => {
      state.companyName = els.settingsCompany.value.trim() || state.companyName;
      state.techName = els.settingsTech.value.trim() || state.techName;
      saveState();
      showToast('Defaults saved');
    });

    els.btnClearData.addEventListener('click', () => {
      if (!window.confirm('Clear all Hood Cert Pack data on this device?')) return;
      localStorage.removeItem(STORAGE_KEY);
      state = { companyName: 'Summit Hood Services', techName: 'Maria Lopez', accounts: [], jobs: [] };
      renderAccountSelect();
      renderBoard();
      setJobStep(0);
      showToast('Local data cleared');
    });

    els.btnLoadSamples.addEventListener('click', () => loadSampleData());

    els.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab || 'job'));
    });
  }

  function init() {
    loadState();
    initDraftChecklist();
    renderAccountSelect();
    renderBoard();
    wireEvents();
    setJobStep(0);
    switchTab('job');

    const params = new URLSearchParams(window.location.search);
    if (params.get('sample') === '1') {
      const hasSamples = state.accounts.some((a) => a.id.startsWith('sample-'));
      if (!hasSamples) {
        loadSampleData();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
