(function () {
  'use strict';

  const STORAGE_KEY = 'wh347-sub-check-v1';

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
      { id: '2026-w38', label: 'Sep 13' },
      { id: '2026-w39', label: 'Sep 20' },
      { id: '2026-w40', label: 'Sep 27' },
      { id: '2026-w41', label: 'Oct 4' }
    ],
    subs: [
      { id: 'apex', name: 'Apex Mechanical LLC' },
      { id: 'summit', name: 'Summit Electric Inc.' },
      { id: 'quickdrywall', name: 'Quick Drywall Co.' },
      { id: 'pacific', name: 'Pacific Steel Erectors' }
    ],
    filings: {}
  };

  /** @type {typeof DEFAULT_PROJECT} */
  let project = loadProject();

  const $ = (sel) => document.querySelector(sel);

  const subSelect = $('#sub-select');
  const weekSelect = $('#week-select');
  const fileInput = $('#file-input');
  const uploadZone = $('#upload-zone');
  const resultsPanel = $('#results-panel');
  const checkList = $('#check-list');
  const resultsBadge = $('#results-badge');
  const resultsMeta = $('#results-meta');
  const kickbackPanel = $('#kickback-panel');
  const kickbackText = $('#kickback-text');
  const kickbackCopied = $('#kickback-copied');
  const projectGrid = $('#project-grid');
  const gridEmpty = $('#grid-empty');
  const btnCopyKickback = $('#btn-copy-kickback');
  const btnResetDemo = $('#btn-reset-demo');

  /**
   * @typedef {{
   *   id: string,
   *   label: string,
   *   pass: boolean,
   *   detail: string
   * }} CheckResult
   */

  function loadProject() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.subs && parsed.weeks) return parsed;
      }
    } catch (_) { /* ignore */ }
    return JSON.parse(JSON.stringify(DEFAULT_PROJECT));
  }

  function saveProject() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }

  function filingKey(subId, weekId) {
    return `${subId}::${weekId}`;
  }

  /**
   * @param {string} text
   * @returns {CheckResult[]}
   */
  function runChecks(text) {
    const normalized = text.replace(/\s+/g, ' ');
    const lower = normalized.toLowerCase();

    const checks = [];

    // Form revision / OMB markers
    const hasCurrentOmb = normalized.includes(CURRENT_OMB);
    const hasCurrentExpiry = normalized.includes(CURRENT_EXPIRY);
    const hasOldExpiry = /expires\s+09\/30\/2026/i.test(normalized) ||
      /expires\s+9\/30\/2026/i.test(normalized);
    const hasOmbBlock = /omb\s*(control\s*)?no\.?\s*1235-0008/i.test(normalized);

    if (hasCurrentOmb && hasCurrentExpiry && !hasOldExpiry) {
      checks.push({
        id: 'formRevision',
        label: 'Form revision (OMB markers)',
        pass: true,
        detail: `Found OMB ${CURRENT_OMB} with expiry ${CURRENT_EXPIRY} — matches current WH-347 per DOL.`
      });
    } else if (hasOldExpiry || (hasOmbBlock && !hasCurrentExpiry)) {
      checks.push({
        id: 'formRevision',
        label: 'Form revision (OMB markers)',
        pass: false,
        detail: hasOldExpiry
          ? 'PDF shows expired OMB expiry date (09/30/2026). Resubmit on current WH-347 (OMB 1235-0008, expires 01/31/2028).'
          : 'OMB block found but current expiry 01/31/2028 not detected — may be wrong revision or scanned image without text.'
      });
    } else if (!hasOmbBlock) {
      checks.push({
        id: 'formRevision',
        label: 'Form revision (OMB markers)',
        pass: false,
        detail: 'Could not find OMB 1235-0008 markers in extracted text. Confirm this is WH-347 and not a flat scan.'
      });
    } else {
      checks.push({
        id: 'formRevision',
        label: 'Form revision (OMB markers)',
        pass: false,
        detail: 'OMB markers incomplete — verify form matches current WH-347 (expires 01/31/2028).'
      });
    }

    // Wage determination number
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

    // Apprentice registration
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

    // Fringe benefit breakdown
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

    // Statement of Compliance signature
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
  function buildKickbackNote(checks, subName, weekLabel) {
    const failures = checks.filter((c) => !c.pass);
    if (failures.length === 0) {
      return `Re: Certified Payroll — Week ending ${weekLabel}\n\n${subName},\n\nYour WH-347 for week ending ${weekLabel} passed our pre-check. We will forward to the contracting agency.\n\nThank you,\nProject Office`;
    }

    const items = failures.map((f, i) => `${i + 1}. ${f.label}: ${f.detail}`);
    return `Re: Certified Payroll REJECTED — Week ending ${weekLabel}\n\n${subName},\n\nYour certified payroll for week ending ${weekLabel} cannot be forwarded. Incomplete, wrong-revision, or defective filings are treated like missing filings — payment will be withheld until corrected.\n\nPlease fix and resubmit:\n\n${items.join('\n\n')}\n\nResubmit a corrected WH-347 (current form: OMB 1235-0008, expires 01/31/2028) at your earliest convenience.\n\nThank you,\nProject Office`;
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
      const pageText = content.items.map((item) => item.str).join(' ');
      parts.push(pageText);
    }
    return parts.join('\n');
  }

  /**
   * @param {CheckResult[]} checks
   * @param {string} subName
   * @param {string} weekLabel
   * @param {string} fileName
   */
  function showResults(checks, subName, weekLabel, fileName) {
    const allPass = checks.every((c) => c.pass);
    resultsPanel.classList.remove('hidden');
    resultsBadge.textContent = allPass ? 'Pass' : 'Fail';
    resultsBadge.className = 'badge ' + (allPass ? 'badge--pass' : 'badge--fail');
    resultsMeta.textContent = `${subName} · Week ending ${weekLabel} · ${fileName}`;

    checkList.innerHTML = checks.map((c) => {
      const cls = c.pass ? 'check-item--pass' : 'check-item--fail';
      const icon = c.pass ? '✓' : '✕';
      return `<li class="check-item ${cls}">
        <span class="check-item__icon" aria-hidden="true">${icon}</span>
        <div class="check-item__body">
          <p class="check-item__label">${escapeHtml(c.label)}</p>
          <p class="check-item__detail">${escapeHtml(c.detail)}</p>
        </div>
      </li>`;
    }).join('');

    const note = buildKickbackNote(checks, subName, weekLabel);
    kickbackText.textContent = note;
    kickbackPanel.hidden = false;
    kickbackCopied.classList.add('hidden');
    resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
      kickbackNote: buildKickbackNote(checks, sub?.name || subId, week?.label || weekId),
      checkedAt: Date.now(),
      textPreview: extractedPreview.slice(0, 500)
    };
    saveProject();
    renderGrid();
  }

  function renderGrid() {
    const cols = project.weeks.length + 1;
    projectGrid.style.gridTemplateColumns = `minmax(140px, 1.4fr) repeat(${project.weeks.length}, minmax(72px, 1fr))`;

    let html = '<div class="project-grid" style="display:contents">';
    html += `<div class="project-grid__cell project-grid__cell--corner project-grid__cell--head">Subcontractor</div>`;
    for (const week of project.weeks) {
      html += `<div class="project-grid__cell project-grid__cell--head">${escapeHtml(week.label)}</div>`;
    }

    for (const sub of project.subs) {
      html += `<div class="project-grid__row" style="display:contents">`;
      html += `<div class="project-grid__cell project-grid__cell--sub">${escapeHtml(sub.name)}</div>`;
      for (const week of project.weeks) {
        const key = filingKey(sub.id, week.id);
        const filing = project.filings[key];
        let cellClass = 'project-grid__cell--pending';
        let label = '—';
        if (filing) {
          cellClass = filing.status === 'pass' ? 'project-grid__cell--pass' : 'project-grid__cell--fail';
          label = filing.status === 'pass' ? 'Pass' : 'Fail';
        }
        const clickable = filing ? ' project-grid__cell--clickable' : '';
        html += `<div class="project-grid__cell ${cellClass}${clickable}" data-sub="${sub.id}" data-week="${week.id}" role="${filing ? 'button' : 'cell'}" tabindex="${filing ? '0' : '-1'}">${label}</div>`;
      }
      html += `</div>`;
    }
    html += '</div>';
    projectGrid.innerHTML = html;

    const hasFilings = Object.keys(project.filings).length > 0;
    gridEmpty.classList.toggle('hidden', hasFilings);
    btnResetDemo.classList.toggle('hidden', !hasFilings);

    projectGrid.querySelectorAll('.project-grid__cell--clickable').forEach((cell) => {
      cell.addEventListener('click', () => openFiling(cell.dataset.sub, cell.dataset.week));
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFiling(cell.dataset.sub, cell.dataset.week);
        }
      });
    });
  }

  function openFiling(subId, weekId) {
    const filing = project.filings[filingKey(subId, weekId)];
    if (!filing) return;
    const sub = project.subs.find((s) => s.id === subId);
    const week = project.weeks.find((w) => w.id === weekId);
    subSelect.value = subId;
    weekSelect.value = weekId;
    showResults(filing.checks, sub?.name || subId, week?.label || weekId, filing.fileName);
  }

  function populateSelects() {
    subSelect.innerHTML = project.subs.map((s) =>
      `<option value="${s.id}">${escapeHtml(s.name)}</option>`
    ).join('');
    weekSelect.innerHTML = project.weeks.map((w) =>
      `<option value="${w.id}">${escapeHtml(w.label)}</option>`
    ).join('');
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

    uploadZone.classList.add('is-loading');
    try {
      const text = await extractPdfText(file);
      if (!text || text.trim().length < 20) {
        alert('Could not extract enough text from this PDF. It may be a scanned image without a text layer.');
        return;
      }
      const checks = runChecks(text);
      showResults(checks, sub?.name || subId, week?.label || weekId, fileName);
      saveFiling(subId, weekId, checks, fileName, text);
    } catch (err) {
      console.error(err);
      alert('Failed to read PDF: ' + (err.message || 'Unknown error'));
    } finally {
      uploadZone.classList.remove('is-loading');
    }
  }

  async function loadSample(sampleKey) {
    const sample = SAMPLE_FILES[sampleKey];
    if (!sample) return;
    subSelect.value = sample.subId;
    weekSelect.value = sample.weekId;
    const chips = document.querySelectorAll('.chip');
    chips.forEach((c) => c.classList.add('is-loading'));
    try {
      const resp = await fetch(`samples/${sample.file}`);
      if (!resp.ok) throw new Error('Sample file not found');
      const blob = await resp.blob();
      await processFile(blob, sample.file);
    } finally {
      chips.forEach((c) => c.classList.remove('is-loading'));
    }
  }

  async function runAllSamples() {
    for (const key of ['pass', 'revision', 'missing']) {
      await loadSample(key);
      await new Promise((r) => setTimeout(r, 300));
    }
    const passFiling = project.filings[filingKey('apex', '2026-w40')];
    if (passFiling) {
      openFiling('apex', '2026-w40');
    }
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
  });

  document.querySelectorAll('.chip[data-sample]').forEach((btn) => {
    btn.addEventListener('click', () => loadSample(btn.dataset.sample));
  });

  btnCopyKickback.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(kickbackText.textContent);
      kickbackCopied.classList.remove('hidden');
      setTimeout(() => kickbackCopied.classList.add('hidden'), 2000);
    } catch (_) {
      const range = document.createRange();
      range.selectNode(kickbackText);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      document.execCommand('copy');
      kickbackCopied.classList.remove('hidden');
    }
  });

  btnResetDemo.addEventListener('click', () => {
    if (confirm('Clear all filings and reset demo data?')) {
      project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
      saveProject();
      resultsPanel.classList.add('hidden');
      renderGrid();
    }
  });

  // Init
  populateSelects();
  renderGrid();

  const params = new URLSearchParams(window.location.search);
  if (params.get('sample') === '1') {
    runAllSamples();
  }
})();
