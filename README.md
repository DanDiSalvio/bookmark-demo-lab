# bookmark-demo-lab

Morning bookmark demos for Dan's Demo Lab pipeline.

## Today's demo: Baseball Swing Lab

**Branch:** `demo/2026-09-16-baseball-roboflow`

Film or upload a baseball swing on your phone, get pose + bat/ball overlays, and see swing metrics — all in the browser.

### What it does

- **Sample mode** — animated batter with bat-path overlay (no camera, no API key)
- **Record swing** — live camera capture on iPhone Safari (≤10 s, front/back flip)
- **Upload clip** — mp4/webm/mov from Photos or desktop
- **Roboflow AI** — bat/ball object detection via hosted `detect.roboflow.com` API
- **MediaPipe Pose** — body skeleton fallback + bat-path proxy from wrists
- **Metrics** — single `swingTotals` object: contact frame, swing plane, bat speed proxy, exit velo estimate
- **Session history** — last 5 swings in `localStorage`

### Roboflow models (Universe hosted detect API)

| Role | Model ID | Classes |
|------|----------|---------|
| **Primary** (default) | `mlb-sbfxd/baseball-and-baseball-bat/1` | Baseball, BaseballBat |
| **Alt fallback** | `baseball-v1/baseball-and-bat/2` | Ball, Bat |
| **Optional pose** | `swingapi/baseball-pose-4y9w6/4` | Keypoints |

- [Primary on Universe](https://universe.roboflow.com/mlb-sbfxd/baseball-and-baseball-bat)
- [Alt on Universe](https://universe.roboflow.com/baseball-v1/baseball-and-bat)
- [Pose on Universe](https://universe.roboflow.com/swingapi/baseball-pose-4y9w6)

Inference: `POST https://detect.roboflow.com/<model_id>?api_key=...` with multipart image. Proxied through `/api/roboflow` so the secret key never ships to the browser.

### Environment variables (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `ROBOFLOW_API_KEY` | No* | Private API key from [Roboflow Settings](https://app.roboflow.com/settings/api). Recommended — proxied via `/api/roboflow`. |
| `NEXT_PUBLIC_ROBOFLOW_PUBLISHABLE_KEY` | No | Publishable key (`rf_...`) for direct browser calls to Universe public models. Only used when secret key is absent. |
| `ROBOFLOW_MODEL_ID` | No | Override primary detect model (default: `mlb-sbfxd/baseball-and-baseball-bat/1`) |
| `ROBOFLOW_ALT_MODEL_ID` | No | Alt detect model (default: `baseball-v1/baseball-and-bat/2`) |
| `ROBOFLOW_POSE_MODEL_ID` | No | Pose model (default: `swingapi/baseball-pose-4y9w6/4`) |
| `ROBOFLOW_POSE_ENABLED` | No | Set `false` to disable pose inference |

\* Without any key, sample mode and MediaPipe pose tracking still work. A banner says **"Add ROBOFLOW_API_KEY to unlock AI detect"**.

**Vercel setup:**

1. Project → Settings → Environment Variables
2. Add `ROBOFLOW_API_KEY` for Preview + Production (recommended)
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
6. Look for **bat/ball bounding boxes** (gold/white) when Roboflow is connected.
7. **Fallback:** tap **Upload clip** and pick a swing video from Photos.

### Architecture

```
Browser (app.js)
  ├── Sample animation (no backend)
  ├── MediaPipe Pose (CDN, client-side fallback)
  ├── getUserMedia + MediaRecorder (iOS Safari)
  └── Roboflow detect.roboflow.com
        ├── via /api/roboflow proxy (ROBOFLOW_API_KEY — recommended)
        └── or direct (NEXT_PUBLIC_ROBOFLOW_PUBLISHABLE_KEY only)
```

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
