import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";

const baseUrl = (process.env.FAMILY_SECURITY_BASE_URL ?? "").replace(/\/$/, "");
const jwtSecret = process.env.FAMILY_SECURITY_JWT_SECRET ?? process.env.JWT_SECRET ?? "";
const integration = Boolean(baseUrl);
const integrationOptions = { skip: integration ? false : "FAMILY_SECURITY_BASE_URL is required for HTTP integration tests" };
const testDatabase = {
  host: process.env.FAMILY_SECURITY_DB_HOST ?? "",
  port: Number(process.env.FAMILY_SECURITY_DB_PORT ?? 0),
  user: process.env.FAMILY_SECURITY_DB_USER ?? "",
  password: process.env.FAMILY_SECURITY_DB_PASSWORD ?? "",
  database: process.env.FAMILY_SECURITY_DB_NAME ?? ""
};

async function request(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  let payload = text;
  try { payload = text ? JSON.parse(text) : null; } catch {}
  return { status: response.status, payload, text };
}

async function login(email) {
  const result = await request("/auth/login", {
    method: "POST",
    body: {
      email,
      password: "test-password",
      device: { id: `family-security-${email}`, platform: "test", name: "Family security test" }
    }
  });
  assert.equal(result.status, 200, `login for ${email}: ${result.text}`);
  assert.equal(typeof result.payload?.token, "string", `token missing for ${email}: ${result.text}`);
  return result.payload.token;
}

async function patientToken() {
  const token = await login("patient@test.com");
  const family = await request("/api/family/create", { method: "POST", token });
  assert.ok([200, 201].includes(family.status), `family setup: ${family.status} ${family.text}`);
  return token;
}

function expiredJwt() {
  assert.ok(jwtSecret.length >= 32, "FAMILY_SECURITY_JWT_SECRET/JWT_SECRET must be configured for expired JWT test");
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const signingInput = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ id: "expired-test", email: "expired@test.com", exp: 1 })}`;
  const signature = createHmac("sha256", jwtSecret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

async function expireLegacyInvite(code) {
  assert.ok(Object.values(testDatabase).every(Boolean), "Family Security test database settings are required");
  const mysql = await import("mysql2/promise");
  const connection = await mysql.createConnection(testDatabase);
  try {
    await connection.execute(
      "UPDATE family_links SET expires_at=DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE invite_code_hash=?",
      [inviteHash(code)]
    );
  } finally {
    await connection.end();
  }
}

function inviteHash(code) {
  return createHash("sha256").update(code).digest("hex");
}

async function createLegacyInvite(token, email = "caregiver@test.com") {
  const result = await request("/family/invitations", {
    method: "POST",
    token,
    body: { email, permissions: { glucose: true, history: true, emergency: true } }
  });
  assert.equal(result.status, 201, `legacy invite creation: ${result.status} ${result.text}`);
  assert.equal(typeof result.payload?.invitation?.inviteCode, "string", `raw invite code missing: ${result.text}`);
  return result.payload.invitation.inviteCode;
}

test("caregiver cannot delete another Family member", integrationOptions, async () => {
  const [patient, caregiver] = await Promise.all([patientToken(), login("caregiver@test.com")]);
  const members = await request("/api/family/members", { token: patient });
  assert.equal(members.status, 200, members.text);
  const patientMember = members.payload?.find((member) => member.role === "patient" && member.status === "active");
  assert.ok(patientMember?.id, `patient membership missing: ${members.text}`);

  const deletion = await request(`/api/family/member/${patientMember.id}`, { method: "DELETE", token: caregiver });
  assert.equal(deletion.status, 403, `caregiver member deletion must be denied: ${deletion.status} ${deletion.text}`);
});

test("non-member GET /api/family is denied with 403", integrationOptions, async () => {
  await patientToken();
  const stranger = await login("stranger@test.com");
  const result = await request("/api/family", { token: stranger });
  assert.equal(result.status, 403, `non-member response: ${result.status} ${result.text}`);
  assert.deepEqual(result.payload, { error: "forbidden" }, `non-member response body: ${result.text}`);
});

test("invalid JWT is rejected with 401", integrationOptions, async () => {
  const result = await request("/api/family", { token: "not.a.valid.jwt" });
  assert.equal(result.status, 401, `invalid JWT response: ${result.status} ${result.text}`);
});

test("expired JWT is rejected with 401", integrationOptions, async () => {
  const result = await request("/api/family", { token: expiredJwt() });
  assert.equal(result.status, 401, `expired JWT response: ${result.status} ${result.text}`);
});

test("invalid Family invite token is rejected with a 4xx response", integrationOptions, async () => {
  const caregiver = await login("caregiver@test.com");
  const result = await request("/api/family/invite/accept", {
    method: "POST",
    token: caregiver,
    body: { code: "invalid-family-invite-code" }
  });
  assert.ok(result.status >= 400 && result.status < 500, `invalid invite response: ${result.status} ${result.text}`);
});

test("SOS unlock without a valid PIN is rejected with 403", integrationOptions, async () => {
  const patient = await patientToken();
  const profile = await request("/sos/profile", {
    method: "POST",
    token: patient,
    body: { card: {}, hideSensitive: true, pin: "1234" }
  });
  assert.equal(profile.status, 200, `SOS profile setup: ${profile.status} ${profile.text}`);
  assert.equal(typeof profile.payload?.token, "string", `SOS token missing: ${profile.text}`);

  const result = await request(`/sos/${profile.payload.token}/unlock`, {
    method: "POST",
    body: { pin: "0000" }
  });
  assert.equal(result.status, 403, `SOS unauthorized response: ${result.status} ${result.text}`);
});

test("legacy Family invite tokens are hashed, recipient-bound, expiring, and one-time", integrationOptions, async () => {
  const [patient, caregiver, stranger] = await Promise.all([
    patientToken(),
    login("caregiver@test.com"),
    login("stranger@test.com")
  ]);

  const validCode = await createLegacyInvite(patient);
  const valid = await request("/family/invitations/accept", { method: "POST", token: caregiver, body: { code: validCode } });
  assert.equal(valid.status, 200, `valid invite: ${valid.status} ${valid.text}`);

  const reused = await request("/family/invitations/accept", { method: "POST", token: caregiver, body: { code: validCode } });
  assert.equal(reused.status, 404, `reused invite: ${reused.status} ${reused.text}`);
  assert.deepEqual(reused.payload, { error: "invitation is unavailable" });

  const wrongEmailCode = await createLegacyInvite(patient);
  const wrongEmail = await request("/family/invitations/accept", { method: "POST", token: stranger, body: { code: wrongEmailCode } });
  assert.equal(wrongEmail.status, 404, `wrong-email invite: ${wrongEmail.status} ${wrongEmail.text}`);
  assert.deepEqual(wrongEmail.payload, { error: "invitation is unavailable" });

  const invalid = await request("/family/invitations/accept", { method: "POST", token: caregiver, body: { code: "not-a-valid-invite" } });
  assert.equal(invalid.status, 404, `invalid invite: ${invalid.status} ${invalid.text}`);
  assert.deepEqual(invalid.payload, { error: "invitation is unavailable" });

  const expiredCode = await createLegacyInvite(patient);
  await expireLegacyInvite(expiredCode);
  const expired = await request("/family/invitations/accept", { method: "POST", token: caregiver, body: { code: expiredCode } });
  assert.equal(expired.status, 404, `expired invite: ${expired.status} ${expired.text}`);
  assert.deepEqual(expired.payload, { error: "invitation is unavailable" });

  const members = await request("/family/members", { token: patient });
  assert.equal(members.status, 200, `member list: ${members.status} ${members.text}`);
  assert.equal(members.payload?.members?.find((member) => member.email === "caregiver@test.com")?.inviteCode, null, `raw invite code leaked: ${members.text}`);
});
