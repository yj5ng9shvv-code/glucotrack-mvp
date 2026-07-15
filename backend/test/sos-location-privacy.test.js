import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const serverSource = readFileSync(new URL("../server.js", import.meta.url), "utf8");

test("public SOS page does not request geolocation on initial QR scan", () => {
  assert.match(serverSource, /scan\(\{\}\);/);
  assert.doesNotMatch(
    serverSource,
    /if\(navigator\.geolocation\)\{navigator\.geolocation\.getCurrentPosition/
  );
});

test("SOS scan history has retention and owner deletion API", () => {
  assert.match(serverSource, /SOS_SCAN_RETENTION_DAYS/);
  assert.match(serverSource, /app\.delete\("\/sos\/scans"/);
});
