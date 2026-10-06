(function () {
  'use strict';

  const STORAGE_KEY = 'wh347-sub-check-v1';
  const SIGNATURE_KEY = 'wh347-user-signature-v1';
  const PROJECT_YEAR = 2026;
  const DEMO_TODAY = new Date('2026-09-28T12:00:00');

  const CURRENT_OMB = '1235-0008';
  const CURRENT_EXPIRY = '01/31/2028';

  const SAMPLE_FILES = {
    pass: { file: 'pass-apex-mechanical.pdf', subId: 'apex', weekId: '2026-w40' },
    revision: { file: 'fail-old-revision.pdf', subId: 'summit', weekId: '2026-w39' },
    missing: { file: 'fail-missing-wd-unsigned.pdf', subId: 'quickdrywall', weekId: '2026-w38' }
  };

  const DEFAULT_PROJECT = {
    name: 'Riverside Federal Courthouse',
    weeks: [
      { id: '2026-w38', label: 'Sep 13', endDate: '2026-09-13' },
      { id: '2026-w39', label: 'Sep 20', endDate: '2026-09-20' },
      { id: '2026-w40', label: 'Sep 27', endDate: '2026-09-27' },
      { id: '2026-w41', label: 'Oct 4', endDate: '2026-10-04' }
    ],
    subs: [
      { id: 'apex', name: 'Apex Mechanical LLC' },
      { id: 'summit', name: 'Summit Electric Inc.' },
      { id: 'quickdrywall', name: 'Quick Drywall Co.' },
      { id: 'pacific', name: 'Pacific Steel Erectors' }
    ],
    filings: {}
  };

  const ICON_PASS = '<svg class="check-item__svg" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M6.5 11.2 3.3 8l-.9.9 4.1 4.1 8-8-.9-.9z"/></svg>';
  const ICON_FAIL = '<svg class="check-item__svg" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 6.9 11.8 3l.9.9L8.9 7.8l3.8 3.8-.9.9L8 8.7 4.2 12.5l-.9-.9L7.1 7.8 3.3 4l.9-.9z"/></svg>';
  const ICON_CHEVRON = '<svg class="grid-list__chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M6 4l4 4-4 4V4z"/></svg>';

  /** @type {typeof DEFAULT_PROJECT} */
  let project = loadProject();
  /** @type {{ subId: string, weekId: string } | null} */
  let selectedCell = null;
  /** @type {{ checks: CheckResult[], subName: string, weekLabel: string } | null} */
  let currentResults = null;
  let composerBodyEdited = false;
  /** @type {string | null} */
  let composerFilingKey = null;

  const $ = (sel) => document.querySelector(sel);

  const subSelect = $('#sub-select');
  const weekSelect = $('#week-select');
  const fileInput = $('#file-input');
  const uploadZone = $('#upload-zone');
  const uploadError = $('#upload-error');
  const resultsPanel = $('#results-panel');
  const resultsHeading = $('#results-heading');
  const resultsIssues = $('#results-issues');
  const checkList = $('#check-list');
  const checkListPasses = $('#check-list-passes');
  const checkPasses = $('#check-passes');
  const resultsMeta = $('#results-meta');
  const composerPanel = $('#composer-panel');
  const composerTo = $('#composer-to');
  const composerSubject = $('#composer-subject');
  const composerBody = $('#composer-body');
  const composerResubmit = $('#composer-resubmit');
  const composerSignature = $('#composer-signature');
  const composerSendResubmit = $('#composer-send-resubmit');
  const composerSendSignature = $('#composer-send-signature');
  const gridDesktop = $('#project-grid-desktop');
  const gridMobile = $('#project-grid-mobile');
  const summaryStrip = $('#summary-strip');
  const gridEmpty = $('#grid-empty');
  const btnCopyMessage = $('#btn-copy-message');
  const btnOpenEmail = $('#btn-open-email');
  const btnResetDemo = $('#btn-reset-demo');
  const btnLoadSamples = $('#btn-load-samples');
  const toast = $('#toast');
  const toastText = $('#toast-text');
  const toastAction = $('#toast-action');

  /** @typedef {{ id: string, label: string, pass: boolean, detail: string }} CheckResult */

  function loadProject() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.subs && parsed.weeks) {
          parsed.weeks = parsed.weeks.map((w) => ({
            ...w,
            endDate: w.endDate || DEFAULT_PROJECT.weeks.find((d) => d.id === w.id)?.endDate
          }));
          if (!parsed.composerDrafts) parsed.composerDrafts = {};
          return parsed;
        }
      }
    } catch (_) { /* ignore */ }
    const fresh = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    fresh.composerDrafts = {};
    return fresh;
  }

  function saveProject() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }

  function loadSignature() {
    return localStorage.getItem(SIGNATURE_KEY) || '';
  }

  function saveSignature(value) {
    localStorage.setItem(SIGNATURE_KEY, value);
  }

  function filingKey(subId, weekId) {
    return `${subId}::${weekId}`;
  }

  function weekHeaderLabel(week) {
    return `Wk ending ${week.label}, ${PROJECT_YEAR}`;
  }

  function isFutureWeek(week) {
    if (!week.endDate) return false;
    const end = new Date(week.endDate + 'T23:59:59');
    return end > DEMO_TODAY;
  }

  function getCellStatus(subId, weekId) {
    const week = project.weeks.find((w) => w.id === weekId);
    if (week && isFutureWeek(week)) return 'future';
    const filing = project.filings[filingKey(subId, weekId)];
    if (!filing) return 'pending';
    return filing.status === 'pass' ? 'ready' : 'issues';
  }

  function statusLabel(status) {
    if (status === 'ready') return 'Ready';
    if (status === 'issues') return 'Issues';
    if (status === 'pending') return 'Not received';
    if (status === 'future') return 'Not due';
    return '';
  }

  function defaultResubmitDate() {
    const d = new Date(DEMO_TODAY);
    let businessDays = 0;
    while (businessDays < 3) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) businessDays++;
    }
    return d.toISOString().slice(0, 10);
  }

  /**
   * @param {string} isoDate
   */
  function formatResubmitDateForMessage(isoDate) {
    const d = new Date(`${isoDate}T12:00:00`);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function formatDemoAsOf() {
    return DEMO_TODAY.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /**
   * @param {CheckResult} check
   */
  function subDirectedBullet(check) {
    switch (check.id) {
      case 'formRevision':
        if (check.detail.includes('09/30/2026')) {
          return 'Resubmit on the current WH-347 form (OMB 1235-0008, expires 01/31/2028).';
        }
        if (check.detail.includes('Could not find')) {
          return 'Confirm you are using WH-347 and that the PDF has a readable text layer (not a flat scan).';
        }
        return 'Verify the form shows OMB 1235-0008 with expiry 01/31/2028.';
      case 'wageDetermination':
        return 'Enter the wage determination number(s) from the contract.';
      case 'apprenticeRegistration':
        return 'List each apprentice\'s registered program (OA or SAA) and complete Box 4 on the Statement of Compliance.';
      case 'fringeBenefits':
        return 'Complete the Hourly Credit for Fringe Benefits section on page 2, or show fringe paid as cash in column 6C.';
      case 'statementOfCompliance':
        return 'Sign and date the Statement of Compliance with the certifying official\'s name and title.';
      default:
        return check.detail;
    }
  }

  function statusPillClass(status) {
    if (status === 'ready') return 'status-pill--ready';
    if (status === 'issues') return 'status-pill--issues';
    return 'status-pill--pending';
  }

  /**
   * @param {string} text
   * @returns {CheckResult[]}
   */
  function runChecks(text) {
    const normalized = text.replace(/\s+/g, ' ');
    const lower = normalized.toLowerCase();
    const checks = [];

    const hasCurrentOmb = normalized.includes(CURRENT_OMB);
    const hasCurrentExpiry = normalized.includes(CURRENT_EXPIRY);
    const hasOldExpiry = /expires\s+09\/30\/2026/i.test(normalized) ||
      /expires\s+9\/30\/2026/i.test(normalized);
    const hasOmbBlock = /omb\s*(control\s*)?no\.?\s*1235-0008/i.test(normalized);

    if (hasCurrentOmb && hasCurrentExpiry && !hasOldExpiry) {
      checks.push({
        id: 'formRevision',
        label: 'Current form version',
        pass: true,
        detail: `Found OMB ${CURRENT_OMB} with expiry ${CURRENT_EXPIRY} — matches current WH-347 per DOL.`
      });
    } else if (hasOldExpiry || (hasOmbBlock && !hasCurrentExpiry)) {
      checks.push({
        id: 'formRevision',
        label: 'Current form version',
        pass: false,
        detail: hasOldExpiry
          ? 'PDF shows an outdated OMB expiry date (09/30/2026). Resubmit on current WH-347 (OMB 1235-0008, expires 01/31/2028).'
          : 'OMB block found but current expiry 01/31/2028 not detected — may be wrong revision or scanned image without text.'
      });
    } else if (!hasOmbBlock) {
      checks.push({
        id: 'formRevision',
        label: 'Current form version',
        pass: false,
        detail: 'Could not find OMB 1235-0008 markers in extracted text. Confirm this is WH-347 and not a flat scan.'
      });
    } else {
      checks.push({
        id: 'formRevision',
        label: 'Current form version',
        pass: false,
        detail: 'OMB markers incomplete — verify form matches current WH-347 (expires 01/31/2028).'
      });
    }

    const wdPatterns = [
      /wage\s+determination\s+no\.?\s*:?\s*([A-Z]{0,3}\d{4,}[\w-]*)/i,
      /wd\s+no\.?\s*:?\s*([A-Z]{0,3}\d{4,}[\w-]*)/i,
      /determination\s+no\.?\s*:?\s*([A-Z0-9-]+)/i
    ];
    let wdMatch = null;
    for (const pat of wdPatterns) {
      const m = normalized.match(pat);
      if (m) {
        wdMatch = m[1].trim();
        break;
      }
    }
    const wdBlank = /wage\s+determination\s+no\.?\s*:?\s*[_\s-]{3,}/i.test(normalized) ||
      /wage\s+determination\s+no\.?\s*:?\s*_{2,}/i.test(normalized);

    if (wdMatch && !wdBlank && wdMatch.length > 2 && !/^[_\s-]+$/.test(wdMatch)) {
      checks.push({
        id: 'wageDetermination',
        label: 'Wage determination number',
        pass: true,
        detail: `Found wage determination reference: ${wdMatch}`
      });
    } else {
      checks.push({
        id: 'wageDetermination',
        label: 'Wage determination number',
        pass: false,
        detail: 'Wage Determination No. missing or blank. Sub must enter the WD number(s) from the contract.'
      });
    }

    const hasApprentice = /\bRA\b/.test(normalized) ||
      /registered\s+apprentice/i.test(lower) ||
      /apprentice\s+level/i.test(lower);
    const hasOaSaa = /office\s+of\s+apprenticeship|\(OA\)|state\s+apprenticeship\s+agency|\(SAA\)|registered\s+with\s+DOL/i.test(normalized);
    const apprenticeBlank = /apprenticeship\s+program\s*:\s*\(?blank\)?/i.test(normalized) ||
      /apprenticeship\s+program\s*:\s*$/i.test(normalized);

    if (!hasApprentice) {
      checks.push({
        id: 'apprenticeRegistration',
        label: 'Apprentice registration',
        pass: true,
        detail: 'No registered apprentices (RA) detected on this payroll — check not required.'
      });
    } else if (hasOaSaa && !apprenticeBlank) {
      checks.push({
        id: 'apprenticeRegistration',
        label: 'Apprentice registration',
        pass: true,
        detail: 'Apprentice(s) listed with OA or SAA registration reference.'
      });
    } else {
      checks.push({
        id: 'apprenticeRegistration',
        label: 'Apprentice registration',
        pass: false,
        detail: 'Apprentice (RA) listed but OA/SAA program registration not found. Box 4 and program name required.'
      });
    }

    const hasFringeSection = /hourly\s+credit\s+for\s+fringe\s+benefits/i.test(lower) ||
      /fringe\s+benefit/i.test(lower);
    const hasFringeDetail = /health\s*&\s*welfare|pension\s+plan|training\s+fund|funded|unfunded|\$\d+\.\d+\/hr/i.test(normalized);
    const claimsFringeBox = /\[x\]\s*box\s*5|box\s*5.*fringe/i.test(lower);

    if (hasFringeSection && (hasFringeDetail || !claimsFringeBox)) {
      checks.push({
        id: 'fringeBenefits',
        label: 'Fringe benefit breakdown',
        pass: true,
        detail: hasFringeDetail
          ? 'Fringe benefit credit section with plan details detected.'
          : 'Fringe section present; cash-in-lieu may apply (column 6C).'
      });
    } else if (claimsFringeBox && !hasFringeDetail) {
      checks.push({
        id: 'fringeBenefits',
        label: 'Fringe benefit breakdown',
        pass: false,
        detail: 'Box 5 checked but Hourly Credit for Fringe Benefits subsection appears incomplete.'
      });
    } else {
      checks.push({
        id: 'fringeBenefits',
        label: 'Fringe benefit breakdown',
        pass: false,
        detail: 'Fringe benefit breakdown not clearly present. If claiming plan credits, complete page 2 subsection.'
      });
    }

    const hasStatement = /statement\s+of\s+compliance/i.test(lower);
    const hasSigned = /\/s\/|signature\s*:\s*[^_\s]{2,}/i.test(normalized) &&
      !/signature\s*:\s*_{3,}/i.test(normalized) &&
      !/\(unsigned\)/i.test(normalized);
    const hasDate = /date\s+signed\s*:\s*\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(normalized) &&
      !/date\s+signed\s*:\s*_{2,}/i.test(normalized);
    const hasOfficial = /certifying\s+official/i.test(lower);

    if (hasStatement && hasSigned && hasDate && hasOfficial) {
      checks.push({
        id: 'statementOfCompliance',
        label: 'Signed Statement of Compliance',
        pass: true,
        detail: 'Statement of Compliance with certifying official, signature, and date detected.'
      });
    } else {
      const missing = [];
      if (!hasStatement) missing.push('Statement of Compliance heading');
      if (!hasSigned) missing.push('signature');
      if (!hasDate) missing.push('date signed');
      if (!hasOfficial) missing.push('certifying official name/title');
      checks.push({
        id: 'statementOfCompliance',
        label: 'Signed Statement of Compliance',
        pass: false,
        detail: `Incomplete: missing ${missing.join(', ')}. Unsigned statements will be rejected.`
      });
    }

    return checks;
  }

  /**
   * @param {CheckResult[]} checks
   * @param {string} subName
   * @param {string} weekLabel
   */
  function assembleMessageBody(checks, subName, weekLabel) {
    const failures = checks.filter((c) => !c.pass);

    if (failures.length === 0) {
      return `${subName},\n\nYour WH-347 for week ending ${weekLabel}, ${PROJECT_YEAR} passed our pre-check. We will forward to the contracting agency.`;
    }

    const items = failures.map((f) => `• ${subDirectedBullet(f)}`);
    return `${subName},\n\nYour certified payroll for week ending ${weekLabel}, ${PROJECT_YEAR} cannot be forwarded yet. Incomplete, wrong-revision, or defective filings are treated like missing filings — payment will be withheld until corrected.\n\nPlease fix and resubmit:\n\n${items.join('\n')}`;
  }

  function getOutboundMessageBody() {
    const body = composerBody.value.trimEnd();
    const resubmitIso = composerResubmit.value.trim() || defaultResubmitDate();
    const resubmitBy = formatResubmitDateForMessage(resubmitIso);
    const signature = (composerSignature.value.trim() || loadSignature()).trim();
    let text = body;
    text += `\n\nPlease resubmit by ${resubmitBy}.`;
    if (signature) text += `\n\n${signature}`;
    return text;
  }

  function updateComposerSendFooter() {
    const resubmitIso = composerResubmit.value.trim() || defaultResubmitDate();
    const resubmitBy = formatResubmitDateForMessage(resubmitIso);
    const signature = (composerSignature.value.trim() || loadSignature()).trim();
    composerSendResubmit.textContent = `Please resubmit by ${resubmitBy}.`;
    if (signature) {
      composerSendSignature.textContent = signature;
      composerSendSignature.hidden = false;
    } else {
      composerSendSignature.textContent = '';
      composerSendSignature.hidden = true;
    }
  }

  function saveComposerDraft() {
    if (!composerFilingKey) return;
    const filing = project.filings[composerFilingKey];
    if (!filing || filing.status !== 'fail') return;
    if (!project.composerDrafts) project.composerDrafts = {};
    project.composerDrafts[composerFilingKey] = {
      body: composerBody.value,
      resubmit: composerResubmit.value,
      signature: composerSignature.value,
      edited: composerBodyEdited
    };
    saveProject();
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  function loadComposerDraft(key) {
    const draft = project.composerDrafts?.[key];
    if (!draft) return false;
    composerBody.value = draft.body;
    composerResubmit.value = draft.resubmit || defaultResubmitDate();
    composerSignature.value = draft.signature ?? loadSignature();
    composerBodyEdited = !!draft.edited;
    return true;
  }

  function refreshComposerBody() {
    if (!currentResults || composerBodyEdited) return;
    const { checks, subName, weekLabel } = currentResults;
    composerBody.value = assembleMessageBody(checks, subName, weekLabel);
    updateComposerSendFooter();
  }

  function buildSubject(weekLabel, hasFailures) {
    const prefix = hasFailures ? 'Certified payroll corrections' : 'Certified payroll';
    return `${prefix} — ${project.name} — week ending ${weekLabel}, ${PROJECT_YEAR}`;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderCheckItem(c) {
    const cls = c.pass ? 'check-item--pass' : 'check-item--fail';
    const icon = c.pass ? ICON_PASS : ICON_FAIL;
    return `<li class="check-item ${cls}">
      <span class="check-item__icon" aria-hidden="true">${icon}</span>
      <div class="check-item__body">
        <p class="check-item__label">${escapeHtml(c.label)}</p>
        <p class="check-item__detail">${escapeHtml(c.detail)}</p>
      </div>
    </li>`;
  }

  /**
   * @param {CheckResult[]} checks
   * @param {string} subName
   * @param {string} weekLabel
   * @param {string} fileName
   * @param {string} [subId]
   * @param {string} [weekId]
   * @param {boolean} [shouldFocus]
   */
  function showResults(checks, subName, weekLabel, fileName, subId, weekId, shouldFocus) {
    const failures = checks.filter((c) => !c.pass);
    const passes = checks.filter((c) => c.pass);
    const allPass = failures.length === 0;

    currentResults = { checks, subName, weekLabel };
    const nextFilingKey = subId && weekId ? filingKey(subId, weekId) : null;
    const isNewComposerContext = nextFilingKey !== composerFilingKey;

    if (isNewComposerContext && composerFilingKey) {
      saveComposerDraft();
    }

    resultsPanel.classList.remove('hidden');

    if (allPass) {
      composerFilingKey = nextFilingKey;
      resultsIssues.hidden = false;
      resultsIssues.textContent = 'Ready to forward';
      resultsIssues.className = 'results-issues results-issues--ready';
      checkList.innerHTML = '';
      checkList.classList.add('hidden');
      checkPasses.hidden = false;
      checkListPasses.innerHTML = passes.map(renderCheckItem).join('');
      checkPasses.querySelector('.check-passes__summary').textContent =
        `${passes.length} check${passes.length === 1 ? '' : 's'} passed`;
      composerPanel.hidden = true;
    } else {
      resultsIssues.hidden = false;
      resultsIssues.textContent = `${failures.length} issue${failures.length === 1 ? '' : 's'} to fix`;
      resultsIssues.className = 'results-issues';
      checkList.classList.remove('hidden');
      checkList.innerHTML = failures.map(renderCheckItem).join('');
      if (passes.length > 0) {
        checkPasses.hidden = false;
        checkListPasses.innerHTML = passes.map(renderCheckItem).join('');
        checkPasses.querySelector('.check-passes__summary').textContent =
          `${passes.length} check${passes.length === 1 ? '' : 's'} passed`;
      } else {
        checkPasses.hidden = true;
        checkListPasses.innerHTML = '';
      }
      composerPanel.hidden = false;
      composerSubject.value = buildSubject(weekLabel, true);
      if (isNewComposerContext) {
        composerFilingKey = nextFilingKey;
        if (nextFilingKey && loadComposerDraft(nextFilingKey)) {
          updateComposerSendFooter();
        } else {
          composerBodyEdited = false;
          composerResubmit.value = defaultResubmitDate();
          refreshComposerBody();
        }
      } else if (!composerBodyEdited) {
        refreshComposerBody();
      } else {
        updateComposerSendFooter();
      }
    }

    resultsMeta.innerHTML = `
      <span class="results-meta__sub">${escapeHtml(subName)} · Week ending ${escapeHtml(weekLabel)}, ${PROJECT_YEAR}</span>
      <span class="results-meta__file" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</span>
    `;

    if (subId && weekId) {
      selectedCell = { subId, weekId };
      renderGrid();
    }

    if (shouldFocus) {
      resultsHeading.focus();
    }
    resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function computeSummary() {
    let issues = 0;
    let ready = 0;
    let pending = 0;

    for (const sub of project.subs) {
      for (const week of project.weeks) {
        const status = getCellStatus(sub.id, week.id);
        if (status === 'future') continue;
        if (status === 'issues') issues++;
        else if (status === 'ready') ready++;
        else pending++;
      }
    }

    return { issues, ready, pending };
  }

  function renderSummary() {
    const { issues, ready, pending } = computeSummary();
    summaryStrip.innerHTML = `
      <span class="summary-strip__item summary-strip__item--issues"><strong>${issues}</strong> need fixes</span>
      <span class="summary-strip__sep" aria-hidden="true">/</span>
      <span class="summary-strip__item summary-strip__item--ready"><strong>${ready}</strong> ready</span>
      <span class="summary-strip__sep" aria-hidden="true">/</span>
      <span class="summary-strip__item summary-strip__item--pending"><strong>${pending}</strong> not received</span>
    `;
  }

  function renderDesktopGrid() {
    let html = '<table class="filing-table"><thead><tr>';
    html += '<th class="filing-table__sub" scope="col">Subcontractor</th>';
    for (const week of project.weeks) {
      html += `<th class="filing-table__week" scope="col">${escapeHtml(weekHeaderLabel(week))}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const sub of project.subs) {
      html += '<tr>';
      html += `<th class="filing-table__sub" scope="row">${escapeHtml(sub.name)}</th>`;
      for (const week of project.weeks) {
        const status = getCellStatus(sub.id, week.id);
        const isSelected = selectedCell?.subId === sub.id && selectedCell?.weekId === week.id;
        const selectedClass = isSelected ? ' filing-table__cell--selected' : '';

        if (status === 'future') {
          html += `<td class="filing-table__cell filing-table__cell--future${selectedClass}">
            <span class="status-pill status-pill--pending">Not due</span>
          </td>`;
          continue;
        }

        const filing = project.filings[filingKey(sub.id, week.id)];
        if (filing) {
          const ariaLabel = `${sub.name}, week ending ${week.label}, ${PROJECT_YEAR}: ${statusLabel(status)}`;
          html += `<td class="filing-table__cell${selectedClass}">
            <button type="button" class="filing-table__btn" data-sub="${sub.id}" data-week="${week.id}"
              aria-label="${escapeHtml(ariaLabel)}"${isSelected ? ' aria-current="true"' : ''}>
              <span class="status-pill ${statusPillClass(status)}">${statusLabel(status)}</span>
            </button>
          </td>`;
        } else {
          html += `<td class="filing-table__cell${selectedClass}">
            <span class="status-pill status-pill--pending">Not received</span>
          </td>`;
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    gridDesktop.innerHTML = html;

    gridDesktop.querySelectorAll('.filing-table__btn').forEach((btn) => {
      btn.addEventListener('click', () => openFiling(btn.dataset.sub, btn.dataset.week, true));
    });
  }

  function renderMobileList() {
    const groupDefs = [
      { key: 'issues', title: 'Needs fixes', status: 'issues' },
      { key: 'ready', title: 'Ready to forward', status: 'ready' },
      { key: 'pending', title: 'Not received', status: 'pending' }
    ];

    const grouped = groupDefs.map((group) => {
      const items = [];
      for (const sub of project.subs) {
        for (const week of project.weeks) {
          const status = getCellStatus(sub.id, week.id);
          if (status === 'future' || status !== group.status) continue;
          items.push({ sub, week, status });
        }
      }
      return { ...group, items };
    });

    let html = '';
    for (const group of grouped) {
      if (group.items.length === 0) continue;

      const title = `${group.title} (${group.items.length})`;
      if (group.key === 'pending') {
        html += `<details class="grid-list__collapse"><summary class="grid-list__title"><span>${title}</span>${ICON_CHEVRON}</summary><ul class="grid-list__items">`;
      } else {
        html += `<div class="grid-list__group"><h3 class="grid-list__title">${title}</h3><ul class="grid-list__items">`;
      }

      for (const { sub, week, status } of group.items) {
        const isSelected = selectedCell?.subId === sub.id && selectedCell?.weekId === week.id;
        const clickable = status !== 'pending';
        const tag = clickable ? 'button' : 'div';
        const attrs = clickable
          ? ` type="button" class="grid-list__item grid-list__item--clickable${isSelected ? ' grid-list__item--selected' : ''}" data-sub="${sub.id}" data-week="${week.id}" aria-label="${escapeHtml(sub.name)}, week ending ${week.label}, ${PROJECT_YEAR}: ${statusLabel(status)}"${isSelected ? ' aria-current="true"' : ''}`
          : ` class="grid-list__item"`;

        const chevron = clickable ? ICON_CHEVRON : '';
        html += `<li><${tag}${attrs}>
          <span class="grid-list__text">
            <span class="grid-list__name">${escapeHtml(sub.name)}</span>
            <span class="grid-list__week meta">${escapeHtml(weekHeaderLabel(week))}</span>
          </span>
          <span class="grid-list__trail">
            <span class="status-pill ${statusPillClass(status)}">${statusLabel(status)}</span>
            ${chevron}
          </span>
        </${tag}></li>`;
      }
      html += group.key === 'pending' ? '</ul></details>' : '</ul></div>';
    }

    gridMobile.innerHTML = html;
    gridMobile.querySelectorAll('.grid-list__item--clickable').forEach((btn) => {
      btn.addEventListener('click', () => openFiling(btn.dataset.sub, btn.dataset.week, true));
    });
  }

  function renderGrid() {
    renderSummary();
    renderDesktopGrid();
    renderMobileList();

    const hasFilings = Object.keys(project.filings).length > 0;
    gridEmpty.classList.toggle('hidden', hasFilings);
    btnResetDemo.classList.toggle('hidden', !hasFilings);
  }

  /**
   * @param {string} subId
   * @param {string} weekId
   * @param {CheckResult[]} checks
   * @param {string} fileName
   * @param {string} extractedPreview
   */
  function saveFiling(subId, weekId, checks, fileName, extractedPreview) {
    const allPass = checks.every((c) => c.pass);
    const sub = project.subs.find((s) => s.id === subId);
    const week = project.weeks.find((w) => w.id === weekId);
    const key = filingKey(subId, weekId);
    project.filings[key] = {
      subId,
      weekId,
      status: allPass ? 'pass' : 'fail',
      checks,
      fileName,
      checkedAt: Date.now(),
      textPreview: extractedPreview.slice(0, 500)
    };
    if (!project.composerDrafts) project.composerDrafts = {};
    delete project.composerDrafts[key];
    saveProject();
    composerBodyEdited = false;
    composerFilingKey = key;
    showResults(
      checks,
      sub?.name || subId,
      week?.label || weekId,
      fileName,
      subId,
      weekId
    );
  }

  /**
   * @param {string} subId
   * @param {string} weekId
   * @param {boolean} [shouldFocus]
   */
  function openFiling(subId, weekId, shouldFocus) {
    const filing = project.filings[filingKey(subId, weekId)];
    if (!filing) return;
    const sub = project.subs.find((s) => s.id === subId);
    const week = project.weeks.find((w) => w.id === weekId);
    subSelect.value = subId;
    weekSelect.value = weekId;
    showResults(
      filing.checks,
      sub?.name || subId,
      week?.label || weekId,
      filing.fileName,
      subId,
      weekId,
      shouldFocus
    );
  }

  function populateSelects() {
    subSelect.innerHTML = project.subs.map((s) =>
      `<option value="${s.id}">${escapeHtml(s.name)}</option>`
    ).join('');
    weekSelect.innerHTML = project.weeks
      .filter((w) => !isFutureWeek(w))
      .map((w) =>
        `<option value="${w.id}">Week ending ${escapeHtml(w.label)}, ${PROJECT_YEAR}</option>`
      ).join('');
  }

  function showUploadError(message) {
    uploadError.textContent = message;
    uploadError.classList.remove('hidden');
  }

  function clearUploadError() {
    uploadError.textContent = '';
    uploadError.classList.add('hidden');
  }

  /**
   * @param {File | Blob} file
   * @returns {Promise<string>}
   */
  async function extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const parts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((item) => item.str).join(' '));
    }
    return parts.join('\n');
  }

  /**
   * @param {File | Blob} file
   * @param {string} fileName
   */
  async function processFile(file, fileName) {
    const subId = subSelect.value;
    const weekId = weekSelect.value;
    const sub = project.subs.find((s) => s.id === subId);
    const week = project.weeks.find((w) => w.id === weekId);

    clearUploadError();
    uploadZone.classList.add('is-loading');
    try {
      const text = await extractPdfText(file);
      if (!text || text.trim().length < 20) {
        showUploadError('Could not extract enough text from this PDF. It may be a scanned image without a text layer.');
        return;
      }
      const checks = runChecks(text);
      saveFiling(subId, weekId, checks, fileName, text);
    } catch (err) {
      console.error(err);
      const msg = (err.message || '').includes('Invalid PDF structure')
        ? 'This file isn\'t a readable PDF. Export the WH-347 as PDF and try again.'
        : 'This file isn\'t a readable PDF. Export the WH-347 as PDF and try again.';
      showUploadError(msg);
    } finally {
      uploadZone.classList.remove('is-loading');
    }
  }

  async function loadSample(sampleKey) {
    const sample = SAMPLE_FILES[sampleKey];
    if (!sample) return;
    subSelect.value = sample.subId;
    weekSelect.value = sample.weekId;
    btnLoadSamples.classList.add('is-loading');
    btnLoadSamples.disabled = true;
    try {
      const resp = await fetch(`samples/${sample.file}`);
      if (!resp.ok) throw new Error('Sample file not found');
      const blob = await resp.blob();
      await processFile(blob, sample.file);
    } finally {
      btnLoadSamples.classList.remove('is-loading');
      btnLoadSamples.disabled = false;
    }
  }

  async function runAllSamples() {
    for (const key of ['pass', 'revision', 'missing']) {
      await loadSample(key);
      await new Promise((r) => setTimeout(r, 300));
    }
    openFiling('quickdrywall', '2026-w38');
  }

  let toastTimer = null;

  function showToast(message, undoFn) {
    toastText.textContent = message;
    if (undoFn) {
      toastAction.hidden = false;
      toastAction.onclick = () => {
        undoFn();
        hideToast();
      };
    } else {
      toastAction.hidden = true;
      toastAction.onclick = null;
    }
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 5000);
  }

  function hideToast() {
    toast.classList.add('hidden');
    clearTimeout(toastTimer);
  }

  async function copyMessage() {
    const text = getOutboundMessageBody();
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    btnCopyMessage.textContent = 'Copied';
    setTimeout(() => { btnCopyMessage.textContent = 'Copy message'; }, 2000);
  }

  function openInEmail() {
    const to = composerTo.value.trim();
    const subject = encodeURIComponent(composerSubject.value);
    const body = encodeURIComponent(getOutboundMessageBody());
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`;
    window.location.href = mailto;
  }

  // Event listeners
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) processFile(file, file.name);
    fileInput.value = '';
  });

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('is-dragover');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('is-dragover'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('is-dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type === 'application/pdf') processFile(file, file.name);
    else if (file) showUploadError('Please upload a PDF file.');
  });

  btnLoadSamples.addEventListener('click', runAllSamples);

  btnCopyMessage.addEventListener('click', copyMessage);
  btnOpenEmail.addEventListener('click', openInEmail);

  composerSignature.value = loadSignature();
  composerResubmit.value = defaultResubmitDate();
  composerBody.addEventListener('input', () => {
    composerBodyEdited = true;
    updateComposerSendFooter();
    saveComposerDraft();
  });
  composerSignature.addEventListener('input', () => {
    saveSignature(composerSignature.value);
    updateComposerSendFooter();
    saveComposerDraft();
  });
  composerResubmit.addEventListener('input', () => {
    updateComposerSendFooter();
    saveComposerDraft();
  });

  btnResetDemo.addEventListener('click', () => {
    const snapshot = JSON.parse(JSON.stringify(project));
    project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.composerDrafts = {};
    saveProject();
    selectedCell = null;
    resultsPanel.classList.add('hidden');
    renderGrid();
    showToast('Demo data reset', () => {
      project = snapshot;
      saveProject();
      renderGrid();
    });
  });

  // Init
  $('#grid-as-of').textContent = `As of ${formatDemoAsOf()}`;
  populateSelects();
  renderGrid();

  const params = new URLSearchParams(window.location.search);
  if (params.get('sample') === '1') {
    runAllSamples();
  }
})();
