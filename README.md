# bookmark-demo-lab

Morning bookmark demos for Dan's Demo Lab pipeline.

## Today's demo: Baseball Swing Lab

**Branch:** `demo/2026-09-15-baseball-overnight` (overnight refinement)

### Overnight pass (Sep 15)

- **Upload robustness** — long clips capped to first 10 s; file input resets for same-file re-select; progress + clearer error messages; throttled playback (~10 fps)
- **swingTotals** — single source of truth for session metrics; demo-estimate badges and footnotes; last-5 session history in `localStorage`
- **Polish** — metric card accent borders (BS-6), footer contrast (BS-7), first-run CTA, mobile layout pass

**Earlier branch:** `demo/2026-09-14-baseball-swing`

Inspired by [tennis CV coaching via phone video](https://x.com/measure_plan/status/2097715692069859769) — this slice applies the same idea to **hitting a baseball**.

### What it demos

- **Sample mode** — animated batter with bat-path overlay and live metrics (no upload needed)
- **Upload mode** — drop an mp4/webm clip; MediaPipe Pose tracks body + approximates bat path from wrists
- **Metrics panel** — contact frame estimate, swing plane angle, bat speed proxy, exit-velo placeholder (all labeled as demo estimates)
- **Session summary** — short recap after each swing cycle

All processing runs client-side in the browser. No backend, no API keys.

### Try locally

```bash
npx serve .
# open http://localhost:3000
```

Click **Sample swing** for the built-in demo, or **Upload video** for your own clip.

### Future work

- Roboflow RF-DETR bat/ball detection for real contact point
- Calibrated exit velocity from tracked ball flight
- Side-by-side comparison across swings

---

## How Demo Lab works

1. **Source** — one buildable item from X Bookmarks (libs, UI tricks, APIs, tools).
2. **Build** — Cursor cloud agent implements a small demo on a dated branch (`demo/YYYY-MM-DD-<slug>`).
3. **Preview** — Vercel deploys every branch to a preview URL.
4. **Deliver** — Demo Lab sends the preview link with a short note on what was bookmarked.

## Deployment

- **Production:** `main` → production URL
- **Previews:** `demo/*` branches → `https://bookmark-demo-lab-git-<branch-slug>-dandisalvios-projects.vercel.app`

Static site at repo root — no build step.
