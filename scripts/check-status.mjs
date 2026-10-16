import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadCatalog } from "../src/data/catalog.mjs";
import { readStatusPayload } from "./status.mjs";

const write = process.argv.includes("--write");
const catalog = await loadCatalog(process.cwd());
const path = "data/status_checks.json";
const current = JSON.parse(readFileSync(path, "utf8"));
const byTool = new Map(current.map((check) => [check.tool_id, check]));
const checkedAt = new Date().toISOString();
let changed = 0;

for (const tool of catalog.tools) {
  let httpStatus = 0;
  let body = "";
  try {
    const response = await fetch(tool.status_api, {
      redirect: "follow",
      headers: {
        accept: "application/json",
        "user-agent": "vibemeter-status",
      },
      signal: AbortSignal.timeout(20000),
    });
    httpStatus = response.status;
    body = await response.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`${tool.id} FAILED ${message}`);
    httpStatus = 0;
    body = "";
  }
  const parsed = readStatusPayload(httpStatus, body);
  const row = {
    tool_id: tool.id,
    checked_at: checkedAt,
    indicator: parsed.indicator,
    incident_title: null,
    description: parsed.description,
    http_status: parsed.http_status,
    source_url: tool.status_api,
  };
  const previous = byTool.get(tool.id);
  const same =
    previous &&
    previous.indicator === row.indicator &&
    previous.http_status === row.http_status &&
    previous.description === row.description;
  console.log(
    `${tool.id} HTTP ${row.http_status} ${row.indicator ?? "unknown"} ${row.description ?? ""}`,
  );
  if (same || !write) continue;
  changed += 1;
  byTool.set(tool.id, row);
  const stamp = checkedAt.replace(/[:.]/g, "-");
  const archived = `history/status/${stamp}/${tool.id}.json`;
  mkdirSync(`history/status/${stamp}`, { recursive: true });
  writeFileSync(archived, `${JSON.stringify(row, null, 2)}\n`);
}

if (write && changed > 0) {
  const next = catalog.tools.map((tool) => byTool.get(tool.id));
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`status wrote ${changed}`);
} else {
  console.log(write ? "status unchanged" : "status dry-run ok");
}
