import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

import { pool } from "./db.js";
import { ABOUT_LOCALES } from "./about-content.js";
import { HELP_LOCALES } from "./help-content.js";
import { cleanHelpSlug, helpLocale, helpStatus, helpTranslationStatus, sanitizeHelpHtml } from "./help.js";
import {
  adminAnonymizeGdprRequest,
  adminApproveGdprRequest,
  adminAssignGdprRequest,
  adminCompleteGdprRequest,
  adminCreateGdprRequest,
  adminDeleteGdprAccount,
  adminGdprAudit,
  adminGdprRequestDetails,
  adminGdprRequests,
  adminGenerateGdprExport,
  adminRejectGdprRequest,
  adminUpdateGdprStatus,
  adminVerifyGdprIdentity,
  adminCommentGdprRequest
} from "./gdpr.js";

const ADMIN_TOKEN_COOKIE = "gt_admin_session";
const ADMIN_ROLES = {
  super_admin: ["*"],
  support: ["dashboard:read", "users:read", "devices:read", "subscriptions:read", "support:write", "audit:read", "gdpr:read", "gdpr.view", "gdpr.comment"],
  billing_manager: ["dashboard:read", "users:read", "subscriptions:read", "payments:read", "payments:write", "gdpr:read", "gdpr.view"],
  content_manager: ["dashboard:read", "localizations:read", "localizations:write", "notifications:read", "notifications:write", "versions:read", "referrals:read", "help:read", "help:write", "about:read", "about:write"],
  security_auditor: ["dashboard:read", "audit:read", "security:read", "errors:read", "backups:read"],
  medical_data_reviewer: ["dashboard:read", "medical:read", "users:read", "gdpr:read", "gdpr.view", "gdpr.view_audit"]
};

export function registerAdminRoutes(app, { asyncHandler }) {
  app.post("/admin/auth/login", asyncHandler(adminLogin));
  app.get("/admin/auth/me", adminAuth(), asyncHandler(adminMe));
  app.post("/admin/auth/2fa/setup", adminAuth({ allowPending2fa: true }), asyncHandler(adminSetupTwoFactor));
  app.post("/admin/auth/2fa/verify", adminAuth({ allowPending2fa: true }), asyncHandler(adminVerifyTwoFactor));
  app.post("/admin/auth/logout", adminAuth({ allowPending2fa: true }), asyncHandler(adminLogout));

  app.get("/admin/dashboard", adminAuth("dashboard:read"), asyncHandler(adminDashboard));
  app.get("/admin/users", adminAuth("users:read"), asyncHandler(adminUsers));
  app.get("/admin/users/:id", adminAuth("users:read"), asyncHandler(adminUserDetails));
  app.post("/admin/users/:id/revoke-sessions", adminAuth("users:write"), asyncHandler(adminRevokeUserSessions));
  app.post("/admin/users/:id/block", adminAuth("users:write"), asyncHandler(adminBlockUser));
  app.post("/admin/users/:id/unblock", adminAuth("users:write"), asyncHandler(adminUnblockUser));
  app.post("/admin/users/:id/verify-email", adminAuth("users:write"), asyncHandler(adminVerifyUserEmail));
  app.post("/admin/users/:id/subscription/extend", adminAuth("payments:write"), asyncHandler(adminExtendUserSubscription));
  app.post("/admin/users/:id/devices/:deviceId/revoke", adminAuth("users:write"), asyncHandler(adminRevokeUserDevice));
  app.post("/admin/users/:id/sessions/:sessionId/revoke", adminAuth("users:write"), asyncHandler(adminRevokeUserSession));
  app.post("/admin/users/:id/medical", adminAuth("medical:read"), asyncHandler(adminMedicalSnapshot));
  app.get("/admin/subscriptions", adminAuth("subscriptions:read"), asyncHandler(adminSubscriptions));
  app.get("/admin/payments", adminAuth("payments:read"), asyncHandler(adminPayments));
  app.get("/admin/devices", adminAuth("devices:read"), asyncHandler(adminDevices));
  app.get("/admin/trials", adminAuth("subscriptions:read"), asyncHandler(adminTrials));
  app.get("/admin/family", adminAuth("users:read"), asyncHandler(adminFamily));
  app.get("/admin/sos", adminAuth("security:read"), asyncHandler(adminSos));
  app.get("/admin/ai", adminAuth("audit:read"), asyncHandler(adminAi));
  app.get("/admin/notifications", adminAuth("notifications:read"), asyncHandler(adminNotifications));
  app.post("/admin/notifications/campaigns", adminAuth("notifications:write"), asyncHandler(adminCreateNotificationCampaign));
  app.post("/admin/notifications/preview", adminAuth("notifications:write"), asyncHandler(adminNotificationPreview));
  app.get("/admin/notifications/:id", adminAuth("notifications:read"), asyncHandler(adminNotificationDetails));
  app.post("/admin/notifications/:id/send", adminAuth("notifications:write"), asyncHandler(adminSendNotificationCampaign));
  app.get("/admin/referrals", adminAuth("referrals:read"), asyncHandler(adminReferrals));
  app.get("/admin/referrals/:id", adminAuth("referrals:read"), asyncHandler(adminReferralDetails));
  app.post("/admin/referrals/:id/approve", adminAuth("referrals:write"), asyncHandler(adminApproveReferral));
  app.post("/admin/referrals/:id/reject", adminAuth("referrals:write"), asyncHandler(adminRejectReferral));
  app.post("/admin/referrals/:id/revoke", adminAuth("referrals:write"), asyncHandler(adminRevokeReferral));
  app.post("/admin/referrals/:id/restore", adminAuth("referrals:write"), asyncHandler(adminRestoreReferral));
  app.put("/admin/referrals/settings", adminAuth("referrals:write"), asyncHandler(adminUpdateReferralSettings));
  app.get("/admin/help", adminAuth("help:read"), asyncHandler(adminHelpArticles));
  app.get("/admin/help/categories", adminAuth("help:read"), asyncHandler(adminHelpCategories));
  app.post("/admin/help/categories", adminAuth("help:write"), asyncHandler(adminCreateHelpCategory));
  app.put("/admin/help/categories/:id", adminAuth("help:write"), asyncHandler(adminUpdateHelpCategory));
  app.delete("/admin/help/categories/:id", adminAuth("help:write"), asyncHandler(adminDeleteHelpCategory));
  app.get("/admin/help/articles/:id", adminAuth("help:read"), asyncHandler(adminHelpArticleDetails));
  app.post("/admin/help/articles", adminAuth("help:write"), asyncHandler(adminCreateHelpArticle));
  app.put("/admin/help/articles/:id", adminAuth("help:write"), asyncHandler(adminUpdateHelpArticle));
  app.delete("/admin/help/articles/:id", adminAuth("help:write"), asyncHandler(adminDeleteHelpArticle));
  app.post("/admin/help/articles/:id/publish", adminAuth("help:write"), asyncHandler(adminPublishHelpArticle));
  app.post("/admin/help/articles/:id/archive", adminAuth("help:write"), asyncHandler(adminArchiveHelpArticle));
  app.post("/admin/help/articles/:id/translate", adminAuth("help:write"), asyncHandler(adminTranslateHelpArticle));
  app.post("/admin/help/articles/:id/restore-version", adminAuth("help:write"), asyncHandler(adminRestoreHelpVersion));
  app.get("/admin/about", adminAuth("about:read"), asyncHandler(adminAboutContent));
  app.put("/admin/about/:id", adminAuth("about:write"), asyncHandler(adminUpdateAboutContent));
  app.get("/admin/localizations", adminAuth("localizations:read"), asyncHandler(adminLocalizations));
  app.post("/admin/localizations", adminAuth("localizations:write"), asyncHandler(adminCreateLocalizationVersion));
  app.get("/admin/audit", adminAuth("audit:read"), asyncHandler(adminAudit));
  app.get("/admin/login-attempts", adminAuth("audit:read"), asyncHandler(adminLoginAttempts));
  app.get("/admin/settings", adminAuth("settings:read"), asyncHandler(adminSettings));
  app.put("/admin/settings/:key", adminAuth("settings:write"), asyncHandler(adminUpsertSetting));
  app.get("/admin/security", adminAuth("security:read"), asyncHandler(adminSecurityEvents));
  app.get("/admin/errors", adminAuth("errors:read"), asyncHandler(adminSystemErrors));
  app.get("/admin/backups", adminAuth("backups:read"), asyncHandler(adminBackups));
  app.post("/admin/backups", adminAuth("backups:write"), asyncHandler(adminCreateBackup));
  app.get("/admin/gdpr", adminAuth("gdpr.view"), asyncHandler(adminGdprRequests));
  app.post("/admin/gdpr", adminAuth("gdpr.create"), asyncHandler(adminCreateGdprRequest));
  app.get("/admin/gdpr/:id", adminAuth("gdpr.view"), asyncHandler(adminGdprRequestDetails));
  app.patch("/admin/gdpr/:id", adminAuth("gdpr.comment"), asyncHandler(adminUpdateGdprStatus));
  app.post("/admin/gdpr/:id/status", adminAuth("gdpr.comment"), asyncHandler(adminUpdateGdprStatus));
  app.post("/admin/gdpr/:id/assign", adminAuth("gdpr.assign"), asyncHandler(adminAssignGdprRequest));
  app.post("/admin/gdpr/:id/comment", adminAuth("gdpr.comment"), asyncHandler(adminCommentGdprRequest));
  app.post("/admin/gdpr/:id/verify", adminAuth("gdpr.verify_identity"), asyncHandler(adminVerifyGdprIdentity));
  app.post("/admin/gdpr/:id/approve", adminAuth("gdpr.approve"), asyncHandler(adminApproveGdprRequest));
  app.post("/admin/gdpr/:id/reject", adminAuth("gdpr.reject"), asyncHandler(adminRejectGdprRequest));
  app.post("/admin/gdpr/:id/generate-export", adminAuth("gdpr.export"), asyncHandler(adminGenerateGdprExport));
  app.post("/admin/gdpr/:id/anonymize", adminAuth("gdpr.anonymize"), asyncHandler(adminAnonymizeGdprRequest));
  app.post("/admin/gdpr/:id/delete-account", adminAuth("gdpr.delete_user"), asyncHandler(adminDeleteGdprAccount));
  app.post("/admin/gdpr/:id/complete", adminAuth("gdpr.complete"), asyncHandler(adminCompleteGdprRequest));
  app.get("/admin/gdpr/:id/audit", adminAuth("gdpr.view_audit"), asyncHandler(adminGdprAudit));
  app.get("/admin/versions", adminAuth("versions:read"), asyncHandler(adminAppVersions));
  app.put("/admin/versions/:platform", adminAuth("versions:write"), asyncHandler(adminUpsertAppVersion));
  app.get("/admin/support", adminAuth("support:write"), asyncHandler(adminSupportTickets));
  app.post("/admin/support", adminAuth("support:write"), asyncHandler(adminCreateSupportTicket));
  app.get("/admin/support/:id", adminAuth("support:write"), asyncHandler(adminSupportTicketDetails));
  app.patch("/admin/support/:id", adminAuth("support:write"), asyncHandler(adminUpdateSupportTicket));
  app.post("/admin/support/:id/messages", adminAuth("support:write"), asyncHandler(adminCreateSupportMessage));
  app.delete("/admin/support/:id", adminAuth("support:write"), asyncHandler(adminDeleteSupportTicket));
  app.get("/admin/admins", adminAuth("admins:write"), asyncHandler(adminAdmins));
  app.post("/admin/admins", adminAuth("admins:write"), asyncHandler(adminCreateUser));
  app.patch("/admin/admins/:id", adminAuth("admins:write"), asyncHandler(adminUpdateUser));
  app.get("/admin/export/:section", adminAuth(), asyncHandler(adminExport));
}

export function adminPermissionsForRole(role) {
  return ADMIN_ROLES[role] ? [...ADMIN_ROLES[role]] : [];
}

export function adminRequiresTwoFactorSetup(roles, twoFactorEnabled) {
  return false;
}

async function adminLogin(req, res) {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const code = cleanCode(req.body?.code);
  const ip = requestIp(req);
  const userAgent = cleanText(req.headers["user-agent"], 512);
  if (!email || !password) return res.status(400).json({ code: "ADMIN_LOGIN_REQUIRED" });

  const locked = await pool.query(
    `SELECT MAX(locked_until) locked_until FROM admin_login_attempts
     WHERE email = $1 AND success = FALSE AND locked_until > UTC_TIMESTAMP()`,
    [email]
  );
  if (locked.rows[0]?.locked_until) {
    await logAdminLogin(null, email, ip, userAgent, false, "locked");
    return res.status(429).json({ code: "ADMIN_LOGIN_LOCKED", lockedUntil: locked.rows[0].locked_until });
  }

  const result = await pool.query(
    `SELECT id, email, password_hash, display_name, is_active, two_factor_enabled, two_factor_secret,
       failed_login_count, locked_until
     FROM admin_users WHERE email = $1`,
    [email]
  );
  const admin = result.rows[0];
  const passwordOk = admin?.is_active && await bcrypt.compare(password, admin.password_hash);
  if (!passwordOk) {
    await failedLogin(admin, email, ip, userAgent);
    return res.status(401).json({ code: "ADMIN_INVALID_CREDENTIALS" });
  }
  const roles = await adminRoles(admin.id);
  const mustSetupTwoFactor = adminRequiresTwoFactorSetup(roles, Boolean(admin.two_factor_enabled));
  if (admin.two_factor_enabled && !verifyTotp(code, admin.two_factor_secret)) {
    await logAdminLogin(admin.id, email, ip, userAgent, false, "two_factor_required");
    return res.status(401).json({ code: "ADMIN_2FA_REQUIRED", twoFactorRequired: true });
  }

  await pool.query(
    "UPDATE admin_users SET failed_login_count = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP() WHERE id = $1",
    [admin.id]
  );
  const session = await createAdminSession(admin, req, {
    twoFactorVerified: !mustSetupTwoFactor && (!admin.two_factor_enabled || Boolean(code))
  });
  await logAdminLogin(admin.id, email, ip, userAgent, true, null);
  setAdminCookie(res, session.token, session.expiresAt);
  res.json({
    token: session.token,
    csrfToken: csrfForToken(session.token),
    expiresAt: session.expiresAt,
    twoFactorSetupRequired: mustSetupTwoFactor,
    admin: await adminProfile(admin.id)
  });
}

async function adminMe(req, res) {
  res.json({ admin: req.admin, permissions: req.admin.permissions });
}

async function adminSetupTwoFactor(req, res) {
  const secret = base32Secret();
  await pool.query("UPDATE admin_users SET two_factor_secret = $1 WHERE id = $2", [secret, req.admin.id]);
  await adminAudit(req, "admin.2fa_setup_started", "admin_user", req.admin.id);
  res.json({ secret, otpauthUrl: `otpauth://totp/GlucoTrack:${encodeURIComponent(req.admin.email)}?secret=${secret}&issuer=GlucoTrack` });
}

async function adminVerifyTwoFactor(req, res) {
  const code = cleanCode(req.body?.code);
  const profile = await pool.query("SELECT two_factor_secret FROM admin_users WHERE id = $1", [req.admin.id]);
  const secret = profile.rows[0]?.two_factor_secret;
  if (!secret || !verifyTotp(code, secret)) return res.status(400).json({ code: "ADMIN_2FA_INVALID" });
  await pool.query("UPDATE admin_users SET two_factor_enabled = TRUE WHERE id = $1", [req.admin.id]);
  await pool.query("UPDATE admin_sessions SET two_factor_verified = TRUE WHERE id = $1", [req.admin.sessionId]);
  await pool.query(
    "UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP() WHERE admin_user_id = $1 AND id <> $2 AND revoked_at IS NULL",
    [req.admin.id, req.admin.sessionId]
  );
  await adminAudit(req, "admin.2fa_enabled", "admin_user", req.admin.id);
  res.json({ ok: true });
}

async function adminLogout(req, res) {
  await pool.query("UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = $1", [req.admin.sessionId]);
  setAdminCookie(res, "", new Date(0).toISOString());
  await adminAudit(req, "admin.logout", "admin_session", req.admin.sessionId);
  res.json({ ok: true });
}

async function adminDashboard(_req, res) {
  const [
    users,
    usersToday,
    users7d,
    users30d,
    verifiedEmails,
    blockedUsers,
    premium,
    familyPremium,
    trials,
    diary,
    devices,
    androidDevices,
    iosDevices,
    webDevices,
    desktopDevices,
    ai,
    sos,
    support,
    errors,
    payments,
    registrations,
    plans,
    platforms,
    locales,
    recentUsers
  ] = await Promise.all([
    count("users"),
    countWhere("users", "created_at >= UTC_DATE()"),
    countWhere("users", "created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY"),
    countWhere("users", "created_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY"),
    countWhere("users", "email_verified = TRUE"),
    countWhere("users", "admin_blocked_at IS NOT NULL"),
    countWhere("users", "subscription_status IN ('active','trialing') OR premium_status IN ('active','trialing')"),
    countWhere("users", "premium_plan = 'family' AND (subscription_status = 'active' OR premium_status = 'active')"),
    countWhere("trial_periods", "status = 'active' AND ends_at > UTC_TIMESTAMP()"),
    pool.query("SELECT (SELECT COUNT(*) FROM glucose_logs)+(SELECT COUNT(*) FROM insulin_logs)+(SELECT COUNT(*) FROM food_logs) count"),
    countWhere("account_devices", "revoked_at IS NULL"),
    countWhere("account_devices", "revoked_at IS NULL AND platform = 'android'"),
    countWhere("account_devices", "revoked_at IS NULL AND platform = 'ios'"),
    countWhere("account_devices", "revoked_at IS NULL AND platform = 'web'"),
    countWhere("account_devices", "revoked_at IS NULL AND platform IN ('windows','macos')"),
    countWhere("ai_requests", "created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY"),
    countWhere("sos_scans", "scanned_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY"),
    countWhere("support_tickets", "status IN ('open','pending')"),
    countWhere("system_errors", "status = 'open'"),
    pool.query("SELECT COALESCE(SUM(amount_minor),0) total_minor, COUNT(*) count FROM payments WHERE status IN ('succeeded','paid')"),
    pool.query("SELECT DATE(created_at) day, COUNT(*) count FROM users WHERE created_at >= UTC_DATE() - INTERVAL 13 DAY GROUP BY DATE(created_at) ORDER BY day"),
    pool.query("SELECT COALESCE(premium_plan, 'free') label, COUNT(*) count FROM users GROUP BY COALESCE(premium_plan, 'free') ORDER BY count DESC"),
    pool.query("SELECT platform label, COUNT(*) count FROM account_devices WHERE revoked_at IS NULL GROUP BY platform ORDER BY count DESC"),
    pool.query("SELECT preferred_locale label, COUNT(*) count FROM users GROUP BY preferred_locale ORDER BY count DESC LIMIT 10"),
    pool.query("SELECT id,email,full_name,created_at,subscription_status FROM users ORDER BY created_at DESC LIMIT 8")
  ]);
  res.json({
    stats: {
      users,
      usersToday,
      users7d,
      users30d,
      verifiedEmails,
      unverifiedEmails: Math.max(users - verifiedEmails, 0),
      blockedUsers,
      premium,
      freeUsers: Math.max(users - premium, 0),
      familyPremium,
      activeTrials: trials,
      diaryEntries: Number(diary.rows[0]?.count ?? 0),
      activeDevices: devices,
      androidDevices,
      iosDevices,
      webDevices,
      desktopDevices,
      aiRequests7d: ai,
      sosScans7d: sos,
      supportOpen: support,
      openErrors: errors,
      paidPayments: Number(payments.rows[0]?.count ?? 0),
      revenueMinor: Number(payments.rows[0]?.total_minor ?? 0)
    },
    charts: {
      registrations: registrations.rows,
      plans: plans.rows,
      platforms: platforms.rows,
      locales: locales.rows
    },
    recentUsers: recentUsers.rows.map(publicAdminUser)
  });
}

async function adminUsers(req, res) {
  const page = pageParams(req);
  const search = searchTerm(req);
  const where = search ? "WHERE email LIKE $1 OR full_name LIKE $1" : "";
  const params = search ? [`%${search}%`] : [];
  const rows = await pool.query(
    `SELECT id,email,full_name,preferred_locale,premium_status,premium_plan,premium_until,
       subscription_status,subscription_expires_at,trial_used,email_verified,created_at
     FROM users ${where} ORDER BY ${userSort(req)} LIMIT ${page.limit} OFFSET ${page.offset}`,
    params
  );
  const total = await pool.query(`SELECT COUNT(*) count FROM users ${where}`, params);
  res.json({ rows: rows.rows.map(publicAdminUser), total: Number(total.rows[0]?.count ?? 0), ...page });
}

async function adminUserDetails(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "INVALID_ID" });
  const user = await pool.query(
    `SELECT id,email,full_name,preferred_locale,premium_status,premium_plan,premium_until,
       subscription_status,subscription_expires_at,trial_started_at,trial_ends_at,trial_used,
       email_verified,diabetes_type,glucose_unit,created_at
     FROM users WHERE id = $1`,
    [id]
  );
  if (!user.rowCount) return res.status(404).json({ code: "USER_NOT_FOUND" });
  const [subscriptions, devices, sessions, trials, reports, family, sos] = await Promise.all([
    pool.query("SELECT provider,plan,status,expires_at,created_at,updated_at FROM subscriptions WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 20", [id]),
    pool.query("SELECT id,device_id,device_name,platform,last_seen_at,created_at,revoked_at FROM account_devices WHERE user_id = $1 ORDER BY last_seen_at DESC LIMIT 50", [id]),
    pool.query("SELECT id,expires_at,revoked_at,created_at FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50", [id]),
    pool.query("SELECT started_at,ends_at,status,created_at FROM trial_periods WHERE user_id = $1", [id]),
    pool.query("SELECT id,title,created_at FROM reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20", [id]),
    pool.query("SELECT id,invite_email,status,expires_at,accepted_at FROM family_links WHERE owner_user_id = $1 OR caregiver_user_id = $1 ORDER BY created_at DESC LIMIT 20", [id]),
    pool.query("SELECT public_token,hide_sensitive,updated_at FROM sos_profiles WHERE user_id = $1", [id])
  ]);
  res.json({
    user: publicAdminUser(user.rows[0]),
    subscriptions: subscriptions.rows,
    devices: devices.rows,
    sessions: sessions.rows,
    trials: trials.rows,
    reports: reports.rows,
    family: family.rows,
    sos: sos.rows[0] ?? null
  });
}

async function adminRevokeUserSessions(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "INVALID_ID" });
  await pool.transaction(async (query) => {
    await query("UPDATE users SET token_version = token_version + 1 WHERE id = $1", [id]);
    await query("UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = $1 AND revoked_at IS NULL", [id]);
  });
  await adminAudit(req, "user.sessions_revoked", "user", id);
  res.json({ ok: true });
}

async function adminBlockUser(req, res) {
  const id = positiveId(req.params.id);
  const reason = cleanText(req.body?.reason, 255);
  if (!id || !reason) return res.status(400).json({ code: "USER_BLOCK_REASON_REQUIRED" });
  await pool.transaction(async (query) => {
    await query("UPDATE users SET admin_blocked_at = UTC_TIMESTAMP(), admin_block_reason = $1, token_version = token_version + 1 WHERE id = $2", [reason, id]);
    await query("UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = $1 AND revoked_at IS NULL", [id]);
  });
  await writeAudit(req.admin.id, "user.blocked", "user", id, req, { reason });
  res.json({ ok: true });
}

async function adminUnblockUser(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "INVALID_ID" });
  await pool.query("UPDATE users SET admin_blocked_at = NULL, admin_block_reason = NULL WHERE id = $1", [id]);
  await writeAudit(req.admin.id, "user.unblocked", "user", id, req);
  res.json({ ok: true });
}

async function adminVerifyUserEmail(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "INVALID_ID" });
  await pool.query("UPDATE users SET email_verified = TRUE, email_verification_token_hash = NULL, email_verification_expires_at = NULL WHERE id = $1", [id]);
  await writeAudit(req.admin.id, "user.email_verified", "user", id, req);
  res.json({ ok: true });
}

async function adminExtendUserSubscription(req, res) {
  const id = positiveId(req.params.id);
  const days = Math.min(Math.max(Number.parseInt(req.body?.days, 10) || 0, 1), 3650);
  const plan = cleanText(req.body?.plan, 32) || "premium";
  const allowedPlans = new Set(["premium", "monthly", "yearly", "family"]);
  if (!id || !allowedPlans.has(plan)) return res.status(400).json({ code: "SUBSCRIPTION_EXTENSION_INVALID" });
  let result;
  await pool.transaction(async (query) => {
    const user = await query("SELECT id, subscription_expires_at FROM users WHERE id = $1 FOR UPDATE", [id]);
    if (!user.rowCount) {
      result = null;
      return;
    }
    await query(
      `UPDATE users
       SET premium_status = 'active',
           subscription_status = 'active',
           premium_plan = $1,
           premium_until = DATE_ADD(GREATEST(COALESCE(subscription_expires_at, UTC_TIMESTAMP()), UTC_TIMESTAMP()), INTERVAL $2 DAY),
           subscription_expires_at = DATE_ADD(GREATEST(COALESCE(subscription_expires_at, UTC_TIMESTAMP()), UTC_TIMESTAMP()), INTERVAL $2 DAY)
       WHERE id = $3`,
      [plan, days, id]
    );
    await query(
      `INSERT INTO subscriptions(user_id, provider, provider_subscription_id, plan, status, expires_at, updated_at)
       VALUES($1, 'admin_manual', $2, $3, 'active',
         DATE_ADD(GREATEST(COALESCE((SELECT subscription_expires_at FROM users WHERE id = $1), UTC_TIMESTAMP()), UTC_TIMESTAMP()), INTERVAL 0 DAY),
         UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         plan = VALUES(plan),
         status = VALUES(status),
         expires_at = VALUES(expires_at),
         updated_at = UTC_TIMESTAMP()`,
      [id, `admin-manual-${id}`, plan]
    );
    result = await query(
      "SELECT id,email,premium_plan,subscription_status,subscription_expires_at,premium_until FROM users WHERE id = $1",
      [id]
    );
  });
  if (!result?.rowCount) return res.status(404).json({ code: "USER_NOT_FOUND" });
  await writeAudit(req.admin.id, "subscription.extended", "user", id, req, {
    plan,
    days,
    subscriptionExpiresAt: result.rows[0].subscription_expires_at
  });
  res.json({ ok: true, user: publicAdminUser(result.rows[0]), days, plan });
}

async function adminRevokeUserDevice(req, res) {
  const id = positiveId(req.params.id);
  const deviceId = cleanText(req.params.deviceId, 128);
  if (!id || !deviceId) return res.status(400).json({ code: "INVALID_DEVICE" });
  await pool.transaction(async (query) => {
    await query("UPDATE account_devices SET revoked_at = UTC_TIMESTAMP() WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL", [id, deviceId]);
    await query("UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL", [id, deviceId]);
  });
  await writeAudit(req.admin.id, "user.device_revoked", "account_device", deviceId, req, { userId: id });
  res.json({ ok: true });
}

async function adminRevokeUserSession(req, res) {
  const userId = positiveId(req.params.id);
  const sessionId = positiveId(req.params.sessionId);
  if (!userId || !sessionId) return res.status(400).json({ code: "INVALID_SESSION" });
  await pool.query("UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = $1 AND id = $2 AND revoked_at IS NULL", [userId, sessionId]);
  await writeAudit(req.admin.id, "user.session_revoked", "refresh_token", sessionId, req, { userId });
  res.json({ ok: true });
}

async function adminMedicalSnapshot(req, res) {
  const id = positiveId(req.params.id);
  const reason = cleanText(req.body?.reason, 512);
  const anonymized = req.body?.anonymized !== false;
  if (!id || !reason) return res.status(400).json({ code: "MEDICAL_REASON_REQUIRED" });
  const [glucose, insulin, food, snapshot] = await Promise.all([
    pool.query("SELECT glucose_mmol, measured_at, source FROM glucose_logs WHERE user_id = $1 ORDER BY measured_at DESC LIMIT 50", [id]),
    pool.query("SELECT units, insulin_type, administered_at FROM insulin_logs WHERE user_id = $1 ORDER BY administered_at DESC LIMIT 50", [id]),
    pool.query("SELECT title, carbs_grams, eaten_at FROM food_logs WHERE user_id = $1 ORDER BY eaten_at DESC LIMIT 50", [id]),
    pool.query("SELECT payload, updated_at FROM health_snapshots WHERE user_id = $1", [id])
  ]);
  await writeAudit(req.admin.id, "medical.viewed", "user", id, req, { reason, anonymized, categories: ["glucose", "insulin", "food", "snapshot"] });
  res.json({
    userId: anonymized ? `user-${id}` : String(id),
    anonymized,
    glucose: glucose.rows,
    insulin: insulin.rows,
    food: food.rows,
    snapshot: snapshot.rows[0] ?? null
  });
}

async function adminSubscriptions(req, res) {
  const page = pageParams(req);
  const search = searchTerm(req);
  const where = [
    "(u.subscription_status IS NOT NULL OR u.premium_plan IS NOT NULL OR u.premium_until IS NOT NULL OR u.subscription_expires_at IS NOT NULL)"
  ];
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    where.push("(u.email LIKE $1 OR u.full_name LIKE $1)");
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const latestSubscriptionJoin = `
    LEFT JOIN subscriptions s ON s.id = (
      SELECT s2.id FROM subscriptions s2
      WHERE s2.user_id = u.id
      ORDER BY s2.updated_at DESC, s2.id DESC
      LIMIT 1
    )`;
  const rows = await pool.query(
    `SELECT COALESCE(s.id, u.id) id, u.id user_id, u.email, u.full_name,
       COALESCE(s.provider, 'user_state') provider,
       COALESCE(s.plan, u.premium_plan) plan,
       COALESCE(s.status, u.subscription_status, u.premium_status) status,
       COALESCE(s.expires_at, u.subscription_expires_at, u.premium_until) expires_at,
       COALESCE(s.created_at, u.created_at) created_at,
       COALESCE(s.updated_at, u.subscription_expires_at, u.premium_until, u.created_at) updated_at
     FROM users u ${latestSubscriptionJoin}
     ${whereSql}
     ORDER BY COALESCE(s.updated_at, u.subscription_expires_at, u.premium_until, u.created_at) DESC
     LIMIT ${page.limit} OFFSET ${page.offset}`,
    params
  );
  const total = await pool.query(`SELECT COUNT(*) count FROM users u ${whereSql}`, params);
  res.json({ rows: rows.rows, total: Number(total.rows[0]?.count ?? 0), ...page });
}

async function adminPayments(req, res) {
  await listJoined(req, res, {
    select: `p.id,p.user_id,u.email,u.full_name,p.provider,p.amount_minor,p.currency,p.status,p.created_at`,
    from: "payments p JOIN users u ON u.id = p.user_id",
    order: "p.created_at DESC"
  });
}

async function adminDevices(req, res) {
  await listJoined(req, res, {
    select: `d.id,d.user_id,u.email,u.full_name,d.device_id,d.device_name,d.platform,d.last_seen_at,d.created_at,d.revoked_at`,
    from: "account_devices d JOIN users u ON u.id = d.user_id",
    order: "d.last_seen_at DESC"
  });
}

async function adminTrials(req, res) {
  await listJoined(req, res, {
    select: `t.id,t.user_id,u.email,u.full_name,t.started_at,t.ends_at,t.status,t.device_hash,t.created_at`,
    from: "trial_periods t JOIN users u ON u.id = t.user_id",
    order: "t.created_at DESC"
  });
}

async function adminFamily(req, res) {
  const page = pageParams(req);
  const search = searchTerm(req);
  const where = ["(u.premium_plan = 'family' OR f.id IS NOT NULL)"];
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    where.push("(u.email LIKE $1 OR u.full_name LIKE $1 OR f.invite_email LIKE $1)");
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const rows = await pool.query(
    `SELECT COALESCE(f.id, CONCAT('owner-', u.id)) id,
       u.id owner_user_id,
       f.caregiver_user_id,
       u.email owner_email,
       COALESCE(f.invite_email, '') invite_email,
       CASE WHEN f.id IS NULL THEN 'no_members' ELSE f.status END status,
       COALESCE(f.expires_at, u.subscription_expires_at, u.premium_until) expires_at,
       f.accepted_at,
       COALESCE(f.created_at, u.created_at) created_at,
       (SELECT COUNT(*) FROM family_links fl WHERE fl.owner_user_id = u.id AND fl.status IN ('pending','accepted')) member_count
     FROM users u
     LEFT JOIN family_links f ON f.owner_user_id = u.id
     ${whereSql}
     ORDER BY COALESCE(f.created_at, u.subscription_expires_at, u.created_at) DESC
     LIMIT ${page.limit} OFFSET ${page.offset}`,
    params
  );
  const total = await pool.query(
    `SELECT COUNT(*) count FROM users u LEFT JOIN family_links f ON f.owner_user_id = u.id ${whereSql}`,
    params
  );
  res.json({ rows: rows.rows, total: Number(total.rows[0]?.count ?? 0), ...page });
}

async function adminSos(req, res) {
  const page = pageParams(req);
  const rows = await pool.query(
    `SELECT s.user_id,u.email,u.full_name,s.public_token,s.hide_sensitive,s.updated_at,
       (SELECT COUNT(*) FROM sos_scans sc WHERE sc.user_id = s.user_id) scan_count
     FROM sos_profiles s JOIN users u ON u.id = s.user_id
     ORDER BY s.updated_at DESC LIMIT ${page.limit} OFFSET ${page.offset}`
  );
  const total = await count("sos_profiles");
  res.json({ rows: rows.rows, total, ...page });
}

async function adminAi(req, res) {
  await listJoined(req, res, {
    select: `a.id,a.user_id,u.email,u.full_name,a.request_type,a.locale,a.status,a.model,a.input_tokens,a.output_tokens,a.created_at`,
    from: "ai_requests a JOIN users u ON u.id = a.user_id",
    order: "a.created_at DESC"
  });
}

async function adminNotifications(req, res) {
  const page = pageParams(req);
  const search = searchTerm(req);
  const params = search ? [`%${search}%`] : [];
  const where = search ? "WHERE c.title LIKE $1 OR c.status LIKE $1 OR c.locale LIKE $1" : "";
  const rows = await pool.query(
    `SELECT c.id,c.title,c.locale,c.status,c.created_by,a.email created_by_email,
       COALESCE(c.recipient_count, 0) recipient_count,
       COALESCE(c.delivered_count, delivered.delivered_count, 0) delivered_count,
       COALESCE(c.audience_filter, JSON_OBJECT('audience','all')) audience_filter,
       c.created_at,c.scheduled_at,c.sent_at
     FROM notification_campaigns c
     LEFT JOIN admin_users a ON a.id = c.created_by
     LEFT JOIN (
       SELECT campaign_id, COUNT(*) delivered_count
       FROM notification_deliveries
       WHERE status = 'delivered'
       GROUP BY campaign_id
     ) delivered ON delivered.campaign_id = c.id
     ${where}
     ORDER BY c.created_at DESC LIMIT ${page.limit} OFFSET ${page.offset}`,
    params
  );
  const total = await pool.query(`SELECT COUNT(*) count FROM notification_campaigns c ${where}`, params);
  res.json({ rows: rows.rows, total: Number(total.rows[0]?.count ?? 0), ...page });
}

async function adminCreateNotificationCampaign(req, res) {
  const title = cleanText(req.body?.title, 255);
  const body = cleanText(req.body?.body, 5000);
  const locale = cleanText(req.body?.locale, 16) || null;
  const status = enumValue(req.body?.status, ["draft", "scheduled", "send_now"], "draft");
  const scheduledAt = parseOptionalDate(req.body?.scheduledAt);
  const audienceFilter = notificationAudienceFilter(req.body);
  if (!title || !body) return res.status(400).json({ code: "CAMPAIGN_INVALID" });
  const normalizedStatus = status === "send_now" ? "draft" : status;
  const inserted = await pool.query(
    `INSERT INTO notification_campaigns(title, body, locale, status, audience_filter, created_by, scheduled_at)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [title, body, locale, normalizedStatus, audienceFilter, req.admin.id, scheduledAt]
  );
  await writeAudit(req.admin.id, "notification_campaign.created", "notification_campaign", inserted.insertId, req);
  if (status === "send_now") {
    const result = await deliverNotificationCampaign(inserted.insertId, req.admin.id);
    await writeAudit(req.admin.id, "notification_campaign.sent", "notification_campaign", inserted.insertId, req, result);
    return res.status(201).json({ id: String(inserted.insertId), title, locale, status: "sent", scheduledAt, ...result });
  }
  res.status(201).json({ id: String(inserted.insertId), title, locale, status: normalizedStatus, scheduledAt, audienceFilter });
}

async function adminNotificationPreview(req, res) {
  const audienceFilter = notificationAudienceFilter(req.body);
  const recipients = await notificationRecipients(audienceFilter, { limit: 100 });
  const total = await notificationRecipientCount(audienceFilter);
  res.json({ total, sample: recipients.map(notificationRecipientRow), audienceFilter });
}

async function adminNotificationDetails(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "CAMPAIGN_ID_INVALID" });
  const campaignRows = await pool.query(
    `SELECT c.id,c.title,c.body,c.locale,c.status,c.audience_filter,c.recipient_count,c.delivered_count,
       c.created_by,a.email created_by_email,c.created_at,c.scheduled_at,c.sent_at
     FROM notification_campaigns c
     LEFT JOIN admin_users a ON a.id = c.created_by
     WHERE c.id = $1`,
    [id]
  );
  const campaign = campaignRows.rows[0];
  if (!campaign) return res.status(404).json({ code: "CAMPAIGN_NOT_FOUND" });
  const stats = await pool.query(
    `SELECT status, COUNT(*) count
     FROM notification_deliveries
     WHERE campaign_id = $1
     GROUP BY status`,
    [id]
  );
  const deliveries = await pool.query(
    `SELECT d.id,d.user_id,u.email,u.full_name,d.notification_id,d.channel,d.status,d.delivered_at,d.error_message
     FROM notification_deliveries d
     JOIN users u ON u.id = d.user_id
     WHERE d.campaign_id = $1
     ORDER BY d.id DESC
     LIMIT 100`,
    [id]
  );
  res.json({ campaign, stats: stats.rows, deliveries: deliveries.rows });
}

async function adminSendNotificationCampaign(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "CAMPAIGN_ID_INVALID" });
  const result = await deliverNotificationCampaign(id, req.admin.id);
  await writeAudit(req.admin.id, "notification_campaign.sent", "notification_campaign", id, req, result);
  res.json(result);
}

async function adminReferrals(req, res) {
  const page = pageParams(req);
  const search = searchTerm(req);
  const params = [];
  const where = [];
  if (search) {
    params.push(`%${search}%`);
    where.push(`(referrer.email LIKE $${params.length} OR referred.email LIKE $${params.length} OR rc.code LIKE $${params.length} OR rr.status LIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await pool.query(
    `SELECT rr.id, rc.code, referrer.email referrer_email, referred.email referred_email,
       rr.status, rr.rejection_reason, rr.registered_at, rr.email_verified_at,
       rr.qualified_at, rr.rewarded_at,
       COALESCE(SUM(CASE WHEN rw.status = 'granted' THEN rw.reward_days ELSE 0 END), 0) granted_days
     FROM referral_relations rr
     JOIN referral_codes rc ON rc.id = rr.referral_code_id
     JOIN users referrer ON referrer.id = rr.referrer_user_id
     JOIN users referred ON referred.id = rr.referred_user_id
     LEFT JOIN referral_rewards rw ON rw.referral_relation_id = rr.id
     ${whereSql}
     GROUP BY rr.id, rc.code, referrer.email, referred.email, rr.status, rr.rejection_reason,
       rr.registered_at, rr.email_verified_at, rr.qualified_at, rr.rewarded_at
     ORDER BY rr.created_at DESC
     LIMIT ${page.limit} OFFSET ${page.offset}`,
    params
  );
  const total = await pool.query(
    `SELECT COUNT(*) count
     FROM referral_relations rr
     JOIN referral_codes rc ON rc.id = rr.referral_code_id
     JOIN users referrer ON referrer.id = rr.referrer_user_id
     JOIN users referred ON referred.id = rr.referred_user_id
     ${whereSql}`,
    params
  );
  res.json({ rows: rows.rows, total: Number(total.rows[0]?.count ?? 0), ...page });
}

async function adminReferralDetails(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "REFERRAL_ID_INVALID" });
  const relation = await pool.query(
    `SELECT rr.*, rc.code, referrer.email referrer_email, referred.email referred_email
     FROM referral_relations rr
     JOIN referral_codes rc ON rc.id = rr.referral_code_id
     JOIN users referrer ON referrer.id = rr.referrer_user_id
     JOIN users referred ON referred.id = rr.referred_user_id
     WHERE rr.id = $1`,
    [id]
  );
  if (!relation.rowCount) return res.status(404).json({ code: "REFERRAL_NOT_FOUND" });
  const rewards = await pool.query("SELECT * FROM referral_rewards WHERE referral_relation_id = $1 ORDER BY id", [id]);
  const fraud = await pool.query("SELECT check_type,result,risk_score,details_json,created_at FROM referral_fraud_checks WHERE referral_relation_id = $1 ORDER BY created_at DESC", [id]);
  res.json({ referral: relation.rows[0], rewards: rewards.rows, fraud: fraud.rows });
}

async function adminApproveReferral(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "REFERRAL_ID_INVALID" });
  const updated = await pool.query(
    `UPDATE referral_relations
     SET status = CASE
       WHEN email_verified_at IS NULL THEN 'email_pending'
       WHEN qualified_at IS NULL THEN 'awaiting_payment'
       WHEN rewarded_at IS NULL THEN 'qualified'
       ELSE status END,
       rejection_reason = NULL
     WHERE id = $1 AND status IN ('manual_review','rejected')`,
    [id]
  );
  if (!updated.rowCount) return res.status(404).json({ code: "REFERRAL_NOT_FOUND_OR_NOT_REVIEWABLE" });
  await writeAudit(req.admin.id, "referral.approved", "referral", id, req);
  res.json({ ok: true });
}

async function adminRejectReferral(req, res) {
  const id = positiveId(req.params.id);
  const reason = cleanText(req.body?.reason, 96) || "admin_rejected";
  if (!id) return res.status(400).json({ code: "REFERRAL_ID_INVALID" });
  await pool.query(
    `UPDATE referral_relations SET status = 'rejected', rejected_at = UTC_TIMESTAMP(), rejection_reason = $2 WHERE id = $1`,
    [id, reason]
  );
  await pool.query("UPDATE referral_rewards SET status = 'revoked', revoked_at = UTC_TIMESTAMP(), revoke_reason = $2 WHERE referral_relation_id = $1", [id, reason]);
  await writeAudit(req.admin.id, "referral.rejected", "referral", id, req, { reason });
  res.json({ ok: true });
}

async function adminRevokeReferral(req, res) {
  const id = positiveId(req.params.id);
  const reason = cleanText(req.body?.reason, 96) || "admin_revoked";
  if (!id) return res.status(400).json({ code: "REFERRAL_ID_INVALID" });
  await pool.query("UPDATE referral_relations SET status = 'revoked', rejection_reason = $2 WHERE id = $1", [id, reason]);
  await pool.query("UPDATE referral_rewards SET status = 'revoked', revoked_at = UTC_TIMESTAMP(), revoke_reason = $2 WHERE referral_relation_id = $1", [id, reason]);
  await pool.query(
    `UPDATE premium_bonus_periods SET status = 'revoked', revoked_at = UTC_TIMESTAMP(), revoke_reason = $2
     WHERE source = 'referral' AND source_id IN (SELECT id FROM referral_rewards WHERE referral_relation_id = $1)`,
    [id, reason]
  );
  await writeAudit(req.admin.id, "referral.revoked", "referral", id, req, { reason });
  res.json({ ok: true });
}

async function adminRestoreReferral(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "REFERRAL_ID_INVALID" });
  await pool.query(
    `UPDATE referral_relations
     SET status = CASE WHEN email_verified_at IS NULL THEN 'email_pending' ELSE 'awaiting_payment' END,
       rejected_at = NULL, rejection_reason = NULL
     WHERE id = $1 AND status IN ('rejected','revoked')`,
    [id]
  );
  await writeAudit(req.admin.id, "referral.restored", "referral", id, req);
  res.json({ ok: true });
}

async function adminUpdateReferralSettings(req, res) {
  const allowed = {
    programEnabled: "boolean",
    referrerRewardDays: "number",
    referredRewardEnabled: "boolean",
    referredRewardDays: "number",
    attributionDays: "number",
    monthlyRewardLimit: "number",
    lifetimeRewardLimit: "number",
    minimumPaymentMinor: "number",
    eligiblePlans: "array",
    reviewDelayDays: "number"
  };
  for (const [key, type] of Object.entries(allowed)) {
    if (!(key in (req.body || {}))) continue;
    const value = req.body[key];
    if (type === "boolean" && typeof value !== "boolean") continue;
    if (type === "number" && !Number.isSafeInteger(Number(value))) continue;
    if (type === "array" && !Array.isArray(value)) continue;
    await pool.query(
      `INSERT INTO referral_settings(setting_key, setting_value, updated_by)
       VALUES($1, $2, $3)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = UTC_TIMESTAMP()`,
      [key, type === "number" ? Number(value) : value, req.admin.id]
    );
  }
  await writeAudit(req.admin.id, "referral.settings_updated", "referral_settings", null, req);
  res.json({ ok: true });
}

function notificationAudienceFilter(body = {}) {
  const audience = enumValue(body.audience, ["all", "user", "locale", "plan", "subscription_status"], "all");
  const filter = { audience };
  if (audience === "user") {
    const userId = positiveId(body.userId);
    if (!userId) return { audience: "none" };
    filter.userId = userId;
  }
  if (audience === "locale") filter.locale = cleanText(body.audienceLocale || body.locale, 16);
  if (audience === "plan") filter.plan = cleanText(body.plan, 64);
  if (audience === "subscription_status") {
    filter.subscriptionStatus = enumValue(body.subscriptionStatus, ["active", "inactive", "expired", "trial", "cancelled"], "active");
  }
  return filter;
}

function notificationAudienceWhere(filter = {}, startIndex = 1) {
  const audience = filter.audience || "all";
  const params = [];
  const where = ["u.admin_blocked_at IS NULL"];
  if (audience === "none") where.push("1 = 0");
  if (audience === "user") {
    where.push(`u.id = $${startIndex + params.length}`);
    params.push(filter.userId);
  }
  if (audience === "locale" && filter.locale) {
    where.push(`u.preferred_locale = $${startIndex + params.length}`);
    params.push(filter.locale);
  }
  if (audience === "plan" && filter.plan) {
    where.push(`u.premium_plan = $${startIndex + params.length}`);
    params.push(filter.plan);
  }
  if (audience === "subscription_status" && filter.subscriptionStatus) {
    where.push(`u.subscription_status = $${startIndex + params.length}`);
    params.push(filter.subscriptionStatus);
  }
  return { where: where.join(" AND "), params };
}

async function notificationRecipientCount(filter) {
  const audience = notificationAudienceWhere(filter);
  const rows = await pool.query(`SELECT COUNT(*) count FROM users u WHERE ${audience.where}`, audience.params);
  return Number(rows.rows[0]?.count ?? 0);
}

async function notificationRecipients(filter, { limit = 10000 } = {}) {
  const audience = notificationAudienceWhere(filter);
  const rows = await pool.query(
    `SELECT u.id,u.email,u.full_name,u.preferred_locale,u.premium_plan,u.subscription_status
     FROM users u
     WHERE ${audience.where}
     ORDER BY u.id ASC
     LIMIT ${Math.min(Math.max(Number(limit) || 100, 1), 10000)}`,
    audience.params
  );
  return rows.rows;
}

function notificationRecipientRow(row) {
  return {
    id: String(row.id),
    email: row.email,
    fullName: row.full_name,
    locale: row.preferred_locale,
    premiumPlan: row.premium_plan,
    subscriptionStatus: row.subscription_status
  };
}

async function deliverNotificationCampaign(campaignId, adminUserId) {
  return pool.transaction(async (query) => {
    const campaignRows = await query(
      `SELECT id,title,body,locale,status,COALESCE(audience_filter, JSON_OBJECT('audience','all')) audience_filter,sent_at
       FROM notification_campaigns
       WHERE id = $1
       FOR UPDATE`,
      [campaignId]
    );
    const campaign = campaignRows.rows[0];
    if (!campaign) {
      const error = new Error("CAMPAIGN_NOT_FOUND");
      error.statusCode = 404;
      throw error;
    }
    if (campaign.sent_at || campaign.status === "sent") {
      const error = new Error("CAMPAIGN_ALREADY_SENT");
      error.statusCode = 409;
      throw error;
    }
    const filter = parseJsonObject(campaign.audience_filter) || { audience: "all" };
    const audience = notificationAudienceWhere(filter);
    const recipients = await query(
      `SELECT u.id,u.email,u.full_name,u.preferred_locale,u.premium_plan,u.subscription_status
       FROM users u
       WHERE ${audience.where}
       ORDER BY u.id ASC
       LIMIT 10000`,
      audience.params
    );
    let delivered = 0;
    for (const recipient of recipients.rows) {
      const notification = await query(
        `INSERT INTO notifications(user_id,type,title,body,metadata)
         VALUES($1,'campaign',$2,$3,$4)`,
        [recipient.id, campaign.title, campaign.body, {
          campaignId: String(campaign.id),
          locale: campaign.locale,
          audience: filter
        }]
      );
      await query(
        `INSERT INTO notification_deliveries(campaign_id,user_id,notification_id,channel,status,delivered_at)
         VALUES($1,$2,$3,'in_app','delivered',UTC_TIMESTAMP())`,
        [campaign.id, recipient.id, notification.insertId]
      );
      delivered += 1;
    }
    await query(
      `UPDATE notification_campaigns
       SET status = 'sent', recipient_count = $1, delivered_count = $2, sent_at = UTC_TIMESTAMP()
       WHERE id = $3`,
      [recipients.rowCount, delivered, campaign.id]
    );
    return { ok: true, campaignId: String(campaign.id), recipientCount: recipients.rowCount, deliveredCount: delivered };
  });
}

function parseJsonObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function adminHelpArticles(req, res) {
  const page = pageParams(req);
  const search = searchTerm(req);
  const locale = helpLocale(req.query.locale || "en");
  const where = search
    ? "WHERE a.slug LIKE $2 OR COALESCE(t.title, fallback.title) LIKE $2 OR c.slug LIKE $2"
    : "";
  const params = search ? [locale, `%${search}%`] : [locale];
  const rows = await pool.query(
    `SELECT a.id, a.slug, a.status, a.is_featured, a.view_count, a.updated_at, c.slug category,
       COALESCE(t.title, fallback.title) title,
       COALESCE(t.translation_status, fallback.translation_status) translation_status,
       GROUP_CONCAT(DISTINCT tr.locale ORDER BY tr.locale SEPARATOR ',') languages
     FROM help_articles a
     JOIN help_categories c ON c.id = a.category_id
     LEFT JOIN help_article_translations t ON t.article_id = a.id AND t.locale = $1
     LEFT JOIN help_article_translations fallback ON fallback.article_id = a.id AND fallback.locale = 'en'
     LEFT JOIN help_article_translations tr ON tr.article_id = a.id
     ${where}
     GROUP BY a.id, a.slug, a.status, a.is_featured, a.view_count, a.updated_at, c.slug, title, translation_status
     ORDER BY a.updated_at DESC LIMIT ${page.limit} OFFSET ${page.offset}`,
    params
  );
  const total = await pool.query(
    `SELECT COUNT(*) count FROM help_articles a JOIN help_categories c ON c.id = a.category_id
     LEFT JOIN help_article_translations t ON t.article_id = a.id AND t.locale = $1
     LEFT JOIN help_article_translations fallback ON fallback.article_id = a.id AND fallback.locale = 'en'
     ${where}`,
    params
  );
  res.json({ rows: rows.rows, total: Number(total.rows[0]?.count ?? 0), ...page });
}

async function adminHelpCategories(_req, res) {
  const rows = await pool.query(
    `SELECT c.id, c.slug, c.icon, c.sort_order, c.is_active,
       COALESCE(ru.title, en.title) title,
       COALESCE(ru.description, en.description) description,
       COUNT(a.id) article_count
     FROM help_categories c
     LEFT JOIN help_category_translations ru ON ru.category_id = c.id AND ru.locale = 'ru'
     LEFT JOIN help_category_translations en ON en.category_id = c.id AND en.locale = 'en'
     LEFT JOIN help_articles a ON a.category_id = c.id
     GROUP BY c.id, c.slug, c.icon, c.sort_order, c.is_active, title, description
     ORDER BY c.sort_order, c.slug`
  );
  res.json({ rows: rows.rows, total: rows.rowCount, locales: HELP_LOCALES });
}

async function adminCreateHelpCategory(req, res) {
  const slug = cleanHelpSlug(req.body?.slug);
  const title = cleanText(req.body?.title, 255);
  const description = cleanText(req.body?.description, 2000);
  const icon = cleanText(req.body?.icon, 64) || "circle-help";
  const sortOrder = Number.parseInt(req.body?.sortOrder ?? req.body?.sort_order, 10) || 0;
  if (!slug || !title) return res.status(400).json({ code: "HELP_CATEGORY_INVALID" });
  const inserted = await pool.query(
    "INSERT INTO help_categories(slug, icon, sort_order, is_active) VALUES($1, $2, $3, TRUE)",
    [slug, icon, sortOrder]
  );
  for (const locale of HELP_LOCALES) {
    await pool.query(
      "INSERT INTO help_category_translations(category_id, locale, title, description) VALUES($1, $2, $3, $4)",
      [inserted.insertId, locale, title, description]
    );
  }
  await writeAudit(req.admin.id, "help.category_created", "help_category", inserted.insertId, req, { slug });
  res.status(201).json({ id: String(inserted.insertId), slug });
}

async function adminUpdateHelpCategory(req, res) {
  const id = positiveId(req.params.id);
  const slug = cleanHelpSlug(req.body?.slug);
  const title = cleanText(req.body?.title, 255);
  const description = cleanText(req.body?.description, 2000);
  const icon = cleanText(req.body?.icon, 64) || "circle-help";
  const sortOrder = Number.parseInt(req.body?.sortOrder ?? req.body?.sort_order, 10) || 0;
  const isActive = req.body?.isActive ?? req.body?.is_active;
  if (!id || !slug || !title) return res.status(400).json({ code: "HELP_CATEGORY_INVALID" });
  await pool.query(
    "UPDATE help_categories SET slug = $1, icon = $2, sort_order = $3, is_active = $4 WHERE id = $5",
    [slug, icon, sortOrder, isActive !== false && isActive !== "false", id]
  );
  for (const locale of ["en", "ru"]) {
    await pool.query(
      `INSERT INTO help_category_translations(category_id, locale, title, description)
       VALUES($1, $2, $3, $4)
       ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description)`,
      [id, locale, title, description]
    );
  }
  await writeAudit(req.admin.id, "help.category_updated", "help_category", id, req, { slug });
  res.json({ ok: true });
}

async function adminDeleteHelpCategory(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "INVALID_ID" });
  const used = await pool.query("SELECT COUNT(*) count FROM help_articles WHERE category_id = $1", [id]);
  if (Number(used.rows[0]?.count ?? 0) > 0) return res.status(409).json({ code: "HELP_CATEGORY_NOT_EMPTY" });
  await pool.query("DELETE FROM help_categories WHERE id = $1", [id]);
  await writeAudit(req.admin.id, "help.category_deleted", "help_category", id, req);
  res.json({ ok: true });
}

async function adminHelpArticleDetails(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "INVALID_ID" });
  const article = await pool.query(
    `SELECT a.*, c.slug category FROM help_articles a JOIN help_categories c ON c.id = a.category_id WHERE a.id = $1`,
    [id]
  );
  if (!article.rowCount) return res.status(404).json({ code: "HELP_ARTICLE_NOT_FOUND" });
  const [translations, versions, feedback] = await Promise.all([
    pool.query("SELECT locale,title,summary,content,translation_status,source_version,updated_at,reviewed_at FROM help_article_translations WHERE article_id = $1 ORDER BY FIELD(locale,'en','ru') DESC, locale", [id]),
    pool.query("SELECT id,locale,title,translation_status,version_number,created_at FROM help_article_versions WHERE article_id = $1 ORDER BY created_at DESC LIMIT 30", [id]),
    pool.query("SELECT locale,helpful,COUNT(*) count FROM help_article_feedback WHERE article_id = $1 GROUP BY locale,helpful ORDER BY locale", [id])
  ]);
  res.json({ article: article.rows[0], translations: translations.rows, versions: versions.rows, feedback: feedback.rows, locales: HELP_LOCALES });
}

async function adminCreateHelpArticle(req, res) {
  const payload = helpArticlePayload(req);
  if (!payload.slug || !payload.categoryId || !payload.title || !payload.content) return res.status(400).json({ code: "HELP_ARTICLE_INVALID" });
  const inserted = await pool.query(
    `INSERT INTO help_articles(category_id, slug, status, is_featured, sort_order, published_at, created_by, updated_by)
     VALUES($1, $2, $3, $4, $5, CASE WHEN $3 = 'published' THEN UTC_TIMESTAMP() ELSE NULL END, $6, $6)`,
    [payload.categoryId, payload.slug, payload.status, payload.featured, payload.sortOrder, req.admin.id]
  );
  await upsertHelpTranslation(inserted.insertId, payload.locale, payload, req.admin.id);
  if (payload.locale === "en") await machineFillHelpTranslations(inserted.insertId, payload);
  await writeAudit(req.admin.id, "help.article_created", "help_article", inserted.insertId, req, { slug: payload.slug });
  res.status(201).json({ id: String(inserted.insertId), slug: payload.slug });
}

async function adminUpdateHelpArticle(req, res) {
  const id = positiveId(req.params.id);
  const payload = helpArticlePayload(req);
  if (!id || !payload.slug || !payload.categoryId || !payload.title || !payload.content) return res.status(400).json({ code: "HELP_ARTICLE_INVALID" });
  await saveHelpVersion(id, payload.locale, req.admin.id);
  await pool.query(
    `UPDATE help_articles
     SET category_id = $1, slug = $2, status = $3, is_featured = $4, sort_order = $5,
       published_at = CASE WHEN $3 = 'published' THEN COALESCE(published_at, UTC_TIMESTAMP()) ELSE published_at END,
       updated_by = $6
     WHERE id = $7`,
    [payload.categoryId, payload.slug, payload.status, payload.featured, payload.sortOrder, req.admin.id, id]
  );
  await upsertHelpTranslation(id, payload.locale, payload, req.admin.id);
  if (payload.locale === "en") {
    await pool.query("UPDATE help_article_translations SET translation_status = 'outdated' WHERE article_id = $1 AND locale <> 'en'", [id]);
  }
  await writeAudit(req.admin.id, "help.article_updated", "help_article", id, req, { slug: payload.slug, locale: payload.locale });
  res.json({ ok: true });
}

async function adminDeleteHelpArticle(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "INVALID_ID" });
  await pool.query("DELETE FROM help_articles WHERE id = $1", [id]);
  await writeAudit(req.admin.id, "help.article_deleted", "help_article", id, req);
  res.json({ ok: true });
}

async function adminPublishHelpArticle(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "INVALID_ID" });
  await pool.query("UPDATE help_articles SET status = 'published', published_at = COALESCE(published_at, UTC_TIMESTAMP()), updated_by = $1 WHERE id = $2", [req.admin.id, id]);
  await writeAudit(req.admin.id, "help.article_published", "help_article", id, req);
  res.json({ ok: true });
}

async function adminArchiveHelpArticle(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "INVALID_ID" });
  await pool.query("UPDATE help_articles SET status = 'archived', updated_by = $1 WHERE id = $2", [req.admin.id, id]);
  await writeAudit(req.admin.id, "help.article_archived", "help_article", id, req);
  res.json({ ok: true });
}

async function adminTranslateHelpArticle(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "INVALID_ID" });
  const en = await pool.query("SELECT title,summary,content FROM help_article_translations WHERE article_id = $1 AND locale = 'en'", [id]);
  if (!en.rowCount) return res.status(404).json({ code: "HELP_SOURCE_TRANSLATION_NOT_FOUND" });
  await machineFillHelpTranslations(id, {
    title: en.rows[0].title,
    summary: en.rows[0].summary,
    content: en.rows[0].content
  });
  await writeAudit(req.admin.id, "help.article_translated", "help_article", id, req);
  res.json({ ok: true, locales: HELP_LOCALES.length });
}

async function adminRestoreHelpVersion(req, res) {
  const id = positiveId(req.params.id);
  const versionId = positiveId(req.body?.versionId);
  if (!id || !versionId) return res.status(400).json({ code: "HELP_VERSION_INVALID" });
  const version = await pool.query("SELECT * FROM help_article_versions WHERE id = $1 AND article_id = $2", [versionId, id]);
  if (!version.rowCount) return res.status(404).json({ code: "HELP_VERSION_NOT_FOUND" });
  await saveHelpVersion(id, version.rows[0].locale, req.admin.id);
  await pool.query(
    `INSERT INTO help_article_translations(article_id, locale, title, summary, content, translation_status, source_version, reviewed_at, reviewed_by)
     VALUES($1, $2, $3, $4, $5, $6, $7, UTC_TIMESTAMP(), $8)
     ON DUPLICATE KEY UPDATE title = VALUES(title), summary = VALUES(summary), content = VALUES(content),
       translation_status = VALUES(translation_status), source_version = VALUES(source_version), reviewed_at = UTC_TIMESTAMP(), reviewed_by = VALUES(reviewed_by)`,
    [id, version.rows[0].locale, version.rows[0].title, version.rows[0].summary, version.rows[0].content, version.rows[0].translation_status, version.rows[0].version_number, req.admin.id]
  );
  await writeAudit(req.admin.id, "help.article_version_restored", "help_article", id, req, { versionId });
  res.json({ ok: true });
}

function helpArticlePayload(req) {
  return {
    categoryId: positiveId(req.body?.categoryId ?? req.body?.category_id),
    slug: cleanHelpSlug(req.body?.slug),
    locale: helpLocale(req.body?.locale || "en"),
    status: helpStatus(req.body?.status, "draft"),
    translationStatus: helpTranslationStatus(req.body?.translationStatus ?? req.body?.translation_status, "needs_review"),
    featured: req.body?.featured === true || req.body?.featured === "true" || req.body?.is_featured === true || req.body?.is_featured === "true",
    sortOrder: Number.parseInt(req.body?.sortOrder ?? req.body?.sort_order, 10) || 0,
    title: cleanText(req.body?.title, 255),
    summary: cleanText(req.body?.summary, 2000),
    content: sanitizeHelpHtml(req.body?.content)
  };
}

async function upsertHelpTranslation(articleId, locale, payload, adminId) {
  await pool.query(
    `INSERT INTO help_article_translations(article_id, locale, title, summary, content, translation_status, source_version, translated_at, reviewed_at, reviewed_by)
     VALUES($1, $2, $3, $4, $5, $6, 1, UTC_TIMESTAMP(), CASE WHEN $6 = 'approved' THEN UTC_TIMESTAMP() ELSE NULL END, CASE WHEN $6 = 'approved' THEN $7 ELSE NULL END)
     ON DUPLICATE KEY UPDATE title = VALUES(title), summary = VALUES(summary), content = VALUES(content),
       translation_status = VALUES(translation_status), translated_at = UTC_TIMESTAMP(),
       reviewed_at = CASE WHEN VALUES(translation_status) = 'approved' THEN UTC_TIMESTAMP() ELSE reviewed_at END,
       reviewed_by = CASE WHEN VALUES(translation_status) = 'approved' THEN VALUES(reviewed_by) ELSE reviewed_by END`,
    [articleId, locale, payload.title, payload.summary, payload.content, payload.translationStatus, adminId]
  );
}

async function machineFillHelpTranslations(articleId, source) {
  for (const locale of HELP_LOCALES.filter((code) => code !== "en")) {
    await pool.query(
      `INSERT INTO help_article_translations(article_id, locale, title, summary, content, translation_status, source_version, translated_at)
       VALUES($1, $2, $3, $4, $5, 'machine_translated', 1, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         title = CASE WHEN translation_status IN ('missing','machine_translated','outdated') THEN VALUES(title) ELSE title END,
         summary = CASE WHEN translation_status IN ('missing','machine_translated','outdated') THEN VALUES(summary) ELSE summary END,
         content = CASE WHEN translation_status IN ('missing','machine_translated','outdated') THEN VALUES(content) ELSE content END,
         translation_status = CASE WHEN translation_status IN ('missing','machine_translated','outdated') THEN 'machine_translated' ELSE translation_status END,
         translated_at = UTC_TIMESTAMP()`,
      [articleId, locale, source.title, source.summary, source.content]
    );
  }
}

async function saveHelpVersion(articleId, locale, adminId) {
  const current = await pool.query("SELECT * FROM help_article_translations WHERE article_id = $1 AND locale = $2", [articleId, locale]);
  if (!current.rowCount) return;
  const version = await pool.query("SELECT COALESCE(MAX(version_number),0)+1 next_version FROM help_article_versions WHERE article_id = $1 AND locale = $2", [articleId, locale]);
  await pool.query(
    `INSERT INTO help_article_versions(article_id, locale, title, summary, content, translation_status, version_number, created_by)
     VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
    [articleId, locale, current.rows[0].title, current.rows[0].summary, current.rows[0].content, current.rows[0].translation_status, Number(version.rows[0]?.next_version ?? 1), adminId]
  );
}

async function adminLocalizations(_req, res) {
  const versions = await pool.query("SELECT locale,version_label,created_at,created_by FROM localization_versions ORDER BY created_at DESC LIMIT 100");
  res.json({ rows: versions.rows, total: versions.rowCount });
}

async function adminAboutContent(req, res) {
  const page = pageParams(req);
  const search = searchTerm(req);
  const where = search
    ? "WHERE c.section_key LIKE $1 OR t.title LIKE $1 OR t.locale LIKE $1"
    : "";
  const params = search ? [`%${search}%`] : [];
  const rows = await pool.query(
    `SELECT c.id,c.section_key,c.content_type,c.sort_order,c.is_active,
       t.locale,t.title,t.subtitle,t.content,t.translation_status,t.updated_at
     FROM about_content c
     LEFT JOIN about_content_translations t ON t.content_id = c.id
     ${where}
     ORDER BY c.sort_order, FIELD(t.locale, 'ru', 'en'), t.locale
     LIMIT ${page.limit} OFFSET ${page.offset}`,
    params
  );
  const total = await pool.query(
    `SELECT COUNT(*) count FROM about_content c
     LEFT JOIN about_content_translations t ON t.content_id = c.id ${where}`,
    params
  );
  res.json({ rows: rows.rows, total: Number(total.rows[0]?.count ?? 0), locales: ABOUT_LOCALES, ...page });
}

async function adminUpdateAboutContent(req, res) {
  const id = positiveId(req.params.id);
  const locale = cleanText(req.body?.locale, 16);
  const title = cleanText(req.body?.title, 255);
  const subtitle = cleanText(req.body?.subtitle, 4000);
  const content = cleanText(req.body?.content, 30000);
  const status = enumValue(req.body?.translationStatus, ["draft", "machine_translated", "needs_review", "approved", "outdated", "published"], "needs_review");
  const isActive = req.body?.isActive === undefined ? null : Boolean(req.body.isActive);
  if (!id || !ABOUT_LOCALES.includes(locale) || !title) return res.status(400).json({ code: "ABOUT_CONTENT_INVALID" });
  const exists = await pool.query("SELECT id FROM about_content WHERE id = $1", [id]);
  if (!exists.rowCount) return res.status(404).json({ code: "ABOUT_CONTENT_NOT_FOUND" });
  await pool.transaction(async (query) => {
    if (isActive !== null) {
      await query("UPDATE about_content SET is_active = $1 WHERE id = $2", [isActive, id]);
    }
    await query(
      `INSERT INTO about_content_translations(content_id, locale, title, subtitle, content, translation_status)
       VALUES($1,$2,$3,$4,$5,$6)
       ON DUPLICATE KEY UPDATE title=VALUES(title), subtitle=VALUES(subtitle), content=VALUES(content), translation_status=VALUES(translation_status)`,
      [id, locale, title, subtitle || null, content || null, status]
    );
  });
  await writeAudit(req.admin.id, "about_content.updated", "about_content", id, req, { locale, status });
  res.json({ ok: true });
}

async function adminCreateLocalizationVersion(req, res) {
  const locale = cleanText(req.body?.locale, 16);
  const versionLabel = cleanText(req.body?.versionLabel, 64);
  const payload = req.body?.payload;
  if (!locale || !versionLabel || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return res.status(400).json({ code: "LOCALIZATION_INVALID" });
  }
  const inserted = await pool.query(
    "INSERT INTO localization_versions(locale, version_label, payload, created_by) VALUES($1,$2,$3,$4)",
    [locale, versionLabel, payload, req.admin.id]
  );
  await writeAudit(req.admin.id, "localization.version_created", "localization_version", inserted.insertId, req, { locale, versionLabel });
  res.status(201).json({ id: String(inserted.insertId), locale, versionLabel });
}

async function adminAudit(req, resOrAction, entityType, entityId) {
  if (typeof resOrAction === "string") {
    await writeAudit(req.admin?.id ?? null, resOrAction, entityType, entityId, req);
    return;
  }
  const res = resOrAction;
  const page = pageParams(req);
  const rows = await pool.query(
    `SELECT l.id,l.admin_user_id,a.email admin_email,l.action,l.entity_type,l.entity_id,l.ip_address,l.created_at
     FROM admin_audit_logs l LEFT JOIN admin_users a ON a.id = l.admin_user_id
     ORDER BY l.created_at DESC LIMIT ${page.limit} OFFSET ${page.offset}`
  );
  const total = await count("admin_audit_logs");
  res.json({ rows: rows.rows, total, ...page });
}

async function adminLoginAttempts(req, res) {
  const page = pageParams(req);
  const rows = await pool.query(
    `SELECT id,admin_user_id,email,ip_address,user_agent,success,failure_reason,locked_until,attempted_at
     FROM admin_login_attempts ORDER BY attempted_at DESC LIMIT ${page.limit} OFFSET ${page.offset}`
  );
  const total = await count("admin_login_attempts");
  res.json({ rows: rows.rows, total, ...page });
}

async function adminSettings(_req, res) {
  const rows = await pool.query("SELECT setting_key, setting_value, is_secret, updated_at FROM system_settings ORDER BY setting_key");
  res.json({ rows: rows.rows.map((row) => ({ ...row, setting_value: row.is_secret ? null : row.setting_value })) });
}

async function adminSystemErrors(req, res) {
  const page = pageParams(req);
  const search = searchTerm(req);
  const where = search ? "WHERE source LIKE $1 OR severity LIKE $1 OR code LIKE $1 OR safe_message LIKE $1" : "";
  const params = search ? [`%${search}%`] : [];
  const rows = await pool.query(
    `SELECT id,source,severity,code,endpoint,safe_message,status,occurrences,first_seen_at,last_seen_at,resolved_at
     FROM system_errors ${where} ORDER BY last_seen_at DESC LIMIT ${page.limit} OFFSET ${page.offset}`,
    params
  );
  const total = await pool.query(`SELECT COUNT(*) count FROM system_errors ${where}`, params);
  res.json({ rows: rows.rows, total: Number(total.rows[0]?.count ?? 0), ...page });
}

async function adminBackups(req, res) {
  const page = pageParams(req);
  const rows = await pool.query(
    `SELECT id,backup_type,status,file_path,file_size_bytes,duration_ms,created_by,started_at,finished_at,error_message
     FROM backup_runs ORDER BY started_at DESC LIMIT ${page.limit} OFFSET ${page.offset}`
  );
  const total = await count("backup_runs");
  res.json({ rows: rows.rows, total, ...page });
}

async function adminCreateBackup(req, res) {
  const backupType = enumValue(req.body?.type, ["database"], "database");
  const started = Date.now();
  const inserted = await pool.query(
    "INSERT INTO backup_runs(backup_type,status,created_by) VALUES($1,'running',$2)",
    [backupType, req.admin.id]
  );
  const backupDir = process.env.ADMIN_BACKUP_DIR || "/home/ODESSA/web/glukotrack.com/backend/backups";
  await mkdir(backupDir, { recursive: true });
  const filePath = `${backupDir}/glukotrack-db-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`;
  try {
    await runBackup(filePath);
    const file = await stat(filePath);
    await pool.query(
      "UPDATE backup_runs SET status='completed', file_path=$1, file_size_bytes=$2, duration_ms=$3, finished_at=UTC_TIMESTAMP() WHERE id=$4",
      [filePath, file.size, Date.now() - started, inserted.insertId]
    );
    await writeAudit(req.admin.id, "backup.created", "backup_run", inserted.insertId, req, { filePath });
    res.status(201).json({ id: String(inserted.insertId), status: "completed", filePath, fileSizeBytes: file.size });
  } catch (error) {
    await pool.query(
      "UPDATE backup_runs SET status='failed', duration_ms=$1, finished_at=UTC_TIMESTAMP(), error_message=$2 WHERE id=$3",
      [Date.now() - started, cleanText(error.message, 512), inserted.insertId]
    );
    throw error;
  }
}

async function legacyAdminGdprRequests(req, res) {
  const page = pageParams(req);
  const rows = await pool.query(
    `SELECT g.id,g.user_id,u.email,g.request_type,g.status,g.reason,g.requested_by_admin_id,g.created_at,g.completed_at
     FROM gdpr_requests g LEFT JOIN users u ON u.id = g.user_id
     ORDER BY g.created_at DESC LIMIT ${page.limit} OFFSET ${page.offset}`
  );
  const total = await count("gdpr_requests");
  res.json({ rows: rows.rows, total, ...page });
}

async function legacyAdminCreateGdprRequest(req, res) {
  const userId = positiveId(req.body?.userId);
  const requestType = enumValue(req.body?.requestType, ["export", "rectify", "restrict", "anonymize", "delete"], null);
  const reason = cleanText(req.body?.reason, 512);
  if (!userId || !requestType || !reason) return res.status(400).json({ code: "GDPR_REQUEST_INVALID" });
  const inserted = await pool.query(
    "INSERT INTO gdpr_requests(user_id, request_type, reason, requested_by_admin_id) VALUES($1,$2,$3,$4)",
    [userId, requestType, reason, req.admin.id]
  );
  await writeAudit(req.admin.id, "gdpr.request_created", "gdpr_request", inserted.insertId, req, { userId, requestType });
  res.status(201).json({ id: String(inserted.insertId), userId, requestType, status: "open" });
}

async function legacyAdminUpdateGdprRequest(req, res) {
  const id = positiveId(req.params.id);
  const status = enumValue(req.body?.status, ["open", "in_progress", "completed", "rejected"], null);
  if (!id || !status) return res.status(400).json({ code: "GDPR_REQUEST_INVALID" });
  await pool.query(
    "UPDATE gdpr_requests SET status=$1, completed_at=CASE WHEN $1='completed' THEN UTC_TIMESTAMP() ELSE completed_at END WHERE id=$2",
    [status, id]
  );
  await writeAudit(req.admin.id, "gdpr.request_updated", "gdpr_request", id, req, { status });
  res.json({ ok: true });
}

async function adminAppVersions(req, res) {
  const rows = await pool.query("SELECT platform,current_version,minimum_version,recommended_version,force_update,rollout_percent,download_url,changelog,status,updated_at FROM app_versions ORDER BY platform");
  res.json({ rows: rows.rows, total: rows.rowCount });
}

async function adminUpsertAppVersion(req, res) {
  const platform = enumValue(req.params.platform, ["web", "android", "ios", "windows", "macos"], null);
  const currentVersion = cleanText(req.body?.currentVersion, 64);
  if (!platform || !currentVersion) return res.status(400).json({ code: "APP_VERSION_INVALID" });
  await pool.query(
    `INSERT INTO app_versions(platform,current_version,minimum_version,recommended_version,force_update,rollout_percent,download_url,changelog,status,updated_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON DUPLICATE KEY UPDATE current_version=VALUES(current_version), minimum_version=VALUES(minimum_version),
       recommended_version=VALUES(recommended_version), force_update=VALUES(force_update), rollout_percent=VALUES(rollout_percent),
       download_url=VALUES(download_url), changelog=VALUES(changelog), status=VALUES(status), updated_by=VALUES(updated_by)`,
    [
      platform,
      currentVersion,
      cleanText(req.body?.minimumVersion, 64) || null,
      cleanText(req.body?.recommendedVersion, 64) || null,
      Boolean(req.body?.forceUpdate),
      Math.min(Math.max(Number(req.body?.rolloutPercent) || 100, 0), 100),
      cleanText(req.body?.downloadUrl, 512) || null,
      cleanText(req.body?.changelog, 5000) || null,
      enumValue(req.body?.status, ["active", "draft", "disabled"], "active"),
      req.admin.id
    ]
  );
  await writeAudit(req.admin.id, "app_version.updated", "app_version", platform, req);
  res.json({ ok: true });
}

async function adminUpsertSetting(req, res) {
  const key = cleanSettingKey(req.params.key);
  const value = req.body?.value;
  const isSecret = Boolean(req.body?.isSecret);
  if (!key || value === undefined) return res.status(400).json({ code: "SETTING_INVALID" });
  await pool.transaction(async (query) => {
    await query(
      `INSERT INTO system_settings(setting_key, setting_value, is_secret, updated_by)
       VALUES($1,$2,$3,$4)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), is_secret = VALUES(is_secret), updated_by = VALUES(updated_by)`,
      [key, value, isSecret, req.admin.id]
    );
    await query(
      "INSERT INTO system_settings_versions(setting_key, setting_value, changed_by) VALUES($1,$2,$3)",
      [key, value, req.admin.id]
    );
  });
  await writeAudit(req.admin.id, "system_setting.updated", "system_setting", key, req, { key, isSecret });
  res.json({ ok: true });
}

async function adminSecurityEvents(req, res) {
  const page = pageParams(req);
  const search = searchTerm(req);
  const where = search ? "WHERE event_type LIKE $1 OR severity LIKE $1 OR ip_address LIKE $1" : "";
  const params = search ? [`%${search}%`] : [];
  const rows = await pool.query(
    `SELECT id,event_type,severity,user_id,admin_user_id,ip_address,created_at
     FROM security_events ${where} ORDER BY created_at DESC LIMIT ${page.limit} OFFSET ${page.offset}`,
    params
  );
  const total = await pool.query(`SELECT COUNT(*) count FROM security_events ${where}`, params);
  res.json({ rows: rows.rows, total: Number(total.rows[0]?.count ?? 0), ...page });
}

async function adminSupportTickets(req, res) {
  const page = pageParams(req);
  const search = searchTerm(req);
  const guestEmailSql = "NULLIF(SUBSTRING_INDEX(SUBSTRING_INDEX(first_message.body, '\\n', 1), 'From: ', -1), '')";
  const where = search ? `WHERE t.subject LIKE $1 OR t.status LIKE $1 OR u.email LIKE $1 OR ${guestEmailSql} LIKE $1` : "";
  const params = search ? [`%${search}%`] : [];
  const rows = await pool.query(
    `SELECT t.id,t.user_id,COALESCE(u.email, ${guestEmailSql}) email,t.subject,t.status,t.priority,t.assigned_admin_id,t.created_at,t.updated_at
     FROM support_tickets t
     LEFT JOIN users u ON u.id = t.user_id
     LEFT JOIN support_messages first_message ON first_message.id = (
       SELECT MIN(sm.id) FROM support_messages sm WHERE sm.ticket_id = t.id
     )
     ${where} ORDER BY t.updated_at DESC LIMIT ${page.limit} OFFSET ${page.offset}`,
    params
  );
  const total = await pool.query(
    `SELECT COUNT(*) count
     FROM support_tickets t
     LEFT JOIN users u ON u.id = t.user_id
     LEFT JOIN support_messages first_message ON first_message.id = (
       SELECT MIN(sm.id) FROM support_messages sm WHERE sm.ticket_id = t.id
     )
     ${where}`,
    params
  );
  res.json({ rows: rows.rows, total: Number(total.rows[0]?.count ?? 0), ...page });
}

async function adminSupportTicketDetails(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "SUPPORT_TICKET_INVALID" });
  const ticket = await supportTicketWithEmail(id);
  if (!ticket) return res.status(404).json({ code: "SUPPORT_TICKET_NOT_FOUND" });
  const messages = await pool.query(
    `SELECT m.id,m.author_admin_id,a.email admin_email,m.body,m.created_at
     FROM support_messages m
     LEFT JOIN admin_users a ON a.id = m.author_admin_id
     WHERE m.ticket_id = $1
     ORDER BY m.created_at, m.id`,
    [id]
  );
  res.json({ ticket, messages: messages.rows });
}

async function supportTicketWithEmail(id) {
  const guestEmailSql = "NULLIF(SUBSTRING_INDEX(SUBSTRING_INDEX(first_message.body, '\\n', 1), 'From: ', -1), '')";
  const ticket = await pool.query(
    `SELECT t.id,t.user_id,COALESCE(u.email, ${guestEmailSql}) email,t.subject,t.status,t.priority,t.assigned_admin_id,t.created_at,t.updated_at
     FROM support_tickets t
     LEFT JOIN users u ON u.id = t.user_id
     LEFT JOIN support_messages first_message ON first_message.id = (
       SELECT MIN(sm.id) FROM support_messages sm WHERE sm.ticket_id = t.id
     )
     WHERE t.id = $1`,
    [id]
  );
  return ticket.rows[0] || null;
}

async function adminCreateSupportTicket(req, res) {
  const userId = positiveId(req.body?.userId);
  const subject = cleanText(req.body?.subject, 255);
  const priority = enumValue(req.body?.priority, ["low", "normal", "high", "urgent"], "normal");
  if (!subject) return res.status(400).json({ code: "SUPPORT_TICKET_INVALID" });
  const inserted = await pool.query(
    "INSERT INTO support_tickets(user_id, subject, priority, assigned_admin_id) VALUES($1,$2,$3,$4)",
    [userId, subject, priority, req.admin.id]
  );
  await writeAudit(req.admin.id, "support.ticket_created", "support_ticket", inserted.insertId, req);
  res.status(201).json({ id: String(inserted.insertId), userId, subject, priority, status: "open" });
}

async function adminUpdateSupportTicket(req, res) {
  const id = positiveId(req.params.id);
  const status = enumValue(req.body?.status, ["open", "pending", "resolved", "closed"], null);
  const priority = enumValue(req.body?.priority, ["low", "normal", "high", "urgent"], null);
  if (!id || (!status && !priority)) return res.status(400).json({ code: "SUPPORT_TICKET_INVALID" });
  await pool.query(
    `UPDATE support_tickets
     SET status = COALESCE($1, status), priority = COALESCE($2, priority), assigned_admin_id = COALESCE(assigned_admin_id, $3)
     WHERE id = $4`,
    [status, priority, req.admin.id, id]
  );
  await writeAudit(req.admin.id, "support.ticket_updated", "support_ticket", id, req, { status, priority });
  res.json({ ok: true });
}

async function adminCreateSupportMessage(req, res) {
  const id = positiveId(req.params.id);
  const body = cleanText(req.body?.body, 5000);
  if (!id || !body) return res.status(400).json({ code: "SUPPORT_MESSAGE_INVALID" });
  const inserted = await pool.query(
    "INSERT INTO support_messages(ticket_id, author_admin_id, body) VALUES($1,$2,$3)",
    [id, req.admin.id, body]
  );
  await pool.query("UPDATE support_tickets SET updated_at = UTC_TIMESTAMP(), assigned_admin_id = COALESCE(assigned_admin_id, $1) WHERE id = $2", [req.admin.id, id]);
  const ticket = await supportTicketWithEmail(id);
  if (!ticket?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ticket.email)) {
    return res.status(400).json({ code: "SUPPORT_REPLY_EMAIL_MISSING" });
  }
  await sendSupportReplyEmail(ticket, body);
  await writeAudit(req.admin.id, "support.message_created", "support_ticket", id, req);
  res.status(201).json({ id: String(inserted.insertId), ticketId: String(id), emailSent: true });
}

async function adminDeleteSupportTicket(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "SUPPORT_TICKET_INVALID" });
  const existing = await pool.query("SELECT id, subject FROM support_tickets WHERE id = $1", [id]);
  if (!existing.rowCount) return res.status(404).json({ code: "SUPPORT_TICKET_NOT_FOUND" });
  await pool.query("DELETE FROM support_tickets WHERE id = $1", [id]);
  await writeAudit(req.admin.id, "support.ticket_deleted", "support_ticket", id, req, {
    subject: existing.rows[0].subject
  });
  res.json({ ok: true });
}

async function adminAdmins(req, res) {
  const page = pageParams(req);
  const rows = await pool.query(
    `SELECT a.id,a.email,a.display_name,a.is_active,a.two_factor_enabled,a.last_login_at,a.created_at,
       GROUP_CONCAT(DISTINCT r.code ORDER BY r.code) roles,
       GROUP_CONCAT(DISTINCT p.code ORDER BY p.code) direct_permissions
     FROM admin_users a
     LEFT JOIN admin_user_roles ur ON ur.admin_user_id = a.id
     LEFT JOIN admin_roles r ON r.id = ur.role_id
     LEFT JOIN admin_user_permissions up ON up.admin_user_id = a.id
     LEFT JOIN admin_permissions p ON p.id = up.permission_id
     GROUP BY a.id
     ORDER BY a.created_at DESC LIMIT ${page.limit} OFFSET ${page.offset}`
  );
  const total = await count("admin_users");
  res.json({ rows: rows.rows.map(publicAdminAccount), total, ...page });
}

async function adminCreateUser(req, res) {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const displayName = cleanText(req.body?.displayName, 120) || email;
  const role = cleanText(req.body?.role, 64);
  if (!email || password.length < 12 || !ADMIN_ROLES[role]) return res.status(400).json({ code: "ADMIN_USER_INVALID" });
  const passwordHash = await bcrypt.hash(password, 12);
  const inserted = await pool.query(
    "INSERT INTO admin_users(email,password_hash,display_name) VALUES($1,$2,$3)",
    [email, passwordHash, displayName]
  );
  await pool.query(
    "INSERT INTO admin_user_roles(admin_user_id, role_id) SELECT $1, id FROM admin_roles WHERE code = $2",
    [inserted.insertId, role]
  );
  await writeAudit(req.admin.id, "admin.created", "admin_user", inserted.insertId, req);
  res.status(201).json({ id: String(inserted.insertId), email, displayName, role });
}

async function adminUpdateUser(req, res) {
  const id = positiveId(req.params.id);
  const displayName = req.body?.displayName == null ? null : cleanText(req.body.displayName, 120);
  const isActive = req.body?.isActive == null ? null : Boolean(req.body.isActive);
  const roles = Array.isArray(req.body?.roles) ? req.body.roles.map((role) => cleanText(role, 64)).filter((role) => ADMIN_ROLES[role]) : null;
  const directPermissions = Array.isArray(req.body?.permissions)
    ? req.body.permissions.map((permission) => cleanText(permission, 96)).filter(Boolean)
    : null;
  const resetTwoFactor = Boolean(req.body?.resetTwoFactor);
  if (!id) return res.status(400).json({ code: "ADMIN_USER_INVALID" });
  if (String(id) === String(req.admin.id) && isActive === false) return res.status(400).json({ code: "ADMIN_CANNOT_DISABLE_SELF" });
  await pool.transaction(async (query) => {
    if (displayName || isActive != null || resetTwoFactor) {
      await query(
        `UPDATE admin_users
         SET display_name = COALESCE($1, display_name),
             is_active = COALESCE($2, is_active),
             two_factor_secret = CASE WHEN $3 THEN NULL ELSE two_factor_secret END,
             two_factor_enabled = CASE WHEN $3 THEN FALSE ELSE two_factor_enabled END
         WHERE id = $4`,
        [displayName || null, isActive, resetTwoFactor, id]
      );
    }
    if (roles) {
      await query("DELETE FROM admin_user_roles WHERE admin_user_id = $1", [id]);
      for (const role of roles) {
        await query(
          "INSERT INTO admin_user_roles(admin_user_id, role_id) SELECT $1, id FROM admin_roles WHERE code = $2",
          [id, role]
        );
      }
    }
    if (directPermissions) {
      await query("DELETE FROM admin_user_permissions WHERE admin_user_id = $1", [id]);
      for (const permission of directPermissions) {
        await query(
          `INSERT INTO admin_user_permissions(admin_user_id, permission_id)
           SELECT $1, id FROM admin_permissions WHERE code = $2`,
          [id, permission]
        );
      }
    }
    if (isActive === false || resetTwoFactor) {
      await query("UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP() WHERE admin_user_id = $1 AND revoked_at IS NULL", [id]);
    }
  });
  await writeAudit(req.admin.id, "admin.updated", "admin_user", id, req, { isActive, roles, directPermissions, resetTwoFactor });
  res.json({ ok: true });
}

let supportMailTransport;
async function sendSupportReplyEmail(ticket, body) {
  if (!supportMailTransport) {
    const smtpHost = process.env.SMTP_HOST ?? "127.0.0.1";
    const localSmtp = smtpHost === "127.0.0.1" || smtpHost === "localhost";
    supportMailTransport = nodemailer.createTransport({
      host: smtpHost,
      port: envNumber("SMTP_PORT", 25),
      secure: envBoolean("SMTP_SECURE", false),
      ignoreTLS: envBoolean("SMTP_IGNORE_TLS", localSmtp),
      ...(process.env.SMTP_USER ? {
        auth: { user: process.env.SMTP_USER, pass: requiredEnv("SMTP_PASSWORD") }
      } : {})
    });
  }
  const subject = cleanText(ticket.subject, 180).replace(/^Help Center:\s*/i, "");
  await supportMailTransport.sendMail({
    from: process.env.EMAIL_FROM ?? "GlucoTrack <support@glukotrack.com>",
    to: ticket.email,
    subject: `GlucoTrack Support: ${subject || `ticket #${ticket.id}`}`,
    text: `${body}\n\n---\nGlucoTrack Support\nTicket #${ticket.id}`,
    html: `<p>${escapeHtml(body).replace(/\n/g, "<br>")}</p><hr><p>GlucoTrack Support<br>Ticket #${escapeHtml(ticket.id)}</p>`
  });
}

async function adminExport(req, res) {
  const section = cleanText(req.params.section, 64);
  const spec = exportSpec(section);
  if (!spec) return res.status(404).json({ code: "EXPORT_SECTION_NOT_FOUND" });
  if (!hasPermission(req.admin.permissions, spec.permission)) return res.status(403).json({ code: "ADMIN_FORBIDDEN" });
  const rows = await pool.query(`${spec.sql} LIMIT 10000`);
  const csv = toCsv(spec.columns, rows.rows);
  await writeAudit(req.admin.id, "admin.export", section, null, req, { section, count: rows.rowCount });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="glukotrack-${section}.csv"`);
  res.send(csv);
}

function adminAuth(permissionOrOptions = null, maybeOptions = {}) {
  const permission = typeof permissionOrOptions === "string" ? permissionOrOptions : null;
  const options = typeof permissionOrOptions === "object" ? permissionOrOptions : maybeOptions;
  return async (req, res, next) => {
    try {
      const bearerToken = bearer(req);
      const token = bearerToken || cookieToken(req);
      if (!token) return res.status(401).json({ code: "ADMIN_UNAUTHORIZED" });
      if (!bearerToken && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const csrf = cleanText(req.headers["x-admin-csrf"], 128);
        if (!csrf || csrf !== csrfForToken(token)) return res.status(403).json({ code: "ADMIN_CSRF_REQUIRED" });
      }
      const payload = jwt.verify(token, adminJwtSecret());
      const tokenHash = hashToken(token);
      const result = await pool.query(
        `SELECT s.id session_id,s.admin_user_id,s.two_factor_verified,s.expires_at,s.revoked_at,
          a.email,a.display_name,a.is_active,a.two_factor_enabled
         FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_user_id
         WHERE s.token_hash = $1`,
        [tokenHash]
      );
      const row = result.rows[0];
      if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now() || !row.is_active) {
        return res.status(401).json({ code: "ADMIN_SESSION_EXPIRED" });
      }
      const roles = await adminRoles(row.admin_user_id);
      const permissions = await permissionsForAdmin(row.admin_user_id, roles);
      req.admin = {
        id: String(row.admin_user_id),
        sessionId: String(row.session_id),
        email: row.email,
        displayName: row.display_name,
        roles,
        permissions,
        twoFactorEnabled: Boolean(row.two_factor_enabled),
        twoFactorVerified: Boolean(row.two_factor_verified),
        tokenId: payload.jti
      };
      if (adminRequiresTwoFactorSetup(roles, Boolean(row.two_factor_enabled)) && !options.allowPending2fa) {
        return res.status(403).json({ code: "ADMIN_2FA_SETUP_REQUIRED" });
      }
      if (row.two_factor_enabled && !row.two_factor_verified && !options.allowPending2fa) {
        return res.status(403).json({ code: "ADMIN_2FA_NOT_VERIFIED" });
      }
      if (permission && !hasPermission(permissions, permission)) return res.status(403).json({ code: "ADMIN_FORBIDDEN" });
      await pool.query("UPDATE admin_sessions SET last_seen_at = UTC_TIMESTAMP() WHERE id = $1", [row.session_id]);
      next();
    } catch (error) {
      if (error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError") {
        return res.status(401).json({ code: "ADMIN_INVALID_TOKEN" });
      }
      next(error);
    }
  };
}

async function createAdminSession(admin, req, { twoFactorVerified }) {
  const jti = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + adminSessionTtlMs()).toISOString();
  const token = jwt.sign({ sub: String(admin.id), scope: "admin", jti }, adminJwtSecret(), { expiresIn: Math.floor(adminSessionTtlMs() / 1000) });
  await pool.query(
    `INSERT INTO admin_sessions(admin_user_id, token_hash, ip_address, user_agent, two_factor_verified, expires_at)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [admin.id, hashToken(token), requestIp(req), cleanText(req.headers["user-agent"], 512), Boolean(twoFactorVerified), expiresAt.slice(0, 19).replace("T", " ")]
  );
  return { token, expiresAt };
}

async function failedLogin(admin, email, ip, userAgent) {
  const failures = Number(admin?.failed_login_count ?? 0) + 1;
  const lockedUntil = failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
  if (admin?.id) {
    await pool.query(
      "UPDATE admin_users SET failed_login_count = $1, locked_until = $2 WHERE id = $3",
      [failures, lockedUntil ? sqlDate(lockedUntil) : null, admin.id]
    );
  }
  await pool.query(
    `INSERT INTO admin_login_attempts(admin_user_id,email,ip_address,user_agent,success,locked_until,failure_reason)
     VALUES($1,$2,$3,$4,FALSE,$5,'invalid_credentials')`,
    [admin?.id ?? null, email, ip, userAgent, lockedUntil ? sqlDate(lockedUntil) : null]
  );
}

async function logAdminLogin(adminId, email, ip, userAgent, success, failureReason) {
  await pool.query(
    `INSERT INTO admin_login_attempts(admin_user_id,email,ip_address,user_agent,success,failure_reason)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [adminId, email, ip, userAgent, success, failureReason]
  );
}

async function writeAudit(adminUserId, action, entityType, entityId, req, metadata = {}) {
  await pool.query(
    `INSERT INTO admin_audit_logs(admin_user_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [adminUserId, action, entityType, entityId ? String(entityId) : null, metadata, requestIp(req), cleanText(req.headers["user-agent"], 512)]
  );
}

async function listJoined(req, res, { select, from, order }) {
  const page = pageParams(req);
  const search = searchTerm(req);
  const where = search ? "WHERE u.email LIKE $1 OR u.full_name LIKE $1" : "";
  const params = search ? [`%${search}%`] : [];
  const rows = await pool.query(`SELECT ${select} FROM ${from} ${where} ORDER BY ${order} LIMIT ${page.limit} OFFSET ${page.offset}`, params);
  const total = await pool.query(`SELECT COUNT(*) count FROM ${from} ${where}`, params);
  res.json({ rows: rows.rows, total: Number(total.rows[0]?.count ?? 0), ...page });
}

async function adminProfile(id) {
  const rows = await pool.query(
    "SELECT id,email,display_name,two_factor_enabled,last_login_at FROM admin_users WHERE id = $1",
    [id]
  );
  const profile = rows.rows[0];
  const roles = await adminRoles(id);
  const directPermissions = await adminDirectPermissions(id);
  return {
    id: String(profile.id),
    email: profile.email,
    displayName: profile.display_name,
    roles,
    directPermissions,
    permissions: await permissionsForAdmin(id, roles),
    twoFactorEnabled: Boolean(profile.two_factor_enabled),
    lastLoginAt: profile.last_login_at
  };
}

async function adminRoles(adminUserId) {
  const result = await pool.query(
    `SELECT r.code FROM admin_user_roles ur JOIN admin_roles r ON r.id = ur.role_id
     WHERE ur.admin_user_id = $1 ORDER BY r.code`,
    [adminUserId]
  );
  return result.rows.map((row) => row.code);
}

function permissionsForRoles(roles) {
  return [...new Set(roles.flatMap((role) => ADMIN_ROLES[role] ?? []))];
}

async function permissionsForAdmin(adminUserId, roles) {
  return [...new Set([...permissionsForRoles(roles), ...(await adminDirectPermissions(adminUserId))])];
}

async function adminDirectPermissions(adminUserId) {
  const result = await pool.query(
    `SELECT p.code FROM admin_user_permissions up JOIN admin_permissions p ON p.id = up.permission_id
     WHERE up.admin_user_id = $1 ORDER BY p.code`,
    [adminUserId]
  );
  return result.rows.map((row) => row.code);
}

function hasPermission(permissions, permission) {
  return permissions.includes("*") || permissions.includes(permission);
}

function csrfForToken(token) {
  return hashToken(token).slice(0, 32);
}

async function count(table) {
  const result = await pool.query(`SELECT COUNT(*) count FROM ${table}`);
  return Number(result.rows[0]?.count ?? 0);
}

async function countWhere(table, where) {
  const result = await pool.query(`SELECT COUNT(*) count FROM ${table} WHERE ${where}`);
  return Number(result.rows[0]?.count ?? 0);
}

function publicAdminUser(row) {
  return {
    id: String(row.id),
    email: row.email,
    fullName: row.full_name,
    preferredLocale: row.preferred_locale,
    premiumStatus: row.premium_status,
    premiumPlan: row.premium_plan,
    premiumUntil: row.premium_until,
    subscriptionStatus: row.subscription_status,
    subscriptionExpiresAt: row.subscription_expires_at,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    trialUsed: Boolean(row.trial_used),
    emailVerified: Boolean(row.email_verified),
    diabetesType: row.diabetes_type,
    glucoseUnit: row.glucose_unit,
    createdAt: row.created_at
  };
}

function publicAdminAccount(row) {
  return {
    id: String(row.id),
    email: row.email,
    displayName: row.display_name,
    isActive: Boolean(row.is_active),
    twoFactorEnabled: Boolean(row.two_factor_enabled),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    roles: typeof row.roles === "string" && row.roles ? row.roles.split(",") : []
    ,directPermissions: typeof row.direct_permissions === "string" && row.direct_permissions ? row.direct_permissions.split(",") : []
  };
}

function pageParams(req) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  return { page, limit, offset: (page - 1) * limit };
}

function searchTerm(req) {
  return cleanText(req.query.q, 120);
}

function userSort(req) {
  const allowed = {
    created_desc: "created_at DESC",
    created_asc: "created_at ASC",
    email_asc: "email ASC",
    email_desc: "email DESC"
  };
  return allowed[req.query.sort] ?? allowed.created_desc;
}

function positiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function enumValue(value, allowed, fallback) {
  const text = cleanText(value, 64);
  return allowed.includes(text) ? text : fallback;
}

function parseOptionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : sqlDate(date);
}

function cleanSettingKey(value) {
  const key = cleanText(value, 96);
  return /^[a-z0-9_.:-]+$/i.test(key) ? key : "";
}

function exportSpec(section) {
  const specs = {
    users: {
      permission: "users:read",
      columns: ["id", "email", "full_name", "preferred_locale", "subscription_status", "premium_plan", "created_at"],
      sql: "SELECT id,email,full_name,preferred_locale,subscription_status,premium_plan,created_at FROM users ORDER BY created_at DESC"
    },
    subscriptions: {
      permission: "subscriptions:read",
      columns: ["id", "user_id", "email", "provider", "plan", "status", "expires_at", "updated_at"],
      sql: `SELECT COALESCE(s.id, u.id) id, u.id user_id, u.email,
        COALESCE(s.provider, 'user_state') provider,
        COALESCE(s.plan, u.premium_plan) plan,
        COALESCE(s.status, u.subscription_status) status,
        COALESCE(s.expires_at, u.subscription_expires_at, u.premium_until) expires_at,
        COALESCE(s.updated_at, u.updated_at, u.created_at) updated_at
        FROM users u
        LEFT JOIN (
          SELECT s1.* FROM subscriptions s1
          JOIN (SELECT user_id, MAX(updated_at) updated_at FROM subscriptions GROUP BY user_id) latest
            ON latest.user_id = s1.user_id AND latest.updated_at = s1.updated_at
        ) s ON s.user_id = u.id
        WHERE u.subscription_status IS NOT NULL OR u.premium_plan IS NOT NULL
        ORDER BY updated_at DESC`
    },
    payments: {
      permission: "payments:read",
      columns: ["id", "user_id", "email", "amount_minor", "currency", "status", "created_at"],
      sql: "SELECT p.id,p.user_id,u.email,p.amount_minor,p.currency,p.status,p.created_at FROM payments p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC"
    },
    devices: {
      permission: "devices:read",
      columns: ["id", "user_id", "email", "device_name", "platform", "last_seen_at", "revoked_at"],
      sql: "SELECT d.id,d.user_id,u.email,d.device_name,d.platform,d.last_seen_at,d.revoked_at FROM account_devices d JOIN users u ON u.id=d.user_id ORDER BY d.last_seen_at DESC"
    },
    audit: {
      permission: "audit:read",
      columns: ["id", "admin_user_id", "action", "entity_type", "entity_id", "ip_address", "created_at"],
      sql: "SELECT id,admin_user_id,action,entity_type,entity_id,ip_address,created_at FROM admin_audit_logs ORDER BY created_at DESC"
    },
    security: {
      permission: "security:read",
      columns: ["id", "event_type", "severity", "user_id", "admin_user_id", "ip_address", "created_at"],
      sql: "SELECT id,event_type,severity,user_id,admin_user_id,ip_address,created_at FROM security_events ORDER BY created_at DESC"
    },
    support: {
      permission: "support:write",
      columns: ["id", "user_id", "email", "subject", "status", "priority", "updated_at"],
      sql: "SELECT t.id,t.user_id,u.email,t.subject,t.status,t.priority,t.updated_at FROM support_tickets t LEFT JOIN users u ON u.id=t.user_id ORDER BY t.updated_at DESC"
    },
    errors: {
      permission: "errors:read",
      columns: ["id", "source", "severity", "code", "endpoint", "status", "occurrences", "last_seen_at"],
      sql: "SELECT id,source,severity,code,endpoint,status,occurrences,last_seen_at FROM system_errors ORDER BY last_seen_at DESC"
    },
    notifications: {
      permission: "notifications:read",
      columns: ["id", "title", "locale", "status", "recipient_count", "delivered_count", "created_at", "sent_at"],
      sql: "SELECT id,title,locale,status,recipient_count,delivered_count,created_at,sent_at FROM notification_campaigns ORDER BY created_at DESC"
    },
    referrals: {
      permission: "referrals:read",
      columns: ["id", "code", "referrer_email", "referred_email", "status", "rejection_reason", "registered_at", "email_verified_at", "qualified_at", "rewarded_at", "granted_days"],
      sql: `SELECT rr.id, rc.code, referrer.email referrer_email, referred.email referred_email,
        rr.status, rr.rejection_reason, rr.registered_at, rr.email_verified_at, rr.qualified_at, rr.rewarded_at,
        COALESCE(SUM(CASE WHEN rw.status = 'granted' THEN rw.reward_days ELSE 0 END), 0) granted_days
        FROM referral_relations rr
        JOIN referral_codes rc ON rc.id = rr.referral_code_id
        JOIN users referrer ON referrer.id = rr.referrer_user_id
        JOIN users referred ON referred.id = rr.referred_user_id
        LEFT JOIN referral_rewards rw ON rw.referral_relation_id = rr.id
        GROUP BY rr.id, rc.code, referrer.email, referred.email, rr.status, rr.rejection_reason,
          rr.registered_at, rr.email_verified_at, rr.qualified_at, rr.rewarded_at
        ORDER BY rr.created_at DESC`
    },
    help: {
      permission: "help:read",
      columns: ["id", "slug", "category", "title", "status", "translation_status", "view_count", "updated_at"],
      sql: `SELECT a.id, a.slug, c.slug category, COALESCE(t.title, fallback.title) title,
        a.status, COALESCE(t.translation_status, fallback.translation_status) translation_status,
        a.view_count, a.updated_at
        FROM help_articles a
        JOIN help_categories c ON c.id = a.category_id
        LEFT JOIN help_article_translations t ON t.article_id = a.id AND t.locale = 'ru'
        LEFT JOIN help_article_translations fallback ON fallback.article_id = a.id AND fallback.locale = 'en'
        ORDER BY a.updated_at DESC`
    }
  };
  return specs[section] ?? null;
}

function runBackup(filePath) {
  const args = [
    `--host=${process.env.DB_HOST || "localhost"}`,
    `--port=${process.env.DB_PORT || "3306"}`,
    `--user=${process.env.DB_USER}`,
    "--single-transaction",
    "--quick",
    "--routines",
    "--events",
    `--result-file=${filePath}`,
    process.env.DB_NAME
  ];
  return new Promise((resolve, reject) => {
    const child = spawn("mysqldump", args, {
      env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || "" },
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(cleanText(stderr, 512) || `mysqldump exited with code ${code}`));
    });
  });
}

function toCsv(columns, rows) {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(","))
  ].join("\n");
}

function csvValue(value) {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeEmail(value) {
  return cleanText(value, 255).toLowerCase();
}

function cleanCode(value) {
  return cleanText(value, 16).replace(/\s+/g, "");
}

function bearer(req) {
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function cookieToken(req) {
  const cookie = req.headers.cookie ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${ADMIN_TOKEN_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function setAdminCookie(res, token, expiresAt) {
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Expires=${new Date(expiresAt).toUTCString()}`
  );
}

function requestIp(req) {
  return cleanText(req.headers["x-forwarded-for"]?.split(",")[0] ?? req.ip ?? "", 64);
}

function hashToken(token) {
  return createHmac("sha256", adminJwtSecret()).update(token).digest("hex");
}

function adminJwtSecret() {
  return process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
}

function adminSessionTtlMs() {
  return (Number(process.env.ADMIN_SESSION_HOURS) || 8) * 60 * 60 * 1000;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function envBoolean(name, fallback = false) {
  if (process.env[name] == null) return fallback;
  return ["1", "true", "yes", "on"].includes(String(process.env[name]).toLowerCase());
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function sqlDate(value) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function base32Secret() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = randomBytes(20);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  return bits.match(/.{1,5}/g).map((chunk) => alphabet[parseInt(chunk.padEnd(5, "0"), 2)]).join("");
}

function verifyTotp(code, secret) {
  if (!/^\d{6}$/.test(code) || !secret) return false;
  const now = Math.floor(Date.now() / 30000);
  return [-1, 0, 1].some((offset) => safeEqual(code, totp(secret, now + offset)));
}

function totp(secret, counter) {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0xf;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

function base32Decode(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of value.replace(/=+$/g, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index >= 0) bits += index.toString(2).padStart(5, "0");
  }
  const bytes = bits.match(/.{1,8}/g)?.map((byte) => parseInt(byte.padEnd(8, "0"), 2)) ?? [];
  return Buffer.from(bytes);
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}
