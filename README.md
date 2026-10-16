# VibeMeter

VibeMeter tracks public prices, limits, and status for 10 AI coding tools.

The data lives in `data/*.json`. A price is published only when `verification` is `verified` and the plan has a source URL plus the date it was checked. Unverified plans keep `price_monthly`, `price_annual`, and `credits_or_limit` null.

```
node --test scripts/catalog.test.mjs
node scripts/validate-data.mjs
```
