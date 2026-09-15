# bookmark-demo-lab

Morning bookmark demos for Dan's Demo Lab pipeline.

## Today's demo: AI Logo Lab

**Branch:** `demo/2026-09-15-ai-logo`

Inspired by [open-source AI logo generator using Flux](https://x.com/tom_doerr/status/1894189645811888324) — this slice is a **Flux-inspired generative logo playground** that runs entirely in the browser.

### What it demos

- **Stepped create flow** — name → style → palette
- **Brand + tagline inputs** — type a name and optional tagline (AL-1 validation)
- **Visual style cards** — six distinct treatments of the same brand name (geometric, wordmark, monogram, badge, gradient, minimal)
- **Neutral canvas + one accent** — clean SaaS logo-maker look (no AI-purple glow)
- **Color palettes** — five presets plus a custom accent picker
- **Generate** — produces 6 distinct SVG logo candidates (one per style)
- **Mockup previews** — business card, coffee cup, and letterhead context on each result
- **Preview & download** — click a candidate to enlarge; **SVG primary**, PNG secondary
- **Recent history** — last 5 generations in `localStorage`

All processing runs client-side. No backend, no Flux API, no secrets. Real Flux image generation can be a follow-up.

### Try locally

```bash
npx serve .
# open http://localhost:3000
```

Enter a brand name, pick a style and palette, then click **Generate logos**. Click any candidate to preview and download.

### Prior work

**Baseball Swing Lab** (Sep 15 overnight pass) lives on `main` and branch `demo/2026-09-15-baseball-overnight`. Earlier: `demo/2026-09-14-baseball-swing`. Phone-camera swing coach with MediaPipe Pose — see git history on those branches.

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
