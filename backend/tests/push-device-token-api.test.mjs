import assert from "node:assert/strict";
import test from "node:test";

let express;
try {
  ({ default: express } = await import("express"));
} catch {
  // The service-level tests can be skipped in source-only environments.
}

const integrationOptions = {
  skip: express ? false : "express dependency is required for push device API tests"
};
const token = "fcm-registration-token-abcdefghijklmnopqrstuvwxyz";
const apnsToken = "a".repeat(64);

test("register device stores encrypted token and a hash", integrationOptions, async () => {
  await withApi(async ({ request, devices }) => {
    const result = await request("/api/devices/register", {
      method: "POST",
      token: "user-1",
      body: { device_id: "device-one", platform: "android", push_token: token }
    });
    assert.equal(result.status, 201, result.text);
    assert.equal(result.payload.device.device_id, "device-one");
    assert.notEqual(devices[0].push_token_encrypted, token);
    assert.match(devices[0].push_token_hash, /^[a-f0-9]{64}$/);
    assert.equal(devices[0].push_token, undefined);
  });
});

test("registering the same device updates its token", integrationOptions, async () => {
  await withApi(async ({ request, devices, cipher }) => {
    await request("/api/devices/register", {
      method: "POST", token: "user-1",
      body: { device_id: "device-one", platform: "android", push_token: token }
    });
    const updated = `${token}-rotated`;
    const result = await request("/api/devices/register", {
      method: "POST", token: "user-1",
      body: { device_id: "device-one", platform: "android", push_token: updated }
    });
    assert.equal(result.status, 201, result.text);
    assert.equal(cipher.decrypt(devices[0].push_token_encrypted), updated);
  });
});

test("iOS registers an APNs device token", integrationOptions, async () => {
  await withApi(async ({ request, devices, cipher }) => {
    const result = await request("/api/devices/register", {
      method: "POST", token: "user-2",
      body: { device_id: "device-two", platform: "ios", push_token: apnsToken }
    });
    assert.equal(result.status, 201, result.text);
    assert.equal(cipher.decrypt(devices[1].push_token_encrypted), apnsToken);
  });
});

test("wrong token/provider combinations are rejected", integrationOptions, async () => {
  await withApi(async ({ request }) => {
    const iosFcm = await request("/api/devices/register", {
      method: "POST", token: "user-2",
      body: { device_id: "device-two", platform: "ios", push_token: token }
    });
    assert.equal(iosFcm.status, 400, iosFcm.text);

    const androidApns = await request("/api/devices/register", {
      method: "POST", token: "user-1",
      body: { device_id: "device-one", platform: "android", push_token: apnsToken }
    });
    assert.equal(androidApns.status, 400, androidApns.text);
  });
});

test("unregister revokes the current device token", integrationOptions, async () => {
  await withApi(async ({ request, devices }) => {
    await request("/api/devices/register", {
      method: "POST", token: "user-1",
      body: { device_id: "device-one", platform: "android", push_token: token }
    });
    const result = await request("/api/devices/unregister", {
      method: "POST", token: "user-1", body: { device_id: "device-one" }
    });
    assert.equal(result.status, 200, result.text);
    assert.equal(devices[0].push_token_hash, null);
    assert.equal(devices[0].push_token_encrypted, null);
    assert.ok(devices[0].push_revoked_at);
  });
});

test("unauthenticated registration is rejected", integrationOptions, async () => {
  await withApi(async ({ request }) => {
    const result = await request("/api/devices/register", {
      method: "POST",
      body: { device_id: "device-one", platform: "android", push_token: token }
    });
    assert.equal(result.status, 401, result.text);
  });
});

test("a user cannot register or revoke another user's device", integrationOptions, async () => {
  await withApi(async ({ request, devices }) => {
    const register = await request("/api/devices/register", {
      method: "POST", token: "user-2",
      body: { device_id: "device-one", platform: "android", push_token: token }
    });
    assert.equal(register.status, 403, register.text);
    const unregister = await request("/api/devices/unregister", {
      method: "POST", token: "user-2", body: { device_id: "device-one" }
    });
    assert.equal(unregister.status, 403, unregister.text);
    assert.equal(devices[0].push_token_encrypted, null);
  });
});

test("an active token cannot be silently assigned to another device", integrationOptions, async () => {
  await withApi(async ({ request, devices }) => {
    devices[1].platform = "android";
    await request("/api/devices/register", {
      method: "POST", token: "user-1",
      body: { device_id: "device-one", platform: "android", push_token: token }
    });
    const result = await request("/api/devices/register", {
      method: "POST", token: "user-2",
      body: { device_id: "device-two", platform: "android", push_token: token }
    });
    assert.equal(result.status, 409, result.text);
  });
});

async function withApi(callback) {
  const { createPushDeviceRouter } = await import("../api/pushDeviceRoutes.js");
  const { createPushDeviceTokenService } = await import("../services/pushDeviceTokenService.js");
  const { createPushTokenCipher, hashPushToken } = await import("../services/pushTokenCrypto.js");
  const cipher = createPushTokenCipher(Buffer.alloc(32, 7).toString("base64"));
  const devices = [
    { id: 1, user_id: "1", device_id: "device-one", platform: "android", revoked_at: null, push_revoked_at: null, push_token_hash: null, push_token_encrypted: null },
    { id: 2, user_id: "2", device_id: "device-two", platform: "ios", revoked_at: null, push_revoked_at: null, push_token_hash: null, push_token_encrypted: null }
  ];
  const repository = {
    async findOwnedActiveDevice(userId, deviceId) {
      return devices.find((device) => String(device.user_id) === String(userId) &&
        device.device_id === deviceId && device.revoked_at == null) ?? null;
    },
    async findActiveDeviceByTokenHash(tokenHash) {
      return devices.find((device) => device.push_token_hash === tokenHash &&
        device.revoked_at == null && device.push_revoked_at == null) ?? null;
    },
    async storePushToken({ deviceRowId, tokenHash, encryptedToken }) {
      const device = devices.find((item) => item.id === deviceRowId);
      if (!device || device.revoked_at != null) return { rowCount: 0 };
      device.push_token_hash = tokenHash;
      device.push_token_encrypted = encryptedToken;
      device.push_revoked_at = null;
      device.last_token_update = new Date().toISOString();
      return { rowCount: 1 };
    },
    async revokePushToken(deviceRowId) {
      const device = devices.find((item) => item.id === deviceRowId);
      if (!device || device.revoked_at != null) return { rowCount: 0 };
      device.push_token_hash = null;
      device.push_token_encrypted = null;
      device.push_revoked_at = new Date().toISOString();
      return { rowCount: 1 };
    }
  };
  const service = createPushDeviceTokenService({ repository, tokenCipher: cipher });
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const users = { "Bearer user-1": { id: "1" }, "Bearer user-2": { id: "2" } };
    const user = users[req.headers.authorization];
    if (!user) return res.status(401).json({ error: "unauthorized" });
    req.user = user;
    next();
  });
  app.use("/api/devices", createPushDeviceRouter({ pushDeviceTokenService: service }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await callback({ request: (path, options = {}) => request(baseUrl, path, options), devices, cipher, hashPushToken });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function request(baseUrl, path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch {}
  return { status: response.status, payload, text };
}
