import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createFamilyInvitationService, InvalidFamilyInvitationError } from "../family/services/familyInvitationService.js";

const inviteHash = (value) => createHash("sha256").update(String(value)).digest("hex");
const fixedNow = new Date("2026-08-02T12:00:00.000Z");

function createFixture({ invitation } = {}) {
  const attempts = [];
  const accepted = [];
  const invitations = new Map();
  if (invitation) invitations.set(invitation.invite_code_hash, invitation);
  const repository = {
    create: async () => undefined,
    findByHash: async (hash) => invitations.get(hash) ?? null,
    accept: async (id) => {
      const invite = [...invitations.values()].find((item) => item.id === id);
      invite.status = "accepted";
      accepted.push(id);
    },
    reject: async () => undefined,
    async countRecentFailedAttempts({ inviteCodeHash, targetUserId, ipHash, since }) {
      const matching = attempts.filter((attempt) => attempt.attemptedAt >= since && attempt.result !== "accepted");
      return Math.max(
        matching.filter((attempt) => attempt.inviteCodeHash === inviteCodeHash).length,
        matching.filter((attempt) => attempt.targetUserId === targetUserId).length,
        matching.filter((attempt) => attempt.ipHash === ipHash).length
      );
    },
    async recordAcceptAttempt(attempt) {
      attempts.push({ ...attempt, attemptedAt: new Date(fixedNow) });
    }
  };
  const service = createFamilyInvitationService(
    repository,
    { findGroupByPatient: async (patientId) => ({ id: "family-1", patient_user_id: patientId }) },
    { addMember: async () => undefined },
    { ipHashSalt: "test-salt", now: () => new Date(fixedNow) }
  );
  return { service, attempts, accepted };
}

function pendingInvitation(code, overrides = {}) {
  return {
    id: "invite-1",
    patient_user_id: "patient-1",
    email: "caregiver@example.test",
    invite_code_hash: inviteHash(code),
    status: "pending",
    expires_at: new Date(fixedNow.getTime() + 60_000),
    ...overrides
  };
}

async function expectUnavailable(operation) {
  await assert.rejects(operation, (error) => error instanceof InvalidFamilyInvitationError && error.message === "INVALID_INVITATION");
}

test("valid Family invite is accepted and only its hash is audited", async () => {
  const rawCode = "valid-family-invite-token";
  const { service, attempts, accepted } = createFixture({ invitation: pendingInvitation(rawCode) });

  const family = await service.acceptInvite("caregiver@example.test", rawCode, "caregiver-1", { ip: "203.0.113.1" });

  assert.equal(family.id, "family-1");
  assert.deepEqual(accepted, ["invite-1"]);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].result, "accepted");
  assert.equal(attempts[0].inviteCodeHash, inviteHash(rawCode));
  assert.equal(JSON.stringify(attempts).includes(rawCode), false, "raw invitation token must not be recorded");
  assert.equal(JSON.stringify(attempts).includes("203.0.113.1"), false, "raw IP address must not be recorded");
});

test("invalid Family invite attempts are throttled after five failures", async () => {
  const { service, attempts } = createFixture();
  const rawCode = "invalid-family-invite-token";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expectUnavailable(() => service.acceptInvite("caregiver@example.test", rawCode, "caregiver-1", { ip: "203.0.113.2" }));
  }
  await expectUnavailable(() => service.acceptInvite("caregiver@example.test", rawCode, "caregiver-1", { ip: "203.0.113.2" }));

  assert.equal(attempts.filter((attempt) => attempt.result === "invalid").length, 5);
  assert.equal(attempts.at(-1).result, "throttled");
  assert.equal(JSON.stringify(attempts).includes(rawCode), false, "raw invitation token must not be recorded");
});

test("target-account throttling applies even when IP and token both change", async () => {
  const { service, attempts } = createFixture();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expectUnavailable(() => service.acceptInvite(
      "caregiver@example.test",
      `invalid-token-${attempt}`,
      "caregiver-1",
      { ip: `203.0.113.${10 + attempt}` }
    ));
  }
  await expectUnavailable(() => service.acceptInvite(
    "caregiver@example.test",
    "different-invalid-token",
    "caregiver-1",
    { ip: "203.0.113.20" }
  ));

  assert.equal(attempts.at(-1).result, "throttled");
});

test("expired Family invite attempts are throttled without exposing invite state", async () => {
  const rawCode = "expired-family-invite-token";
  const { service, attempts } = createFixture({
    invitation: pendingInvitation(rawCode, { expires_at: new Date(fixedNow.getTime() - 60_000) })
  });

  for (let attempt = 0; attempt < 6; attempt += 1) {
    await expectUnavailable(() => service.acceptInvite("caregiver@example.test", rawCode, "caregiver-1", { ip: "203.0.113.3" }));
  }

  assert.equal(attempts.filter((attempt) => attempt.result === "expired").length, 5);
  assert.equal(attempts.at(-1).result, "throttled");
});

test("wrong-account attempts use the same unavailable response and are audited by account", async () => {
  const rawCode = "recipient-bound-family-invite-token";
  const { service, attempts } = createFixture({ invitation: pendingInvitation(rawCode) });

  await expectUnavailable(() => service.acceptInvite("other@example.test", rawCode, "stranger-1", { ip: "203.0.113.4" }));

  assert.equal(attempts[0].result, "wrong_email");
  assert.equal(attempts[0].targetUserId, "stranger-1");
});

test("reused Family invite attempts are rejected and audited without raw token storage", async () => {
  const rawCode = "reused-family-invite-token";
  const { service, attempts } = createFixture({ invitation: pendingInvitation(rawCode, { status: "accepted" }) });

  await expectUnavailable(() => service.acceptInvite("caregiver@example.test", rawCode, "caregiver-1", { ip: "203.0.113.5" }));

  assert.equal(attempts[0].result, "reused");
  assert.equal(JSON.stringify(attempts).includes(rawCode), false, "raw invitation token must not be recorded");
});
