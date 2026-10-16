import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { formatMonthly, loadCatalog, parseCatalog, priceLabel } from "../src/data/catalog.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function sampleTool(overrides = {}) {
  return {
    id: "bolt",
    name: "Bolt",
    vendor: "Bolt",
    category: "app-builder",
    homepage: "https://bolt.new",
    pricing_url: "https://bolt.new/pricing",
    status_url: "https://status.bolt.new",
    status_api: "https://status.bolt.new/api/v2/status.json",
    affiliate_url: null,
    featured_until: null,
    verification: "verified",
    source_url: "https://bolt.new/pricing",
    checked_at: "2026-10-16",
    notes: null,
    ...overrides,
  };
}

function samplePlan(overrides = {}) {
  return {
    tool_id: "bolt",
    name: "Pro",
    price_monthly: 25,
    price_annual: null,
    currency: "USD",
    credits_or_limit: null,
    limit_unit: null,
    free_tier: false,
    notes: null,
    captured_at: "2026-10-16",
    verification: "verified",
    source_url: "https://bolt.new/pricing",
    checked_at: "2026-10-16",
    ...overrides,
  };
}

function catalog(overrides = {}) {
  return {
    tools: [sampleTool()],
    plans: [samplePlan()],
    price_changes: [],
    status_checks: [],
    snapshots: [],
    comparisons: [
      { id: "cursor-vs-windsurf", left: "bolt", right: "bolt", title: "bad" },
    ],
    ...overrides,
  };
}

test("rejects an unverified plan that carries a price", () => {
  assert.throws(
    () =>
      parseCatalog(
        catalog({
          plans: [samplePlan({ verification: "unverified", price_monthly: 20, source_url: null, checked_at: null })],
          comparisons: [
            { id: "cursor-vs-windsurf", left: "bolt", right: "bolt", title: "Cursor vs Windsurf" },
            { id: "lovable-vs-bolt", left: "bolt", right: "bolt", title: "Lovable vs Bolt" },
          ],
        }),
      ),
    /unverified plans cannot carry a price/,
  );
});

test("rejects a verified plan with no source", () => {
  assert.throws(
    () =>
      parseCatalog(
        catalog({
          plans: [samplePlan({ source_url: null })],
          comparisons: [
            { id: "cursor-vs-windsurf", left: "bolt", right: "bolt", title: "Cursor vs Windsurf" },
            { id: "lovable-vs-bolt", left: "bolt", right: "bolt", title: "Lovable vs Bolt" },
          ],
        }),
      ),
    /verified plans need a source URL/,
  );
});

test("priceLabel hides numbers on unverified plans", () => {
  const plan = samplePlan({
    verification: "unverified",
    price_monthly: null,
    currency: null,
    source_url: null,
    checked_at: null,
  });
  assert.equal(formatMonthly(plan), null);
  assert.equal(priceLabel(plan), "No captured price");
  assert.equal(priceLabel(samplePlan({ price_monthly: null })), "No public price");
  assert.equal(priceLabel(samplePlan()), "$25/mo");
});

test("committed catalog matches the 2026-10-16 capture", async () => {
  const data = await loadCatalog(root);
  assert.deepEqual(
    data.tools.map((tool) => tool.id),
    [
      "lovable",
      "bolt",
      "replit",
      "cursor",
      "claude-code",
      "v0",
      "windsurf",
      "github-copilot",
      "base44",
      "devin",
    ],
  );
  const price = (toolId, name) => {
    const plan = data.plansFor(toolId).find((item) => item.name === name);
    assert.ok(plan, `${toolId} ${name}`);
    return plan.price_monthly;
  };
  assert.equal(price("lovable", "Pro"), 25);
  assert.equal(price("lovable", "Business"), 50);
  assert.equal(price("bolt", "Pro"), 25);
  assert.equal(price("replit", "Core"), 20);
  assert.equal(price("cursor", "Plus"), 8);
  assert.equal(price("cursor", "Premium"), 30);
  assert.equal(price("claude-code", "Pro"), 20);
  assert.equal(data.plansFor("claude-code").find((plan) => plan.name === "Pro").price_annual, 200);
  assert.equal(price("v0", "Plus"), 30);
  assert.equal(price("windsurf", "Pro"), 20);
  assert.equal(price("github-copilot", "Pro"), 10);
  assert.equal(price("base44", "Starter"), 16);
  assert.equal(data.tool("devin").verification, "unverified");
  assert.equal(data.plansFor("devin").length, 0);
  assert.equal(data.priceChanges.length, 0);
  for (const plan of data.plans) {
    if (plan.verification === "verified") {
      assert.match(plan.source_url, /^https:\/\//);
      assert.equal(plan.checked_at, "2026-10-16");
    }
  }
});
