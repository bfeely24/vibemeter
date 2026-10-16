export function sitePath(path) {
  const base = String(import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  if (path === "/") return `${base}/`;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
