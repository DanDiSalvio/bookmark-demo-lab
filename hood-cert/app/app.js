(function () {
  'use strict';

  const STORAGE_KEY = 'hood-cert-pack-v1';
  const FREE_RECORDS_PER_MONTH = 3;
  const SAMPLE_PHOTO_DISCLAIMER = 'Sample photos for demo, not from a real job';

  function samplePhotoTimes(serviceDateIso) {
    const [y, m, d] = serviceDateIso.split('-').map(Number);
    const before = new Date(y, m - 1, d, 10, 5, 0, 0);
    const after = new Date(y, m - 1, d, 11, 40, 0, 0);
    return { beforeAt: before.toISOString(), afterAt: after.toISOString() };
  }

  const CHECKLIST_AREAS = [
    { id: 'hood', label: 'Hood' },
    { id: 'filters', label: 'Filters' },
    { id: 'ductwork', label: 'Ductwork' },
    { id: 'fan', label: 'Fan' },
    { id: 'accessPanels', label: 'Access panels' },
    { id: 'greaseContainment', label: 'Grease containment' },
    { id: 'fireSuppressionNozzles', label: 'Fire-suppression nozzles visible/unobstructed' }
  ];

  const VOLUME_MONTHS = { high: 1, medium: 3, low: 6, minimal: 12 };

  const VOLUME_LABELS = {
    high: 'High volume (monthly)',
    medium: 'Medium volume (quarterly)',
    low: 'Low volume (semiannual)',
    minimal: 'Seasonal (annual)'
  };

  const CAMERA_SVG =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';

  /** @type {{ companyName: string, techName: string, plan: string, demoPro: boolean, recordsMonth: { key: string, count: number }, accounts: any[], jobs: any[] }} */
  let state = {
    companyName: 'Summit Hood Services',
    techName: 'Maria Lopez',
    plan: 'free',
    demoPro: false,
    recordsMonth: { key: '', count: 0 },
    accounts: [],
    jobs: []
  };

  let selectedAccountId = '';
  /** @type {Record<string, any>} */
  let draftChecklist = {};
  let jobStep = 0;
  /** @type {any | null} */
  let lastCompletedJob = null;
  let isSavingJob = false;
  let jobCommitted = false;

  const $ = (sel) => document.querySelector(sel);

  const els = {
    accountSelect: $('#account-select'),
    btnToggleAdd: $('#btn-toggle-add-account'),
    addAccountForm: $('#add-account-form'),
    newName: $('#new-name'),
    newAddress: $('#new-address'),
    newEmail: $('#new-email'),
    newVolume: $('#new-volume'),
    errNewName: $('#err-new-name'),
    errNewAddress: $('#err-new-address'),
    btnSaveAccount: $('#btn-save-account'),
    btnToChecklist: $('#btn-to-checklist'),
    jobStepAccount: $('#job-step-account'),
    jobStepChecklist: $('#job-step-checklist'),
    jobStepReview: $('#job-step-review'),
    jobStepRecord: $('#job-step-record'),
    checklistRoot: $('#checklist-root'),
    checklistAccountName: $('#checklist-account-name'),
    checklistProgress: $('#checklist-progress'),
    planUsageBanner: $('#plan-usage-banner'),
    jobStepChecklistBlocked: $('#job-step-checklist-blocked'),
    checklistBlockedBody: $('#checklist-blocked-body'),
    checklistError: $('#checklist-error'),
    btnMarkPass: $('#btn-mark-pass'),
    btnToReview: $('#btn-to-review'),
    btnBackAccount: $('#btn-back-account'),
    btnBackChecklist: $('#btn-back-checklist'),
    techName: $('#tech-name'),
    companyName: $('#company-name'),
    finishSummary: $('#finish-summary'),
    completeError: $('#complete-error'),
    btnCompleteJob: $('#btn-complete-job'),
    recordMeta: $('#record-meta'),
    pdfError: $('#pdf-error'),
    btnDownloadPdf: $('#btn-download-pdf'),
    btnSharePdf: $('#btn-share-pdf'),
    btnEmailSummary: $('#btn-email-summary'),
    btnNewJob: $('#btn-new-job'),
    boardLocked: $('#board-locked'),
    boardPro: $('#board-pro'),
    boardSections: $('#board-sections'),
    boardEmpty: $('#board-empty'),
    btnDemoUnlock: $('#btn-demo-unlock-board'),
    settingsCompany: $('#settings-company'),
    settingsTech: $('#settings-tech'),
    settingsDemoPro: $('#settings-demo-pro'),
    planLabel: $('#plan-label'),
    btnSaveSettings: $('#btn-save-settings'),
    btnClearData: $('#btn-clear-data'),
    btnLoadSamples: $('#btn-load-samples'),
    jobSteps: $('#job-steps'),
    panelHeading: $('#panel-heading'),
    panelLede: $('#panel-lede'),
    panelJob: $('#panel-job'),
    panelBoard: $('#panel-board'),
    panelSettings: $('#panel-settings'),
    recordDialog: $('#record-dialog'),
    recordDialogBody: $('#record-dialog-body'),
    btnCloseRecordDialog: $('#btn-close-record-dialog'),
    toast: $('#toast'),
    tabButtons: document.querySelectorAll('.tab-bar__btn')
  };

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function localDateIso() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function monthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function isProPlan() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sample') === '1') return true;
    return state.plan === 'pro' || state.demoPro;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      state = {
        companyName: parsed.companyName || state.companyName,
        techName: parsed.techName || state.techName,
        plan: parsed.plan || 'free',
        demoPro: !!parsed.demoPro,
        recordsMonth: parsed.recordsMonth || { key: monthKey(), count: 0 },
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
        jobs: Array.isArray(parsed.jobs) ? parsed.jobs : []
      };
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

  function showFieldError(el, message) {
    if (!el) return;
    if (!message) {
      el.textContent = '';
      el.classList.add('hidden');
      return;
    }
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function formatDate(iso) {
    if (!iso) return 'Never';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function addMonthsLocal(iso, months) {
    const d = new Date(iso + 'T12:00:00');
    d.setMonth(d.getMonth() + months);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function daysUntil(iso) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(iso + 'T12:00:00');
    return Math.round((target - today) / 86400000);
  }

  function accountNextDue(account) {
    if (!account.lastServiceDate) return null;
    return addMonthsLocal(account.lastServiceDate, VOLUME_MONTHS[account.volume] || 3);
  }

  function lastServiceDisplay(account) {
    return account.lastServiceDate ? formatDate(account.lastServiceDate) : 'No visit yet';
  }

  function freePlanBannerText() {
    if (isProPlan()) return '';
    const left = FREE_RECORDS_PER_MONTH - recordsUsedThisMonth();
    if (left <= 0) {
      return 'Free plan limit reached for this month. Upgrade to Pro for unlimited records.';
    }
    if (left === 1) {
      return '1 free record left this month';
    }
    return `${left} free records left this month`;
  }

  function isChecklistBlockedByPlan() {
    return !isProPlan() && !canCompleteAnotherRecord();
  }

  function accountBoardBucket(account) {
    const next = accountNextDue(account);
    if (!account.lastServiceDate) {
      return { key: 'new', label: 'No visit yet', badge: 'badge--neutral', section: 'due' };
    }
    if (!next) {
      return { key: 'due', label: 'Due in 30 days', badge: 'badge--due', section: 'due' };
    }
    const days = daysUntil(next);
    if (days < 0) {
      const overdue = Math.abs(days);
      return {
        key: 'overdue',
        label: 'Overdue',
        badge: 'badge--overdue',
        section: 'overdue',
        overdueText: `${overdue} day${overdue === 1 ? '' : 's'} overdue`
      };
    }
    if (days <= 30) {
      return { key: 'due', label: 'Due in 30 days', badge: 'badge--due', section: 'due' };
    }
    return { key: 'later', label: 'Later', badge: 'badge--ok', section: 'later' };
  }

  function recordsUsedThisMonth() {
    const key = monthKey();
    if (state.recordsMonth.key !== key) {
      state.recordsMonth = { key, count: 0 };
    }
    return state.recordsMonth.count;
  }

  function bumpRecordCount() {
    const key = monthKey();
    if (state.recordsMonth.key !== key) {
      state.recordsMonth = { key, count: 0 };
    }
    state.recordsMonth.count += 1;
  }

  function canCompleteAnotherRecord() {
    if (isProPlan()) return true;
    return recordsUsedThisMonth() < FREE_RECORDS_PER_MONTH;
  }

  function initDraftChecklist() {
    draftChecklist = {};
    CHECKLIST_AREAS.forEach((area) => {
      draftChecklist[area.id] = {
        id: area.id,
        status: null,
        note: '',
        beforePhoto: null,
        afterPhoto: null,
        beforeAt: null,
        afterAt: null,
        noAccessReason: ''
      };
    });
    jobCommitted = false;
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

  function checklistProgressStats() {
    const answered = CHECKLIST_AREAS.filter((a) => draftChecklist[a.id].status).length;
    let photos = 0;
    CHECKLIST_AREAS.forEach((a) => {
      const item = draftChecklist[a.id];
      if (item.beforePhoto) photos += 1;
      if (item.afterPhoto) photos += 1;
    });
    return { answered, photos, total: CHECKLIST_AREAS.length };
  }

  function updateChecklistProgress() {
    const { answered, photos, total } = checklistProgressStats();
    els.checklistProgress.textContent = `${answered} of ${total} areas · ${photos} photos`;
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

  function createPhotoTile(areaId, kind, item) {
    const inputId = `photo-${areaId}-${kind}`;
    const label = document.createElement('label');
    label.className = 'photo-tile';
    label.setAttribute('for', inputId);
    const data = kind === 'before' ? item.beforePhoto : item.afterPhoto;
    if (data) {
      label.classList.add('photo-tile--filled');
      const img = document.createElement('img');
      img.src = data;
      img.alt = `${kind} photo`;
      label.appendChild(img);
    } else {
      label.innerHTML = CAMERA_SVG;
      const span = document.createElement('span');
      span.className = 'photo-tile__text';
      span.textContent = kind === 'before' ? 'Before' : 'After';
      label.appendChild(span);
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.id = inputId;
    input.className = 'photo-tile__input';
    input.setAttribute('aria-label', `${kind} photo for ${areaId}`);
    label.appendChild(input);
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const dataUrl = await compressImage(file);
        const stamp = new Date().toISOString();
        if (kind === 'before') {
          item.beforePhoto = dataUrl;
          item.beforeAt = stamp;
        } else {
          item.afterPhoto = dataUrl;
          item.afterAt = stamp;
          item.noAccessReason = '';
        }
        renderChecklist();
      } catch (err) {
        showToast('Could not process photo');
        console.error(err);
      }
    });
    return label;
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
      name.id = `area-label-${area.id}`;
      name.textContent = area.label;

      const toggle = document.createElement('div');
      toggle.className = 'status-toggle';
      toggle.setAttribute('role', 'group');
      toggle.setAttribute('aria-labelledby', `area-label-${area.id}`);

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

      const btnNoAccess = document.createElement('button');
      btnNoAccess.type = 'button';
      btnNoAccess.className = 'status-toggle__btn' + (item.status === 'no_access' ? ' is-na' : '');
      btnNoAccess.textContent = 'No access';
      btnNoAccess.dataset.status = 'no_access';

      toggle.classList.add('status-toggle--three');
      toggle.append(btnPass, btnDef, btnNoAccess);
      head.append(name, toggle);

      const noteField = document.createElement('div');
      noteField.className = 'field';
      if (item.status === 'deficiency') {
        const noteLabel = document.createElement('label');
        noteLabel.className = 'field-label';
        noteLabel.setAttribute('for', `note-${area.id}`);
        noteLabel.textContent = 'Deficiency note';
        const noteInput = document.createElement('textarea');
        noteInput.className = 'field-textarea';
        noteInput.id = `note-${area.id}`;
        noteInput.rows = 2;
        noteInput.value = item.note || '';
        noteInput.addEventListener('input', () => {
          item.note = noteInput.value;
        });
        noteField.append(noteLabel, noteInput);
      }

      const accessField = document.createElement('div');
      accessField.className = 'field field--compact';
      if (item.status === 'no_access') {
        const accessLabel = document.createElement('label');
        accessLabel.className = 'field-label';
        accessLabel.setAttribute('for', `no-access-reason-${area.id}`);
        accessLabel.textContent = 'No access reason';
        const accessInput = document.createElement('input');
        accessInput.className = 'field-input';
        accessInput.id = `no-access-reason-${area.id}`;
        accessInput.type = 'text';
        accessInput.value = item.noAccessReason || '';
        accessInput.addEventListener('input', () => {
          item.noAccessReason = accessInput.value;
        });
        accessField.append(accessLabel, accessInput);
      }

      const photoGrid = document.createElement('div');
      photoGrid.className = 'photo-grid';
      if (item.status === 'pass' || item.status === 'deficiency') {
        photoGrid.append(createPhotoTile(area.id, 'before', item), createPhotoTile(area.id, 'after', item));
      }

      wrap.append(head, noteField, accessField, photoGrid);
      els.checklistRoot.appendChild(wrap);

      toggle.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-status]');
        if (!btn) return;
        const next = btn.dataset.status;
        if (next === 'deficiency') item.status = 'deficiency';
        else if (next === 'no_access') {
          item.status = 'no_access';
          item.afterPhoto = null;
          item.afterAt = null;
          item.note = '';
        } else {
          item.status = 'pass';
          item.noAccessReason = '';
        }
        renderChecklist();
      });
    });

    updateChecklistProgress();
  }

  function validateChecklist() {
    for (const area of CHECKLIST_AREAS) {
      const item = draftChecklist[area.id];
      if (!item.status) {
        return `Choose Pass, Deficiency, or No access for ${area.label}.`;
      }
      if (item.status === 'no_access') {
        if (!(item.noAccessReason || '').trim()) {
          return `Add a no access reason for ${area.label}.`;
        }
        continue;
      }
      if (!item.afterPhoto) {
        return `Add an after photo for ${area.label}.`;
      }
      if (item.status === 'deficiency' && !(item.note || '').trim()) {
        return `Add a deficiency note for ${area.label}.`;
      }
    }
    return '';
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
    const blocked = step === 1 && isChecklistBlockedByPlan();
    els.jobStepChecklist.classList.toggle('hidden', step !== 1 || blocked);
    if (els.jobStepChecklistBlocked) {
      els.jobStepChecklistBlocked.classList.toggle('hidden', step !== 1 || !blocked);
      if (blocked && els.checklistBlockedBody) {
        els.checklistBlockedBody.textContent =
          'You have used all 3 free service records this month. Upgrade to Pro for unlimited records, or wait until next month.';
      }
    }
    els.jobStepReview.classList.toggle('hidden', step !== 2);
    els.jobStepRecord.classList.toggle('hidden', step !== 3);

    if (step === 1) {
      if (els.planUsageBanner) {
        const text = freePlanBannerText();
        els.planUsageBanner.textContent = text;
        els.planUsageBanner.classList.toggle('hidden', !text);
      }
      renderChecklist();
    }
    if (step === 2) updateFinishSummary();
    if (step === 3) updateRecordScreen();
  }

  function updateFinishSummary() {
    const account = state.accounts.find((a) => a.id === selectedAccountId);
    if (!account) return;
    const today = localDateIso();
    const nextDue = addMonthsLocal(today, VOLUME_MONTHS[account.volume] || 3);
    const defCount = Object.values(draftChecklist).filter((c) => c.status === 'deficiency').length;
    const defWord = defCount === 1 ? 'deficiency note' : 'deficiency notes';
    els.finishSummary.textContent = `${account.name} · ${formatDate(today)} · ${defCount} ${defWord} · Next due ${formatDate(nextDue)}`;
    els.techName.value = state.techName;
    els.companyName.value = state.companyName;
    showFieldError(els.completeError, '');
  }

  function buildJobFromDraft() {
    const serviceDate = localDateIso();
    state.techName = els.techName.value.trim() || state.techName;
    state.companyName = els.companyName.value.trim() || state.companyName;
    const recordNumber = window.HoodCertPdf
      ? window.HoodCertPdf.makeRecordNumber(serviceDate)
      : `HC-${serviceDate.replace(/-/g, '')}-DEMO`;

    return {
      id: uid(),
      accountId: selectedAccountId,
      serviceDate,
      techName: state.techName,
      recordNumber,
      checklist: CHECKLIST_AREAS.map((a) => ({ ...draftChecklist[a.id] })),
      createdAt: Date.now()
    };
  }

  async function completeJobOnce() {
    if (jobCommitted || isSavingJob) return null;
    isSavingJob = true;
    els.btnCompleteJob.disabled = true;
    els.btnCompleteJob.textContent = 'Saving…';

    showFieldError(els.completeError, '');
    const checklistErr = validateChecklist();
    if (checklistErr) {
      showFieldError(els.completeError, checklistErr);
      isSavingJob = false;
      els.btnCompleteJob.disabled = false;
      els.btnCompleteJob.textContent = 'Complete job';
      return null;
    }
    if (!canCompleteAnotherRecord()) {
      showFieldError(
        els.completeError,
        'Free plan allows 3 service records per month. Upgrade to Pro for unlimited records.'
      );
      isSavingJob = false;
      els.btnCompleteJob.disabled = false;
      els.btnCompleteJob.textContent = 'Complete job';
      return null;
    }

    const account = state.accounts.find((a) => a.id === selectedAccountId);
    if (!account) {
      isSavingJob = false;
      els.btnCompleteJob.disabled = false;
      els.btnCompleteJob.textContent = 'Complete job';
      return null;
    }

    try {
      const job = buildJobFromDraft();
      state.jobs.unshift(job);
      account.lastServiceDate = job.serviceDate;
      if (!account.jobs) account.jobs = [];
      account.jobs.unshift(job.id);
      if (!isProPlan()) bumpRecordCount();
      saveState();
      lastCompletedJob = job;
      jobCommitted = true;
      renderBoard();
      setJobStep(3);
      return job;
    } finally {
      isSavingJob = false;
      els.btnCompleteJob.disabled = false;
      els.btnCompleteJob.textContent = 'Complete job';
    }
  }

  function pdfPayloadFromJob(job) {
    const account = state.accounts.find((a) => a.id === job.accountId);
    if (!account) return null;
    const nextDue = addMonthsLocal(job.serviceDate, VOLUME_MONTHS[account.volume] || 3);
    const payload = {
      companyName: state.companyName,
      techName: job.techName,
      recordNumber: job.recordNumber,
      account: { name: account.name, address: account.address, email: account.email },
      serviceDate: formatDate(job.serviceDate),
      nextDue: formatDate(nextDue),
      checklist: job.checklist
    };
    if (job.sampleUsesStockPhotos) {
      payload.samplePhotoDisclaimer = SAMPLE_PHOTO_DISCLAIMER;
    }
    return payload;
  }

  function updateRecordScreen() {
    const job = lastCompletedJob;
    if (!job) return;
    const account = state.accounts.find((a) => a.id === job.accountId);
    els.recordMeta.textContent = `${job.recordNumber} · ${account ? account.name : 'Account'} · ${formatDate(job.serviceDate)}`;
    showFieldError(els.pdfError, '');
    if (navigator.share && navigator.canShare) {
      els.btnSharePdf.classList.remove('hidden');
    }
  }

  async function downloadPdfForJob() {
    const job = lastCompletedJob;
    if (!job || !window.HoodCertPdf) {
      showFieldError(els.pdfError, 'PDF tools are not available. Refresh and try again.');
      return;
    }
    showFieldError(els.pdfError, '');
    try {
      const payload = pdfPayloadFromJob(job);
      if (!payload) return;
      await window.HoodCertPdf.downloadServiceRecordPdf(payload);
    } catch (e) {
      console.error(e);
      showFieldError(
        els.pdfError,
        'Your record is saved. The PDF could not be built on this device. Tap Download PDF to try again.'
      );
    }
  }

  async function sharePdfForJob() {
    const job = lastCompletedJob;
    if (!job || !window.HoodCertPdf || !navigator.share) return;
    try {
      const payload = pdfPayloadFromJob(job);
      if (!payload) return;
      const { blob, filename } = await window.HoodCertPdf.blobServiceRecordPdf(payload);
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
      }
    } catch (e) {
      showFieldError(els.pdfError, 'Share failed on this device. Use Download instead.');
    }
  }

  function renderBoard() {
    const pro = isProPlan();
    els.boardLocked.classList.toggle('hidden', pro);
    els.boardPro.classList.toggle('hidden', !pro);
    if (!pro) return;

    const sections = { overdue: [], due: [], later: [] };
    state.accounts.forEach((account) => {
      const bucket = accountBoardBucket(account);
      sections[bucket.section].push({ account, bucket });
    });

    const order = ['overdue', 'due', 'later'];
    const titles = {
      overdue: 'Overdue',
      due: 'Due in 30 days',
      later: 'Later'
    };

    els.boardSections.replaceChildren();
    const total = state.accounts.length;
    if (total === 0) {
      els.boardEmpty.classList.remove('hidden');
      return;
    }
    els.boardEmpty.classList.add('hidden');

    order.forEach((key) => {
      const rows = sections[key];
      if (!rows.length) return;

      const section =
        key === 'later'
          ? document.createElement('details')
          : document.createElement('section');
      section.className = 'board-section';
      if (key === 'later') {
        section.classList.add('board-section--collapsible');
        section.open = false;
      }

      const heading = document.createElement('h2');
      heading.className = 'board-section__title';
      heading.textContent = `${titles[key]} (${rows.length})`;
      if (key === 'later') {
        const summary = document.createElement('summary');
        summary.className = 'board-section__summary';
        summary.appendChild(heading);
        section.appendChild(summary);
      } else {
        section.appendChild(heading);
      }

      const table = document.createElement('div');
      table.className = 'board-table';
      table.setAttribute('role', 'table');

      rows.forEach(({ account, bucket }) => {
        const next = accountNextDue(account);
        const row = document.createElement('div');
        row.className = 'board-table__row';
        row.setAttribute('role', 'row');

        const nameCell = document.createElement('div');
        nameCell.className = 'board-table__cell board-table__cell--name';
        nameCell.setAttribute('role', 'cell');
        const nameEl = document.createElement('p');
        nameEl.className = 'board-row__name';
        nameEl.textContent = account.name;
        const metaEl = document.createElement('p');
        metaEl.className = 'board-row__meta';
        metaEl.textContent = account.lastServiceDate
          ? `Last ${lastServiceDisplay(account)} · ${VOLUME_LABELS[account.volume] || account.volume}`
          : VOLUME_LABELS[account.volume] || account.volume;
        nameCell.append(nameEl, metaEl);

        const statusCell = document.createElement('div');
        statusCell.className = 'board-table__cell board-table__cell--status';
        statusCell.setAttribute('role', 'cell');
        const badge = document.createElement('span');
        badge.className = `badge ${bucket.badge}`;
        badge.textContent = bucket.label;
        const overdueEl = document.createElement('span');
        overdueEl.className = 'board-row__overdue';
        const statusLine =
          bucket.overdueText ||
          (account.lastServiceDate && next ? `Next ${formatDate(next)}` : '');
        statusCell.appendChild(badge);
        if (statusLine) {
          overdueEl.textContent = statusLine;
          statusCell.appendChild(overdueEl);
        }

        const actions = document.createElement('div');
        actions.className = 'board-table__cell board-table__cell--actions';
        actions.setAttribute('role', 'cell');

        const recordsBtn = document.createElement('button');
        recordsBtn.type = 'button';
        recordsBtn.className = 'btn btn-ghost btn-sm';
        recordsBtn.textContent = 'Records';
        recordsBtn.addEventListener('click', () => openRecordsForAccount(account.id));
        actions.appendChild(recordsBtn);

        if (key === 'due' || key === 'overdue') {
          const rebookBtn = document.createElement('button');
          rebookBtn.type = 'button';
          rebookBtn.className = 'btn btn-accent btn-sm';
          rebookBtn.textContent = 'Send rebook note';
          rebookBtn.addEventListener('click', () => sendRebookNote(account, next, bucket));
          actions.appendChild(rebookBtn);
        }

        row.append(nameCell, statusCell, actions);
        table.appendChild(row);
      });

      section.appendChild(table);
      els.boardSections.appendChild(section);
    });
  }

  function openRecordsForAccount(accountId) {
    const jobs = state.jobs.filter((j) => j.accountId === accountId);
    const account = state.accounts.find((a) => a.id === accountId);
    els.recordDialogBody.replaceChildren();
    const title = document.createElement('p');
    title.className = 'meta';
    title.textContent = account ? account.name : 'Account';
    els.recordDialogBody.appendChild(title);

    if (!jobs.length) {
      const empty = document.createElement('p');
      empty.className = 'meta';
      empty.textContent = 'No saved records for this account yet.';
      els.recordDialogBody.appendChild(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'record-list';
      jobs.forEach((job) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-ghost btn-block';
        btn.textContent = `${job.recordNumber || 'Record'} · ${formatDate(job.serviceDate)} · ${job.techName}`;
        btn.addEventListener('click', () => {
          lastCompletedJob = job;
          els.recordDialog.close();
          switchTab('job');
          setJobStep(3);
        });
        li.appendChild(btn);
        list.appendChild(li);
      });
      els.recordDialogBody.appendChild(list);
    }
    els.recordDialog.showModal();
  }

  function sendRebookNote(account, nextDue, bucket) {
    const message = buildRebookMessage(account, nextDue, bucket);
    const subject = encodeURIComponent(`Hood cleaning rebook - ${account.name}`);
    const body = encodeURIComponent(message);
    const to = account.email ? encodeURIComponent(account.email) : '';
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }

  function buildRebookMessage(account, nextDue, bucket) {
    const company = state.companyName || 'Our hood cleaning team';
    const duePhrase = nextDue ? formatDate(nextDue) : 'soon';
    let urgency = `Your next hood cleaning is due around ${duePhrase}.`;
    if (bucket.key === 'overdue') {
      urgency = `Your kitchen exhaust cleaning is overdue (was due ${duePhrase}).`;
    }
    return [
      `Hi ${account.name} team,`,
      '',
      `This is ${company}. ${urgency}`,
      '',
      `We follow NFPA 96 style frequency for ${VOLUME_LABELS[account.volume] || 'your cooking volume'}. Reply with a good day or time to get on the calendar.`,
      '',
      'Thank you,',
      company
    ].join('\n');
  }

  function switchTab(tab) {
    const allTabButtons = [...els.tabButtons, ...document.querySelectorAll('.shell-top-nav__btn')];
    allTabButtons.forEach((btn) => {
      const active = btn.dataset.tab === tab;
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });

    const headings = {
      job: ['New job', 'Select a restaurant, complete the hood checklist, and save one service record.'],
      board: ['Rebook board', 'Overdue accounts first, then due within 30 days.'],
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
      els.settingsDemoPro.checked = state.demoPro;
      els.planLabel.textContent = isProPlan()
        ? 'Plan: Pro (demo or paid)'
        : `Plan: Free · ${recordsUsedThisMonth()} of ${FREE_RECORDS_PER_MONTH} records used this month`;
    }
  }

  async function loadSampleData() {
    const today = new Date();
    const iso = (offsetDays) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offsetDays);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    let beforeUrl;
    let afterUrl;
    try {
      beforeUrl = await loadImageAsDataUrl('samples/hood-before.jpg');
      afterUrl = await loadImageAsDataUrl('samples/hood-after.jpg');
    } catch (e) {
      beforeUrl = null;
      afterUrl = null;
    }

    const accounts = [
      { id: 'sample-1', name: 'Harbor Grill', address: '412 Dock St, Portland, OR 97204', email: 'manager@harborgrill.example', volume: 'medium', lastServiceDate: iso(-120), jobs: [] },
      { id: 'sample-2', name: 'Wok Express 24', address: '88 Burnside Ave, Portland, OR 97209', email: 'ops@wokexpress.example', volume: 'high', lastServiceDate: iso(-45), jobs: [] },
      { id: 'sample-3', name: 'Lakeview Diner', address: '2100 NE Sandy Blvd, Portland, OR 97232', email: 'owner@lakeviewdiner.example', volume: 'low', lastServiceDate: iso(-30), jobs: [] },
      { id: 'sample-4', name: 'Brick Oven Pizza Co', address: '55 SE Morrison St, Portland, OR 97214', email: 'kitchen@brickoven.example', volume: 'medium', lastServiceDate: iso(-100), jobs: [] },
      { id: 'sample-5', name: 'Summit Catering Kitchen', address: '900 NW 23rd Ave, Portland, OR 97210', email: 'facilities@summitcatering.example', volume: 'minimal', lastServiceDate: iso(-60), jobs: [] },
      { id: 'sample-6', name: 'Riverside BBQ Pit', address: '1440 SE Powell Blvd, Portland, OR 97202', email: 'pitmaster@riversidebbq.example', volume: 'high', lastServiceDate: iso(-20), jobs: [] },
      { id: 'sample-7', name: 'Northside Commissary', address: '3010 N Interstate Ave, Portland, OR 97227', email: 'ops@northsidecommissary.example', volume: 'medium', lastServiceDate: null, jobs: [] }
    ];

    const sampleServiceDate = iso(-14);
    const { beforeAt, afterAt } = samplePhotoTimes(sampleServiceDate);
    const completedChecklist = CHECKLIST_AREAS.map((area) => {
      if (area.id === 'hood') {
        return {
          id: area.id,
          status: 'pass',
          note: '',
          beforePhoto: beforeUrl,
          afterPhoto: afterUrl,
          beforeAt,
          afterAt,
          noAccessReason: ''
        };
      }
      if (area.id === 'fan') {
        return {
          id: area.id,
          status: 'deficiency',
          note: 'Belt wear noted, fan cleaned and operational.',
          beforePhoto: null,
          afterPhoto: null,
          beforeAt: null,
          afterAt: null,
          noAccessReason: ''
        };
      }
      if (['accessPanels', 'greaseContainment', 'fireSuppressionNozzles'].includes(area.id)) {
        return {
          id: area.id,
          status: 'no_access',
          note: '',
          beforePhoto: null,
          afterPhoto: null,
          beforeAt: null,
          afterAt: null,
          noAccessReason: 'Panel sealed, documented no access'
        };
      }
      return {
        id: area.id,
        status: 'pass',
        note: '',
        beforePhoto: null,
        afterPhoto: null,
        beforeAt: null,
        afterAt: null,
        noAccessReason: ''
      };
    });

    const completedJob = {
      id: 'sample-job-1',
      accountId: 'sample-1',
      serviceDate: sampleServiceDate,
      techName: 'Maria Lopez',
      recordNumber: `HC-${sampleServiceDate.replace(/-/g, '')}-SAMP`,
      checklist: completedChecklist,
      sampleUsesStockPhotos: true,
      createdAt: Date.now() - 14 * 86400000
    };

    accounts[0].lastServiceDate = completedJob.serviceDate;
    accounts[0].jobs = [completedJob.id];

    state = {
      companyName: 'Summit Hood Services',
      techName: 'Maria Lopez',
      plan: 'free',
      demoPro: false,
      recordsMonth: { key: monthKey(), count: 0 },
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
      let ok = true;
      showFieldError(els.errNewName, name ? '' : 'Restaurant name is required.');
      showFieldError(els.errNewAddress, address ? '' : 'Address is required.');
      if (!name) ok = false;
      if (!address) ok = false;
      if (!ok) return;

      const acc = { id: uid(), name, address, email, volume, lastServiceDate: null, jobs: [] };
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

    const btnBackBlocked = $('#btn-back-account-blocked');
    const btnChecklistUnlock = $('#btn-checklist-unlock-pro');
    if (btnBackBlocked) {
      btnBackBlocked.addEventListener('click', () => setJobStep(0));
    }
    if (btnChecklistUnlock) {
      btnChecklistUnlock.addEventListener('click', () => {
        state.demoPro = true;
        saveState();
        setJobStep(1);
        showToast('Pro preview enabled for this device');
      });
    }
    els.btnBackChecklist.addEventListener('click', () => setJobStep(1));

    els.btnMarkPass.addEventListener('click', () => {
      CHECKLIST_AREAS.forEach((a) => {
        if (!draftChecklist[a.id].status) draftChecklist[a.id].status = 'pass';
      });
      renderChecklist();
    });

    els.btnToReview.addEventListener('click', () => {
      const err = validateChecklist();
      showFieldError(els.checklistError, err);
      if (err) return;
      setJobStep(2);
    });

    els.btnCompleteJob.addEventListener('click', () => {
      completeJobOnce();
    });

    els.btnDownloadPdf.addEventListener('click', () => downloadPdfForJob());
    els.btnSharePdf.addEventListener('click', () => sharePdfForJob());

    els.btnEmailSummary.addEventListener('click', () => {
      const job = lastCompletedJob;
      const account = job ? state.accounts.find((a) => a.id === job.accountId) : null;
      if (!job || !account || !window.HoodCertPdf) return;
      const payload = pdfPayloadFromJob(job);
      if (!payload) return;
      const defCount = job.checklist.filter((c) => c.status === 'deficiency').length;
      window.location.href = window.HoodCertPdf.buildMailtoSummary({
        companyName: state.companyName,
        account: { name: account.name, email: account.email },
        serviceDate: payload.serviceDate,
        nextDue: payload.nextDue,
        deficiencyCount: defCount,
        recordNumber: job.recordNumber
      });
    });

    els.btnNewJob.addEventListener('click', () => {
      selectedAccountId = '';
      els.accountSelect.value = '';
      els.btnToChecklist.disabled = true;
      lastCompletedJob = null;
      initDraftChecklist();
      setJobStep(0);
      switchTab('job');
    });

    els.btnSaveSettings.addEventListener('click', () => {
      state.companyName = els.settingsCompany.value.trim() || state.companyName;
      state.techName = els.settingsTech.value.trim() || state.techName;
      state.demoPro = els.settingsDemoPro.checked;
      saveState();
      renderBoard();
      showToast('Defaults saved');
    });

    els.btnClearData.addEventListener('click', () => {
      if (!window.confirm('Clear all Hood Cert Pack data on this device?')) return;
      localStorage.removeItem(STORAGE_KEY);
      state = {
        companyName: 'Summit Hood Services',
        techName: 'Maria Lopez',
        plan: 'free',
        demoPro: false,
        recordsMonth: { key: monthKey(), count: 0 },
        accounts: [],
        jobs: []
      };
      renderAccountSelect();
      renderBoard();
      setJobStep(0);
      showToast('Local data cleared');
    });

    document.querySelectorAll('.shell-top-nav__btn').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab || 'job'));
    });

    els.btnLoadSamples.addEventListener('click', () => {
      if (!window.confirm('Load sample restaurants? This replaces accounts and jobs on this device.')) return;
      loadSampleData();
    });

    els.btnDemoUnlock.addEventListener('click', () => {
      state.demoPro = true;
      saveState();
      renderBoard();
      showToast('Pro board preview enabled');
    });

    els.btnCloseRecordDialog.addEventListener('click', () => els.recordDialog.close());

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
      if (!hasSamples) loadSampleData();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.HoodCertApp = {
    getState: () => state,
    validateChecklist,
    completeJobOnce,
    draftChecklist,
    CHECKLIST_AREAS
  };
})();
