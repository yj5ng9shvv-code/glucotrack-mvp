import assert from "node:assert/strict";
import test from "node:test";

let express;
try {
  ({ default: express } = await import("express"));
} catch {
  // The local source-only environment does not install backend dependencies.
}

const integrationOptions = { skip: express ? false : "express dependency is required for location API tests" };

test("patient can update location through the API", integrationOptions, async () => {
  await withApi(async ({ request, state }) => {
    const result = await request("/api/location/update", {
      method: "POST",
      token: "patient",
      body: { latitude: 52.2, longitude: 21, accuracy: 8, battery_level: 72, device_id: "patient-device" }
    });
    assert.equal(result.status, 201, result.text);
    assert.equal(state.locations.length, 1);
  });
});

test("caregiver with a grant can view current location through the API", integrationOptions, async () => {
  await withApi(async ({ request }) => {
    const result = await request("/api/location/current/10", { token: "caregiver" });
    assert.equal(result.status, 200, result.text);
    assert.equal(result.payload.location.patient_id, 10);
  });
});

test("caregiver without a grant receives 403 through the API", integrationOptions, async () => {
  await withApi({ grant: false }, async ({ request }) => {
    const result = await request("/api/location/current/10", { token: "caregiver" });
    assert.equal(result.status, 403, result.text);
  });
});

test("revoke blocks subsequent caregiver access through the API", integrationOptions, async () => {
  await withApi(async ({ request }) => {
    const revoked = await request("/api/location/revoke/20", { method: "DELETE", token: "patient" });
    assert.equal(revoked.status, 204, revoked.text);
    const result = await request("/api/location/current/10", { token: "caregiver" });
    assert.equal(result.status, 403, result.text);
  });
});

test("missing bearer token is rejected with 401", integrationOptions, async () => {
  await withApi(async ({ request }) => {
    const result = await request("/api/location/current/10");
    assert.equal(result.status, 401, result.text);
  });
});

async function withApi(options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  const { createLocationRouter } = await import("../family/api/locationRoutes.js");
  const { createLocationService } = await import("../family/services/locationService.js");
  const state = { grant: options.grant ?? true, locations: [], logs: [] };
  const familyRepository = {
    async findGroupByPatient(patientId) {
      return Number(patientId) === 10 ? { id: 1, patient_user_id: 10, status: "active" } : null;
    },
    async members() { return [{ id: 2, user_id: 20, role: "caregiver", status: "active" }]; }
  };
  const permissionRepository = { async get() { return { can_view_location: true }; } };
  const locationRepository = {
    async createLocationUpdate(patientId, latitude, longitude, accuracy, batteryLevel, deviceId) {
      state.locations.push({ patient_id: Number(patientId), latitude, longitude, accuracy, battery_level: batteryLevel, device_id: deviceId });
      return { rowCount: 1 };
    },
    async getCurrentLocation(patientId) { return state.locations.at(-1) ?? { patient_id: Number(patientId), latitude: 52.2, longitude: 21 }; },
    async getLocationHistory() { return []; },
    async findActiveLocationGrant(patientId, memberId) { return state.grant && Number(patientId) === 10 && memberId === 2 ? { id: 1 } : null; },
    async grantLocationAccess() { state.grant = true; return { rowCount: 1 }; },
    async revokeLocationAccess() { state.grant = false; return { rowCount: 1 }; },
    async createAccessLog(...entry) { state.logs.push(entry); return { rowCount: 1 }; }
  };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const tokens = { "Bearer patient": { id: "10" }, "Bearer caregiver": { id: "20" } };
    const user = tokens[req.headers.authorization];
    if (!user) return res.status(401).json({ error: "unauthorized" });
    req.user = user;
    next();
  });
  app.use("/api/location", createLocationRouter({ locationService: createLocationService({ familyRepository, permissionRepository, locationRepository }) }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await callback({ state, request: (path, options = {}) => request(baseUrl, path, options) });
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
