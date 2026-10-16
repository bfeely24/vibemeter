import { loadCatalog } from "../src/data/catalog.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = await loadCatalog(root);
const unverified = catalog.tools.filter((tool) => tool.verification === "unverified").map((tool) => tool.id);
console.log(`tools ${catalog.tools.length}`);
console.log(`plans ${catalog.plans.length}`);
console.log(`unverified tools ${unverified.join(", ") || "none"}`);
