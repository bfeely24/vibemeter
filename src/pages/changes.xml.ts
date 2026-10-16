import { loadCatalog, statusLabel } from "../data/catalog.mjs";
import { sitePath } from "../lib/paths.mjs";

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function GET() {
  const catalog = await loadCatalog(process.cwd());
  const origin = "https://bfeely24.github.io";
  const feedUrl = `${origin}${sitePath("/changes.xml")}`;
  const names = new Map(catalog.tools.map((tool) => [tool.id, tool.name]));
  const priceItems = catalog.priceChanges.map((change) => {
    const title = `${names.get(change.tool_id)} ${change.plan} ${change.field}`;
    const body = `${change.old} to ${change.new}. Confirmed: ${change.confirmed ? "yes" : "no"}.`;
    return { title, body, when: change.detected_at };
  });
  const statusItems = catalog.statusChecks.map((check) => ({
    title: `${names.get(check.tool_id)} status ${check.indicator ?? "unknown"}`,
    body: `${statusLabel(check)}. HTTP ${check.http_status}.`,
    when: check.checked_at,
  }));
  const items = [...priceItems, ...statusItems]
    .map(
      (item) => `    <item>
      <title>${xmlEscape(item.title)}</title>
      <description>${xmlEscape(item.body)}</description>
      <pubDate>${xmlEscape(item.when)}</pubDate>
      <link>${xmlEscape(feedUrl)}</link>
    </item>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>VibeMeter changes</title>
    <link>${xmlEscape(`${origin}${sitePath("/changes/")}`)}</link>
    <description>Price and status changes for AI coding tools.</description>
${items}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
