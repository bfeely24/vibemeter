import assert from "node:assert/strict";
import { test } from "node:test";
import { readStatusPayload } from "./status.mjs";

test("reads a Statuspage summary", () => {
  const result = readStatusPayload(
    200,
    JSON.stringify({ status: { indicator: "minor", description: "Partially Degraded Service" } }),
  );
  assert.deepEqual(result, {
    indicator: "minor",
    description: "Partially Degraded Service",
    incident_title: null,
    http_status: 200,
  });
});

test("a blocked page stays unknown", () => {
  const result = readStatusPayload(403, "<html>Just a moment</html>");
  assert.equal(result.indicator, null);
  assert.equal(result.incident_title, null);
  assert.equal(result.http_status, 403);
});

test("an unexpected indicator stays unknown", () => {
  const result = readStatusPayload(200, JSON.stringify({ status: { indicator: "maintenance" } }));
  assert.equal(result.indicator, null);
  assert.equal(result.incident_title, null);
});
