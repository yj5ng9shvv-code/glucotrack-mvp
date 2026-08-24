import assert from "node:assert/strict";
import test from "node:test";

import { dispatchFamilyInvitationEmail } from "../services/email/familyInvitationDispatch.js";
import { familyInvitationTemplate } from "../services/email/templates/familyInvitationTemplate.js";

const message = { subject: "Family invitation", title: "Invitation", body: "Join", code: "Code", expires: "7 days" };
const invitationUrl = "https://glukotrack.com/api/family/invite/test-token";

test("family invitation dispatch sends email and marks the invitation delivered", async () => {
  const queries = [];
  const logs = [];
  const result = await dispatchFamilyInvitationEmail({
    db: { query: async (sql, params) => queries.push({ sql, params }) },
    emailService: { sendFamilyInvitationEmail: async (payload) => ({ accepted: [payload.email] }) },
    invitation: { id: 42, email: "caregiver@example.test" },
    patient: { id: 7, name: "Patient" },
    inviteCode: "test-token",
    message,
    invitationUrl,
    applicationUrl: "https://glukotrack.com/app",
    logger: { info: (event, fields) => logs.push({ event, fields }), error: () => {} }
  });

  assert.deepEqual(result.accepted, ["caregiver@example.test"]);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /email_sent = TRUE/);
  assert.deepEqual(logs.map(({ event }) => event), ["INVITATION_CREATED", "INVITATION_EMAIL_SENT"]);
  assert.equal(JSON.stringify(logs).includes("test-token"), false);
});

test("family invitation dispatch preserves the invitation and records a bounded delivery error", async () => {
  const queries = [];
  const logs = [];
  await assert.rejects(() => dispatchFamilyInvitationEmail({
    db: { query: async (sql, params) => queries.push({ sql, params }) },
    emailService: { sendFamilyInvitationEmail: async () => { throw new Error("SMTP temporarily unavailable"); } },
    invitation: { id: 43, email: "caregiver@example.test" },
    patient: { id: 7, name: "Patient" },
    inviteCode: "test-token",
    message,
    invitationUrl,
    applicationUrl: "https://glukotrack.com/app",
    logger: { info: (event, fields) => logs.push({ event, fields }), error: (event, fields) => logs.push({ event, fields }) }
  }));

  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /email_sent = FALSE/);
  assert.equal(logs.at(-1).event, "INVITATION_EMAIL_FAILED");
  assert.equal(JSON.stringify(logs).includes("test-token"), false);
});

test("family invitation email template contains the exact accept link and raw token", () => {
  const template = familyInvitationTemplate({ message, inviteCode: "test-token", invitationUrl, applicationUrl: "https://glukotrack.com/app" });
  assert.match(template.text, /https:\/\/glukotrack\.com\/api\/family\/invite\/test-token/);
  assert.match(template.text, /Code: test-token/);
});
