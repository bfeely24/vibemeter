# VibeMeter

VibeMeter tracks public prices, limits, and status for 10 AI coding tools.

The data lives in `data/*.json`. A price is published only when `verification` is `verified` and the plan has a source URL plus the date it was checked. Unverified plans keep `price_monthly`, `price_annual`, and `credits_or_limit` null.

The site is an Astro build. `site` is `https://bfeely24.github.io` and `base` is `/vibemeter`.

```
npm ci
npm test
npm run build
node scripts/verify-preview.mjs
```
