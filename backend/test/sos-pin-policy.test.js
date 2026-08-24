import test from "node:test";
import assert from "node:assert/strict";

import { sosPinAttemptPolicy, sosPinWindowSeconds } from "../sos-pin-policy.js";

test("does not lock SOS PIN unlock before the threshold", () => {
  assert.deepEqual(sosPinAttemptPolicy(0), { locked: false, delaySeconds: 0 });
  assert.deepEqual(sosPinAttemptPolicy(1), { locked: false, delaySeconds: 0 });
  assert.deepEqual(sosPinAttemptPolicy(2), { locked: false, delaySeconds: 0 });
});

test("locks SOS PIN unlock with bounded exponential delay", () => {
  assert.deepEqual(sosPinAttemptPolicy(3), { locked: true, delaySeconds: 1 });
  assert.deepEqual(sosPinAttemptPolicy(4), { locked: true, delaySeconds: 2 });
  assert.deepEqual(sosPinAttemptPolicy(5), { locked: true, delaySeconds: 4 });
  assert.deepEqual(sosPinAttemptPolicy(20), { locked: true, delaySeconds: 60 });
});

test("uses a limited recent-attempt window for SOS PIN failures", () => {
  assert.equal(sosPinWindowSeconds(), 15 * 60);
});
