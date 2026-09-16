# bookmark-demo-lab

Morning bookmark demos for Dan's Demo Lab pipeline.

## Today's demo: Baseball Swing Lab

**Branch:** `demo/2026-09-16-baseball-roboflow`

Film or upload a baseball swing on your phone, get pose + bat/ball overlays, and see swing metrics — all in the browser.

### What it does

- **Sample mode** — animated batter with bat-path overlay (no camera, no API key)
- **Record swing** — live camera capture on iPhone Safari (≤10 s, front/back flip)
- **Upload clip** — mp4/webm/mov from Photos or desktop
- **Roboflow AI** — bat/ball object detection on analyzed frames (when `ROBOFLOW_API_KEY` is set)
- **MediaPipe Pose** — body skeleton + bat-path proxy from wrists
- **Metrics** — single `swingTotals` object: contact frame, swing plane, bat speed proxy, exit velo estimate
- **Session history** — last 5 swings in `localStorage`

### Roboflow model

Default model: **`baseball-detection/baseball-tracker-vp0ko/1`** (Roboflow Universe — baseball tracker, object detection).

Override with `ROBOFLOW_MODEL_ID` (e.g. `baseball-v1/baseball-and-bat/1` for Ball + Bat classes).

### Environment variables (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `ROBOFLOW_API_KEY` | No* | Private API key from [Roboflow Settings](https://app.roboflow.com/settings/api). Enables bat/ball detection via `/api/roboflow` proxy. |
| `ROBOFLOW_MODEL_ID` | No | Model ID (default: `baseball-detection/baseball-tracker-vp0ko/1`) |

\* Without the key, sample mode and MediaPipe pose tracking still work. A banner explains how to connect Roboflow.

**Vercel setup:**

1. Project → Settings → Environment Variables
2. Add `ROBOFLOW_API_KEY` for Preview + Production
3. Redeploy the branch preview

Copy `.env.example` for local reference.

### Try locally

**Static only (sample mode, no Roboflow):**

```bash
npx serve .
# open http://localhost:3000
```

**Full stack (API routes + Roboflow):**

```bash
cp .env.example .env.local
# edit .env.local with your ROBOFLOW_API_KEY

npx vercel dev
# open http://localhost:3000
```

> Camera recording requires HTTPS. Use the Vercel preview URL on your phone, or `vercel dev` with a tunnel.

### iOS Safari test steps

1. Open the **Vercel preview URL** on your iPhone (HTTPS required for camera).
2. Tap **Try sample** first to confirm metrics load without permissions.
3. Tap **Record swing** → Allow camera when prompted.
4. Frame the batter from the **side**; tap **Start** (auto-stops at 10 s).
5. Wait for analysis → scrub frames, read **At this frame** vs **This swing** metrics.
6. **Fallback:** tap **Upload clip** and pick a swing video from Photos.
7. If Roboflow is connected, look for bat/ball bounding boxes and the Detections metric.

### Architecture

```
Browser (app.js)
  ├── Sample animation (no backend)
  ├── MediaPipe Pose (CDN, client-side)
  ├── getUserMedia + MediaRecorder (iOS Safari)
  └── POST /api/roboflow  →  Vercel serverless proxy  →  serverless.roboflow.com
```

The API key never ships to the client.

---

## How Demo Lab works

1. **Source** — one buildable item from X Bookmarks.
2. **Build** — Cursor cloud agent on a dated branch (`demo/YYYY-MM-DD-<slug>`).
3. **Preview** — Vercel deploys every branch to a preview URL.
4. **Deliver** — Demo Lab sends the preview link with a short note.

## Deployment

- **Production:** `main` → production URL
- **Previews:** `demo/*` branches → `https://bookmark-demo-lab-git-<branch-slug>-dandisalvios-projects.vercel.app`

Static site at repo root. Vercel serves `/api/*` as serverless functions.
