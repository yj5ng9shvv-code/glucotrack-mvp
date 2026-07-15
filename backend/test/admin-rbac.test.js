import test from "node:test";
import assert from "node:assert/strict";

import { adminPermissionsForRole, adminRequiresTwoFactorSetup } from "../admin.js";
import { normalizeSqlParams } from "../db.js";
import { GDPR_REQUEST_TYPES, GDPR_STATUSES } from "../gdpr.js";

test("super admin receives wildcard permission", () => {
  assert.deepEqual(adminPermissionsForRole("super_admin"), ["*"]);
});

test("support role cannot manage administrators or read medical data by default", () => {
  const permissions = adminPermissionsForRole("support");
  assert.equal(permissions.includes("users:read"), true);
  assert.equal(permissions.includes("gdpr.view"), true);
  assert.equal(permissions.includes("gdpr.comment"), true);
  assert.equal(permissions.includes("admins:write"), false);
  assert.equal(permissions.includes("medical:read"), false);
});

test("GDPR workflow exposes the required request types and statuses", () => {
  assert.deepEqual(GDPR_REQUEST_TYPES, [
    "data_access",
    "data_export",
    "data_rectification",
    "account_deletion",
    "data_anonymization",
    "processing_restriction",
    "consent_withdrawal",
    "processing_objection",
    "data_portability",
    "other"
  ]);
  assert.deepEqual(GDPR_STATUSES, [
    "draft",
    "submitted",
    "identity_verification_required",
    "verified",
    "in_review",
    "in_progress",
    "waiting_for_user",
    "approved",
    "rejected",
    "completed",
    "cancelled",
    "expired"
  ]);
});

test("unknown admin role has no permissions", () => {
  assert.deepEqual(adminPermissionsForRole("unknown"), []);
});

test("2FA setup is optional for password-only admin access", () => {
  assert.equal(adminRequiresTwoFactorSetup(["super_admin"], false), false);
  assert.equal(adminRequiresTwoFactorSetup(["super_admin"], true), false);
  assert.equal(adminRequiresTwoFactorSetup(["support"], false), false);
});

test("database placeholder normalization repeats numbered parameters", () => {
  const normalized = normalizeSqlParams("WHERE owner_user_id = $1 OR caregiver_user_id = $1 AND status = $2", [5, "open"]);
  assert.equal(normalized.normalizedSql, "WHERE owner_user_id = ? OR caregiver_user_id = ? AND status = ?");
  assert.deepEqual(normalized.normalizedParams, [5, 5, "open"]);
});
