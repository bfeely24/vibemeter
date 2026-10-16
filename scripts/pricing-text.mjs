import { createHash } from "node:crypto";

export function normalizePlanText(text) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "[time]")
    .trim();
}

function joinSplitPrices(lines) {
  const joined = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const amount = lines[index + 1] || "";
    const unit = lines[index + 2] || "";
    if (line === "$" && /^[\d,]+(?:\.\d+)?$/.test(amount)) {
      let price = `$${amount}`;
      index += 2;
      if (/^\/(?:mo|month|user\/month|yr|year)$/i.test(unit)) {
        price += unit;
        index += 1;
      }
      joined.push(price);
      continue;
    }
    joined.push(line);
    index += 1;
  }
  return joined;
}

export function priceSignal(text) {
  const lines = joinSplitPrices(
    normalizePlanText(text)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const kept = lines.filter((line) => {
    if (line.length > 120) return false;
    if (!/\$\s*\d/.test(line)) return false;
    if (/credit|included usage|flex allotment|\bvalue\b|actions usage/i.test(line)) return false;
    return true;
  });
  return [...new Set(kept)].sort().join("\n");
}

export function hashPlanText(text) {
  return createHash("sha256").update(priceSignal(text)).digest("hex");
}

export function planTextDiff(before, after) {
  const oldLines = new Set(before.split("\n"));
  const newLines = new Set(after.split("\n"));
  const added = after.split("\n").filter((line) => line.trim() && !oldLines.has(line)).slice(0, 40);
  const removed = before.split("\n").filter((line) => line.trim() && !newLines.has(line)).slice(0, 40);
  return { added, removed };
}
