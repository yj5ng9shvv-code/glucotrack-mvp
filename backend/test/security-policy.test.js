import test from "node:test";
import assert from "node:assert/strict";

import { deviceFingerprintHash, isMatchingRefreshDevice, sanitizeDeviceIdentity, isValidDeviceIdentity } from "../security-policy.js";

const validDevice = {
  id: "device_0123456789abcdef",
  name: "Web browser",
  platform: "web",
  fingerprint: "ab12cd34"
};

test("accepts a complete supported device identity", () => {
  assert.equal(isValidDeviceIdentity(validDevice), true);
});

test("rejects missing and short device identifiers", () => {
  assert.equal(isValidDeviceIdentity(), false);
  assert.equal(isValidDeviceIdentity({ ...validDevice, id: "short" }), false);
});

test("rejects unsupported platforms and missing fingerprints", () => {
  assert.equal(isValidDeviceIdentity({ ...validDevice, platform: "unknown" }), false);
  assert.equal(isValidDeviceIdentity({ ...validDevice, fingerprint: "" }), false);
});

test("rejects device fields containing control or markup characters", () => {
  assert.equal(isValidDeviceIdentity({ ...validDevice, platform: "android", fingerprint: "finger print" }), false);
  assert.equal(isValidDeviceIdentity({ ...validDevice, id: "device<script>0123456" }), false);
});

test("rejects control characters in device name", () => {
  assert.equal(isValidDeviceIdentity({ ...validDevice, name: "Web\x00browser" }), false);
});

test("normalizes raw device payload or rejects invalid payload", () => {
  assert.deepEqual(sanitizeDeviceIdentity(validDevice), validDevice);
  assert.equal(sanitizeDeviceIdentity({ id: "bad", name: "x", platform: "web", fingerprint: "fingerprint123" }), null);
});

test("accepts web-style raw fingerprint through sanitization", () => {
  const requestDevice = sanitizeDeviceIdentity({
    id: "device_0123456789abcdef",
    name: "Web browser",
    platform: "web",
    fingerprint: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  });
  assert.equal(isValidDeviceIdentity(requestDevice), true);
  assert.match(requestDevice.fingerprint, /^[a-f0-9]{64}$/);
});

test("rejects unsafe web fingerprint only before hash", () => {
  const requestDevice = sanitizeDeviceIdentity({
    id: "device_0123456789abcdef",
    name: "Web browser",
    platform: "web",
    fingerprint: "device<script>0123456789",
  });
  assert.equal(isValidDeviceIdentity(requestDevice), true);
  assert.match(requestDevice.fingerprint, /^[a-f0-9]{64}$/);
  assert.notEqual(requestDevice.fingerprint, "device<script>0123456789");
});

test("checks refresh-device matching by device id", () => {
  const userId = 1;
  const requestDevice = validDevice;
  const tokenData = {
    device_id: "device_0123456789abcdef",
    fingerprint_hash: deviceFingerprintHash(userId, requestDevice)
  };
  assert.equal(isMatchingRefreshDevice(userId, requestDevice, tokenData), true);
});

test("matches refresh-device by fingerprint when device id is absent in token payload", () => {
  const userId = 1;
  const requestDevice = validDevice;
  const tokenData = {
    device_id: "",
    fingerprint_hash: deviceFingerprintHash(userId, requestDevice),
  };
  assert.equal(isMatchingRefreshDevice(userId, requestDevice, tokenData), true);
});

test("rejects refresh-device mismatch", () => {
  const userId = 1;
  const requestDevice = { ...validDevice, id: "different_device_abcdef1234", fingerprint: "differentfingerprint" };
  const tokenData = {
    device_id: "device_0123456789abcdef",
    fingerprint_hash: deviceFingerprintHash(userId, validDevice)
  };
  assert.equal(isMatchingRefreshDevice(userId, requestDevice, tokenData), false);
});
