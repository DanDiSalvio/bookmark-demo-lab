/**
 * AI Logo Lab — client-side procedural SVG logo generator.
 * Clean SaaS logo-maker UX; deterministic generative art, no API keys.
 */

const HISTORY_KEY = "ail-logo-history";
const HISTORY_MAX = 5;
const CANDIDATE_COUNT = 6;
const BRAND_PLACEHOLDER = "e.g. Northwind Studio";
const PREVIEW_BRAND = "Your Brand";

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

const STYLES = [
  {
    id: "geometric",
    label: "Geometric",
    desc: "Icon mark with shapes + wordmark",
  },
  {
    id: "wordmark",
    label: "Wordmark",
    desc: "Typography-led with accent rule",
  },
  {
    id: "monogram",
    label: "Monogram",
    desc: "Initials in a framed badge",
  },
  {
    id: "badge",
    label: "Badge",
    desc: "Ribbon seal with stars",
  },
  {
    id: "gradient",
    label: "Gradient",
    desc: "Soft gradient with icon lockup",
  },
  {
    id: "minimal",
    label: "Minimal",
    desc: "Clean dot + sans wordmark",
  },
];

/** Neutral canvas palettes — one accent each, white backgrounds. */
const PALETTES = {
  emerald: { primary: "#059669", secondary: "#047857", accent: "#a7f3d0", bg: "#ffffff", fg: "#1c1917", muted: "#78716c" },
  coral: { primary: "#ea580c", secondary: "#c2410c", accent: "#fed7aa", bg: "#ffffff", fg: "#1c1917", muted: "#78716c" },
  ocean: { primary: "#0284c7", secondary: "#0369a1", accent: "#bae6fd", bg: "#ffffff", fg: "#1c1917", muted: "#78716c" },
  slate: { primary: "#475569", secondary: "#334155", accent: "#cbd5e1", bg: "#ffffff", fg: "#1c1917", muted: "#78716c" },
  mono: { primary: "#1c1917", secondary: "#44403c", accent: "#d6d3d1", bg: "#ffffff", fg: "#1c1917", muted: "#78716c" },
};

const $ = (id) => document.getElementById(id);

const brandInput = $("brand-name");
const brandError = $("brand-name-error");
const taglineInput = $("tagline");
const toastEl = $("toast");
const styleGrid = $("style-grid");
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
let wizardStep = 1;
/** @type {{ brand: string, tagline: string, style: string, palette: string, candidates: { id: string, svg: string, style: string, styleLabel: string }[] } | null} */
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
  const preset = document.querySelector('input[name="palette"]:checked')?.value || "emerald";
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

function svgWrap(content, palette, w = 512, h = 512, uid = "") {
  const suffix = uid ? `-${uid}` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="${palette.bg}" rx="8"/>
  ${content.replace(/id="([^"]+)"/g, `id="$1${suffix}"`).replace(/url\(#([^)]+)\)/g, `url(#$1${suffix})`)}
</svg>`;
}

function previewSvg(content, palette, w = 320, h = 240) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="${palette.bg}"/>
  ${content}
</svg>`;
}

function generateGeometric(brand, tagline, palette, rng, variant) {
  const initials = getInitials(brand);
  const cx = 256;
  const cy = 200;
  const sides = 3 + (variant % 4);
  const rotation = variant * 22 + rng() * 40;
  const rOuter = 72 + variant * 6;
  const rInner = 36 + variant * 4;

  let shapes = "";
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 + (rotation * Math.PI) / 180;
    const x = cx + Math.cos(angle) * rOuter;
    const y = cy + Math.sin(angle) * rOuter;
    const size = 22 + (i % 3) * 8;
    const fill = i % 2 === 0 ? palette.primary : palette.accent;
    shapes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(1)}" fill="${fill}" opacity="0.9"/>`;
  }

  shapes += `<circle cx="${cx}" cy="${cy}" r="${rInner.toFixed(1)}" fill="${palette.primary}"/>`;
  shapes += `<text x="${cx}" y="${cy + 10}" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="${rInner * 0.85}" font-weight="700" fill="#ffffff">${escapeXml(initials)}</text>`;
  shapes += `<text x="${cx}" y="340" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="34" font-weight="700" fill="${palette.fg}">${escapeXml(brand)}</text>`;
  if (tagline) {
    shapes += `<text x="${cx}" y="378" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="16" fill="${palette.muted}">${escapeXml(tagline)}</text>`;
  }

  return svgWrap(shapes, palette, 512, 512, `geo-${variant}`);
}

function generateGeometricPreview(brand, palette) {
  const initials = getInitials(brand);
  const content = `
    <circle cx="160" cy="95" r="28" fill="${palette.primary}" opacity="0.2"/>
    <circle cx="120" cy="75" r="12" fill="${palette.primary}"/>
    <circle cx="200" cy="75" r="12" fill="${palette.accent}"/>
    <circle cx="160" cy="55" r="12" fill="${palette.primary}"/>
    <circle cx="160" cy="95" r="22" fill="${palette.primary}"/>
    <text x="160" y="102" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="16" font-weight="700" fill="#fff">${escapeXml(initials)}</text>
    <text x="160" y="165" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="18" font-weight="700" fill="${palette.fg}">${escapeXml(truncate(brand, 14))}</text>`;
  return previewSvg(content, palette);
}

function generateWordmark(brand, tagline, palette, rng, variant) {
  const fontSize = brand.length > 12 ? 48 : brand.length > 8 ? 58 : 68;
  const letterSpacing = variant * 1.5 + 1;
  const weight = variant % 2 === 0 ? 700 : 600;
  const fontFamily = variant % 3 === 0 ? "Fraunces,Georgia,serif" : "DM Sans,system-ui,sans-serif";

  let content = `<defs>
    <linearGradient id="wm-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${palette.primary}"/>
      <stop offset="100%" stop-color="${palette.secondary}"/>
    </linearGradient>
  </defs>`;

  const underlineWidth = 100 + variant * 25;
  const underlineY = 280 + variant * 4;
  content += `<rect x="${256 - underlineWidth / 2}" y="${underlineY}" width="${underlineWidth}" height="5" rx="2.5" fill="${palette.primary}"/>`;
  content += `<text x="256" y="250" text-anchor="middle" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${weight}" fill="${palette.fg}" letter-spacing="${letterSpacing}">${escapeXml(brand)}</text>`;

  if (tagline) {
    content += `<text x="256" y="330" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="18" fill="${palette.muted}" letter-spacing="1">${escapeXml(tagline)}</text>`;
  }

  return svgWrap(content, palette, 512, 512, `wm-${variant}`);
}

function generateWordmarkPreview(brand, palette) {
  const content = `
    <rect x="60" y="118" width="200" height="4" rx="2" fill="${palette.primary}"/>
    <text x="160" y="105" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-size="28" font-weight="700" fill="${palette.fg}">${escapeXml(truncate(brand, 12))}</text>`;
  return previewSvg(content, palette);
}

function generateMonogram(brand, tagline, palette, rng, variant) {
  const initials = getInitials(brand);
  const cx = 256;
  const cy = 210;
  const shape = variant % 3;

  let frame = "";
  if (shape === 0) {
    frame = `<circle cx="${cx}" cy="${cy}" r="88" fill="none" stroke="${palette.primary}" stroke-width="5"/>
      <circle cx="${cx}" cy="${cy}" r="78" fill="${palette.primary}" opacity="0.08"/>`;
  } else if (shape === 1) {
    frame = `<rect x="${cx - 82}" y="${cy - 82}" width="164" height="164" rx="20" fill="none" stroke="${palette.primary}" stroke-width="5"/>
      <rect x="${cx - 72}" y="${cy - 72}" width="144" height="144" rx="16" fill="${palette.primary}" opacity="0.08"/>`;
  } else {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      pts.push(`${cx + Math.cos(a) * 88},${cy + Math.sin(a) * 88}`);
    }
    frame = `<polygon points="${pts.join(" ")}" fill="none" stroke="${palette.primary}" stroke-width="5"/>
      <polygon points="${pts.join(" ")}" fill="${palette.primary}" opacity="0.08"/>`;
  }

  const fontSize = initials.length > 1 ? 64 : 80;
  let content = frame;
  content += `<text x="${cx}" y="${cy + fontSize * 0.32}" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="${fontSize}" font-weight="800" fill="${palette.primary}">${escapeXml(initials)}</text>`;
  content += `<text x="${cx}" y="390" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="26" font-weight="600" fill="${palette.fg}">${escapeXml(brand)}</text>`;
  if (tagline) {
    content += `<text x="${cx}" y="422" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="15" fill="${palette.muted}">${escapeXml(tagline)}</text>`;
  }

  return svgWrap(content, palette, 512, 512, `mono-${variant}`);
}

function generateMonogramPreview(brand, palette) {
  const initials = getInitials(brand);
  const content = `
    <rect x="108" y="48" width="104" height="104" rx="18" fill="none" stroke="${palette.primary}" stroke-width="4"/>
    <text x="160" y="118" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="42" font-weight="800" fill="${palette.primary}">${escapeXml(initials)}</text>
    <text x="160" y="175" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="14" font-weight="600" fill="${palette.fg}">${escapeXml(truncate(brand, 14))}</text>`;
  return previewSvg(content, palette);
}

function generateBadge(brand, tagline, palette, rng, variant) {
  const cx = 256;
  const badgeH = 150 + variant * 8;
  const badgeW = 250 + variant * 10;

  let content = `<path d="M ${cx - badgeW / 2} ${210 - badgeH / 2}
    L ${cx + badgeW / 2} ${210 - badgeH / 2}
    L ${cx + badgeW / 2 - 16} ${210 + badgeH / 2}
    L ${cx} ${210 + badgeH / 2 + 24}
    L ${cx - badgeW / 2 + 16} ${210 + badgeH / 2}
    Z" fill="${palette.primary}" stroke="${palette.secondary}" stroke-width="2"/>`;

  content += `<text x="${cx}" y="${210 - 5}" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="30" font-weight="700" fill="#ffffff">${escapeXml(brand)}</text>`;
  if (tagline) {
    content += `<text x="${cx}" y="${210 + 28}" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="13" fill="${palette.accent}">${escapeXml(tagline)}</text>`;
  }

  const starCount = 3 + (variant % 2);
  for (let i = 0; i < starCount; i++) {
    const sx = cx - (starCount - 1) * 14 + i * 28;
    content += `<polygon points="${sx},${210 + badgeH / 2 + 38} ${sx + 5},${210 + badgeH / 2 + 48} ${sx + 10},${210 + badgeH / 2 + 38} ${sx + 8},${210 + badgeH / 2 + 43} ${sx + 2},${210 + badgeH / 2 + 43}" fill="${palette.accent}"/>`;
  }

  return svgWrap(content, palette, 512, 512, `badge-${variant}`);
}

function generateBadgePreview(brand, palette) {
  const content = `
    <path d="M 80 55 L 240 55 L 228 130 L 160 148 L 92 130 Z" fill="${palette.primary}"/>
    <text x="160" y="98" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="16" font-weight="700" fill="#fff">${escapeXml(truncate(brand, 10))}</text>`;
  return previewSvg(content, palette);
}

function generateGradient(brand, tagline, palette, rng, variant) {
  const cx = 256;
  const cy = 200;

  let content = `<defs>
    <linearGradient id="grad-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.bg}"/>
      <stop offset="100%" stop-color="${palette.accent}" stop-opacity="0.35"/>
    </linearGradient>
  </defs>`;

  content += `<rect width="512" height="512" fill="url(#grad-bg)" rx="8"/>`;

  const iconSize = 80 + variant * 6;
  content += `<circle cx="${cx}" cy="${cy}" r="${iconSize}" fill="${palette.primary}"/>`;
  content += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="${iconSize * 0.5}" font-weight="800" fill="#ffffff">${escapeXml(getInitials(brand))}</text>`;
  content += `<text x="${cx}" y="360" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="36" font-weight="700" fill="${palette.fg}">${escapeXml(brand)}</text>`;
  if (tagline) {
    content += `<text x="${cx}" y="398" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="16" fill="${palette.muted}">${escapeXml(tagline)}</text>`;
  }

  return svgWrap(content, palette, 512, 512, `grad-${variant}`);
}

function generateGradientPreview(brand, palette) {
  const initials = getInitials(brand);
  const content = `
    <rect width="320" height="240" fill="${palette.accent}" opacity="0.25"/>
    <circle cx="160" cy="88" r="36" fill="${palette.primary}"/>
    <text x="160" y="98" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="22" font-weight="800" fill="#fff">${escapeXml(initials)}</text>
    <text x="160" y="165" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="18" font-weight="700" fill="${palette.fg}">${escapeXml(truncate(brand, 12))}</text>`;
  return previewSvg(content, palette);
}

function generateMinimal(brand, tagline, palette, rng, variant) {
  const dotSize = 14 + variant * 2;
  const gap = 16 + variant * 2;
  const fontSize = brand.length > 12 ? 44 : brand.length > 8 ? 52 : 60;
  const textWidth = brand.length * (fontSize * 0.52);
  const startX = 256 - (dotSize + gap + textWidth) / 2;

  let content = `<circle cx="${startX + dotSize / 2}" cy="240" r="${dotSize}" fill="${palette.primary}"/>`;
  content += `<text x="${startX + dotSize + gap}" y="252" font-family="DM Sans,system-ui,sans-serif" font-size="${fontSize}" font-weight="700" fill="${palette.fg}">${escapeXml(brand)}</text>`;

  if (tagline) {
    content += `<text x="256" y="310" text-anchor="middle" font-family="DM Sans,system-ui,sans-serif" font-size="17" fill="${palette.muted}">${escapeXml(tagline)}</text>`;
  }

  return svgWrap(content, palette, 512, 512, `min-${variant}`);
}

function generateMinimalPreview(brand, palette) {
  const content = `
    <circle cx="118" cy="112" r="8" fill="${palette.primary}"/>
    <text x="134" y="118" font-family="DM Sans,system-ui,sans-serif" font-size="22" font-weight="700" fill="${palette.fg}">${escapeXml(truncate(brand, 12))}</text>`;
  return previewSvg(content, palette);
}

const GENERATORS = {
  geometric: generateGeometric,
  wordmark: generateWordmark,
  monogram: generateMonogram,
  badge: generateBadge,
  gradient: generateGradient,
  minimal: generateMinimal,
};

const PREVIEW_GENERATORS = {
  geometric: generateGeometricPreview,
  wordmark: generateWordmarkPreview,
  monogram: generateMonogramPreview,
  badge: generateBadgePreview,
  gradient: generateGradientPreview,
  minimal: generateMinimalPreview,
};

function truncate(str, max) {
  const s = str.trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function uniquifySvgIds(svg, suffix) {
  if (!suffix) return svg;
  return svg
    .replace(/id="([^"]+)"/g, `id="$1-${suffix}"`)
    .replace(/url\(#([^)]+)\)/g, `url(#$1-${suffix})`);
}

function previewBrandName() {
  const validation = validateBrandName(brandInput.value);
  return validation.ok ? validation.brand : PREVIEW_BRAND;
}

function generateCandidates(brand, tagline, preferredStyle, paletteName) {
  const palette = getPalette();
  const baseSeed = hashString(`${brand}|${tagline}|${paletteName}|${palette.primary}`);

  const orderedStyles = [...STYLES].sort((a, b) => {
    if (a.id === preferredStyle) return -1;
    if (b.id === preferredStyle) return 1;
    return 0;
  });

  return orderedStyles.map((styleMeta, i) => {
    const rng = createRng(baseSeed + i * 7919);
    const generator = GENERATORS[styleMeta.id];
    const svg = generator(brand, tagline, palette, rng, i);
    return {
      id: `${baseSeed}-${styleMeta.id}`,
      svg,
      style: styleMeta.id,
      styleLabel: styleMeta.label,
    };
  });
}

function mockupHtml(svg, idBase) {
  return `
    <div class="mockup-cell">
      <div class="mockup-card">${uniquifySvgIds(svg, `${idBase}-card`)}</div>
      <span class="mockup-label">Card</span>
    </div>
    <div class="mockup-cell">
      <div class="mockup-cup">
        <div class="mockup-cup__body">${uniquifySvgIds(svg, `${idBase}-cup`)}</div>
        <div class="mockup-cup__handle"></div>
      </div>
      <span class="mockup-label">Cup</span>
    </div>
    <div class="mockup-cell">
      <div class="mockup-stationery">
        <div class="mockup-stationery__header"></div>
        <div class="mockup-stationery__logo">${uniquifySvgIds(svg, `${idBase}-paper`)}</div>
      </div>
      <span class="mockup-label">Letterhead</span>
    </div>`;
}

function renderGrid(candidates, brand) {
  logoGrid.innerHTML = candidates
    .map(
      (c, i) => `
    <button type="button" class="logo-card" data-index="${i}" aria-label="${escapeXml(c.styleLabel)} logo for ${escapeXml(brand)}">
      <div class="logo-card__hero">${uniquifySvgIds(c.svg, `${c.id}-hero`)}</div>
      <div class="logo-card__mockups">${mockupHtml(c.svg, c.id)}</div>
      <div class="logo-card__footer">
        <span class="logo-card__style">${escapeXml(c.styleLabel)}</span>
        <span class="logo-card__action">Preview &amp; download</span>
      </div>
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
  modalPreview.innerHTML = `
    <div class="modal-preview__logo">${uniquifySvgIds(candidate.svg, `${candidate.id}-modal`)}</div>
    <div class="modal-mockups">
      <div class="modal-mockup">
        <div class="mockup-card">${uniquifySvgIds(candidate.svg, `${candidate.id}-mc`)}</div>
        <span class="modal-mockup__label">Business card</span>
      </div>
      <div class="modal-mockup">
        <div class="mockup-cup">
          <div class="mockup-cup__body">${uniquifySvgIds(candidate.svg, `${candidate.id}-mcp`)}</div>
          <div class="mockup-cup__handle"></div>
        </div>
        <span class="modal-mockup__label">Coffee cup</span>
      </div>
      <div class="modal-mockup">
        <div class="mockup-stationery">
          <div class="mockup-stationery__header"></div>
          <div class="mockup-stationery__logo">${uniquifySvgIds(candidate.svg, `${candidate.id}-ms`)}</div>
        </div>
        <span class="modal-mockup__label">Stationery</span>
      </div>
    </div>`;
  modalTitle.textContent = `${brand} · ${candidate.styleLabel}`;
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
  showToast("SVG downloaded — editable vector format.", "success");
}

function downloadPng() {
  if (!selectedCandidate) return;
  const svgEl = modalPreview.querySelector(".modal-preview__logo svg");
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
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1024, 1024);
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
      showToast("PNG downloaded — raster export for sharing.", "success");
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
    goToStep(1);
    brandInput.focus();
    brandInput.classList.add("input-error");
    setTimeout(() => brandInput.classList.remove("input-error"), 600);
    return;
  }

  setBrandFieldError("");
  const brand = validation.brand;
  const tagline = taglineInput.value.trim();
  const paletteName = document.querySelector('input[name="palette"]:checked')?.value || "emerald";
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
  resultsMeta.textContent = `${CANDIDATE_COUNT} distinct styles for “${brand}” · ${paletteName} accent`;
  renderGrid(candidates, brand);
  saveHistory(currentGeneration);
  renderHistory();
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
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
      const tag = h.tagline ? ` · “${escapeXml(h.tagline)}”` : "";
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
      renderStyleGrid();
      goToStep(3);
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
  styleGrid.querySelectorAll(".style-card").forEach((card) => {
    const active = card.dataset.style === style;
    card.classList.toggle("style-card--active", active);
    card.setAttribute("aria-checked", active ? "true" : "false");
  });
}

function renderStyleGrid() {
  const brand = previewBrandName();
  const palette = getPalette();

  styleGrid.innerHTML = STYLES.map((styleMeta) => {
    const previewFn = PREVIEW_GENERATORS[styleMeta.id];
    const preview = previewFn ? previewFn(brand, palette) : "";
    const active = styleMeta.id === selectedStyle;
    return `
      <button type="button" class="style-card${active ? " style-card--active" : ""}" data-style="${styleMeta.id}" role="radio" aria-checked="${active}">
        <div class="style-card__preview">${preview}</div>
        <span class="style-card__label">${escapeXml(styleMeta.label)}</span>
        <span class="style-card__desc">${escapeXml(styleMeta.desc)}</span>
      </button>`;
  }).join("");

  styleGrid.querySelectorAll(".style-card").forEach((card) => {
    card.addEventListener("click", () => {
      if (card.dataset.style) selectStyle(card.dataset.style);
    });
  });
}

function updatePaletteUI() {
  palettePresets.querySelectorAll(".palette-swatch").forEach((swatch) => {
    const input = swatch.querySelector("input");
    swatch.classList.toggle("palette-swatch--active", input?.checked);
  });
  if (wizardStep >= 2) renderStyleGrid();
}

function goToStep(step) {
  wizardStep = step;

  document.querySelectorAll(".wizard-step").forEach((btn) => {
    const n = Number(btn.dataset.step);
    btn.classList.toggle("wizard-step--active", n === step);
    btn.classList.toggle("wizard-step--done", n < step);
    btn.disabled = n > step && step < n;
  });

  document.querySelectorAll(".wizard-panel").forEach((panel) => {
    panel.classList.toggle("wizard-panel--active", Number(panel.dataset.stepPanel) === step);
  });

  if (step === 2) renderStyleGrid();
  if (step >= 2) {
    $("wizard-step-2").disabled = false;
  }
  if (step >= 3) {
    $("wizard-step-3").disabled = false;
  }
}

function tryAdvanceFromStep1() {
  const validation = validateBrandName(brandInput.value);
  if (!validation.ok) {
    setBrandFieldError(validation.message);
    showToast(validation.message, "error");
    brandInput.focus();
    return;
  }
  setBrandFieldError("");
  goToStep(2);
}

function tryAdvanceFromStep2() {
  goToStep(3);
}

styleGrid?.addEventListener("click", (e) => {
  const card = e.target.closest(".style-card");
  if (card?.dataset.style) selectStyle(card.dataset.style);
});

palettePresets.addEventListener("change", () => {
  useCustomAccent = false;
  updatePaletteUI();
});

customAccent.addEventListener("input", () => {
  useCustomAccent = true;
  updatePaletteUI();
});

btnGenerate.addEventListener("click", handleGenerate);

$("btn-step-1-next")?.addEventListener("click", tryAdvanceFromStep1);
$("btn-step-2-next")?.addEventListener("click", tryAdvanceFromStep2);
$("btn-step-2-back")?.addEventListener("click", () => goToStep(1));
$("btn-step-3-back")?.addEventListener("click", () => goToStep(2));

document.querySelectorAll(".wizard-step").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = Number(btn.dataset.step);
    if (target === 1) goToStep(1);
    if (target === 2 && wizardStep >= 2) goToStep(2);
    if (target === 3 && wizardStep >= 3) goToStep(3);
    if (target === 2 && wizardStep === 1) tryAdvanceFromStep1();
  });
});

brandInput.addEventListener("input", () => {
  if (brandInput.getAttribute("aria-invalid") === "true") {
    setBrandFieldError("");
  }
  if (wizardStep >= 2) renderStyleGrid();
});

brandInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (wizardStep === 1) tryAdvanceFromStep1();
    else if (wizardStep === 3) handleGenerate();
  }
});

taglineInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && wizardStep === 3) handleGenerate();
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
renderStyleGrid();
renderHistory();
brandInput.focus();
