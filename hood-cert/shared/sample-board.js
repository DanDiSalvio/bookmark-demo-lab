(function (global) {
  'use strict';

  const VOLUME_MONTHS = { high: 1, medium: 3, low: 6, minimal: 12 };

  const VOLUME_LABELS = {
    high: 'High volume (monthly)',
    medium: 'Medium volume (quarterly)',
    low: 'Low volume (semiannual)',
    minimal: 'Seasonal (annual)'
  };

  const PDF_AREA_STATUS = {
    pass: 'Pass',
    deficiency: 'Deficiency',
    no_access: 'No access'
  };

  /** Fixed demo calendar so hero copy and PDF stay aligned regardless of visit day. */
  const DEMO_TODAY_ISO = '2026-10-23';
  const SAMPLE_JOB_DATE_ISO = '2026-10-19';
  const SAMPLE_NEXT_DUE_LABEL = 'Jan 19, 2027';

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

  function daysUntil(iso, asOf) {
    const today = new Date(asOf);
    today.setHours(0, 0, 0, 0);
    const target = new Date(iso + 'T12:00:00');
    return Math.round((target - today) / 86400000);
  }

  function accountNextDue(account) {
    if (!account.lastServiceDate) return null;
    return addMonthsLocal(account.lastServiceDate, VOLUME_MONTHS[account.volume] || 3);
  }

  function accountBoardBucket(account, asOf) {
    const next = accountNextDue(account);
    if (!account.lastServiceDate) {
      return { key: 'new', label: 'No visit yet', badge: 'badge--neutral', section: 'due' };
    }
    if (!next) {
      return { key: 'due', label: 'Due in 30 days', badge: 'badge--due', section: 'due' };
    }
    const days = daysUntil(next, asOf);
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

  function isoOffset(asOf, offsetDays) {
    const d = new Date(asOf);
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function demoTodayDate(asOf) {
    if (asOf instanceof Date) return asOf;
    if (asOf) return new Date(`${asOf}T12:00:00`);
    return new Date(`${DEMO_TODAY_ISO}T12:00:00`);
  }

  /** Same account roster as Load samples in the app. */
  function buildSampleAccounts(asOf) {
    const ref = demoTodayDate(asOf);
    const iso = (offsetDays) => isoOffset(ref, offsetDays);
    const sampleServiceDate = SAMPLE_JOB_DATE_ISO;

    const accounts = [
      {
        id: 'sample-1',
        name: 'Harbor Grill',
        volume: 'medium',
        lastServiceDate: SAMPLE_JOB_DATE_ISO,
        email: 'manager@harborgrill.example'
      },
      {
        id: 'sample-2',
        name: 'Wok Express 24',
        volume: 'high',
        lastServiceDate: iso(-45),
        email: 'ops@wokexpress.example'
      },
      {
        id: 'sample-3',
        name: 'Lakeview Diner',
        volume: 'low',
        lastServiceDate: iso(-30),
        email: 'owner@lakeviewdiner.example'
      },
      {
        id: 'sample-4',
        name: 'Brick Oven Pizza Co',
        volume: 'medium',
        lastServiceDate: iso(-100),
        email: 'kitchen@brickoven.example'
      },
      {
        id: 'sample-5',
        name: 'Summit Catering Kitchen',
        volume: 'minimal',
        lastServiceDate: iso(-60),
        email: 'facilities@summitcatering.example'
      },
      {
        id: 'sample-6',
        name: 'Riverside BBQ Pit',
        volume: 'high',
        lastServiceDate: iso(-20),
        email: 'pitmaster@riversidebbq.example'
      },
      {
        id: 'sample-7',
        name: 'Northside Commissary',
        volume: 'medium',
        lastServiceDate: null,
        email: 'ops@northsidecommissary.example'
      }
    ];

    return { accounts, sampleServiceDate };
  }

  function samplePhotoTimes(serviceDateIso) {
    const iso = serviceDateIso || SAMPLE_JOB_DATE_ISO;
    const [y, m, d] = iso.split('-').map(Number);
    const before = new Date(y, m - 1, d, 10, 5, 0, 0);
    const after = new Date(y, m - 1, d, 11, 40, 0, 0);
    return {
      beforeLabel: before.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }),
      afterLabel: after.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    };
  }

  function nextDueFromSampleJob(_asOf) {
    return addMonthsLocal(SAMPLE_JOB_DATE_ISO, VOLUME_MONTHS.medium);
  }

  function sampleHeroDueLabel() {
    return SAMPLE_NEXT_DUE_LABEL;
  }

  /**
   * Rows for landing rebook fragment: overdue first, then due (max per section).
   */
  function landingRebookRows(asOf, limits) {
    const ref = asOf instanceof Date ? asOf : new Date();
    const maxOverdue = limits?.maxOverdue ?? 2;
    const maxDue = limits?.maxDue ?? 2;
    const { accounts } = buildSampleAccounts(ref);
    const overdue = [];
    const due = [];

    accounts.forEach((account) => {
      const bucket = accountBoardBucket(account, ref);
      const next = accountNextDue(account);
      const row = {
        account,
        bucket,
        meta: account.lastServiceDate
          ? `Last ${formatDate(account.lastServiceDate)} · ${VOLUME_LABELS[account.volume] || account.volume}`
          : VOLUME_LABELS[account.volume] || account.volume,
        statusLine:
          bucket.overdueText || (account.lastServiceDate && next ? `Next ${formatDate(next)}` : '')
      };
      if (bucket.section === 'overdue' && overdue.length < maxOverdue) overdue.push(row);
      if (bucket.section === 'due' && due.length < maxDue) due.push(row);
    });

    return { overdue, due };
  }

  function rebookAppHref(accountId) {
    const id = encodeURIComponent(accountId);
    return `/hood-cert/app/?sample=1&rebook=${id}`;
  }

  global.HoodCertSampleBoard = {
    VOLUME_MONTHS,
    VOLUME_LABELS,
    PDF_AREA_STATUS,
    DEMO_TODAY_ISO,
    SAMPLE_JOB_DATE_ISO,
    SAMPLE_NEXT_DUE_LABEL,
    formatDate,
    addMonthsLocal,
    accountNextDue,
    accountBoardBucket,
    buildSampleAccounts,
    samplePhotoTimes,
    nextDueFromSampleJob,
    sampleHeroDueLabel,
    landingRebookRows,
    rebookAppHref
  };
})(typeof window !== 'undefined' ? window : globalThis);
