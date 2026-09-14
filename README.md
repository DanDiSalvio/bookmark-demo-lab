# bookmark-demo-lab

Morning bookmark demos for Dan’s Demo Lab pipeline.

Each morning, Demo Lab picks one interesting X Bookmark, builds a minimal working demo on a branch, and ships a Cloudflare Pages preview so the tech can be tried in the browser.

## How it works

1. **Source** — one buildable item from X Bookmarks (libs, UI tricks, APIs, tools).
2. **Build** — Cursor cloud agent implements a small demo on a dated branch (`demo/YYYY-MM-DD-<slug>`).
3. **Preview** — Cloudflare Pages deploys every branch/PR to a preview URL.
4. **Deliver** — Demo Lab sends the preview link with a short note on what was bookmarked.

## Local

Static site at the repo root. Open `index.html` or:

```bash
npx serve .
```

## Cloudflare Pages

- **Production:** `main` → production Pages URL
- **Previews:** every other branch → `https://<branch-slug>.<project>.pages.dev`
- Build: none (static assets)
- Output directory: `/` (repo root)

Do not create paid Cloudflare plans without explicit OK.
