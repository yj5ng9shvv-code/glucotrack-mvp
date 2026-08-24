import assert from "node:assert/strict";
import test from "node:test";

let express;
try {
  ({ default: express } = await import("express"));
} catch {
  // Source-only environments may omit the test dependency.
}

const integrationOptions = {
  skip: express ? false : "express dependency is required for Family members API tests"
};

test("patient can view Family members", integrationOptions, async () => {
  await withApi(async ({ request }) => {
    const result = await request("/api/family/members", { token: "patient" });
    assert.equal(result.status, 200, result.text);
    assert.equal(result.payload.length, 2);
  });
});

test("authorized caregiver can view Family members", integrationOptions, async () => {
  await withApi(async ({ request }) => {
    const result = await request("/api/family/members", { token: "caregiver" });
    assert.equal(result.status, 200, result.text);
    assert.equal(result.payload[1].role, "caregiver");
  });
});

test("unauthorized caregiver gets a generic 403", integrationOptions, async () => {
  await withApi(async ({ request }) => {
    const result = await request("/api/family/members", { token: "denied-caregiver" });
    assert.equal(result.status, 403, result.text);
    assert.deepEqual(result.payload, { error: "forbidden" });
  });
});

test("unrelated user gets a generic 403 for members and deletion", integrationOptions, async () => {
  await withApi(async ({ request }) => {
    const members = await request("/api/family/members", { token: "stranger" });
    assert.equal(members.status, 403, members.text);
    assert.deepEqual(members.payload, { error: "forbidden" });

    const deletion = await request("/api/family/member/member-caregiver", {
      method: "DELETE",
      token: "stranger"
    });
    assert.equal(deletion.status, 403, deletion.text);
    assert.deepEqual(deletion.payload, { error: "forbidden" });
  });
});

test("caregiver cannot delete a Family member", integrationOptions, async () => {
  await withApi(async ({ request }) => {
    const result = await request("/api/family/member/member-patient", {
      method: "DELETE",
      token: "caregiver"
    });
    assert.equal(result.status, 403, result.text);
    assert.deepEqual(result.payload, { error: "forbidden" });
  });
});

test("invalid JWT is rejected before the Family router", integrationOptions, async () => {
  await withApi(async ({ request }) => {
    const result = await request("/api/family/members", { token: "invalid" });
    assert.equal(result.status, 401, result.text);
  });
});

async function withApi(callback) {
  const { createFamilyRouter } = await import("../family/api/familyRoutes.js");
  const { FamilyAccessDeniedError } = await import("../family/services/familyService.js");
  const group = { id: "family-1", patient_user_id: "patient" };
  const members = [
    { id: "member-patient", user_id: "patient", role: "patient", status: "active" },
    { id: "member-caregiver", user_id: "caregiver", role: "caregiver", status: "active" }
  ];
  const authorizedUsers = new Set(["patient", "caregiver"]);
  const familyService = {
    async createFamily() { return group; },
    async getFamily(userId) {
      if (!authorizedUsers.has(String(userId))) throw new FamilyAccessDeniedError("ACCESS_DENIED");
      return group;
    }
  };
  const memberService = {
    async getMembers() { return members; },
    async removeMember() { return { rowCount: 1 }; }
  };
  const app = express();
  app.use((req, res, next) => {
    // Mirror the server's normalizer: sendForbidden must preserve the public
    // Family authorization response rather than leaking an internal code.
    const sendJson = res.json.bind(res);
    res.json = (body) => {
      if (body?.error && !body.code) {
        body.code = body.error;
        delete body.error;
      }
      return sendJson(body);
    };
    next();
  });
  app.use((req, res, next) => {
    const id = req.headers.authorization?.replace("Bearer ", "");
    if (!["patient", "caregiver", "denied-caregiver", "stranger"].includes(id)) {
      return res.status(401).json({ error: "unauthorized" });
    }
    req.user = { id, email: `${id}@example.test` };
    next();
  });
  app.use("/api/family", createFamilyRouter({
    familyService,
    memberService,
    invitationService: {}
  }));
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
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

async function request(baseUrl, path, { method = "GET", token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch {}
  return { status: response.status, payload, text };
}
