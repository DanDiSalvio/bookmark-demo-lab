(function () {
  'use strict';

  const STORAGE_KEY = 'missed-call-inbox-v1';
  const BOOK_LINK = 'https://book.yourbiz.com/schedule';
  const AUTO_SMS_SECONDS = 60;
  const SAMPLE_AUTO_SMS_SECONDS = 5;

  /** @typedef {{ phone: string, name: string, notes: string }} KnownContact */

  /** @type {Record<string, KnownContact>} */
  const KNOWN_CONTACTS = {
    '5552348890': {
      phone: '(555) 234-8890',
      name: 'Mike Torres',
      notes: 'Returning customer — water heater install 2024'
    },
    '5558824410': {
      phone: '(555) 882-4410',
      name: 'Sarah Chen',
      notes: 'Seasonal HVAC maintenance — books every spring'
    },
    '5557013322': {
      phone: '(555) 701-3322',
      name: 'Dave & Sons Electric',
      notes: 'Commercial account — panel upgrades'
    }
  };

  const SAMPLE_NUMBERS = {
    new: '5554129087',
    'known-mike': '5552348890',
    'known-sarah': '5558824410'
  };

  /** Seeded mock lookup by area code + last digits */
  const AREA_DATA = {
    '201': { city: 'Jersey City', state: 'NJ', timezone: 'Eastern' },
    '303': { city: 'Denver', state: 'CO', timezone: 'Mountain' },
    '404': { city: 'Atlanta', state: 'GA', timezone: 'Eastern' },
    '415': { city: 'San Francisco', state: 'CA', timezone: 'Pacific' },
    '512': { city: 'Austin', state: 'TX', timezone: 'Central' },
    '555': { city: 'Demo City', state: 'CO', timezone: 'Mountain' },
    '602': { city: 'Phoenix', state: 'AZ', timezone: 'Mountain' },
    '713': { city: 'Houston', state: 'TX', timezone: 'Central' },
    '801': { city: 'Salt Lake City', state: 'UT', timezone: 'Mountain' },
    '917': { city: 'New York', state: 'NY', timezone: 'Eastern' }
  };

  const CARRIERS = [
    'Verizon Wireless',
    'AT&T Mobility',
    'T-Mobile USA',
    'US Cellular',
    'Cricket Wireless'
  ];

  const MOCK_NAMES = [
    'Alex Rivera',
    'Jordan Kim',
    'Taylor Brooks',
    'Casey Nguyen',
    'Morgan Walsh',
    'Riley Patel',
    'Jamie Foster',
    'Quinn Hayes'
  ];

  /** @type {Array<Lead>} */
  let leads = [];

  /** @type {ReturnType<typeof setInterval> | null} */
  let timerInterval = null;

  /** @type {number} */
  let secondsLeft = AUTO_SMS_SECONDS;

  /** @type {FlowState | null} */
  let currentFlow = null;

  let twilioLookupAvailable = false;
  let isSampleMode = false;

  /**
   * @typedef {{
   *   id: string,
   *   phone: string,
   *   phoneDisplay: string,
   *   isKnown: boolean,
   *   contactName: string | null,
   *   lookup: LookupResult,
   *   smsText: string,
   *   smsStatus: 'pending' | 'sent' | 'cancelled',
   *   timestamp: number
   * }} Lead
   */

  /**
   * @typedef {{
   *   phone: string,
   *   phoneDisplay: string,
   *   area: string,
   *   carrier: string,
   *   callerName: string,
   *   lineType: string,
   *   source: 'mock' | 'twilio'
   * }} LookupResult
   */

  /**
   * @typedef {{
   *   phone: string,
   *   phoneDisplay: string,
   *   lookup: LookupResult,
   *   isKnown: boolean,
   *   contact: KnownContact | null,
   *   smsText: string
   * }} FlowState
   */

  const $ = (sel) => document.querySelector(sel);

  const els = {
    connectionStatus: $('#connection-status'),
    phoneInput: $('#phone-input'),
    btnSimulate: $('#btn-simulate'),
    flowPanel: $('#flow-panel'),
    missedBannerText: $('#missed-banner-text'),
    lookupPanel: $('#lookup-panel'),
    lookupGrid: $('#lookup-grid'),
    lookupSource: $('#lookup-source'),
    smsPanel: $('#sms-panel'),
    timerBadge: $('#timer-badge'),
    leadType: $('#lead-type'),
    smsPreview: $('#sms-preview'),
    btnSendNow: $('#btn-send-now'),
    btnCancelSms: $('#btn-cancel-sms'),
    smsStatus: $('#sms-status'),
    leadList: $('#lead-list'),
    inboxEmpty: $('#inbox-empty'),
    btnClearInbox: $('#btn-clear-inbox')
  };

  function normalizePhone(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return digits.slice(1);
    }
    return digits;
  }

  function formatPhone(digits) {
    const d = normalizePhone(digits);
    if (d.length === 10) {
      return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
    }
    if (d.length === 7) {
      return d.slice(0, 3) + '-' + d.slice(3);
    }
    return String(digits || '').trim() || 'Unknown';
  }

  function uid() {
    return 'lead-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function hashDigits(digits) {
    let h = 0;
    for (let i = 0; i < digits.length; i++) {
      h = (h * 31 + digits.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function formatCountdown(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function getKnownContact(digits) {
    return KNOWN_CONTACTS[digits] || null;
  }

  function mockLookup(digits) {
    const areaCode = digits.slice(0, 3) || '555';
    const area = AREA_DATA[areaCode] || {
      city: 'Unknown',
      state: '--',
      timezone: 'US'
    };
    const h = hashDigits(digits);
    const known = getKnownContact(digits);

    return {
      phone: digits,
      phoneDisplay: formatPhone(digits),
      area: area.city + ', ' + area.state + ' (' + area.timezone + ')',
      carrier: CARRIERS[h % CARRIERS.length],
      callerName: known ? known.name : MOCK_NAMES[h % MOCK_NAMES.length],
      lineType: h % 5 === 0 ? 'Landline' : 'Mobile',
      source: 'mock'
    };
  }

  async function lookupPhone(digits) {
    if (twilioLookupAvailable) {
      try {
        const res = await fetch('/api/lookup?phone=' + encodeURIComponent('+' + (digits.length === 10 ? '1' + digits : digits)));
        if (res.ok) {
          const data = await res.json();
          if (data && data.phone) {
            const known = getKnownContact(digits);
            return {
              phone: digits,
              phoneDisplay: data.phoneDisplay || formatPhone(digits),
              area: data.area || 'Unknown',
              carrier: data.carrier || 'Unknown carrier',
              callerName: known ? known.name : (data.callerName || 'Unknown caller'),
              lineType: data.lineType || 'Mobile',
              source: 'twilio'
            };
          }
        }
      } catch (_) {
        /* fall through to mock */
      }
    }
    return mockLookup(digits);
  }

  function composeSms(lookup, isKnown, contact) {
    const firstName = isKnown && contact
      ? contact.name.split(' ')[0]
      : (lookup.callerName.split(' ')[0] || 'there');

    if (isKnown) {
      return (
        'Hi ' + firstName + '! Sorry we missed your call — want to schedule your next visit? ' +
        'Reply here or book online: ' + BOOK_LINK
      );
    }

    return (
      'Hi ' + firstName + ' — sorry we missed your call! Book a service visit in 30 seconds: ' +
      BOOK_LINK + ' — Reply STOP to opt out.'
    );
  }

  function saveInbox() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
    } catch (_) {
      /* quota or private mode */
    }
  }

  function loadInbox() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        leads = parsed;
      }
    } catch (_) {
      leads = [];
    }
  }

  function renderInbox() {
    els.leadList.innerHTML = '';
    const hasLeads = leads.length > 0;
    els.inboxEmpty.classList.toggle('hidden', hasLeads);
    els.btnClearInbox.hidden = !hasLeads;

    const sorted = [...leads].sort((a, b) => b.timestamp - a.timestamp);

    for (const lead of sorted) {
      const li = document.createElement('li');
      li.className = 'lead-card';
      li.dataset.id = lead.id;

      const badgeClass = lead.isKnown ? 'badge--known' : 'badge--new';
      const badgeText = lead.isKnown ? 'Known contact' : 'New lead';
      const smsClass = lead.smsStatus === 'sent' ? 'lead-card__sms' : 'lead-card__sms is-pending';
      const smsLabel = lead.smsStatus === 'sent' ? 'SMS sent' : lead.smsStatus === 'cancelled' ? 'SMS cancelled' : 'SMS pending';

      const namePart = lead.contactName ? escapeHtml(lead.contactName) + ' · ' : '';

      li.innerHTML =
        '<div class="lead-card__top">' +
          '<span class="lead-card__phone">' + namePart + escapeHtml(lead.phoneDisplay) + '</span>' +
          '<span class="badge ' + badgeClass + '">' + badgeText + '</span>' +
        '</div>' +
        '<p class="lead-card__summary">' + escapeHtml(lead.lookup.area) + ' · ' + escapeHtml(lead.lookup.carrier) + '</p>' +
        '<div class="lead-card__meta">' +
          '<span class="' + smsClass + '">' + smsLabel + '</span>' +
          '<span>·</span>' +
          '<span>' + escapeHtml(formatTime(lead.timestamp)) + '</span>' +
        '</div>';

      els.leadList.appendChild(li);
    }
  }

  function renderLookup(lookup) {
    const items = [
      { label: 'Phone', value: lookup.phoneDisplay, wide: true },
      { label: 'Caller ID', value: lookup.callerName },
      { label: 'Line type', value: lookup.lineType },
      { label: 'Location', value: lookup.area },
      { label: 'Carrier', value: lookup.carrier, wide: true }
    ];

    els.lookupGrid.innerHTML = items.map(function (item) {
      return (
        '<div class="lookup-item' + (item.wide ? ' lookup-item--wide' : '') + '">' +
          '<span class="lookup-item__label">' + escapeHtml(item.label) + '</span>' +
          '<span class="lookup-item__value">' + escapeHtml(item.value) + '</span>' +
        '</div>'
      );
    }).join('');

    els.lookupSource.textContent = lookup.source === 'twilio'
      ? 'Lookup via Twilio (live)'
      : 'Lookup via demo seed data (no API key required)';
  }

  function clearTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimerBadge() {
    if (!currentFlow) return;
    if (secondsLeft <= 10) {
      els.timerBadge.classList.add('is-urgent');
    } else {
      els.timerBadge.classList.remove('is-urgent');
    }
    els.timerBadge.textContent = 'Auto-send in ' + formatCountdown(secondsLeft);
  }

  function showSmsPanel(flow) {
    const badgeClass = flow.isKnown ? 'badge--known' : 'badge--new';
    const badgeText = flow.isKnown ? 'Known contact — shorter message' : 'New lead — booking link included';

    els.leadType.innerHTML = '<span class="badge ' + badgeClass + '">' + badgeText + '</span>';
    els.smsPreview.textContent = flow.smsText;
    els.smsPanel.hidden = false;
    els.smsStatus.classList.add('hidden');
    els.btnSendNow.disabled = false;
    els.btnCancelSms.disabled = false;
    els.timerBadge.classList.remove('is-sent');
    updateTimerBadge();
  }

  function startAutoSmsTimer() {
    clearTimer();
    const totalSeconds = isSampleMode ? SAMPLE_AUTO_SMS_SECONDS : AUTO_SMS_SECONDS;
    secondsLeft = totalSeconds;
    updateTimerBadge();

    timerInterval = setInterval(function () {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearTimer();
        completeSmsSend();
        return;
      }
      updateTimerBadge();
    }, 1000);
  }

  async function completeSmsSend() {
    if (!currentFlow) return;

    clearTimer();
    els.btnSendNow.disabled = true;
    els.btnCancelSms.disabled = true;
    els.timerBadge.classList.remove('is-urgent');
    els.timerBadge.classList.add('is-sent');
    els.timerBadge.textContent = 'Sent';

    let statusMsg = 'SMS sent (simulated — no message delivered in demo mode)';

    try {
      const res = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: currentFlow.phone,
          body: currentFlow.smsText,
          demo: true
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sent) {
          statusMsg = data.mock
            ? 'SMS sent (simulated — no message delivered in demo mode)'
            : 'SMS sent to configured test number';
        }
      }
    } catch (_) {
      /* mock sent is fine */
    }

    els.smsStatus.textContent = statusMsg;
    els.smsStatus.classList.remove('hidden');

    const existing = leads.find(function (l) {
      return l.phone === currentFlow.phone && l.smsStatus === 'pending';
    });

    if (existing) {
      existing.smsStatus = 'sent';
      existing.timestamp = Date.now();
    } else {
      leads.unshift({
        id: uid(),
        phone: currentFlow.phone,
        phoneDisplay: currentFlow.phoneDisplay,
        isKnown: currentFlow.isKnown,
        contactName: currentFlow.contact ? currentFlow.contact.name : null,
        lookup: currentFlow.lookup,
        smsText: currentFlow.smsText,
        smsStatus: 'sent',
        timestamp: Date.now()
      });
    }

    saveInbox();
    renderInbox();
  }

  function cancelSms() {
    if (!currentFlow) return;
    clearTimer();
    els.btnSendNow.disabled = true;
    els.btnCancelSms.disabled = true;
    els.timerBadge.textContent = 'Cancelled';
    els.timerBadge.classList.remove('is-urgent', 'is-sent');
    els.smsStatus.textContent = 'Auto-text cancelled.';
    els.smsStatus.classList.remove('hidden');

    const pending = leads.find(function (l) {
      return l.phone === currentFlow.phone && l.smsStatus === 'pending';
    });
    if (pending) {
      pending.smsStatus = 'cancelled';
      saveInbox();
      renderInbox();
    }

    currentFlow = null;
  }

  async function runFlow(digits) {
    if (digits.length < 7) {
      alert('Enter a valid phone number (at least 7 digits).');
      return;
    }

    clearTimer();
    currentFlow = null;

    const phoneDisplay = formatPhone(digits);
    els.flowPanel.hidden = false;
    els.missedBannerText.textContent = 'Missed call from ' + phoneDisplay;
    els.lookupPanel.hidden = true;
    els.smsPanel.hidden = true;

    await new Promise(function (resolve) {
      setTimeout(resolve, 600);
    });

    const lookup = await lookupPhone(digits);
    const contact = getKnownContact(digits);
    const isKnown = Boolean(contact);
    const smsText = composeSms(lookup, isKnown, contact);

    currentFlow = {
      phone: digits,
      phoneDisplay: phoneDisplay,
      lookup: lookup,
      isKnown: isKnown,
      contact: contact,
      smsText: smsText
    };

    renderLookup(lookup);
    els.lookupPanel.hidden = false;

    leads.unshift({
      id: uid(),
      phone: digits,
      phoneDisplay: phoneDisplay,
      isKnown: isKnown,
      contactName: contact ? contact.name : null,
      lookup: lookup,
      smsText: smsText,
      smsStatus: 'pending',
      timestamp: Date.now()
    });
    saveInbox();
    renderInbox();

    await new Promise(function (resolve) {
      setTimeout(resolve, isSampleMode ? 400 : 800);
    });

    showSmsPanel(currentFlow);
    startAutoSmsTimer();
  }

  async function checkTwilioConfig() {
    try {
      const res = await fetch('/api/missed-call-config');
      if (!res.ok) return;
      const data = await res.json();
      twilioLookupAvailable = Boolean(data.twilioLookupEnabled);
      if (data.twilioLookupEnabled || data.twilioSmsEnabled) {
        els.connectionStatus.textContent = 'Twilio connected';
        els.connectionStatus.classList.add('is-live');
      }
    } catch (_) {
      /* demo mode — mocks only */
    }
  }

  function setupSamples() {
    document.querySelectorAll('[data-sample]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const key = btn.dataset.sample;
        const digits = SAMPLE_NUMBERS[key];
        if (digits) {
          els.phoneInput.value = formatPhone(digits);
        }
      });
    });
  }

  function init() {
    loadInbox();
    renderInbox();
    checkTwilioConfig();
    setupSamples();

    els.btnSimulate.addEventListener('click', function () {
      isSampleMode = false;
      const digits = normalizePhone(els.phoneInput.value);
      runFlow(digits);
    });

    els.btnSendNow.addEventListener('click', function () {
      clearTimer();
      completeSmsSend();
    });

    els.btnCancelSms.addEventListener('click', cancelSms);

    els.btnClearInbox.addEventListener('click', function () {
      if (!leads.length) return;
      if (!confirm('Clear all lead cards from this browser?')) return;
      leads = [];
      saveInbox();
      renderInbox();
    });

    const params = new URLSearchParams(window.location.search);
    if (params.get('sample') === '1') {
      isSampleMode = true;
      els.phoneInput.value = formatPhone(SAMPLE_NUMBERS.new);
      setTimeout(function () {
        runFlow(SAMPLE_NUMBERS.new);
      }, 300);
    }
  }

  init();
})();
