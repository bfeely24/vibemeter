import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const base = "http://127.0.0.1:4321/vibemeter";
const tools = [
  ["lovable", "Lovable"],
  ["bolt", "Bolt"],
  ["replit", "Replit"],
  ["cursor", "Cursor"],
  ["claude-code", "Claude Code"],
  ["v0", "v0"],
  ["windsurf", "Windsurf"],
  ["github-copilot", "GitHub Copilot"],
  ["base44", "Base44"],
  ["devin", "Devin"],
];

const server = spawn("node_modules/.bin/astro", ["preview", "--host", "127.0.0.1", "--port", "4321"], {
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
server.stdout.on("data", (chunk) => {
  log += chunk;
});
server.stderr.on("data", (chunk) => {
  log += chunk;
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function text(path) {
  const response = await fetch(`${base}${path}`);
  const body = await response.text();
  return { status: response.status, body, path };
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/`);
      if (response.status === 200) {
        ready = true;
        break;
      }
    } catch {
      ready = false;
    }
    await delay(250);
  }
  assert(ready, `preview did not serve ${base}/\n${log}`);

  const home = await text("/");
  assert(home.status === 200, `home ${home.status}`);
  for (const [, name] of tools) {
    assert(home.body.includes(name), `home missing ${name}`);
  }
  assert(home.body.includes("Unverified"), "home missing Unverified");
  assert(
    home.body.includes("does not send your email"),
    "home missing the disconnected signup copy",
  );
  assert(!home.body.includes("beehiiv") && !home.body.includes("buttondown"), "signup posts somewhere");

  for (const [id, name] of tools) {
    const page = await text(`/tools/${id}/`);
    assert(page.status === 200, `${page.path} ${page.status}`);
    assert(page.body.includes(name), `${id} missing ${name}`);
  }

  const devin = await text("/tools/devin/");
  assert(devin.body.includes("Unverified"), "devin missing Unverified");
  assert(devin.body.includes("No captured price"), "devin missing empty price");
  assert(!/\$\d/.test(devin.body), "devin page shows a dollar amount");

  for (const id of ["cursor-vs-windsurf", "lovable-vs-bolt", "cursor-vs-github-copilot"]) {
    const page = await text(`/compare/${id}/`);
    assert(page.status === 200, `${page.path} ${page.status}`);
  }
  const cursorVsWindsurf = await text("/compare/cursor-vs-windsurf/");
  assert(cursorVsWindsurf.body.includes("Cursor"), "comparison missing Cursor");
  assert(cursorVsWindsurf.body.includes("Windsurf"), "comparison missing Windsurf");
  const lovableVsBolt = await text("/compare/lovable-vs-bolt/");
  assert(lovableVsBolt.body.includes("Lovable"), "comparison missing Lovable");
  assert(lovableVsBolt.body.includes("Bolt"), "comparison missing Bolt");

  const changes = await text("/changes/");
  assert(changes.status === 200, `changes ${changes.status}`);
  assert(changes.body.includes("No price changes recorded yet."), "changes missing empty state");
  assert(changes.body.includes("unknown"), "changes missing unknown status");

  const rss = await text("/changes.xml");
  assert(rss.status === 200, `rss ${rss.status}`);
  assert(rss.body.includes("<rss"), "rss missing rss tag");
  assert(rss.body.includes("Cursor"), "rss missing Cursor");
  assert(rss.body.includes("Devin"), "rss missing Devin");
  console.log("preview ok");
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}
