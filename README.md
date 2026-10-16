# VibeMeter

VibeMeter tracks public prices, limits, and status for 10 AI coding tools.

The data lives in `data/*.json`. A price is published only when `verification` is `verified` and the plan has a source URL plus the date it was checked. Unverified plans keep `price_monthly`, `price_annual`, and `credits_or_limit` null.

The site is an Astro build. `site` is `https://bfeely24.github.io` and `base` is `/vibemeter`. Pushes to `main` upload that build to GitHub Pages. `node scripts/scrape-pricing.mjs --dry-run` reads pricing pages and does not edit `data/plans.json`. Replit's pricing URL returned HTTP 403 to that browser, so it has no text baseline.

```
npm ci
npm test
npm run build
node scripts/verify-preview.mjs
```
