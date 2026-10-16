import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPlanText, normalizePlanText, planTextDiff } from "./pricing-text.mjs";

test("normalizePlanText keeps a price and drops a timestamp", () => {
  const text = normalizePlanText("Pro   $25 / month\n\n\nseen 2026-10-16T00:30:00Z\n");
  assert.equal(text, "Pro $25 / month\n\nseen [time]");
  assert.equal(hashPlanText(text), hashPlanText(text));
});

test("hash ignores a line with no price and keeps a price change", () => {
  assert.equal(hashPlanText("Pro $25\nClaude Code included"), hashPlanText("Pro $25"));
  assert.equal(hashPlanText("$\n25\n/mo"), hashPlanText("$25/mo"));
  assert.notEqual(hashPlanText("Pro $25"), hashPlanText("Pro $30"));
  assert.equal(
    hashPlanText("$10 per month\n$15 monthly total credits for Pro"),
    hashPlanText("$10 per month"),
  );
});

test("planTextDiff names the changed line", () => {
  const diff = planTextDiff("Pro $25", "Pro $30");
  assert.deepEqual(diff.added, ["Pro $30"]);
  assert.deepEqual(diff.removed, ["Pro $25"]);
});
