import assert from "node:assert/strict";
import test from "node:test";

let express;
try {
  ({ default: express } = await import("express"));
} catch {
  // This source-only workspace can run service tests without backend packages.
}

const integrationOptions = {
  skip: express ? false : "express dependency is required for SOS API tests"
};

test("patient creates SOS through the API", integrationOptions, async () => {
  await withApi(async ({ request }) => {
    const result = await request("/api/sos/create", {
      method: "POST",
      token: "patient",
      body: { latitude: 52.2297, longitude: 21.0122, accuracy: 12 }
    });
    assert.equal(result.status, 201, result.text);
    assert.equal(result.payload.status, "ACTIVE");
    assert.equal(result.payload.sos_id, "1");
  });
});

test("patient cancels own SOS through the API", integrationOptions, async () => {
  await withApi(async ({ request }) => {
    const created = await request("/api/sos/create", { method: "POST", token: "patient" });
    const cancelled = await request(`/api/sos/cancel/${created.payload.sos_id}`, {
      method: "POST", token: "patient"
    });
    assert.equal(cancelled.status, 200, cancelled.text);
    assert.equal(cancelled.payload.status, "CANCELLED");
  });
});

test("authorized caregiver views active SOS through the API", integrationOptions, async () => {
  await withApi(async ({ request }) => {
    await request("/api/sos/create", { method: "POST", token: "patient" });
    const result = await request("/api/sos/active/10", { token: "caregiver" });
    assert.equal(result.status, 200, result.text);
    assert.equal(result.payload.sos.status, "ACTIVE");
  });
});

test("caregiver is blocked from cancelling patient SOS", integrationOptions, async () => {
  await withApi(async ({ request }) => {
    const created = await request("/api/sos/create", { method: "POST", token: "patient" });
    const result = await request(`/api/sos/cancel/${created.payload.sos_id}`, {
      method: "POST", token: "caregiver"
    });
    assert.equal(result.status, 403, result.text);
    assert.deepEqual(result.payload, { error: "forbidden" });
  });
});

test("unauthenticated and unauthorized users are blocked", integrationOptions, async () => {
  await withApi(async ({ request }) => {
    const noToken = await request("/api/sos/create", { method: "POST" });
    assert.equal(noToken.status, 401, noToken.text);
    const stranger = await request("/api/sos/active/10", { token: "stranger" });
    assert.equal(stranger.status, 403, stranger.text);
  });
});

async function withApi(callback) {
  const { createSosRouter } = await import("../family/api/sosRoutes.js");
  const { createSosService } = await import("../family/services/sosService.js");
  const events = [];
  let nextId = 1;
  const sosRepository = {
    async createSOS(patientId, latitude, longitude, accuracy) {
      const event = {
        id: nextId++, patient_id: Number(patientId), status: "ACTIVE", latitude, longitude,
        accuracy, created_at: new Date().toISOString(), cancelled_at: null, resolved_at: null
      };
      events.push(event);
      return { insertId: event.id, rowCount: 1 };
    },
    async findActiveByPatient(patientId) {
      return events.find((event) => event.patient_id === Number(patientId) && event.status === "ACTIVE") ?? null;
    },
    async getById(id) { return events.find((event) => event.id === Number(id)) ?? null; },
    async cancelSOS(id, patientId) {
      const event = events.find((item) => item.id === Number(id) && item.patient_id === Number(patientId) && item.status === "ACTIVE");
      if (!event) return { rowCount: 0 };
      event.status = "CANCELLED";
      event.cancelled_at = new Date().toISOString();
      return { rowCount: 1 };
    },
    async resolveSOS(id, patientId) {
      const event = events.find((item) => item.id === Number(id) && item.patient_id === Number(patientId) && item.status === "ACTIVE");
      if (!event) return { rowCount: 0 };
      event.status = "RESOLVED";
      event.resolved_at = new Date().toISOString();
      return { rowCount: 1 };
    },
    async getSOSHistory(patientId, limit) {
      return events.filter((event) => event.patient_id === Number(patientId)).slice(0, limit);
    }
  };
  const familyRepository = {
    async findGroupByPatient(patientId) {
      return Number(patientId) === 10 ? { id: 1, patient_user_id: 10, status: "active" } : null;
    },
    async members() { return [{ id: 2, user_id: 20, role: "caregiver", status: "active" }]; }
  };
  const permissionRepository = { async get() { return { can_view_sos: true, can_view_location: true }; } };
  const locationRepository = { async findActiveLocationGrant(patientId, memberId) {
    return Number(patientId) === 10 && memberId === 2 ? { id: 1 } : null;
  } };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const users = { "Bearer patient": { id: "10" }, "Bearer caregiver": { id: "20" }, "Bearer stranger": { id: "30" } };
    const user = users[req.headers.authorization];
    if (!user) return res.status(401).json({ error: "unauthorized" });
    req.user = user;
    next();
  });
  app.use("/api/sos", createSosRouter({
    sosService: createSosService({ familyRepository, permissionRepository, sosRepository, locationRepository })
  }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await callback({ request: (path, options = {}) => request(baseUrl, path, options) });
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
