const CATEGORIES = new Set(["app-builder", "IDE", "CLI agent"]);
const VERIFICATIONS = new Set(["verified", "unverified"]);
const LIMIT_UNITS = new Set(["messages", "credits", "tokens", "requests"]);
const INDICATORS = new Set(["none", "minor", "major", "critical"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_COMPARISONS = ["cursor-vs-windsurf", "lovable-vs-bolt"];

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

function isNull(value) {
  return value === null;
}

function requireString(value, path) {
  if (typeof value !== "string" || value.length === 0) {
    fail(path, "expected a non-empty string");
  }
  return value;
}

function requireUrl(value, path) {
  const url = requireString(value, path);
  if (!url.startsWith("https://")) {
    fail(path, "expected an https URL");
  }
  return url;
}

function optionalUrl(value, path) {
  if (isNull(value)) return null;
  return requireUrl(value, path);
}

function optionalString(value, path) {
  if (isNull(value)) return null;
  return requireString(value, path);
}

function requireDate(value, path) {
  const date = requireString(value, path);
  if (!DATE.test(date)) {
    fail(path, "expected YYYY-MM-DD");
  }
  return date;
}

function optionalDate(value, path) {
  if (isNull(value)) return null;
  return requireDate(value, path);
}

function requireVerification(value, path) {
  if (!VERIFICATIONS.has(value)) {
    fail(path, "expected verified or unverified");
  }
  return value;
}

function requireMoney(value, path) {
  if (isNull(value)) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail(path, "expected a non-negative number or null");
  }
  return value;
}

function parseTools(value) {
  if (!Array.isArray(value)) fail("tools", "expected an array");
  const tools = value.map((row, index) => {
    const path = `tools[${index}]`;
    if (row === null || typeof row !== "object") fail(path, "expected an object");
    const verification = requireVerification(row.verification, `${path}.verification`);
    const tool = {
      id: requireString(row.id, `${path}.id`),
      name: requireString(row.name, `${path}.name`),
      vendor: requireString(row.vendor, `${path}.vendor`),
      category: requireString(row.category, `${path}.category`),
      homepage: requireUrl(row.homepage, `${path}.homepage`),
      pricing_url: requireUrl(row.pricing_url, `${path}.pricing_url`),
      status_url: requireUrl(row.status_url, `${path}.status_url`),
      status_api: requireUrl(row.status_api, `${path}.status_api`),
      affiliate_url: optionalUrl(row.affiliate_url, `${path}.affiliate_url`),
      featured_until: optionalDate(row.featured_until, `${path}.featured_until`),
      verification,
      source_url: optionalUrl(row.source_url, `${path}.source_url`),
      checked_at: optionalDate(row.checked_at, `${path}.checked_at`),
      notes: optionalString(row.notes, `${path}.notes`),
    };
    if (!CATEGORIES.has(tool.category)) {
      fail(`${path}.category`, "expected app-builder, IDE, or CLI agent");
    }
    if (verification === "verified") {
      if (tool.source_url === null) fail(`${path}.source_url`, "verified tools need a source URL");
      if (tool.checked_at === null) fail(`${path}.checked_at`, "verified tools need a checked date");
    }
    return tool;
  });
  const ids = new Set();
  for (const tool of tools) {
    if (ids.has(tool.id)) fail(`tools.${tool.id}`, "duplicate id");
    ids.add(tool.id);
  }
  return tools;
}

function parsePlans(value, toolIds) {
  if (!Array.isArray(value)) fail("plans", "expected an array");
  return value.map((row, index) => {
    const path = `plans[${index}]`;
    if (row === null || typeof row !== "object") fail(path, "expected an object");
    const verification = requireVerification(row.verification, `${path}.verification`);
    const plan = {
      tool_id: requireString(row.tool_id, `${path}.tool_id`),
      name: requireString(row.name, `${path}.name`),
      price_monthly: requireMoney(row.price_monthly, `${path}.price_monthly`),
      price_annual: requireMoney(row.price_annual, `${path}.price_annual`),
      currency: optionalString(row.currency, `${path}.currency`),
      credits_or_limit: requireMoney(row.credits_or_limit, `${path}.credits_or_limit`),
      limit_unit: optionalString(row.limit_unit, `${path}.limit_unit`),
      free_tier: row.free_tier,
      notes: optionalString(row.notes, `${path}.notes`),
      captured_at: requireDate(row.captured_at, `${path}.captured_at`),
      verification,
      source_url: optionalUrl(row.source_url, `${path}.source_url`),
      checked_at: optionalDate(row.checked_at, `${path}.checked_at`),
    };
    if (!toolIds.has(plan.tool_id)) fail(`${path}.tool_id`, "unknown tool");
    if (typeof plan.free_tier !== "boolean") fail(`${path}.free_tier`, "expected a boolean");
    if (plan.limit_unit !== null && !LIMIT_UNITS.has(plan.limit_unit)) {
      fail(`${path}.limit_unit`, "expected messages, credits, tokens, requests, or null");
    }
    if (plan.credits_or_limit !== null && plan.limit_unit === null) {
      fail(`${path}.limit_unit`, "a limit needs a unit");
    }
    if ((plan.price_monthly !== null || plan.price_annual !== null) && plan.currency !== "USD") {
      fail(`${path}.currency`, "a price needs currency USD");
    }
    if (verification === "unverified") {
      if (plan.price_monthly !== null || plan.price_annual !== null || plan.credits_or_limit !== null) {
        fail(path, "unverified plans cannot carry a price or limit");
      }
    }
    if (verification === "verified") {
      if (plan.source_url === null) fail(`${path}.source_url`, "verified plans need a source URL");
      if (plan.checked_at === null) fail(`${path}.checked_at`, "verified plans need a checked date");
    }
    return plan;
  });
}

function parsePriceChanges(value, toolIds) {
  if (!Array.isArray(value)) fail("price_changes", "expected an array");
  return value.map((row, index) => {
    const path = `price_changes[${index}]`;
    if (row === null || typeof row !== "object") fail(path, "expected an object");
    const change = {
      tool_id: requireString(row.tool_id, `${path}.tool_id`),
      plan: requireString(row.plan, `${path}.plan`),
      field: requireString(row.field, `${path}.field`),
      old: row.old ?? null,
      new: row.new ?? null,
      detected_at: requireString(row.detected_at, `${path}.detected_at`),
      source_snapshot_url: optionalUrl(row.source_snapshot_url, `${path}.source_snapshot_url`),
      confirmed: row.confirmed,
    };
    if (!toolIds.has(change.tool_id)) fail(`${path}.tool_id`, "unknown tool");
    if (typeof change.confirmed !== "boolean") fail(`${path}.confirmed`, "expected a boolean");
    return change;
  });
}

function parseStatusChecks(value, toolIds) {
  if (!Array.isArray(value)) fail("status_checks", "expected an array");
  return value.map((row, index) => {
    const path = `status_checks[${index}]`;
    if (row === null || typeof row !== "object") fail(path, "expected an object");
    const indicator = row.indicator;
    if (indicator !== null && !INDICATORS.has(indicator)) {
      fail(`${path}.indicator`, "expected none, minor, major, critical, or null");
    }
    const check = {
      tool_id: requireString(row.tool_id, `${path}.tool_id`),
      checked_at: requireString(row.checked_at, `${path}.checked_at`),
      indicator,
      incident_title: optionalString(row.incident_title, `${path}.incident_title`),
      description: optionalString(row.description, `${path}.description`),
      http_status: row.http_status,
      source_url: requireUrl(row.source_url, `${path}.source_url`),
    };
    if (!toolIds.has(check.tool_id)) fail(`${path}.tool_id`, "unknown tool");
    if (typeof check.http_status !== "number") fail(`${path}.http_status`, "expected a number");
    if (check.indicator === null && check.incident_title !== null) {
      fail(`${path}.incident_title`, "an unknown status cannot claim an incident");
    }
    return check;
  });
}

function parseSnapshots(value, toolIds) {
  if (!Array.isArray(value)) fail("snapshots", "expected an array");
  return value.map((row, index) => {
    const path = `snapshots[${index}]`;
    if (row === null || typeof row !== "object") fail(path, "expected an object");
    const snapshot = {
      tool_id: requireString(row.tool_id, `${path}.tool_id`),
      url: requireUrl(row.url, `${path}.url`),
      html_hash: requireString(row.html_hash, `${path}.html_hash`),
      archived_path: requireString(row.archived_path, `${path}.archived_path`),
      captured_at: requireString(row.captured_at, `${path}.captured_at`),
    };
    if (!toolIds.has(snapshot.tool_id)) fail(`${path}.tool_id`, "unknown tool");
    return snapshot;
  });
}

function parseComparisons(value, toolIds) {
  if (!Array.isArray(value)) fail("comparisons", "expected an array");
  const comparisons = value.map((row, index) => {
    const path = `comparisons[${index}]`;
    if (row === null || typeof row !== "object") fail(path, "expected an object");
    const comparison = {
      id: requireString(row.id, `${path}.id`),
      left: requireString(row.left, `${path}.left`),
      right: requireString(row.right, `${path}.right`),
      title: requireString(row.title, `${path}.title`),
    };
    if (!toolIds.has(comparison.left) || !toolIds.has(comparison.right)) {
      fail(path, "unknown tool");
    }
    if (comparison.left === comparison.right) fail(path, "a comparison needs two tools");
    return comparison;
  });
  const ids = new Set(comparisons.map((comparison) => comparison.id));
  for (const id of REQUIRED_COMPARISONS) {
    if (!ids.has(id)) fail("comparisons", `missing ${id}`);
  }
  return comparisons;
}

export function parseCatalog(input) {
  if (input === null || typeof input !== "object") fail("catalog", "expected an object");
  const tools = parseTools(input.tools);
  const toolIds = new Set(tools.map((tool) => tool.id));
  const plans = parsePlans(input.plans, toolIds);
  const priceChanges = parsePriceChanges(input.price_changes, toolIds);
  const statusChecks = parseStatusChecks(input.status_checks, toolIds);
  const snapshots = parseSnapshots(input.snapshots, toolIds);
  const comparisons = parseComparisons(input.comparisons, toolIds);
  return {
    tools,
    plans,
    priceChanges,
    statusChecks,
    snapshots,
    comparisons,
    tool(id) {
      const found = tools.find((item) => item.id === id);
      if (!found) fail("tool", `unknown tool ${id}`);
      return found;
    },
    plansFor(id) {
      return plans.filter((plan) => plan.tool_id === id);
    },
  };
}

export async function loadCatalog(root) {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  async function read(name) {
    return JSON.parse(await readFile(join(root, "data", name), "utf8"));
  }
  return parseCatalog({
    tools: await read("tools.json"),
    plans: await read("plans.json"),
    price_changes: await read("price_changes.json"),
    status_checks: await read("status_checks.json"),
    snapshots: await read("snapshots.json"),
    comparisons: await read("comparisons.json"),
  });
}

export function formatMonthly(plan) {
  if (plan.verification !== "verified" || plan.price_monthly === null) return null;
  const amount = Number.isInteger(plan.price_monthly)
    ? `$${plan.price_monthly}`
    : `$${plan.price_monthly.toFixed(2)}`;
  return `${amount}/mo`;
}

export function priceLabel(plan) {
  const monthly = formatMonthly(plan);
  if (monthly) return monthly;
  if (plan.verification === "unverified") return "No captured price";
  return "No public price";
}
