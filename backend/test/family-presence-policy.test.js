import test from "node:test";
import assert from "node:assert/strict";
import {
  FAMILY_PRESENCE_ONLINE_WINDOW_SECONDS,
  finitePresenceCoordinate,
  isFamilyPresenceOnline
} from "../family-presence-policy.js";

test("presence is online for 150 seconds and offline afterwards", () => {
  const now = Date.UTC(2026, 7, 1, 9, 0, 0);
  assert.equal(isFamilyPresenceOnline(new Date(now - 149_000), now), true);
  assert.equal(isFamilyPresenceOnline(new Date(now - 151_000), now), false);
  assert.equal(FAMILY_PRESENCE_ONLINE_WINDOW_SECONDS, 150);
});

test("presence coordinates accept only valid geographic values", () => {
  assert.equal(finitePresenceCoordinate(52.2297, -90, 90), 52.2297);
  assert.equal(finitePresenceCoordinate(181, -180, 180), null);
});
