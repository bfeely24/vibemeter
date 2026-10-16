const INDICATORS = new Set(["none", "minor", "major", "critical"]);

export function readStatusPayload(httpStatus, body) {
  const unknown = {
    indicator: null,
    description: null,
    incident_title: null,
    http_status: httpStatus,
  };
  if (httpStatus !== 200) return unknown;
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return unknown;
  }
  const indicator = payload?.status?.indicator ?? null;
  if (indicator !== null && !INDICATORS.has(indicator)) return unknown;
  const description = payload?.status?.description;
  return {
    indicator,
    description: typeof description === "string" ? description : null,
    incident_title: null,
    http_status: httpStatus,
  };
}
