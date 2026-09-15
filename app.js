/**
 * AI Logo Lab — client-side procedural SVG logo generator.
 * Flux-inspired playground; deterministic generative art, no API keys.
 */

const HISTORY_KEY = "ail-logo-history";
const HISTORY_MAX = 5;
const CANDIDATE_COUNT = 6;
const BRAND_PLACEHOLDER = "e.g. Northwind Studio";

/** Lowercase brand names that look like placeholders, not real brands. */
const PLACEHOLDER_BRANDS = new Set([
  "acme labs",
  "acme",
  "brand name",
  "company name",
  "your brand",
  "your company",
  "my brand",
  "logo",
  "untitled",
  "test",
  "example",
  "sample",
  "lorem ipsum",
]);

const PALETTES = {
  indigo: { primary: "#6366f1", secondary: "#312e81", accent: "#a5b4fc", bg: "#0f0f1a", fg: "#eef2ff" },
  coral: { primary: "#f97316", secondary: "#9a3412", accent: "#fdba74", bg: "#1a0f0a", fg: "#fff7ed" },
  forest: { primary: "#10b981", secondary: "#064e3b", accent: "#6ee7b7", bg: "#0a1410", fg: "#ecfdf5" },
  sunset: { primary: "#f59e0b", secondary: "#78350f", accent: "#fcd34d", bg: "#14100a", fg: "#fffbeb" },
  mono: { primary: "#e2e8f0", secondary: "#0f172a", accent: "#94a3b8", bg: "#0a0a0c", fg: "#f8fafc" },
};

const $ = (id) => document.getElementById(id);

const brandInput = $("brand-name");
const brandError = $("brand-name-error");
const taglineInput = $("tagline");
const toastEl = $("toast");
const styleChips = $("style-chips");
const palettePresets = $("palette-presets");
const customAccent = $("custom-accent");
const btnGenerate = $("btn-generate");
const resultsSection = $("results");
const resultsMeta = $("results-meta");
const logoGrid = $("logo-grid");
const historySection = $("history");
const historyList = $("history-list");
const modal = $("modal");
const modalBackdrop = $("modal-backdrop");
const modalClose = $("modal-close");
const modalPreview = $("modal-preview");
const modalTitle = $("modal-title");
const btnDownloadSvg = $("btn-download-svg");
const btnDownloadPng = $("btn-download-png");

let selectedStyle = "geometric";
let useCustomAccent = false;
/** @type {{ brand: string, tagline: string, style: string, palette: string, candidates: { id: string, svg: string }[] } | null} */
let currentGeneration = null;
/** @type {{ svg: string, brand: string } | null} */
let selectedCandidate = null;

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function getInitials(brand) {
  const words = brand.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "A";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getPalette() {
  const preset = document.querySelector('input[name="palette"]:checked')?.value || "indigo";
  const base = { ...PALETTES[preset] };
  if (useCustomAccent) {
    base.primary = customAccent.value;
    base.accent = lightenColor(customAccent.value, 0.35);
  }
  return base;
}

function lightenColor(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + Math.round(255 * amount));
  const g = Math.min(255, ((n >> 8) & 255) + Math.round(255 * amount));
  const b = Math.min(255, (n & 255) + Math.round(255 * amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function svgWrap(content, palette, w = 512, h = 512) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="${palette.bg}" rx="24"/>
  ${content}
</svg>`;
}

function generateGeometric(brand, tagline, palette, rng, variant) {
  const initials = getInitials(brand);
  const cx = 256;
  const cy = 240;
  const sides = 3 + Math.floor(rng() * 5);
  const rotation = rng() * 360;
  const rOuter = 90 + variant * 8;
  const rInner = 40 + rng() * 30;

  let shapes = "";
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 + (rotation * Math.PI) / 180;
    const x = cx + Math.cos(angle) * rOuter;
    const y = cy + Math.sin(angle) * rOuter;
    const size = 28 + rng() * 40;
    const fill = i % 2 === 0 ? palette.primary : palette.accent;
    if (rng() > 0.5) {
      shapes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(1)}" fill="${fill}" opacity="0.85"/>`;
    } else {
      shapes += `<rect x="${(x - size / 2).toFixed(1)}" y="${(y - size / 2).toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" fill="${fill}" transform="rotate(${(angle * 180) / Math.PI} ${x.toFixed(1)} ${y.toFixed(1)})" opacity="0.85"/>`;
    }
  }

  shapes += `<circle cx="${cx}" cy="${cy}" r="${rInner.toFixed(1)}" fill="${palette.secondary}" opacity="0.9"/>`;
  shapes += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${rInner * 0.9}" font-weight="700" fill="${palette.fg}">${escapeXml(initials)}</text>`;
  shapes += `<text x="${cx}" y="380" text-anchor="middle" font-family="system-ui,sans-serif" font-size="36" font-weight="700" fill="${palette.fg}">${escapeXml(brand)}</text>`;
  if (tagline) {
    shapes += `<text x="${cx}" y="420" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" fill="${palette.accent}">${escapeXml(tagline)}</text>`;
  }

  return svgWrap(shapes, palette);
}

function generateWordmark(brand, tagline, palette, rng, variant) {
  const fontSize = brand.length > 12 ? 52 : brand.length > 8 ? 64 : 76;
  const letterSpacing = variant * 2 + rng() * 4;
  const skew = (rng() - 0.5) * 8;

  let content = `<defs>
    <linearGradient id="wm-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.primary}"/>
      <stop offset="100%" stop-color="${palette.accent}"/>
    </linearGradient>
  </defs>`;

  const underlineWidth = 120 + variant * 30 + rng() * 80;
  content += `<rect x="${256 - underlineWidth / 2}" y="290" width="${underlineWidth}" height="6" rx="3" fill="url(#wm-grad)" opacity="0.9"/>`;
  content += `<text x="256" y="260" text-anchor="middle" font-family="Georgia,serif" font-size="${fontSize}" font-weight="700" fill="url(#wm-grad)" letter-spacing="${letterSpacing}" transform="skewX(${skew.toFixed(1)})">${escapeXml(brand)}</text>`;

  if (tagline) {
    content += `<text x="256" y="340" text-anchor="middle" font-family="system-ui,sans-serif" font-size="20" fill="${palette.accent}" letter-spacing="2">${escapeXml(tagline.toUpperCase())}</text>`;
  }

  const dotCount = 3 + variant;
  for (let i = 0; i < dotCount; i++) {
    const dx = 256 - (dotCount - 1) * 12 + i * 24;
    content += `<circle cx="${dx}" cy="370" r="4" fill="${palette.primary}" opacity="${0.4 + rng() * 0.6}"/>`;
  }

  return svgWrap(content, palette);
}

function generateMonogram(brand, tagline, palette, rng, variant) {
  const initials = getInitials(brand);
  const shape = variant % 3;
  const cx = 256;
  const cy = 220;

  let frame = "";
  if (shape === 0) {
    frame = `<circle cx="${cx}" cy="${cy}" r="110" fill="${palette.primary}" opacity="0.15"/>
      <circle cx="${cx}" cy="${cy}" r="95" fill="none" stroke="${palette.primary}" stroke-width="4"/>`;
  } else if (shape === 1) {
    frame = `<rect x="${cx - 100}" y="${cy - 100}" width="200" height="200" rx="28" fill="${palette.primary}" opacity="0.15"/>
      <rect x="${cx - 95}" y="${cy - 95}" width="190" height="190" rx="24" fill="none" stroke="${palette.primary}" stroke-width="4"/>`;
  } else {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      pts.push(`${cx + Math.cos(a) * 100},${cy + Math.sin(a) * 100}`);
    }
    frame = `<polygon points="${pts.join(" ")}" fill="${palette.primary}" opacity="0.15"/>
      <polygon points="${pts.join(" ")}" fill="none" stroke="${palette.primary}" stroke-width="4"/>`;
  }

  const fontSize = initials.length > 1 ? 72 : 96;
  let content = frame;
  content += `<text x="${cx}" y="${cy + fontSize * 0.35}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="800" fill="${palette.fg}">${escapeXml(initials)}</text>`;
  content += `<text x="${cx}" y="400" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" font-weight="600" fill="${palette.fg}">${escapeXml(brand)}</text>`;
  if (tagline) {
    content += `<text x="${cx}" y="435" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="${palette.accent}">${escapeXml(tagline)}</text>`;
  }

  return svgWrap(content, palette);
}

function generateBadge(brand, tagline, palette, rng, variant) {
  const cx = 256;
  const badgeH = 180 + variant * 10;
  const badgeW = 280 + variant * 15;

  let content = `<defs>
    <linearGradient id="badge-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${palette.primary}"/>
      <stop offset="100%" stop-color="${palette.secondary}"/>
    </linearGradient>
  </defs>`;

  content += `<path d="M ${cx - badgeW / 2} ${200 - badgeH / 2}
    L ${cx + badgeW / 2} ${200 - badgeH / 2}
    L ${cx + badgeW / 2 - 20} ${200 + badgeH / 2}
    L ${cx} ${200 + badgeH / 2 + 30}
    L ${cx - badgeW / 2 + 20} ${200 + badgeH / 2}
    Z" fill="url(#badge-grad)" stroke="${palette.accent}" stroke-width="3"/>`;

  const iconR = 28;
  content += `<circle cx="${cx}" cy="${200 - badgeH / 2 + 50}" r="${iconR}" fill="${palette.bg}" opacity="0.5"/>`;
  content += `<text x="${cx}" y="${200 - badgeH / 2 + 60}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" font-weight="700" fill="${palette.fg}">${escapeXml(getInitials(brand))}</text>`;
  content += `<text x="${cx}" y="${200 + 10}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="32" font-weight="700" fill="${palette.fg}">${escapeXml(brand)}</text>`;
  if (tagline) {
    content += `<text x="${cx}" y="${200 + 45}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" fill="${palette.accent}">${escapeXml(tagline)}</text>`;
  }

  const starCount = 3 + (variant % 3);
  for (let i = 0; i < starCount; i++) {
    const sx = cx - (starCount - 1) * 18 + i * 36;
    content += `<polygon points="${sx},${200 + badgeH / 2 + 50} ${sx + 6},${200 + badgeH / 2 + 62} ${sx + 12},${200 + badgeH / 2 + 50} ${sx + 9},${200 + badgeH / 2 + 56} ${sx + 3},${200 + badgeH / 2 + 56}" fill="${palette.accent}" opacity="0.7"/>`;
  }

  return svgWrap(content, palette);
}

function generateGradient(brand, tagline, palette, rng, variant) {
  const angle = variant * 30 + rng() * 60;
  const cx = 256;
  const cy = 200;

  let content = `<defs>
    <linearGradient id="grad-bg" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0%" stop-color="${palette.primary}"/>
      <stop offset="50%" stop-color="${palette.secondary}"/>
      <stop offset="100%" stop-color="${palette.accent}"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

  content += `<rect width="512" height="512" fill="url(#grad-bg)" rx="24"/>`;

  const blobCount = 2 + (variant % 3);
  for (let i = 0; i < blobCount; i++) {
    const bx = 80 + rng() * 352;
    const by = 60 + rng() * 200;
    const br = 40 + rng() * 80;
    content += `<circle cx="${bx.toFixed(0)}" cy="${by.toFixed(0)}" r="${br.toFixed(0)}" fill="${palette.fg}" opacity="${(0.05 + rng() * 0.12).toFixed(2)}"/>`;
  }

  const iconSize = 100 + variant * 8;
  content += `<circle cx="${cx}" cy="${cy}" r="${iconSize}" fill="${palette.bg}" opacity="0.35" filter="url(#glow)"/>`;
  content += `<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${iconSize * 0.55}" font-weight="800" fill="${palette.fg}">${escapeXml(getInitials(brand))}</text>`;
  content += `<text x="${cx}" y="370" text-anchor="middle" font-family="system-ui,sans-serif" font-size="40" font-weight="700" fill="${palette.fg}">${escapeXml(brand)}</text>`;
  if (tagline) {
    content += `<text x="${cx}" y="410" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" fill="${palette.fg}" opacity="0.85">${escapeXml(tagline)}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${content}</svg>`;
}

const GENERATORS = {
  geometric: generateGeometric,
  wordmark: generateWordmark,
  monogram: generateMonogram,
  badge: generateBadge,
  gradient: generateGradient,
};

function generateCandidates(brand, tagline, style, paletteName) {
  const palette = getPalette();
  const generator = GENERATORS[style] || generateGeometric;
  const baseSeed = hashString(`${brand}|${tagline}|${style}|${paletteName}|${palette.primary}`);
  const candidates = [];

  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    const rng = createRng(baseSeed + i * 7919);
    const svg = generator(brand, tagline, palette, rng, i);
    candidates.push({ id: `${baseSeed}-${i}`, svg });
  }

  return candidates;
}

function renderGrid(candidates, brand) {
  logoGrid.innerHTML = candidates
    .map(
      (c, i) => `
    <button type="button" class="logo-card" data-index="${i}" aria-label="Logo candidate ${i + 1} for ${escapeXml(brand)}">
      <div class="logo-card__preview">${c.svg}</div>
      <span class="logo-card__label">#${i + 1}</span>
    </button>`
    )
    .join("");

  logoGrid.querySelectorAll(".logo-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      openModal(candidates[idx], brand);
    });
  });
}

function openModal(candidate, brand) {
  selectedCandidate = { svg: candidate.svg, brand };
  modalPreview.innerHTML = candidate.svg;
  modalTitle.textContent = `${brand} — logo preview`;
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
  modal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  selectedCandidate = null;
}

function downloadSvg() {
  if (!selectedCandidate) return;
  const blob = new Blob([selectedCandidate.svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(selectedCandidate.brand)}-logo.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPng() {
  if (!selectedCandidate) return;
  const svgEl = modalPreview.querySelector("svg");
  if (!svgEl) return;

  const svgData = new XMLSerializer().serializeToString(svgEl);
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  const img = new Image();
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  img.onload = () => {
    ctx.drawImage(img, 0, 0, 1024, 1024);
    URL.revokeObjectURL(url);
    canvas.toBlob((pngBlob) => {
      if (!pngBlob) return;
      const pngUrl = URL.createObjectURL(pngBlob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `${slugify(selectedCandidate.brand)}-logo.png`;
      a.click();
      URL.revokeObjectURL(pngUrl);
    }, "image/png");
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

function slugify(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "logo";
}

let toastTimer = null;

function showToast(message, variant = "error") {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.remove("hidden", "toast--error", "toast--success");
  toastEl.classList.add(`toast--${variant}`);

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.add("hidden");
    toastTimer = null;
  }, 4200);
}

function isPlaceholderBrand(brand) {
  const normalized = brand.trim().toLowerCase();
  if (!normalized) return true;
  if (PLACEHOLDER_BRANDS.has(normalized)) return true;
  if (normalized === BRAND_PLACEHOLDER.toLowerCase()) return true;
  return false;
}

function setBrandFieldError(message) {
  if (!brandError) return;
  if (message) {
    brandError.textContent = message;
    brandError.classList.remove("hidden");
    brandInput.classList.add("input-error");
    brandInput.setAttribute("aria-invalid", "true");
  } else {
    brandError.textContent = "";
    brandError.classList.add("hidden");
    brandInput.classList.remove("input-error");
    brandInput.setAttribute("aria-invalid", "false");
  }
}

function validateBrandName(rawValue) {
  const brand = rawValue.trim();

  if (!brand) {
    return { ok: false, message: "Brand name is required — enter your company or product name." };
  }

  if (brand.length < 2) {
    return { ok: false, message: "Brand name must be at least 2 characters." };
  }

  if (isPlaceholderBrand(brand)) {
    return {
      ok: false,
      message: "Replace the placeholder with your real brand name (e.g. Northwind Studio).",
    };
  }

  return { ok: true, brand };
}

function handleGenerate() {
  const validation = validateBrandName(brandInput.value);

  if (!validation.ok) {
    setBrandFieldError(validation.message);
    showToast(validation.message, "error");
    brandInput.focus();
    brandInput.classList.add("input-error");
    setTimeout(() => brandInput.classList.remove("input-error"), 600);
    return;
  }

  setBrandFieldError("");
  const brand = validation.brand;
  const tagline = taglineInput.value.trim();
  const paletteName = document.querySelector('input[name="palette"]:checked')?.value || "indigo";
  const candidates = generateCandidates(brand, tagline, selectedStyle, paletteName);

  currentGeneration = {
    brand,
    tagline,
    style: selectedStyle,
    palette: paletteName,
    candidates,
  };

  resultsSection.classList.remove("hidden");
  $("results-empty")?.classList.add("hidden");
  resultsMeta.textContent = `${CANDIDATE_COUNT} ${selectedStyle} variants · ${paletteName} palette`;
  renderGrid(candidates, brand);
  saveHistory(currentGeneration);
  renderHistory();
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(gen) {
  const entry = {
    ts: Date.now(),
    brand: gen.brand,
    tagline: gen.tagline,
    style: gen.style,
    palette: gen.palette,
  };

  const history = loadHistory();
  history.unshift(entry);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_MAX)));
  } catch (err) {
    console.warn("Could not save history:", err);
  }
}

function renderHistory() {
  const history = loadHistory();
  if (history.length === 0) {
    historySection.classList.add("hidden");
    return;
  }

  historySection.classList.remove("hidden");
  historyList.innerHTML = history
    .map((h) => {
      const when = new Date(h.ts).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      const tag = h.tagline ? ` · "${escapeXml(h.tagline)}"` : "";
      return `<li>
        <button type="button" class="history-item" data-brand="${escapeXml(h.brand)}" data-tagline="${escapeXml(h.tagline || "")}" data-style="${h.style}" data-palette="${h.palette}">
          <span class="history-when">${when}</span>
          <span class="history-brand">${escapeXml(h.brand)}${tag}</span>
          <span class="history-meta">${h.style} · ${h.palette}</span>
        </button>
      </li>`;
    })
    .join("");

  historyList.querySelectorAll(".history-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      brandInput.value = btn.dataset.brand || "";
      taglineInput.value = btn.dataset.tagline || "";
      selectStyle(btn.dataset.style || "geometric");
      const paletteRadio = document.querySelector(`input[name="palette"][value="${btn.dataset.palette}"]`);
      if (paletteRadio) {
        paletteRadio.checked = true;
        updatePaletteUI();
      }
      handleGenerate();
    });
  });
}

function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
  renderHistory();
}

function selectStyle(style) {
  selectedStyle = style;
  styleChips.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("chip--active", chip.dataset.style === style);
  });
}

function updatePaletteUI() {
  palettePresets.querySelectorAll(".palette-swatch").forEach((swatch) => {
    const input = swatch.querySelector("input");
    swatch.classList.toggle("palette-swatch--active", input?.checked);
  });
}

styleChips.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (chip?.dataset.style) selectStyle(chip.dataset.style);
});

palettePresets.addEventListener("change", () => {
  useCustomAccent = false;
  updatePaletteUI();
});

customAccent.addEventListener("input", () => {
  useCustomAccent = true;
});

btnGenerate.addEventListener("click", handleGenerate);

brandInput.addEventListener("input", () => {
  if (brandInput.getAttribute("aria-invalid") === "true") {
    setBrandFieldError("");
  }
});

brandInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleGenerate();
});

taglineInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleGenerate();
});

modalClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);
btnDownloadSvg.addEventListener("click", downloadSvg);
btnDownloadPng.addEventListener("click", downloadPng);

$("btn-clear-history").addEventListener("click", clearHistory);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) {
    closeModal();
  }
});

document.documentElement.dataset.ready = "true";
renderHistory();
brandInput.focus();
