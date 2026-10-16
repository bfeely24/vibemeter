import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import { loadCatalog } from "../src/data/catalog.mjs";
import { hashPlanText, normalizePlanText, planTextDiff } from "./pricing-text.mjs";

const mode = process.argv.includes("--write-baseline")
  ? "baseline"
  : process.argv.includes("--check")
    ? "check"
    : "dry-run";

const plansPath = "data/plans.json";
const snapshotsPath = "data/snapshots.json";
const plansBefore = readFileSync(plansPath, "utf8");

function plansUntouched() {
  const plansAfter = readFileSync(plansPath, "utf8");
  if (plansBefore !== plansAfter) {
    throw new Error("pricing check rewrote data/plans.json");
  }
}

function openIssue(title, body) {
  const result = spawnSync("gh", ["issue", "create", "--title", title, "--body", body], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || "gh issue create failed");
  }
  console.log(result.stdout.trim());
}

const catalog = await loadCatalog(process.cwd());
const snapshots = JSON.parse(readFileSync(snapshotsPath, "utf8"));
const latest = new Map();
for (const snapshot of snapshots) latest.set(snapshot.tool_id, snapshot);

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const failures = [];
try {
  for (const tool of catalog.tools) {
    const page = await browser.newPage();
    try {
      const response = await page.goto(tool.pricing_url, {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });
      await page.waitForTimeout(1500);
      const rendered = normalizePlanText(await page.locator("body").innerText());
      const status = response ? response.status() : 0;
      const finalUrl = page.url();
      const blocked =
        status !== 200 ||
        /just a moment|attention required|cf-browser-verification|enable javascript and cookies/i.test(
          rendered,
        );
      if (blocked) {
        console.log(`${tool.id} blocked HTTP ${status} ${finalUrl} chars ${rendered.length}`);
        continue;
      }
      if (rendered.length < 200) {
        throw new Error(`rendered text is ${rendered.length} characters`);
      }
      const digest = hashPlanText(rendered);
      const previous = latest.get(tool.id);
      console.log(`${tool.id} HTTP ${status} ${finalUrl} hash ${digest.slice(0, 12)} chars ${rendered.length}`);
      if (!previous) {
        if (mode === "baseline") {
          mkdirSync("history/pricing", { recursive: true });
          const archivedPath = `history/pricing/${tool.id}.txt`;
          writeFileSync(archivedPath, `${rendered}\n`);
          snapshots.push({
            tool_id: tool.id,
            url: finalUrl,
            html_hash: digest,
            archived_path: archivedPath,
            captured_at: new Date().toISOString(),
          });
          console.log(`${tool.id} wrote baseline ${archivedPath}`);
        } else {
          console.log(`${tool.id} has no baseline`);
        }
        continue;
      }
      const archived = readFileSync(previous.archived_path, "utf8");
      if (hashPlanText(archived) === digest) {
        console.log(`${tool.id} unchanged`);
        continue;
      }
      const diff = planTextDiff(normalizePlanText(archived), rendered);
      console.log(`${tool.id} changed`);
      for (const line of diff.removed) console.log(`- ${line}`);
      for (const line of diff.added) console.log(`+ ${line}`);
      if (mode === "check") {
        const body = [
          `Pricing text for ${tool.name} changed.`,
          `Source: ${finalUrl}`,
          `Previous hash: ${previous.html_hash}`,
          `New hash: ${digest}`,
          "",
          "Removed lines:",
          ...diff.removed.map((line) => `- ${line}`),
          "",
          "Added lines:",
          ...diff.added.map((line) => `+ ${line}`),
          "",
          "This check does not update published prices. Confirm the change before editing data/plans.json.",
        ].join("\n");
        openIssue(`Pricing text changed for ${tool.name}`, body.slice(0, 6000));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${tool.id}: ${message}`);
      console.log(`${tool.id} FAILED ${message}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (mode === "baseline" && failures.length === 0) {
  writeFileSync(snapshotsPath, `${JSON.stringify(snapshots, null, 2)}\n`);
}
plansUntouched();
if (failures.length > 0) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log(`pricing ${mode} ok`);
