/**
 * Baseball Swing Lab — client-side swing analysis demo.
 * Sample mode: animated canvas batter. Upload mode: MediaPipe Pose overlay.
 */

const POSE_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const MAX_ANALYSIS_SECONDS = 10;
const ANALYSIS_FPS = 15;
const PLAYBACK_INTERVAL_MS = 100;
const SESSION_HISTORY_KEY = "bsl-session-history";
const SESSION_HISTORY_MAX = 5;
const SESSION_HISTORY_DEDUPE_MS = 30_000;
const FIRST_RUN_KEY = "bsl-first-run-done";

const L = {
  NOSE: 0,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
};

const SKELETON = [
  [L.L_SHOULDER, L.R_SHOULDER],
  [L.L_SHOULDER, L.L_ELBOW],
  [L.L_ELBOW, L.L_WRIST],
  [L.R_SHOULDER, L.R_ELBOW],
  [L.R_ELBOW, L.R_WRIST],
  [L.L_SHOULDER, L.L_HIP],
  [L.R_SHOULDER, L.R_HIP],
  [L.L_HIP, L.R_HIP],
  [L.L_HIP, L.L_KNEE],
  [L.L_KNEE, L.L_ANKLE],
  [L.R_HIP, L.R_KNEE],
  [L.R_KNEE, L.R_ANKLE],
];

const $ = (id) => document.getElementById(id);

const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const video = $("video");
const scrubber = $("scrubber");
const loading = $("loading");
const loadingText = $("loading-text");
const loadingProgress = $("loading-progress");
const errorBanner = $("error-banner");
const summaryEl = $("summary");
const summaryList = $("summary-list");
const historyEl = $("history");
const historyList = $("history-list");
const stageEl = $("stage");
const sampleBadge = $("sample-badge");
const firstRunCta = $("first-run-cta");
const fileInput = $("file-input");

const playheadEls = {
  frame: $("metric-frame"),
};

const swingEls = {
  contact: $("metric-contact"),
  plane: $("metric-plane"),
  batspeed: $("metric-batspeed"),
  exitvelo: $("metric-exitvelo"),
};

/** @type {{ contactFrame: number, plane: number, batSpeed: number, exitVelo: number, mode: string } | null} */
let swingTotals = null;

let mode = "sample";
let animId = null;
let sampleT = 0;
let samplePlaying = true;
let samplePath = [];
let frameData = [];
let contactFrame = -1;
let poseLandmarker = null;
let videoUrl = null;
let analyzing = false;
let analysisCapNote = "";
/** True after the current sample run has been saved to session history. */
let sampleHistorySaved = false;

// ─── Swing totals (single source of truth) ───────────────────────────

function setSwingTotals(data, { persistHistory = true } = {}) {
  swingTotals = {
    contactFrame: data.contactFrame,
    plane: data.plane,
    batSpeed: data.batSpeed,
    exitVelo: data.exitVelo,
    mode: data.mode,
  };
  updateSwingTotalsUI();
  showSummary();
  if (persistHistory) {
    saveSessionToHistory();
  }
}

function clearSwingTotals() {
  swingTotals = null;
  updateSwingTotalsUI();
  summaryEl.classList.add("hidden");
}

function updatePlayheadUI(frame) {
  playheadEls.frame.textContent = frame != null ? `f${frame}` : "—";
}

function updateSwingTotalsUI() {
  if (!swingTotals) {
    swingEls.contact.textContent = "—";
    swingEls.plane.textContent = "—";
    swingEls.batspeed.textContent = "—";
    swingEls.exitvelo.textContent = "—";
    return;
  }

  swingEls.contact.textContent = `f${swingTotals.contactFrame}`;
  swingEls.plane.textContent = `${swingTotals.plane.toFixed(0)}°`;
  swingEls.batspeed.textContent = `${swingTotals.batSpeed.toFixed(0)} mph*`;
  swingEls.exitvelo.textContent = `${swingTotals.exitVelo.toFixed(0)} mph†`;
}

function showSummary() {
  if (!swingTotals) return;

  summaryEl.classList.remove("hidden");
  const items = [
    `Contact detected near frame ${swingTotals.contactFrame} (${swingTotals.mode} mode).`,
    `Swing plane angle: ~${swingTotals.plane.toFixed(0)}° from horizontal.`,
    `Peak bat speed proxy: ~${swingTotals.batSpeed.toFixed(0)} mph (*uncalibrated demo estimate).`,
    `Estimated exit velocity: ~${swingTotals.exitVelo.toFixed(0)} mph (†model placeholder, not measured).`,
    analysisCapNote || null,
    "Full bat/ball tracking with Roboflow RF-DETR is future work.",
  ].filter(Boolean);

  summaryList.innerHTML = items.map((t) => `<li>${t}</li>`).join("");
}

function computeSampleSwingTotals() {
  const steps = 120;
  let contactFrame = -1;
  let peakBatSpeed = 0;
  let peakPlane = 0;
  let peakExitVelo = 0;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const { phase } = samplePhase(t);
    const m = sampleMetrics(t, phase);

    if (m.contact != null) {
      contactFrame = m.contact;
    }
    if (m.batSpeed > peakBatSpeed) {
      peakBatSpeed = m.batSpeed;
      peakPlane = m.plane;
      peakExitVelo = m.exitVelo;
    }
  }

  return {
    contactFrame: contactFrame >= 0 ? contactFrame : 39,
    plane: peakPlane,
    batSpeed: peakBatSpeed,
    exitVelo: peakExitVelo,
    mode: "sample",
  };
}

// ─── Session history (localStorage) ──────────────────────────────────

function loadSessionHistory() {
  try {
    const raw = localStorage.getItem(SESSION_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function historyEntryMatches(a, b) {
  return (
    a.mode === b.mode &&
    a.contactFrame === b.contactFrame &&
    a.plane === b.plane &&
    a.batSpeed === b.batSpeed &&
    a.exitVelo === b.exitVelo
  );
}

function saveSessionToHistory() {
  if (!swingTotals) return;

  const entry = {
    ts: Date.now(),
    mode: swingTotals.mode,
    contactFrame: swingTotals.contactFrame,
    plane: Math.round(swingTotals.plane),
    batSpeed: Math.round(swingTotals.batSpeed),
    exitVelo: Math.round(swingTotals.exitVelo),
  };

  const history = loadSessionHistory();
  const latest = history[0];
  if (
    latest &&
    historyEntryMatches(latest, entry) &&
    entry.ts - latest.ts < SESSION_HISTORY_DEDUPE_MS
  ) {
    return;
  }

  history.unshift(entry);
  const trimmed = history.slice(0, SESSION_HISTORY_MAX);

  try {
    localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn("Could not save session history:", err);
  }

  renderSessionHistory();
}

function renderSessionHistory() {
  const history = loadSessionHistory();
  if (history.length === 0) {
    historyEl.classList.add("hidden");
    return;
  }

  historyEl.classList.remove("hidden");
  historyList.innerHTML = history
    .map((s) => {
      const when = new Date(s.ts).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      return `<li>
        <span class="history-when">${when}</span>
        <span class="history-mode">${s.mode}</span>
        <span class="history-stats">f${s.contactFrame} · ${s.plane}° · ${s.batSpeed} mph*</span>
      </li>`;
    })
    .join("");
}

function clearSessionHistory() {
  try {
    localStorage.removeItem(SESSION_HISTORY_KEY);
  } catch {
    /* ignore */
  }
  renderSessionHistory();
}

// ─── Loading & error UI ──────────────────────────────────────────────

function setLoading(active, message = "Analyzing frames…", progress = "") {
  loading.classList.toggle("hidden", !active);
  if (loadingText) loadingText.textContent = message;
  if (loadingProgress) loadingProgress.textContent = progress;
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.remove("hidden");
}

function clearError() {
  errorBanner.textContent = "";
  errorBanner.classList.add("hidden");
}

function resetFileInput() {
  fileInput.value = "";
}

// ─── First-run CTA ───────────────────────────────────────────────────

function initFirstRunCta() {
  if (!firstRunCta) return;

  const seen = localStorage.getItem(FIRST_RUN_KEY);
  if (seen) {
    firstRunCta.classList.add("hidden");
    return;
  }

  firstRunCta.classList.remove("hidden");
}

function dismissFirstRunCta() {
  try {
    localStorage.setItem(FIRST_RUN_KEY, "1");
  } catch {
    /* ignore */
  }
  firstRunCta.classList.add("hidden");
}

// ─── Sample mode animation ───────────────────────────────────────────

function samplePhase(t) {
  if (t < 0.15) return { phase: "stance", p: t / 0.15 };
  if (t < 0.35) return { phase: "load", p: (t - 0.15) / 0.2 };
  if (t < 0.72) return { phase: "swing", p: (t - 0.35) / 0.37 };
  return { phase: "follow", p: (t - 0.72) / 0.28 };
}

function samplePose(t, w, h) {
  const { phase, p } = samplePhase(t);
  const cx = w * 0.42;
  const baseY = h * 0.72;
  const scale = h * 0.38;

  const ease = (x) => x * x * (3 - 2 * x);
  const ep = ease(p);

  let loadRot = 0;
  let swingRot = 0;
  let batExt = 0.55;

  if (phase === "load") loadRot = ep * 0.35;
  if (phase === "swing") {
    loadRot = 0.35 * (1 - ep);
    swingRot = ep * 2.1;
    batExt = 0.55 + ep * 0.35;
  }
  if (phase === "follow") {
    swingRot = 2.1 + ep * 0.6;
    batExt = 0.9 - ep * 0.15;
  }

  const torsoRot = loadRot * 0.4 + swingRot * 0.15;
  const shoulderY = baseY - scale * 0.42;
  const hipY = baseY - scale * 0.12;

  const ls = {
    x: cx - scale * 0.14 * Math.cos(torsoRot),
    y: shoulderY + scale * 0.02 * Math.sin(torsoRot),
  };
  const rs = {
    x: cx + scale * 0.14 * Math.cos(torsoRot),
    y: shoulderY - scale * 0.02 * Math.sin(torsoRot),
  };
  const lh = { x: cx - scale * 0.1, y: hipY };
  const rh = { x: cx + scale * 0.1, y: hipY };

  const armAngle = -0.5 - loadRot + swingRot;
  const le = {
    x: ls.x + scale * 0.18 * Math.cos(armAngle - 0.3),
    y: ls.y + scale * 0.18 * Math.sin(armAngle - 0.3),
  };
  const re = {
    x: rs.x + scale * 0.16 * Math.cos(armAngle + 0.5),
    y: rs.y + scale * 0.16 * Math.sin(armAngle + 0.5),
  };
  const lw = {
    x: le.x + scale * 0.16 * Math.cos(armAngle + 0.2),
    y: le.y + scale * 0.16 * Math.sin(armAngle + 0.2),
  };
  const rw = {
    x: re.x + scale * 0.14 * Math.cos(armAngle + 0.8),
    y: re.y + scale * 0.14 * Math.sin(armAngle + 0.8),
  };

  const handMid = { x: (lw.x + rw.x) / 2, y: (lw.y + rw.y) / 2 };
  const batAngle = armAngle + 0.9 + swingRot * 0.3;
  const batTip = {
    x: handMid.x + scale * batExt * Math.cos(batAngle),
    y: handMid.y + scale * batExt * Math.sin(batAngle),
  };

  const lk = { x: lh.x - scale * 0.02, y: hipY + scale * 0.22 };
  const rk = { x: rh.x + scale * 0.02, y: hipY + scale * 0.22 };
  const la = { x: lk.x - scale * 0.02, y: baseY };
  const ra = { x: rk.x + scale * 0.02, y: baseY };

  const landmarks = [];
  landmarks[L.NOSE] = { x: cx, y: shoulderY - scale * 0.12 };
  landmarks[L.L_SHOULDER] = ls;
  landmarks[L.R_SHOULDER] = rs;
  landmarks[L.L_ELBOW] = le;
  landmarks[L.R_ELBOW] = re;
  landmarks[L.L_WRIST] = lw;
  landmarks[L.R_WRIST] = rw;
  landmarks[L.L_HIP] = lh;
  landmarks[L.R_HIP] = rh;
  landmarks[L.L_KNEE] = lk;
  landmarks[L.R_KNEE] = rk;
  landmarks[L.L_ANKLE] = la;
  landmarks[L.R_ANKLE] = ra;

  return { landmarks, batTip, handMid, phase, t };
}

function drawField(w, h) {
  ctx.fillStyle = "#0d1a12";
  ctx.fillRect(0, 0, w, h);

  const grd = ctx.createLinearGradient(0, h * 0.55, 0, h);
  grd.addColorStop(0, "#1a3d28");
  grd.addColorStop(1, "#0d2818");
  ctx.fillStyle = grd;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const y = h * 0.58 + i * (h * 0.07);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.font = "11px system-ui";
  ctx.fillText("SAMPLE MODE", 12, 20);
}

function drawSkeleton(landmarks, w, h) {
  ctx.strokeStyle = "rgba(94, 184, 255, 0.85)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  for (const [a, b] of SKELETON) {
    const p1 = landmarks[a];
    const p2 = landmarks[b];
    if (!p1 || !p2) continue;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  for (const pt of landmarks) {
    if (!pt) continue;
    ctx.fillStyle = "#5eb8ff";
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBatPath(path, w, h) {
  if (path.length < 2) return;

  ctx.strokeStyle = "rgba(245, 197, 66, 0.25)";
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();

  ctx.strokeStyle = "#f5c542";
  ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(245, 197, 66, 0.5)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawBat(handMid, batTip) {
  ctx.strokeStyle = "#f5c542";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(245, 197, 66, 0.6)";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(handMid.x, handMid.y);
  ctx.lineTo(batTip.x, batTip.y);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(batTip.x, batTip.y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawContactMarker(pt) {
  if (!pt) return;
  ctx.strokeStyle = "#3ecf6e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(62, 207, 110, 0.3)";
  ctx.fill();
}

function sampleMetrics(t, phase) {
  const frame = Math.round(t * 60);
  let plane = 28;
  let batSpeed = 0;
  let exitVelo = 0;

  if (phase === "swing" || phase === "follow") {
    const sp = phase === "swing" ? samplePhase(t).p : 1;
    plane = 24 + sp * 8;
    batSpeed = 45 + sp * 38;
    exitVelo = batSpeed * 0.62;
  } else if (phase === "load") {
    plane = 32;
    batSpeed = 12;
    exitVelo = 0;
  }

  const contact =
    phase === "swing" && samplePhase(t).p > 0.55 ? frame : null;

  return { frame, plane, batSpeed, exitVelo, contact };
}

function renderSample() {
  const w = canvas.width;
  const h = canvas.height;
  const pose = samplePose(sampleT, w, h);

  drawField(w, h);
  drawSkeleton(pose.landmarks, w, h);

  samplePath.push({ x: pose.batTip.x, y: pose.batTip.y });
  if (samplePath.length > 40) samplePath.shift();
  drawBatPath(samplePath, w, h);
  drawBat(pose.handMid, pose.batTip);

  const contactTotalsFrame = swingTotals?.contactFrame;
  if (
    contactTotalsFrame != null &&
    Math.round(sampleT * 60) === contactTotalsFrame
  ) {
    drawContactMarker(pose.batTip);
  } else if (
    pose.phase === "swing" &&
    samplePhase(sampleT).p > 0.55 &&
    !swingTotals
  ) {
    drawContactMarker(pose.batTip);
  }

  updatePlayheadUI(Math.round(sampleT * 60));
  scrubber.value = Math.round(sampleT * 100);

  if (samplePlaying) {
    sampleT += 0.008;
    if (sampleT >= 1) {
      sampleT = 0;
      samplePath = [];
      const totals = computeSampleSwingTotals();
      setSwingTotals(totals, { persistHistory: !sampleHistorySaved });
      sampleHistorySaved = true;
    }
  }
}

function sampleLoop() {
  if (mode !== "sample") return;
  renderSample();
  animId = requestAnimationFrame(sampleLoop);
}

// ─── Video + MediaPipe mode ──────────────────────────────────────────

async function initPose() {
  if (poseLandmarker) return poseLandmarker;
  setLoading(true, "Loading pose model…", "");
  const { PoseLandmarker, FilesetResolver } = await import(`${POSE_CDN}/vision_bundle.mjs`);
  const vision = await FilesetResolver.forVisionTasks(`${POSE_CDN}/wasm`);
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
    runningMode: "VIDEO",
    numPoses: 1,
  });
  return poseLandmarker;
}

function normToCanvas(lm, w, h) {
  return { x: lm.x * w, y: lm.y * h, z: lm.z, visibility: lm.visibility };
}

async function analyzeVideo() {
  if (!video.src || analyzing) return;
  analyzing = true;
  clearError();
  analysisCapNote = "";
  setLoading(true, "Analyzing frames…", "");
  frameData = [];
  contactFrame = -1;
  clearSwingTotals();

  try {
    const landmarker = await initPose();
    video.currentTime = 0;
    await new Promise((r) => {
      if (video.readyState >= 2) r();
      else video.addEventListener("loadeddata", r, { once: true });
    });

    const fullDuration = video.duration;
    if (!Number.isFinite(fullDuration) || fullDuration <= 0) {
      throw new Error("Could not read video duration — try a different clip.");
    }

    const cappedDuration = Math.min(fullDuration, MAX_ANALYSIS_SECONDS);
    if (fullDuration > MAX_ANALYSIS_SECONDS) {
      analysisCapNote = `Clip trimmed to first ${MAX_ANALYSIS_SECONDS}s for faster analysis (full clip: ${fullDuration.toFixed(1)}s).`;
    }

    const step = 1 / ANALYSIS_FPS;
    const totalFrames = Math.ceil(cappedDuration * ANALYSIS_FPS);
    let t = 0;
    let frameIdx = 0;

    while (t < cappedDuration) {
      setLoading(
        true,
        "Analyzing frames…",
        `Frame ${frameIdx + 1} of ~${totalFrames}`
      );

      video.currentTime = t;
      await new Promise((r) => {
        const onSeek = () => {
          video.removeEventListener("seeked", onSeek);
          r();
        };
        video.addEventListener("seeked", onSeek);
      });

      const result = landmarker.detectForVideo(video, performance.now());
      const w = canvas.width;
      const h = canvas.height;

      if (result.landmarks && result.landmarks[0]) {
        const raw = result.landmarks[0];
        const landmarks = raw.map((lm) => normToCanvas(lm, w, h));
        const lw = landmarks[L.L_WRIST];
        const rw = landmarks[L.R_WRIST];
        const handMid = { x: (lw.x + rw.x) / 2, y: (lw.y + rw.y) / 2 };
        const batLen = Math.hypot(rw.x - lw.x, rw.y - lw.y) * 2.8;
        const batAngle = Math.atan2(rw.y - lw.y, rw.x - lw.x);
        const batTip = {
          x: handMid.x + batLen * Math.cos(batAngle),
          y: handMid.y + batLen * Math.sin(batAngle),
        };

        frameData.push({ t, frameIdx, landmarks, batTip, handMid });
      }

      t += step;
      frameIdx++;
    }

    if (frameData.length < 3) {
      throw new Error(
        "Not enough pose data detected — use a side-view clip with the batter fully visible."
      );
    }

    computeVideoMetrics();
    scrubber.max = Math.max(frameData.length - 1, 0);
    scrubber.value = 0;
    setSwingTotals({
      contactFrame,
      plane: computedMetrics.plane,
      batSpeed: computedMetrics.batSpeed,
      exitVelo: computedMetrics.exitVelo,
      mode: "upload",
    });
    renderVideoFrame(0);
    playVideoLoop();
    $("mode-label").textContent = `Upload complete — ${frameData.length} frames analyzed`;
  } catch (err) {
    console.error("Analysis failed:", err);
    const msg =
      err instanceof Error
        ? err.message
        : "Analysis failed — try another clip or use sample mode.";
    showError(msg);
    $("mode-label").textContent = "Upload failed — try sample mode or another clip";
    setSampleMode();
  } finally {
    analyzing = false;
    setLoading(false);
    resetFileInput();
  }
}

let computedMetrics = { plane: 0, batSpeed: 0, exitVelo: 0 };

function computeVideoMetrics() {
  if (frameData.length < 3) return;

  let maxVel = 0;
  let maxVelIdx = 0;
  const batTips = frameData.map((f) => f.batTip);

  for (let i = 1; i < batTips.length; i++) {
    const dt = frameData[i].t - frameData[i - 1].t;
    if (dt <= 0) continue;
    const dx = batTips[i].x - batTips[i - 1].x;
    const dy = batTips[i].y - batTips[i - 1].y;
    const vel = Math.hypot(dx, dy) / dt;
    if (vel > maxVel) {
      maxVel = vel;
      maxVelIdx = i;
    }
  }

  contactFrame = frameData[maxVelIdx]?.frameIdx ?? -1;

  const cf = frameData[Math.max(0, maxVelIdx - 2)];
  const ct = frameData[maxVelIdx];
  if (cf && ct) {
    const dx = ct.batTip.x - cf.batTip.x;
    const dy = ct.batTip.y - cf.batTip.y;
    computedMetrics.plane = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));
  }

  const pxPerSec = maxVel;
  const scaleFactor = 0.18;
  computedMetrics.batSpeed = Math.min(pxPerSec * scaleFactor, 95);
  computedMetrics.exitVelo = computedMetrics.batSpeed * 0.58;
}

function renderVideoFrame(idx) {
  const frame = frameData[idx];
  if (!frame) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  video.currentTime = frame.t;
  ctx.drawImage(video, 0, 0, w, h);

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, w, 28);
  ctx.fillStyle = "#fff";
  ctx.font = "11px system-ui";
  ctx.fillText("UPLOAD MODE", 12, 18);

  drawSkeleton(frame.landmarks, w, h);

  const pathStart = Math.max(0, idx - 25);
  const path = frameData.slice(pathStart, idx + 1).map((f) => f.batTip);
  drawBatPath(path, w, h);
  drawBat(frame.handMid, frame.batTip);

  if (frame.frameIdx === contactFrame) {
    drawContactMarker(frame.batTip);
  }

  updatePlayheadUI(frame.frameIdx);
}

let videoPlayTimer = null;
let videoFrameIdx = 0;

function playVideoLoop() {
  if (mode !== "video" || frameData.length === 0) return;
  stopVideoLoop();

  const tick = () => {
    renderVideoFrame(videoFrameIdx);
    scrubber.value = videoFrameIdx;
    videoFrameIdx++;
    if (videoFrameIdx >= frameData.length) {
      videoFrameIdx = 0;
    }
    videoPlayTimer = window.setTimeout(tick, PLAYBACK_INTERVAL_MS);
  };
  tick();
}

function stopVideoLoop() {
  if (videoPlayTimer != null) {
    clearTimeout(videoPlayTimer);
    videoPlayTimer = null;
  }
}

// ─── Mode switching ──────────────────────────────────────────────────

function updateModeAffordance() {
  const isSample = mode === "sample";
  stageEl.classList.toggle("stage--sample", isSample);
  stageEl.classList.toggle("stage--upload", !isSample);
  sampleBadge.classList.toggle("hidden", !isSample);
  $("btn-sample").setAttribute("aria-pressed", String(isSample));
}

function setSampleMode() {
  mode = "sample";
  sampleT = 0;
  samplePath = [];
  samplePlaying = true;
  sampleHistorySaved = false;
  analysisCapNote = "";
  clearSwingTotals();
  clearError();
  stopVideoLoop();
  video.hidden = true;
  video.pause();
  if (videoUrl) {
    URL.revokeObjectURL(videoUrl);
    videoUrl = null;
  }
  video.removeAttribute("src");
  $("mode-label").textContent = "Sample mode — no upload needed";
  scrubber.max = 100;
  scrubber.value = 0;
  updateModeAffordance();
  resetFileInput();
  cancelAnimationFrame(animId);
  sampleLoop();
}

async function setVideoMode(file) {
  if (analyzing) return;

  const maxSizeMb = 80;
  if (file.size > maxSizeMb * 1024 * 1024) {
    showError(`File too large (${Math.round(file.size / 1024 / 1024)} MB). Try a clip under ${maxSizeMb} MB.`);
    resetFileInput();
    return;
  }

  const allowed = ["video/mp4", "video/webm", "video/quicktime", "video/mov"];
  if (file.type && !allowed.includes(file.type)) {
    showError(`Unsupported format (${file.type || "unknown"}). Use mp4, webm, or mov.`);
    resetFileInput();
    return;
  }

  dismissFirstRunCta();
  mode = "video";
  samplePlaying = false;
  cancelAnimationFrame(animId);
  stopVideoLoop();
  clearSwingTotals();
  clearError();
  $("mode-label").textContent = `Loading: ${file.name}`;
  updateModeAffordance();

  if (videoUrl) URL.revokeObjectURL(videoUrl);
  videoUrl = URL.createObjectURL(file);
  video.src = videoUrl;
  video.hidden = false;

  video.onloadedmetadata = () => {
    const aspect = video.videoWidth / video.videoHeight;
    canvas.width = 640;
    canvas.height = Math.round(640 / aspect);
    analyzeVideo();
  };

  video.onerror = () => {
    showError("Could not load video — file may be corrupted or unsupported.");
    resetFileInput();
    setSampleMode();
  };
}

// ─── Scrubber accent ─────────────────────────────────────────────────

function setScrubberActive(active) {
  scrubber.classList.toggle("scrubber-active", active);
}

// ─── Event listeners ─────────────────────────────────────────────────

$("btn-sample").addEventListener("click", () => {
  dismissFirstRunCta();
  setSampleMode();
});

$("btn-first-run").addEventListener("click", () => {
  dismissFirstRunCta();
  setSampleMode();
});

$("btn-dismiss-cta").addEventListener("click", dismissFirstRunCta);

$("btn-clear-history").addEventListener("click", clearSessionHistory);

fileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) setVideoMode(file);
});

scrubber.addEventListener("pointerdown", () => setScrubberActive(true));

scrubber.addEventListener("input", () => {
  if (mode === "sample") {
    sampleT = Number(scrubber.value) / 100;
    samplePlaying = false;
    samplePath = [];
    for (let i = 0; i <= sampleT * 40; i++) {
      const t = i / 40;
      const pose = samplePose(t, canvas.width, canvas.height);
      samplePath.push({ x: pose.batTip.x, y: pose.batTip.y });
    }
    renderSample();
  } else if (frameData.length) {
    stopVideoLoop();
    videoFrameIdx = Number(scrubber.value);
    renderVideoFrame(videoFrameIdx);
  }
});

scrubber.addEventListener("pointerup", () => setScrubberActive(false));
scrubber.addEventListener("change", () => setScrubberActive(false));

$("btn-replay").addEventListener("click", () => {
  clearSwingTotals();
  if (mode === "sample") {
    sampleT = 0;
    samplePath = [];
    samplePlaying = true;
  } else if (frameData.length) {
    videoFrameIdx = 0;
    setSwingTotals(
      {
        contactFrame,
        plane: computedMetrics.plane,
        batSpeed: computedMetrics.batSpeed,
        exitVelo: computedMetrics.exitVelo,
        mode: "upload",
      },
      { persistHistory: false }
    );
    playVideoLoop();
  }
});

// ─── Boot ────────────────────────────────────────────────────────────

document.documentElement.dataset.ready = "true";
initFirstRunCta();
renderSessionHistory();
setSampleMode();
