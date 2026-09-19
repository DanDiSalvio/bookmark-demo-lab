(function () {
  'use strict';

  const S = window.DrivewayReviewStorage;

  const $ = (id) => document.getElementById(id);

  const jobForm = $('job-form');
  const activeJob = $('active-job');
  const smsFlow = $('sms-flow');
  const jobCard = $('job-card');
  const smsPreview = $('sms-preview');
  const smsTo = $('sms-to');
  const smsStatus = $('sms-status');
  const linkPanel = $('link-panel');
  const captureUrlEl = $('capture-url');
  const btnOpenCapture = $('btn-open-capture');
  const responseList = $('response-list');
  const inboxEmpty = $('inbox-empty');
  const btnClearInbox = $('btn-clear-inbox');
  const toast = $('toast');

  /** @type {import('../lib/storage.js').Job | null} */
  let currentJob = null;

  const SAMPLE_DATA = {
    lawn: {
      customerName: 'Sarah Mitchell',
      address: '142 Oak Lane, Denver, CO 80205',
      service: 'Spring lawn cleanup & mulch',
      phone: '(555) 234-8891'
    },
    pressure: {
      customerName: 'Mike Torres',
      address: '88 Cedar Dr, Austin, TX 78704',
      service: 'Driveway & patio pressure wash',
      phone: '(555) 882-4410'
    },
    clean: {
      customerName: 'Jennifer Walsh',
      address: '2105 Birch St, Portland, OR 97201',
      service: 'Deep house clean — 3 bed',
      phone: '(555) 701-3322'
    }
  };

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('toast--visible');
    window.setTimeout(() => toast.classList.remove('toast--visible'), 2200);
  }

  function copyText(text) {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text);
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return Promise.resolve();
  }

  function renderJobCard(job) {
    const sent = job.reviewRequestSentAt !== null;
    jobCard.innerHTML = `
      <div class="job-card__top">
        <span class="job-card__name">${escapeHtml(job.customerName)}</span>
        <span class="job-card__badge job-card__badge--${sent ? 'sent' : 'complete'}">${sent ? 'Request sent' : 'Complete'}</span>
      </div>
      <p class="job-card__meta">${escapeHtml(job.address)}</p>
      <p class="job-card__service">${escapeHtml(job.service)} · ${escapeHtml(job.phone)}</p>
    `;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showActiveJob(job) {
    currentJob = job;
    jobForm.classList.add('hidden');
    activeJob.classList.remove('hidden');
    renderJobCard(job);

    if (job.reviewRequestSentAt) {
      showSentState(job);
    } else {
      smsFlow.classList.add('hidden');
      $('btn-send-request').classList.remove('hidden');
    }
  }

  function showSentState(job) {
    $('btn-send-request').classList.add('hidden');
    smsFlow.classList.remove('hidden');
    smsStatus.classList.remove('hidden');
    smsStatus.className = 'sms-status sms-status--sent';
    smsStatus.textContent = `SMS sent to ${job.phone} · ${S.formatRelativeTime(job.reviewRequestSentAt)}`;

    const captureUrl = S.buildCaptureUrl(job.id);
    smsPreview.textContent = S.buildSmsText(job, captureUrl);
    smsTo.textContent = job.phone;
    linkPanel.classList.remove('hidden');
    captureUrlEl.textContent = captureUrl;
    btnOpenCapture.href = captureUrl;
  }

  function resetToForm() {
    currentJob = null;
    jobForm.classList.remove('hidden');
    activeJob.classList.add('hidden');
    smsFlow.classList.add('hidden');
    smsStatus.classList.add('hidden');
    linkPanel.classList.add('hidden');
    $('customer-name').value = '';
    $('address').value = '';
    $('service').value = '';
    $('phone').value = '';
  }

  function renderInbox() {
    const responses = S.getAllResponses();
    const jobs = S.getAllJobs();
    const jobMap = new Map(jobs.map((job) => [job.id, job]));

    responseList.innerHTML = '';

    if (responses.length === 0) {
      inboxEmpty.classList.remove('hidden');
      btnClearInbox.classList.add('hidden');
      return;
    }

    inboxEmpty.classList.add('hidden');
    btnClearInbox.classList.remove('hidden');

    for (const response of responses) {
      const job = jobMap.get(response.jobId);
      const li = document.createElement('li');
      li.className = 'response-card';

      const photoHtml = response.photoDataUrl
        ? `<img class="response-card__photo" src="${response.photoDataUrl}" alt="Job photo from customer" />`
        : '';

      li.innerHTML = `
        <div class="response-card__top">
          <span class="response-card__customer">${escapeHtml(job?.customerName ?? 'Customer')}</span>
          <span class="response-card__time">${escapeHtml(S.formatDateTime(response.submittedAt))}</span>
        </div>
        ${job ? `<p class="response-card__service">${escapeHtml(job.service)} · ${escapeHtml(job.address)}</p>` : ''}
        <blockquote class="response-card__quote">"${escapeHtml(response.reviewText)}"</blockquote>
        ${photoHtml}
        <div class="draft-block">
          <p class="draft-block__label">Google-ready draft</p>
          <p class="draft-block__text" id="draft-${response.id}">${escapeHtml(response.googleDraft)}</p>
          <div class="draft-block__actions">
            <button type="button" class="btn btn-primary btn-sm" data-copy-draft="${response.id}">Copy draft</button>
          </div>
        </div>
      `;

      responseList.appendChild(li);
    }

    responseList.querySelectorAll('[data-copy-draft]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-copy-draft');
        const draftEl = document.getElementById(`draft-${id}`);
        if (!draftEl) return;
        copyText(draftEl.textContent).then(() => showToast('Draft copied'));
      });
    });
  }

  function handleCompleteJob() {
    const customerName = $('customer-name').value.trim();
    const address = $('address').value.trim();
    const service = $('service').value.trim();
    const phoneRaw = $('phone').value.trim();

    if (!customerName || !address || !service || !phoneRaw) {
      showToast('Fill in all fields');
      return;
    }

    const job = S.saveJob({
      id: S.createId('job'),
      customerName,
      address,
      service,
      phone: S.formatPhoneDisplay(phoneRaw),
      status: 'complete',
      reviewRequestSentAt: null,
      createdAt: Date.now()
    });

    showActiveJob(job);
    showToast('Job marked complete');
  }

  function handleSendRequest() {
    if (!currentJob) return;

    const captureUrl = S.buildCaptureUrl(currentJob.id);
    smsPreview.textContent = S.buildSmsText(currentJob, captureUrl);
    smsTo.textContent = currentJob.phone;
    smsFlow.classList.remove('hidden');
    smsStatus.classList.add('hidden');
    linkPanel.classList.add('hidden');
    $('btn-send-request').classList.add('hidden');
  }

  function handleConfirmSend() {
    if (!currentJob) return;

    currentJob = S.saveJob({
      ...currentJob,
      status: 'request_sent',
      reviewRequestSentAt: Date.now()
    });

    showSentState(currentJob);
    showToast('Review request sent (simulated)');

    if (isSampleMode && !sampleCaptureOpened) {
      sampleCaptureOpened = true;
      window.setTimeout(() => {
        const url = S.buildCaptureUrl(currentJob.id);
        window.open(url, '_blank', 'noopener');
      }, 800);
    }
  }

  function handleCancelSms() {
    smsFlow.classList.add('hidden');
    if (currentJob && !currentJob.reviewRequestSentAt) {
      $('btn-send-request').classList.remove('hidden');
    }
  }

  function handleCopyLink() {
    if (!currentJob) return;
    const url = S.buildCaptureUrl(currentJob.id);
    copyText(url).then(() => showToast('Link copied'));
  }

  let isSampleMode = false;
  let sampleCaptureOpened = false;

  function initSampleMode() {
    isSampleMode = true;
    const jobId = S.seedSampleJob();
    const job = S.getJob(jobId);
    if (!job) return;

    $('customer-name').value = job.customerName;
    $('address').value = job.address;
    $('service').value = job.service;
    $('phone').value = job.phone;

    showActiveJob(job);

    if (!job.reviewRequestSentAt) {
      window.setTimeout(() => {
        handleSendRequest();
        window.setTimeout(() => handleConfirmSend(), 1200);
      }, 600);
    } else {
      showSentState(job);
      if (!S.getResponsesForJob(job.id).length) {
        sampleCaptureOpened = true;
        window.setTimeout(() => {
          window.open(S.buildCaptureUrl(job.id), '_blank', 'noopener');
        }, 500);
      }
    }
  }

  document.querySelectorAll('[data-sample]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const key = chip.getAttribute('data-sample');
      const data = SAMPLE_DATA[key];
      if (!data) return;
      $('customer-name').value = data.customerName;
      $('address').value = data.address;
      $('service').value = data.service;
      $('phone').value = data.phone;
    });
  });

  $('btn-complete-job').addEventListener('click', handleCompleteJob);
  $('btn-send-request').addEventListener('click', handleSendRequest);
  $('btn-confirm-send').addEventListener('click', handleConfirmSend);
  $('btn-cancel-sms').addEventListener('click', handleCancelSms);
  $('btn-copy-link').addEventListener('click', handleCopyLink);
  $('btn-new-job').addEventListener('click', resetToForm);

  btnClearInbox.addEventListener('click', () => {
    if (!window.confirm('Clear all review data? This cannot be undone.')) return;
    S.clearAll();
    resetToForm();
    renderInbox();
    showToast('Inbox cleared');
  });

  window.addEventListener('storage', (event) => {
    if (event.key === S.STORAGE_KEY) {
      renderInbox();
      if (currentJob) {
        const updated = S.getJob(currentJob.id);
        if (updated) {
          currentJob = updated;
          renderJobCard(updated);
        }
      }
    }
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get('sample') === '1') {
    initSampleMode();
  }

  renderInbox();
})();
