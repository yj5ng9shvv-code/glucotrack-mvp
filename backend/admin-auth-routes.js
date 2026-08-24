import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import bcrypt from "bcryptjs";

import { pool } from "./db.js";
import { createNotificationProviderSettingsService } from "./notification-provider-settings-service.js";

const execFileAsync = promisify(execFile);
const SESSION_HOURS = 8;
const ADMIN_BACKUP_DIR = "/home/ODESSA/glukotrack-admin-db-backups";
const ADMIN_BACKUP_LOCK = path.join(ADMIN_BACKUP_DIR, ".backup.lock");
const MIN_BACKUP_FREE_BYTES = 50 * 1024 * 1024;
const GDPR_EXPORT_DIR = "/home/ODESSA/glukotrack-gdpr-exports";
const GDPR_REQUEST_TYPES = new Set(["access","export","rectification","erasure","restriction","objection","portability"]);
const GDPR_STATUSES = new Set(["new","pending_verification","verified","in_progress","completed","rejected","cancelled"]);
const notificationProviderSettingsService = createNotificationProviderSettingsService(pool);

const GDPR_SETTINGS = {
  gdpr_draft_retention_days: { defaultValue: 14, min: 1, max: 365 },
  gdpr_due_days: { defaultValue: 30, min: 1, max: 365 },
  gdpr_export_retention_days: { defaultValue: 7, min: 1, max: 365 }
};

const BACKUP_ROLE_OPTIONS = ["super_admin", "security_auditor"];
const BACKUP_MODE_DEFS = {
  full: { components: ["database", "frontend", "backend", "configs", "uploads", "nginx", "systemd"] },
  database: { components: ["database"] },
  files: { components: ["frontend", "backend", "configs", "uploads", "nginx", "systemd"] },
  "pre-deploy": { components: ["database", "frontend", "backend", "configs", "uploads", "nginx", "systemd"] },
  "pre-wipe": { components: ["database", "frontend", "backend", "configs", "uploads", "nginx", "systemd"] }
};
const BACKUP_SETTING_DEFS = {
  backup_enabled: { type: "boolean", defaultValue: true },
  backup_manual_enabled: { type: "boolean", defaultValue: true },
  backup_auto_enabled: { type: "boolean", defaultValue: false },
  backup_schedule_frequency: { type: "enum", values: ["daily", "weekly", "monthly"], defaultValue: "daily" },
  backup_schedule_days: { type: "days", defaultValue: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] },
  backup_schedule_time: { type: "time", defaultValue: "03:00" },
  backup_schedule_timezone: { type: "enum", values: ["UTC", "Europe/Warsaw", "Europe/Kyiv", "Europe/Berlin"], defaultValue: "UTC" },
  backup_prevent_parallel: { type: "boolean", defaultValue: true },
  backup_max_duration_minutes: { type: "integer", min: 5, max: 1440, defaultValue: 30 },
  backup_min_free_mb: { type: "integer", min: 50, max: 1048576, defaultValue: 512 },
  backup_include_database: { type: "boolean", defaultValue: true },
  backup_include_frontend: { type: "boolean", defaultValue: true },
  backup_include_backend: { type: "boolean", defaultValue: true },
  backup_include_configs: { type: "boolean", defaultValue: true },
  backup_include_uploads: { type: "boolean", defaultValue: true },
  backup_include_nginx: { type: "boolean", defaultValue: true },
  backup_include_systemd: { type: "boolean", defaultValue: true },
  backup_include_env: { type: "boolean", defaultValue: false },
  backup_retention_daily: { type: "integer", min: 1, max: 365, defaultValue: 7 },
  backup_retention_weekly: { type: "integer", min: 1, max: 260, defaultValue: 4 },
  backup_retention_monthly: { type: "integer", min: 1, max: 120, defaultValue: 3 },
  backup_retention_max_age_days: { type: "integer", min: 1, max: 3650, defaultValue: 90 },
  backup_retention_max_total_mb: { type: "integer", min: 100, max: 1048576, defaultValue: 10240 },
  backup_retention_warn_at_percent: { type: "integer", min: 50, max: 100, defaultValue: 85 },
  backup_cleanup_dry_run_enabled: { type: "boolean", defaultValue: true },
  backup_notify_completed: { type: "boolean", defaultValue: true },
  backup_notify_failed: { type: "boolean", defaultValue: true },
  backup_notify_low_space: { type: "boolean", defaultValue: true },
  backup_notify_retention_warning: { type: "boolean", defaultValue: true },
  backup_notify_cleanup_plan: { type: "boolean", defaultValue: true },
  backup_notify_cleanup_completed: { type: "boolean", defaultValue: true },
  backup_notify_cleanup_failed: { type: "boolean", defaultValue: true },
  backup_manage_roles: { type: "roles", defaultValue: ["super_admin"] }
};
let backupSchedulerStarted = false;
let backupSchedulerLastRunKey = "";

const AI_FEATURES = ["basic_text","medication","lab_analysis","photo_food","photo_document","doctor_report"];
const AI_PLANS = ["free","basic","premium","family"];
const AI_COUNTERS = ["normal","photo"];
const AI_ROLE_OPTIONS = ["super_admin","security_auditor","medical_data_reviewer"];
const AI_SETTING_DEFS = {
  ai_enabled: { type: "boolean", defaultValue: true },
  ai_models_available: { type: "models", defaultValue: ["gpt-4o-mini","gpt-4o","gpt-4.1-mini","gpt-4.1"] },
  ...Object.fromEntries(AI_FEATURES.flatMap((feature) => [
    [`ai_feature_${feature}_enabled`, { type: "boolean", defaultValue: true }],
    [`ai_feature_${feature}_primary_model`, { type: "text", defaultValue: "gpt-4o-mini" }],
    [`ai_feature_${feature}_fallback_model`, { type: "text", defaultValue: "gpt-4o" }],
    [`ai_feature_${feature}_fallback_enabled`, { type: "boolean", defaultValue: true }],
    [`ai_feature_${feature}_max_tokens`, { type: "integer", min: 128, max: 8000, defaultValue: feature === "basic_text" ? 700 : 1100 }],
    [`ai_feature_${feature}_counter`, { type: "enum", values: AI_COUNTERS, defaultValue: feature.startsWith("photo") || feature === "lab_analysis" ? "photo" : "normal" }]
  ])),
  ...Object.fromEntries(AI_PLANS.flatMap((plan) => [
    [`ai_limit_${plan}_normal`, { type: "integer", min: 0, max: 10000, defaultValue: plan === "free" ? 5 : plan === "basic" ? 20 : plan === "premium" ? 100 : 200 }],
    [`ai_limit_${plan}_photo`, { type: "integer", min: 0, max: 10000, defaultValue: plan === "free" ? 1 : plan === "basic" ? 5 : plan === "premium" ? 30 : 60 }]
  ])),
  ai_manage_roles: { type: "roles", defaultValue: ["super_admin"] }
};
const SOS_ROLE_OPTIONS = ["super_admin","support","medical_data_reviewer","security_auditor"];
const SOS_SETTING_DEFS = {
  sos_enabled: { type: "boolean", defaultValue: true },
  sos_test_mode: { type: "boolean", defaultValue: true },
  sos_create_roles: { type: "roles", defaultValue: ["super_admin","support","medical_data_reviewer"] },
  sos_view_roles: { type: "roles", defaultValue: ["super_admin","support","medical_data_reviewer","security_auditor"] },
  sos_cancel_roles: { type: "roles", defaultValue: ["super_admin","support","medical_data_reviewer"] },
  sos_close_roles: { type: "roles", defaultValue: ["super_admin","medical_data_reviewer"] },
  sos_audit_actions_enabled: { type: "boolean", defaultValue: true },
  sos_show_patient_card: { type: "boolean", defaultValue: true },
  sos_show_family_card: { type: "boolean", defaultValue: true },
  sos_activation_mode: { type: "enum", values: ["manual","automatic","both"], defaultValue: "both" },
  sos_require_activation_confirmation: { type: "boolean", defaultValue: true },
  sos_accidental_cancel_seconds: { type: "integer", min: 0, max: 300, defaultValue: 15 },
  sos_card_display_priority: { type: "enum", values: ["normal","high","critical"], defaultValue: "high" },
  sos_stale_after_minutes: { type: "integer", min: 1, max: 10080, defaultValue: 240 },
  sos_auto_close_enabled: { type: "boolean", defaultValue: false },
  sos_auto_close_after_hours: { type: "integer", min: 1, max: 168, defaultValue: 24 },
  sos_require_close_comment: { type: "boolean", defaultValue: true },
  sos_patient_cancel_enabled: { type: "boolean", defaultValue: true },
  sos_caregiver_close_enabled: { type: "boolean", defaultValue: false },
  sos_push_enabled: { type: "boolean", defaultValue: false },
  sos_in_app_enabled: { type: "boolean", defaultValue: true },
  sos_caregiver_alarm_sound: { type: "boolean", defaultValue: true },
  sos_repeat_notifications: { type: "boolean", defaultValue: false },
  sos_repeat_interval_minutes: { type: "integer", min: 1, max: 1440, defaultValue: 5 },
  sos_max_notification_repeats: { type: "integer", min: 0, max: 50, defaultValue: 3 },
  sos_escalation_enabled: { type: "boolean", defaultValue: false },
  sos_escalation_after_minutes: { type: "integer", min: 1, max: 1440, defaultValue: 15 },
  sos_sms_enabled: { type: "boolean", defaultValue: false },
  sos_sms_type: { type: "enum", values: ["disabled","system_composer","external_reserved"], defaultValue: "disabled" },
  sos_sms_create_server_first: { type: "boolean", defaultValue: true },
  sos_sms_template: { type: "text", max: 500, defaultValue: "SOS GlukoTrack: {user_name}. {sos_time}. {location_link}. ID {sos_id}." },
  sos_sms_max_repeats: { type: "integer", min: 0, max: 20, defaultValue: 0 },
  sos_sms_min_repeat_interval_minutes: { type: "integer", min: 1, max: 1440, defaultValue: 10 },
  sos_request_current_location: { type: "boolean", defaultValue: true },
  sos_use_last_known_location: { type: "boolean", defaultValue: true },
  sos_last_location_max_age_minutes: { type: "integer", min: 1, max: 10080, defaultValue: 60 },
  sos_location_update_interval_seconds: { type: "integer", min: 5, max: 3600, defaultValue: 30 },
  sos_location_tracking_max_minutes: { type: "integer", min: 1, max: 1440, defaultValue: 60 },
  sos_show_map_to_caregiver: { type: "boolean", defaultValue: true },
  sos_location_retention_days: { type: "integer", min: 1, max: 3650, defaultValue: 30 },
  sos_patient_activation_sound: { type: "boolean", defaultValue: true },
  sos_caregiver_sound: { type: "boolean", defaultValue: true },
  sos_vibration_enabled: { type: "boolean", defaultValue: true },
  sos_repeat_sound_until_ack: { type: "boolean", defaultValue: false },
  sos_warn_missing_sound_permission: { type: "boolean", defaultValue: true },
  sos_allow_sound_test_mode: { type: "boolean", defaultValue: true },
  sos_rate_limit_enabled: { type: "boolean", defaultValue: true },
  sos_rate_limit_count: { type: "integer", min: 1, max: 100, defaultValue: 5 },
  sos_rate_limit_window_minutes: { type: "integer", min: 1, max: 1440, defaultValue: 60 },
  sos_merge_duplicate_active: { type: "boolean", defaultValue: true },
  sos_duplicate_window_seconds: { type: "integer", min: 1, max: 3600, defaultValue: 120 },
  sos_log_lifecycle_events: { type: "boolean", defaultValue: true },
  sos_log_settings_changes: { type: "boolean", defaultValue: true },
  sos_event_retention_days: { type: "integer", min: 1, max: 3650, defaultValue: 365 },
  sos_notification_retention_days: { type: "integer", min: 1, max: 3650, defaultValue: 90 },
  sos_coordinate_retention_days: { type: "integer", min: 1, max: 3650, defaultValue: 30 },
  sos_show_history_patient: { type: "boolean", defaultValue: true },
  sos_show_history_caregiver: { type: "boolean", defaultValue: true },
  sos_include_events_in_gdpr_export: { type: "boolean", defaultValue: true }
};
const ADMIN_COOKIE = "gt_admin_session";
const ADMIN_CSRF_HEADER = "x-admin-csrf";

export function registerAdminAuthRoutes(app, { asyncHandler }) {
  app.post("/admin/auth/login", asyncHandler(adminLogin));
  app.get("/admin/auth/me", adminAuth(), asyncHandler(adminMe));
  app.post("/admin/auth/logout", adminAuth({ allowPending2fa: true }), asyncHandler(adminLogout));
  app.get("/admin/dashboard", adminAuth(), asyncHandler(adminDashboard));
  app.get("/admin/users", adminAuth(), asyncHandler(adminUsers));
  app.get("/admin/users/:id", adminAuth(), asyncHandler(adminUserDetail));
  app.post("/admin/users/:id/revoke-sessions", adminAuth(), asyncHandler(adminRevokeUserSessions));
  app.post("/admin/users/:id/block", adminAuth(), asyncHandler(adminBlockUser));
  app.post("/admin/users/:id/unblock", adminAuth(), asyncHandler(adminUnblockUser));
  app.post("/admin/users/:id/verify-email", adminAuth(), asyncHandler(adminVerifyUserEmail));
  app.post("/admin/users/:id/subscription/extend", adminAuth(), asyncHandler(adminExtendUserSubscription));
  app.post("/admin/users/:id/medical", adminAuth(), asyncHandler(adminMedicalSnapshot));
  app.get("/admin/subscriptions", adminAuth(), asyncHandler(adminSubscriptions));
  app.get("/admin/payments", adminAuth(), asyncHandler(adminPayments));
  app.get("/admin/devices", adminAuth(), asyncHandler(adminDevices));
  app.get("/admin/trials", adminAuth(), asyncHandler(adminTrials));
  app.get("/admin/family", adminAuth(), asyncHandler(adminFamily));
  app.patch("/admin/family/:id/status", adminAuth(), asyncHandler(adminUpdateFamilyStatus));
  app.patch("/admin/family/:id/permissions", adminAuth(), asyncHandler(adminUpdateFamilyPermissions));
  app.get("/admin/sos", adminAuth(), asyncHandler(adminSos));
  app.get("/admin/ai", adminAuth(), asyncHandler(adminAi));
  app.get("/admin/notifications", adminAuth(), asyncHandler(adminNotifications));
  app.get("/admin/notifications/:id", adminAuth(), asyncHandler(adminNotificationDetail));
  app.get("/admin/referrals", adminAuth(), asyncHandler(adminReferrals));
  app.get("/admin/referrals/:id", adminAuth(), asyncHandler(adminReferralDetail));
  app.get("/admin/help", adminAuth(), asyncHandler(adminHelp));
  app.get("/admin/help/articles/:id", adminAuth(), asyncHandler(adminHelpArticleDetail));
  app.get("/admin/about", adminAuth(), asyncHandler(adminAbout));
  app.get("/admin/localizations", adminAuth(), asyncHandler(adminLocalizations));
  app.get("/admin/support", adminAuth(), asyncHandler(adminSupport));
  app.get("/admin/support/:id", adminAuth(), asyncHandler(adminSupportDetail));
  app.get("/admin/security", adminAuth(), asyncHandler(adminSecurity));
  app.get("/admin/errors", adminAuth(), asyncHandler(adminErrors));
  app.delete("/admin/errors/:id", adminAuth(), asyncHandler(requireSuperAdmin), asyncHandler(adminDeleteError));
  app.get("/admin/settings/family-access", adminAuth(), asyncHandler(adminFamilyAccessSettings));
  app.put("/admin/settings/family-access", adminAuth(), asyncHandler(requireSuperAdmin), asyncHandler(adminUpdateFamilyAccessSettings));
  app.get("/admin/settings/notifications", adminAuth(), asyncHandler(adminNotificationSettings));
  app.put("/admin/settings/notifications", adminAuth(), asyncHandler(requireSuperAdmin), asyncHandler(adminUpdateNotificationSettings));
  app.get("/admin/settings/backup", adminAuth(), asyncHandler(adminBackupSettings));
  app.put("/admin/settings/backup", adminAuth(), asyncHandler(requireBackupManage), asyncHandler(adminUpdateBackupSettings));
  app.post("/admin/settings/backup/reset", adminAuth(), asyncHandler(requireBackupManage), asyncHandler(adminResetBackupSettings));
  app.get("/admin/backups", adminAuth(), asyncHandler(adminBackups));
  app.post("/admin/backups", adminAuth(), asyncHandler(requireBackupManage), asyncHandler(adminCreateBackup));
  app.get("/admin/backups/status", adminAuth(), asyncHandler(adminBackupStatus));
  app.post("/admin/backups/dry-run", adminAuth(), asyncHandler(requireBackupManage), asyncHandler(adminBackupCleanupDryRun));
  app.post("/admin/backups/delete-confirmed", adminAuth(), asyncHandler(requireSuperAdmin), asyncHandler(adminConfirmBackupCleanup));
  app.post("/admin/backups/:id/verify", adminAuth(), asyncHandler(requireBackupManage), asyncHandler(adminVerifyBackup));
  app.post("/admin/backups/:id/protect", adminAuth(), asyncHandler(requireBackupManage), asyncHandler(adminProtectBackup));
  app.delete("/admin/backups/:id", adminAuth(), asyncHandler(requireSuperAdmin), asyncHandler(adminDeleteBackup));
  app.get("/admin/gdpr", adminAuth(), asyncHandler(adminGdpr));
  app.post("/admin/gdpr", adminAuth(), asyncHandler(adminCreateGdpr));
  app.get("/admin/gdpr/:id", adminAuth(), asyncHandler(adminGdprDetail));
  app.post("/admin/gdpr/:id/assign", adminAuth(), asyncHandler(requireGdprExecutor), asyncHandler(adminGdprAssign));
  app.post("/admin/gdpr/:id/status", adminAuth(), asyncHandler(requireGdprExecutor), asyncHandler(adminGdprStatus));
  app.post("/admin/gdpr/:id/comment", adminAuth(), asyncHandler(requireGdprExecutor), asyncHandler(adminGdprComment));
  app.post("/admin/gdpr/:id/verify", adminAuth(), asyncHandler(requireGdprExecutor), asyncHandler(adminGdprVerify));
  app.post("/admin/gdpr/:id/approve", adminAuth(), asyncHandler(requireGdprExecutor), asyncHandler(adminGdprApprove));
  app.post("/admin/gdpr/:id/reject", adminAuth(), asyncHandler(requireGdprExecutor), asyncHandler(adminGdprReject));
  app.post("/admin/gdpr/:id/complete", adminAuth(), asyncHandler(requireGdprExecutor), asyncHandler(adminGdprComplete));
  app.post("/admin/gdpr/:id/generate-export", adminAuth(), asyncHandler(requireGdprExecutor), asyncHandler(adminGdprGenerateExport));
  app.get("/admin/gdpr/:id/download/:fileId", adminAuth(), asyncHandler(requireGdprExecutor), asyncHandler(adminGdprDownload));
  app.post("/admin/gdpr/:id/preview-erasure", adminAuth(), asyncHandler(requireGdprExecutor), asyncHandler(adminGdprPreviewErasure));
  app.post("/admin/gdpr/:id/anonymize", adminAuth(), asyncHandler(requireSuperAdmin), asyncHandler(adminGdprAnonymize));
  app.post("/admin/gdpr/:id/delete-account", adminAuth(), asyncHandler(requireSuperAdmin), asyncHandler(adminGdprAnonymize));
  app.post("/admin/gdpr/:id/restrict", adminAuth(), asyncHandler(requireGdprExecutor), asyncHandler(adminGdprRestrict));
  app.post("/admin/gdpr/:id/object", adminAuth(), asyncHandler(requireGdprExecutor), asyncHandler(adminGdprObject));
  app.post("/admin/gdpr/:id/rectify", adminAuth(), asyncHandler(requireGdprExecutor), asyncHandler(adminGdprRectify));
  app.get("/admin/versions", adminAuth(), asyncHandler(adminVersions));
  app.get("/admin/admins", adminAuth(), asyncHandler(adminAdmins));
  app.get("/admin/audit", adminAuth(), asyncHandler(adminAudit));
  app.get("/admin/login-attempts", adminAuth(), asyncHandler(adminLoginAttempts));
  app.get("/admin/settings", adminAuth(), asyncHandler(adminSettings));
  app.get("/admin/settings/ai", adminAuth(), asyncHandler(requireAiManage), asyncHandler(adminAiSettings));
  app.put("/admin/settings/ai", adminAuth(), asyncHandler(requireAiManage), asyncHandler(adminUpdateAiSettings));
  app.post("/admin/settings/ai/reset", adminAuth(), asyncHandler(requireAiManage), asyncHandler(adminResetAiSettings));
  app.post("/admin/settings/ai/api-key", adminAuth(), asyncHandler(requireAiManage), asyncHandler(adminSaveAiApiKey));
  app.post("/admin/settings/ai/test", adminAuth(), asyncHandler(requireAiManage), asyncHandler(adminTestAiConnection));
  app.get("/admin/settings/notification-providers", adminAuth(), asyncHandler(requireSuperAdmin), asyncHandler(adminNotificationProviderSettings));
  app.put("/admin/settings/notification-providers", adminAuth(), asyncHandler(requireSuperAdmin), asyncHandler(adminUpdateNotificationProviderSettings));
  app.post("/admin/settings/notification-providers/test-connection", adminAuth(), asyncHandler(requireSuperAdmin), asyncHandler(adminTestNotificationProviderConnection));
  app.post("/admin/settings/notification-providers/test-send", adminAuth(), asyncHandler(requireSuperAdmin), asyncHandler(adminTestNotificationProviderSend));
  app.get("/admin/settings/sos", adminAuth(), asyncHandler(adminSosSettings));
  app.put("/admin/settings/sos", adminAuth(), asyncHandler(requireSuperAdmin), asyncHandler(adminUpdateSosSettings));
  app.post("/admin/settings/sos/reset", adminAuth(), asyncHandler(requireSuperAdmin), asyncHandler(adminResetSosSettings));
  app.put("/admin/settings/:key", adminAuth(), asyncHandler(requireSuperAdmin), asyncHandler(adminUpdateSetting));
  startBackupScheduler();
  app.use("/admin", adminAuth({ allowPending2fa: true }), adminNotFound);
}

async function adminLogin(req, res) {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const ip = cleanText(req.ip, 64);
  const userAgent = cleanText(req.headers["user-agent"], 512);

  if (!email || !password) {
    return res.status(400).json({ code: "ADMIN_LOGIN_REQUIRED" });
  }

  const locked = await pool.query(
    `SELECT MAX(locked_until) locked_until FROM admin_login_attempts
     WHERE email = $1 AND locked_until IS NOT NULL AND locked_until > UTC_TIMESTAMP()`,
    [email]
  );
  if (locked.rows[0]?.locked_until) {
    await logAdminLogin(null, email, ip, userAgent, false, "locked");
    return res.status(429).json({ code: "ADMIN_LOCKED" });
  }

  const result = await pool.query(
    `SELECT id, email, password_hash, display_name, is_active, two_factor_enabled
     FROM admin_users WHERE email = $1`,
    [email]
  );
  const admin = result.rows[0];
  const valid = admin?.password_hash ? await bcrypt.compare(password, admin.password_hash) : false;

  if (!admin || !admin.is_active || !valid) {
    if (admin?.id) await incrementFailedLogin(admin.id);
    await logAdminLogin(admin?.id ?? null, email, ip, userAgent, false, admin && !admin.is_active ? "inactive" : "invalid_credentials");
    return res.status(401).json({ code: "UNAUTHORIZED" });
  }

  if (admin.two_factor_enabled && !req.body?.code) {
    await logAdminLogin(admin.id, email, ip, userAgent, false, "two_factor_required");
    return res.status(401).json({ code: "ADMIN_2FA_REQUIRED" });
  }

  await pool.query(
    "UPDATE admin_users SET failed_login_count = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP() WHERE id = $1",
    [admin.id]
  );
  const session = await createAdminSession(admin, req, { twoFactorVerified: !admin.two_factor_enabled });
  await logAdminLogin(admin.id, email, ip, userAgent, true, null);
  setAdminCookie(res, session.token, session.expiresAt);
  res.json({
    token: session.token,
    csrfToken: session.csrfToken,
    admin: await publicAdmin(admin.id),
    twoFactorSetupRequired: false
  });
}

async function adminMe(req, res) {
  res.json({ admin: await publicAdmin(req.admin.id) });
}

async function adminLogout(req, res) {
  await pool.query("UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = $1", [req.admin.sessionId]);
  setAdminCookie(res, "", new Date(0));
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
    countWhere("users"),
    countWhere("users", "DATE(created_at) = UTC_DATE()"),
    countWhere("users", "created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY"),
    countWhere("users", "created_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY"),
    countWhere("users", "email_verified = TRUE"),
    countWhere("users", "admin_blocked_at IS NOT NULL"),
    countWhere("users", "subscription_status IN ('active','trialing') OR premium_status IN ('active','trialing')"),
    countWhere("users", "premium_plan IN ('family', 'family_semiannual', 'family_yearly') AND (subscription_status = 'active' OR premium_status = 'active')"),
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
    recentUsers: recentUsers.rows.map(publicUserRow)
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
     FROM users ${where} ORDER BY created_at DESC LIMIT ${page.limit} OFFSET ${page.offset}`,
    params
  );
  const total = await pool.query(`SELECT COUNT(*) count FROM users ${where}`, params);
  res.json({ rows: rows.rows.map(publicAdminUser), total: Number(total.rows[0]?.count ?? 0), ...page });
}

async function adminUserDetail(req, res) {
  const id = req.params.id;
  const userResult = await pool.query(
    `SELECT id,email,full_name,preferred_locale,premium_status,premium_plan,premium_until,
       subscription_status,subscription_expires_at,trial_used,email_verified,created_at
     FROM users WHERE id = $1`,
    [id]
  );
  const user = userResult.rows[0];
  if (!user) return res.status(404).json({ code: "ADMIN_USER_NOT_FOUND" });
  const [devices, subscriptions, trials, sos, familyLinks] = await Promise.all([
    pool.query(
      `SELECT id,device_id,device_name,platform,last_seen_at,created_at,revoked_at
       FROM account_devices WHERE user_id = $1 ORDER BY last_seen_at DESC LIMIT 25`,
      [id]
    ),
    pool.query(
      `SELECT id,provider,plan,status,expires_at,created_at,updated_at
       FROM subscriptions WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 25`,
      [id]
    ),
    pool.query(
      `SELECT id,started_at,ends_at,status,device_hash,created_at
       FROM trial_periods WHERE user_id = $1 ORDER BY started_at DESC LIMIT 25`,
      [id]
    ),
    pool.query(
      `SELECT public_token,hide_sensitive,updated_at
       FROM sos_profiles WHERE user_id = $1`,
      [id]
    ),
    pool.query(
      `SELECT fl.id,fl.owner_user_id,owner.email owner_email,owner.full_name owner_name,
              fl.caregiver_user_id,COALESCE(caregiver.email,fl.invite_email) invite_email,
              caregiver.full_name caregiver_name,fl.member_role role,fl.permissions,fl.status,
              fl.email_sent,fl.email_error,fl.expires_at,fl.accepted_at,fl.created_at
       FROM family_links fl
       LEFT JOIN users owner ON owner.id=fl.owner_user_id
       LEFT JOIN users caregiver ON caregiver.id=fl.caregiver_user_id
       WHERE fl.owner_user_id = $1 OR fl.caregiver_user_id = $1 OR LOWER(fl.invite_email) = LOWER($2)
       ORDER BY fl.created_at DESC LIMIT 50`,
      [id, id, user.email || ""]
    ).catch(() => ({ rows: [] }))
  ]);
  res.json({
    user: publicAdminUser(user),
    devices: devices.rows,
    subscriptions: subscriptions.rows,
    trials: trials.rows,
    sos: sos.rows[0] || null,
    familyLinks: familyLinks.rows
  });
}
async function adminRevokeUserSessions(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "INVALID_ID" });
  await pool.transaction(async (query) => {
    await query("UPDATE users SET token_version = token_version + 1 WHERE id = $1", [id]);
    await query("UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = $1 AND revoked_at IS NULL", [id]);
  });
  await auditAdminAction(req, "user.sessions_revoked", "user", id);
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
  await auditAdminAction(req, "user.blocked", "user", id, { reason });
  res.json({ ok: true });
}

async function adminUnblockUser(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "INVALID_ID" });
  const result = await pool.query("UPDATE users SET admin_blocked_at = NULL, admin_block_reason = NULL WHERE id = $1", [id]);
  if (!result.rowCount) return res.status(404).json({ code: "USER_NOT_FOUND" });
  await auditAdminAction(req, "user.unblocked", "user", id);
  res.json({ ok: true });
}

async function adminVerifyUserEmail(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "INVALID_ID" });
  const result = await pool.query("UPDATE users SET email_verified = TRUE, email_verification_token_hash = NULL, email_verification_expires_at = NULL WHERE id = $1", [id]);
  if (!result.rowCount) return res.status(404).json({ code: "USER_NOT_FOUND" });
  await auditAdminAction(req, "user.email_verified", "user", id);
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
    if (!user.rowCount) return;
    await query(
      `UPDATE users
       SET premium_status = 'active',
           subscription_status = 'active',
           premium_plan = $1,
           premium_until = DATE_ADD(GREATEST(COALESCE(subscription_expires_at, UTC_TIMESTAMP()), UTC_TIMESTAMP()), INTERVAL $2 DAY),
           subscription_expires_at = DATE_ADD(GREATEST(COALESCE(subscription_expires_at, UTC_TIMESTAMP()), UTC_TIMESTAMP()), INTERVAL $3 DAY)
       WHERE id = $4`,
      [plan, days, days, id]
    );
    await query(
      `INSERT INTO subscriptions(user_id, provider, provider_subscription_id, plan, status, expires_at, updated_at)
       VALUES($1, 'admin_manual', $2, $3, 'active',
         DATE_ADD(GREATEST(COALESCE((SELECT subscription_expires_at FROM users WHERE id = $4), UTC_TIMESTAMP()), UTC_TIMESTAMP()), INTERVAL 0 DAY),
         UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         plan = VALUES(plan),
         status = VALUES(status),
         expires_at = VALUES(expires_at),
         updated_at = UTC_TIMESTAMP()`,
      [id, `admin-manual-${id}`, plan, id]
    );
    result = await query("SELECT id,email,full_name,preferred_locale,premium_status,premium_plan,premium_until,subscription_status,subscription_expires_at,trial_used,email_verified,created_at FROM users WHERE id = $1", [id]);
  });
  if (!result?.rowCount) return res.status(404).json({ code: "USER_NOT_FOUND" });
  await auditAdminAction(req, "subscription.extended", "user", id, { plan, days, subscriptionExpiresAt: result.rows[0].subscription_expires_at });
  res.json({ ok: true, user: publicAdminUser(result.rows[0]), days, plan });
}

function parseMedicalPayload(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function numberOrNull(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstMedicalNumber(source, keys) {
  if (!source || typeof source !== "object") return null;
  for (const key of keys) {
    const value = numberOrNull(source[key]);
    if (value != null && value > 0) return value;
  }
  return null;
}

function normalizeMedicalPayload(snapshotPayload, userProfilePayload, user, glucoseRows, sosProfile, sosContact) {
  const payload = parseMedicalPayload(snapshotPayload);
  const userProfile = parseMedicalPayload(userProfilePayload);
  const profile = payload.profile && typeof payload.profile === "object" && !Array.isArray(payload.profile)
    ? payload.profile
    : {};
  const emergency = payload.emergency && typeof payload.emergency === "object" && !Array.isArray(payload.emergency)
    ? payload.emergency
    : {};
  const sosCard = parseMedicalPayload(sosProfile?.card);
  const latestGlucose = Array.isArray(glucoseRows) && glucoseRows.length ? glucoseRows[0] : null;
  return {
    ...payload,
    profile: {
      ...profile,
      fullName: profile.fullName || sosCard.fullName || user.full_name || "",
      email: profile.email || user.email || "",
      phone: profile.phone || userProfile.phone || sosCard.contactPhone || sosContact?.phone || "",
      age: firstMedicalNumber(profile, ["age"]) ?? firstMedicalNumber(userProfile, ["age"]) ?? firstMedicalNumber(sosCard, ["age"]),
      weightKg: firstMedicalNumber(profile, ["weightKg", "weight_kg", "weight", "user_weight"]) ?? firstMedicalNumber(userProfile, ["weightKg", "weight_kg", "weight", "user_weight"]),
      heightCm: firstMedicalNumber(profile, ["heightCm", "height_cm", "height", "user_height"]) ?? firstMedicalNumber(userProfile, ["heightCm", "height_cm", "height", "user_height"]),
      languageCode: profile.languageCode || userProfile.languageCode || sosCard.languageCode || user.preferred_locale || "",
      diabetesType: profile.diabetesType || userProfile.diabetesType || sosCard.diabetesType || user.diabetes_type || "",
      glucoseUnit: profile.glucoseUnit || userProfile.glucoseUnit || user.glucose_unit || "",
      glucoseMmol: firstMedicalNumber(profile, ["glucoseMmol", "currentGlucoseMmol", "current_glucose", "glucose", "glucose_mmol"]) ?? firstMedicalNumber(userProfile, ["glucoseMmol", "currentGlucoseMmol", "current_glucose", "glucose", "glucose_mmol"]) ?? firstMedicalNumber(sosCard, ["currentGlucoseMmol"]) ?? firstMedicalNumber(latestGlucose, ["glucose_mmol"]),
      targetGlucoseMmol: firstMedicalNumber(profile, ["targetGlucoseMmol", "targetGlucose", "target_glucose", "glucose_target", "target_glucose_mmol", "target"]) ?? firstMedicalNumber(userProfile, ["targetGlucoseMmol", "targetGlucose", "target_glucose", "glucose_target", "target_glucose_mmol", "target"]),
      insulinToCarbRatio: firstMedicalNumber(profile, ["insulinToCarbRatio", "insulin_carb_ratio", "insulin_to_carb_ratio", "insulinCarb", "carbRatio", "carb_ratio"]) ?? firstMedicalNumber(userProfile, ["insulinToCarbRatio", "insulin_carb_ratio", "insulin_to_carb_ratio", "insulinCarb", "carbRatio", "carb_ratio"]),
      correctionFactor: firstMedicalNumber(profile, ["correctionFactor", "correction_factor", "correction"]) ?? firstMedicalNumber(userProfile, ["correctionFactor", "correction_factor", "correction"]),
    },
    emergency: {
      ...emergency,
      contactName: emergency.contactName || sosCard.contactName || sosContact?.name || "",
      contactPhone: emergency.contactPhone || sosCard.contactPhone || sosContact?.phone || "",
      bloodType: emergency.bloodType || sosCard.bloodType || "",
      insulinName: emergency.insulinName || sosCard.insulinName || "",
      medications: emergency.medications || sosCard.medications || "",
      importantDiagnoses: emergency.importantDiagnoses || sosCard.importantDiagnoses || "",
      emergencyInstructions: emergency.emergencyInstructions || sosCard.instructions || "",
    },
  };
}

function normalizeMedicalGlucoseRows(rows) {
  return rows.map((row) => ({
    ...row,
    type: row.type || "glucose",
    title: row.title || "Glucose",
    glucoseMmol: numberOrNull(row.glucose_mmol),
    time: row.measured_at,
  }));
}

function normalizeMedicalInsulinRows(rows) {
  return rows.map((row) => ({
    ...row,
    units: numberOrNull(row.units),
    time: row.administered_at,
  }));
}

function normalizeMedicalFoodRows(rows) {
  return rows.map((row) => ({
    ...row,
    carbs: numberOrNull(row.carbs_grams),
    carbs_grams: numberOrNull(row.carbs_grams),
    time: row.eaten_at,
  }));
}

async function adminMedicalSnapshot(req, res) {
  const id = positiveId(req.params.id);
  const reason = cleanText(req.body?.reason, 512);
  const anonymized = req.body?.anonymized !== false;
  if (!id || !reason) return res.status(400).json({ code: "MEDICAL_REASON_REQUIRED" });
  const [user, glucose, insulin, food, snapshot, userProfile, sosProfile, sosContact] = await Promise.all([
    pool.query("SELECT id,email,full_name,preferred_locale,diabetes_type,glucose_unit FROM users WHERE id = $1", [id]),
    pool.query("SELECT glucose_mmol, measured_at, source FROM glucose_logs WHERE user_id = $1 ORDER BY measured_at DESC LIMIT 50", [id]),
    pool.query("SELECT units, insulin_type, administered_at FROM insulin_logs WHERE user_id = $1 ORDER BY administered_at DESC LIMIT 50", [id]),
    pool.query("SELECT title, carbs_grams, eaten_at FROM food_logs WHERE user_id = $1 ORDER BY eaten_at DESC LIMIT 50", [id]),
    pool.query("SELECT payload, updated_at FROM health_snapshots WHERE user_id = $1", [id]),
    pool.query("SELECT profile, updated_at FROM user_profiles WHERE user_id = $1", [id]),
    pool.query("SELECT card, updated_at FROM sos_profiles WHERE user_id = $1", [id]),
    pool.query("SELECT name, phone FROM sos_contacts WHERE user_id = $1 ORDER BY priority ASC, id ASC LIMIT 1", [id])
  ]);
  if (!user.rowCount) return res.status(404).json({ code: "USER_NOT_FOUND" });
  const glucoseRows = normalizeMedicalGlucoseRows(glucose.rows);
  const snapshotRow = snapshot.rows[0] ?? null;
  const payload = normalizeMedicalPayload(snapshotRow?.payload, userProfile.rows[0]?.profile, user.rows[0], glucose.rows, sosProfile.rows[0], sosContact.rows[0]);
  await auditAdminAction(req, "medical.viewed", "user", id, { reason, anonymized, categories: ["profile", "glucose", "insulin", "food", "snapshot", "user_profile", "sos"] });
  res.json({
    userId: anonymized ? "user-" + id : String(id),
    anonymized,
    glucose: glucoseRows,
    insulin: normalizeMedicalInsulinRows(insulin.rows),
    food: normalizeMedicalFoodRows(food.rows),
    snapshot: snapshotRow ? { ...snapshotRow, payload } : { payload, updated_at: null }
  });
}
async function adminNotificationDetail(req, res) {
  const id = req.params.id;
  const campaign = await pool.query("SELECT * FROM notification_campaigns WHERE id = $1", [id]);
  if (!campaign.rowCount) return res.status(404).json({ code: "ADMIN_NOTIFICATION_NOT_FOUND" });
  const [stats, deliveries] = await Promise.all([
    pool.query("SELECT status,COUNT(*) count FROM notification_deliveries WHERE campaign_id = $1 GROUP BY status", [id]),
    pool.query(
      `SELECT d.id,d.user_id,u.email,u.full_name,d.status,d.delivered_at,d.error_message,d.channel
       FROM notification_deliveries d LEFT JOIN users u ON u.id=d.user_id
       WHERE d.campaign_id = $1 ORDER BY d.id DESC LIMIT 50`,
      [id]
    )
  ]);
  res.json({ campaign: campaign.rows[0], stats: stats.rows, deliveries: deliveries.rows });
}

async function adminHelpArticleDetail(req, res) {
  const id = req.params.id;
  const article = await pool.query(
    `SELECT a.*,c.slug category FROM help_articles a LEFT JOIN help_categories c ON c.id=a.category_id WHERE a.id = $1`,
    [id]
  );
  if (!article.rowCount) return res.status(404).json({ code: "ADMIN_HELP_ARTICLE_NOT_FOUND" });
  const [translations, locales] = await Promise.all([
    pool.query("SELECT * FROM help_article_translations WHERE article_id = $1 ORDER BY locale", [id]),
    pool.query("SELECT DISTINCT locale FROM help_article_translations ORDER BY locale")
  ]);
  res.json({ article: article.rows[0], translations: translations.rows, locales: locales.rows.map((row) => row.locale) });
}

async function adminReferralDetail(req, res) {
  const id = req.params.id;
  const referral = await pool.query(
    `SELECT rr.id,rr.referral_relation_id,rc.code,ref.email referrer_email,referred.email referred_email,
       rel.status,rel.rejection_reason,rel.registered_at,rel.email_verified_at,rel.qualified_at,rel.rewarded_at
     FROM referral_rewards rr
     LEFT JOIN referral_relations rel ON rel.id=rr.referral_relation_id
     LEFT JOIN referral_codes rc ON rc.id=rel.referral_code_id
     LEFT JOIN users ref ON ref.id=rel.referrer_user_id
     LEFT JOIN users referred ON referred.id=rel.referred_user_id
     WHERE rr.id = $1`,
    [id]
  );
  if (!referral.rowCount) return res.status(404).json({ code: "ADMIN_REFERRAL_NOT_FOUND" });
  const relationId = referral.rows[0].referral_relation_id;
  const [rewards, fraud] = await Promise.all([
    pool.query("SELECT * FROM referral_rewards WHERE referral_relation_id = $1 ORDER BY created_at DESC", [relationId]),
    pool.query("SELECT * FROM referral_fraud_checks WHERE referral_relation_id = $1 ORDER BY created_at DESC", [relationId])
  ]);
  res.json({ referral: referral.rows[0], rewards: rewards.rows, fraud: fraud.rows });
}

async function adminSupportDetail(req, res) {
  const id = req.params.id;
  const ticket = await pool.query(
    `SELECT t.*,COALESCE(u.email, '-') email FROM support_tickets t LEFT JOIN users u ON u.id=t.user_id WHERE t.id = $1`,
    [id]
  );
  if (!ticket.rowCount) return res.status(404).json({ code: "ADMIN_SUPPORT_NOT_FOUND" });
  const messages = await pool.query(
    `SELECT m.*,a.email admin_email,u.email user_email FROM support_messages m
     LEFT JOIN admin_users a ON a.id=m.author_admin_id
     LEFT JOIN users u ON u.id=m.author_user_id
     WHERE m.ticket_id = $1 ORDER BY m.created_at ASC`,
    [id]
  );
  res.json({ ticket: ticket.rows[0], messages: messages.rows });
}

async function adminGdprDetail(req, res) {
  await cleanupExpiredGdprExports();
  const id = req.params.id;
  const request = await pool.query(
    `SELECT g.public_id publicId,g.id,g.user_id userId,u.email,g.request_type requestType,g.status,g.subject,g.description,
       g.due_at dueAt,g.identity_verified_at identityVerifiedAt,g.rejection_reason rejectionReason,
       a.email assignedAdminEmail,g.assigned_admin_id assignedAdminId
     FROM gdpr_requests g LEFT JOIN users u ON u.id=g.user_id LEFT JOIN admin_users a ON a.id=g.assigned_admin_id
     WHERE g.public_id = $1 OR g.id = $2`,
    [id, id]
  );
  if (!request.rowCount) return res.status(404).json({ code: "ADMIN_GDPR_NOT_FOUND" });
  const requestId = request.rows[0].id;
  const [events, files, jobs, actions] = await Promise.all([
    pool.query("SELECT * FROM gdpr_request_events WHERE request_id = $1 ORDER BY created_at DESC", [requestId]),
    pool.query("SELECT * FROM gdpr_request_files WHERE request_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC", [requestId]),
    pool.query("SELECT * FROM gdpr_export_jobs WHERE request_id = $1 ORDER BY created_at DESC", [requestId]),
    pool.query("SELECT * FROM gdpr_data_actions WHERE request_id = $1 ORDER BY executed_at DESC", [requestId])
  ]);
  res.json({ request: request.rows[0], events: events.rows, files: files.rows, exportJobs: jobs.rows, actions: actions.rows });
}

async function adminSubscriptions(req, res) {
  const page = pageParams(req);
  const search = searchTerm(req);
  const where = ["(u.subscription_status IS NOT NULL OR u.premium_plan IS NOT NULL OR u.premium_until IS NOT NULL OR u.subscription_expires_at IS NOT NULL)"];
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    where.push("(u.email LIKE $1 OR u.full_name LIKE $1)");
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const rows = await pool.query(
    `SELECT COALESCE(s.id, u.id) id, u.id user_id, u.email, u.full_name,
       COALESCE(s.provider, 'user_state') provider,
       COALESCE(s.plan, u.premium_plan) plan,
       COALESCE(s.status, u.subscription_status, u.premium_status) status,
       COALESCE(s.expires_at, u.subscription_expires_at, u.premium_until) expires_at,
       COALESCE(s.updated_at, u.subscription_expires_at, u.premium_until, u.created_at) updated_at
     FROM users u
     LEFT JOIN subscriptions s ON s.id = (
       SELECT s2.id FROM subscriptions s2 WHERE s2.user_id = u.id ORDER BY s2.updated_at DESC, s2.id DESC LIMIT 1
     )
     ${whereSql}
     ORDER BY COALESCE(s.updated_at, u.subscription_expires_at, u.premium_until, u.created_at) DESC
     LIMIT ${page.limit} OFFSET ${page.offset}`,
    params
  );
  const total = await pool.query(`SELECT COUNT(*) count FROM users u ${whereSql}`, params);
  res.json({ rows: rows.rows, total: Number(total.rows[0]?.count ?? 0), ...page });
}

async function adminPayments(req, res) {
  await listQuery(req, res, {
    select: `p.id,p.user_id,u.email,u.full_name,p.provider,p.amount_minor,p.currency,p.status,p.created_at`,
    from: "payments p JOIN users u ON u.id = p.user_id",
    order: "p.created_at DESC"
  });
}

async function adminDevices(req, res) {
  await listQuery(req, res, {
    select: `d.id,d.user_id,u.email,u.full_name,d.device_id,d.device_name,d.platform,d.last_seen_at,d.created_at,d.revoked_at`,
    from: "account_devices d JOIN users u ON u.id = d.user_id",
    order: "d.last_seen_at DESC"
  });
}

async function adminTrials(req, res) {
  await listQuery(req, res, {
    select: `t.id,t.user_id,u.email,t.started_at,t.ends_at,t.status,t.device_hash`,
    from: "trial_periods t JOIN users u ON u.id = t.user_id",
    order: "t.started_at DESC"
  });
}

async function adminFamily(req, res) {
  await listQuery(req, res, {
    select: `fl.id,owner.email owner_email,owner.full_name owner_name,COALESCE(caregiver.email,fl.invite_email) invite_email,caregiver.full_name caregiver_name,fl.member_role role,fl.permissions,fl.status,fl.email_sent,fl.email_error,fl.expires_at,fl.accepted_at,(SELECT COUNT(*) FROM family_links x WHERE x.owner_user_id=fl.owner_user_id AND x.status IN ('pending','accepted')) member_count`,
    from: "family_links fl LEFT JOIN users owner ON owner.id = fl.owner_user_id LEFT JOIN users caregiver ON caregiver.id = fl.caregiver_user_id",
    order: "fl.created_at DESC"
  });
}

async function adminUpdateFamilyStatus(req, res) {
  const id = cleanText(req.params.id, 64);
  const status = cleanText(req.body?.status, 32);
  if (!/^\d+$/.test(id) || !["pending", "accepted", "revoked"].includes(status)) return res.status(400).json({ code: "INVALID_FAMILY_STATUS" });
  const result = await pool.query(
    "UPDATE family_links SET status=$1, accepted_at=CASE WHEN $1='accepted' THEN COALESCE(accepted_at, UTC_TIMESTAMP()) ELSE accepted_at END WHERE id=$2",
    [status, id]
  );
  if (!result.rowCount) return res.status(404).json({ code: "FAMILY_LINK_NOT_FOUND" });
  await pool.query(
    "INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES($1,'family_access.status_updated','family_link',$2,$3,$4,$5)",
    [req.admin.id, id, JSON.stringify({ status }), cleanText(req.ip, 64), cleanText(req.headers["user-agent"], 512)]
  ).catch(() => {});
  res.json({ ok: true, status });
}


async function adminUpdateFamilyPermissions(req, res) {
  const id = cleanText(req.params.id, 64);
  if (!/^\d+$/.test(id)) return res.status(400).json({ code: "INVALID_FAMILY_LINK" });
  const permissions = validateAdminFamilyPermissions(req.body?.permissions || {});
  if (permissions.error) return res.status(400).json({ code: permissions.error });
  const before = await pool.query("SELECT permissions FROM family_links WHERE id=$1", [id]);
  if (!before.rowCount) return res.status(404).json({ code: "FAMILY_LINK_NOT_FOUND" });
  await pool.query("UPDATE family_links SET permissions=$1 WHERE id=$2", [JSON.stringify(permissions.value), id]);
  await pool.query(
    "INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES($1,'family_access.permissions_updated','family_link',$2,$3,$4,$5)",
    [req.admin.id, id, JSON.stringify({ before: before.rows[0]?.permissions ?? null, after: permissions.value }), cleanText(req.ip, 64), cleanText(req.headers["user-agent"], 512)]
  ).catch(() => {});
  res.json({ ok: true, permissions: permissions.value });
}

function validateAdminFamilyPermissions(input) {
  const value = { glucose: false, history: false, emergency: false };
  for (const key of Object.keys(input || {})) if (!Object.prototype.hasOwnProperty.call(value, key)) return { error: "FAMILY_PERMISSION_UNKNOWN" };
  for (const key of Object.keys(value)) {
    if (typeof input[key] !== "boolean") return { error: "FAMILY_PERMISSION_BOOLEAN_REQUIRED" };
    value[key] = input[key];
  }
  return { value };
}

async function adminSos(req, res) {
  await listQuery(req, res, {
    select: `s.user_id,u.email,s.public_token,s.hide_sensitive,(SELECT COUNT(*) FROM sos_scans ss WHERE ss.user_id=s.user_id) scan_count,s.updated_at`,
    from: "sos_profiles s JOIN users u ON u.id = s.user_id",
    order: "s.updated_at DESC"
  });
}

async function adminAi(req, res) {
  await listQuery(req, res, {
    select: `a.id,a.user_id,u.email,a.request_type,a.locale,a.status,a.model,a.created_at`,
    from: "ai_requests a LEFT JOIN users u ON u.id = a.user_id",
    order: "a.created_at DESC"
  });
}

async function adminNotifications(req, res) {
  await listQuery(req, res, {
    select: `id,title,locale,status,recipient_count,delivered_count,created_at,scheduled_at,sent_at`,
    from: "notification_campaigns",
    order: "created_at DESC"
  });
}

async function adminReferrals(req, res) {
  await listQuery(req, res, {
    select: `rr.id,rc.code,ref.email referrer_email,referred.email referred_email,rr.status,rel.rejection_reason,rel.registered_at,rel.email_verified_at,rel.qualified_at,rel.rewarded_at,rr.reward_days granted_days`,
    from: "referral_rewards rr LEFT JOIN referral_relations rel ON rel.id=rr.referral_relation_id LEFT JOIN referral_codes rc ON rc.id=rel.referral_code_id LEFT JOIN users ref ON ref.id=rel.referrer_user_id LEFT JOIN users referred ON referred.id=rel.referred_user_id",
    order: "rr.created_at DESC"
  });
}

async function adminHelp(req, res) {
  await listQuery(req, res, {
    select: `a.id,a.slug,c.slug category,t.title,a.status,t.translation_status,a.view_count,a.updated_at`,
    from: "help_articles a LEFT JOIN help_categories c ON c.id=a.category_id LEFT JOIN help_article_translations t ON t.article_id=a.id AND t.locale='en'",
    order: "a.updated_at DESC"
  });
}

async function adminAbout(req, res) {
  await listQuery(req, res, {
    select: `c.id,c.section_key,c.content_type,t.locale,t.title,t.translation_status,c.is_active,c.updated_at`,
    from: "about_content c LEFT JOIN about_content_translations t ON t.content_id=c.id",
    order: "c.updated_at DESC"
  });
}

async function adminLocalizations(req, res) {
  await listQuery(req, res, {
    select: `locale,version_label,created_at,created_by`,
    from: "localization_versions",
    order: "created_at DESC"
  });
}

async function adminSupport(req, res) {
  await listQuery(req, res, {
    select: `t.id,COALESCE(u.email, '-') email,t.subject,t.status,t.priority,t.assigned_admin_id,t.updated_at`,
    from: "support_tickets t LEFT JOIN users u ON u.id = t.user_id",
    order: "t.updated_at DESC"
  });
}

async function adminSecurity(req, res) {
  await listQuery(req, res, {
    select: `id,event_type,severity,user_id,admin_user_id,ip_address,created_at`,
    from: "security_events",
    order: "created_at DESC"
  });
}

async function adminErrors(req, res) {
  await listQuery(req, res, {
    select: `id,source,severity,code,endpoint,status,occurrences,last_seen_at`,
    from: "system_errors",
    order: "last_seen_at DESC"
  });
}

async function adminDeleteError(req, res) {
  const result = await pool.query("DELETE FROM system_errors WHERE id = $1", [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ code: "ADMIN_ERROR_NOT_FOUND" });
  res.json({ ok: true, deletedId: String(req.params.id) });
}

async function adminBackups(req, res) {
  await ensureBackupSchema();
  await listQuery(req, res, {
    select: `b.id,COALESCE(b.mode,b.backup_type) backup_type,b.status,b.file_size_bytes,b.sha256,b.duration_ms,COALESCE(a.email, b.created_by) created_by,b.source,b.started_at,b.finished_at,b.verified_at,b.verification_status,b.error_message,b.is_protected`,
    from: "backup_runs b LEFT JOIN admin_users a ON a.id=b.created_by",
    order: "b.started_at DESC"
  });
}

const FAMILY_ACCESS_SETTING_DEFS = {
  family_access_enabled: { type: "boolean", defaultValue: true },
  family_trusted_contacts_enabled: { type: "boolean", defaultValue: true },
  family_invites_enabled: { type: "boolean", defaultValue: true },
  family_max_members: { type: "integer", min: 1, max: 20, defaultValue: 5 }
};

const NOTIFICATION_PRIORITY_OPTIONS = ["low", "normal", "high", "critical"];
const NOTIFICATION_SETTING_DEFS = {
  notifications_enabled: { type: "boolean", defaultValue: true },
  notification_push_enabled: { type: "boolean", defaultValue: true },
  notification_email_enabled: { type: "boolean", defaultValue: true },
  notification_sms_enabled: { type: "boolean", defaultValue: false },
  notification_in_app_enabled: { type: "boolean", defaultValue: true },
  notification_event_glucose_alert_enabled: { type: "boolean", defaultValue: true },
  notification_event_family_invite_enabled: { type: "boolean", defaultValue: true },
  notification_event_medication_reminder_enabled: { type: "boolean", defaultValue: true },
  notification_event_daily_summary_enabled: { type: "boolean", defaultValue: true },
  notification_event_system_broadcast_enabled: { type: "boolean", defaultValue: true },
  notification_priority_glucose_alert: { type: "enum", values: NOTIFICATION_PRIORITY_OPTIONS, defaultValue: "high" },
  notification_priority_family_invite: { type: "enum", values: NOTIFICATION_PRIORITY_OPTIONS, defaultValue: "normal" },
  notification_priority_medication_reminder: { type: "enum", values: NOTIFICATION_PRIORITY_OPTIONS, defaultValue: "high" },
  notification_priority_daily_summary: { type: "enum", values: NOTIFICATION_PRIORITY_OPTIONS, defaultValue: "normal" },
  notification_priority_system_broadcast: { type: "enum", values: NOTIFICATION_PRIORITY_OPTIONS, defaultValue: "normal" },
  notification_rate_limit_per_minute: { type: "integer", min: 1, max: 120, defaultValue: 10 },
  notification_rate_limit_per_hour: { type: "integer", min: 1, max: 1000, defaultValue: 120 },
  notification_rate_limit_per_day: { type: "integer", min: 1, max: 10000, defaultValue: 500 },
  notification_default_push: { type: "boolean", defaultValue: true },
  notification_default_email: { type: "boolean", defaultValue: true },
  notification_default_sms: { type: "boolean", defaultValue: false },
  notification_default_in_app: { type: "boolean", defaultValue: true }
};
async function adminFamilyAccessSettings(req, res) {
  const settings = await familyAccessSettings();
  const links = await pool.query(
    `SELECT fl.id,fl.owner_user_id,owner.email owner_email,owner.full_name owner_name,fl.caregiver_user_id,COALESCE(caregiver.email,fl.invite_email) invite_email,caregiver.full_name caregiver_name,fl.member_role role,fl.permissions,fl.status,fl.email_sent,fl.email_error,fl.expires_at,fl.accepted_at,fl.created_at
     FROM family_links fl
     LEFT JOIN users owner ON owner.id=fl.owner_user_id
     LEFT JOIN users caregiver ON caregiver.id=fl.caregiver_user_id
     ORDER BY fl.created_at DESC LIMIT 100`
  );
  res.json({ settings, rows: links.rows, total: links.rows.length, page: 1, limit: 100 });
}

async function adminUpdateFamilyAccessSettings(req, res) {
  const parsed = validateFamilyAccessSettings(req.body?.settings || {});
  if (parsed.error) return res.status(400).json({ code: parsed.error });
  const before = await familyAccessSettings();
  await pool.transaction(async (query) => {
    for (const [key, value] of Object.entries(parsed.value)) {
      await query(
        `INSERT INTO system_settings(setting_key,setting_value,is_secret,updated_by,updated_at)
         VALUES($1,$2,0,$3,UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),is_secret=0,updated_by=VALUES(updated_by),updated_at=VALUES(updated_at)`,
        [key, JSON.stringify(value), req.admin.id]
      );
    }
    await query(
      "INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES($1,'settings.family_access.updated','system_settings','family_access',$2,$3,$4)",
      [req.admin.id, JSON.stringify({ before, after: parsed.value }), cleanText(req.ip, 64), cleanText(req.headers["user-agent"], 512)]
    );
  });
  res.json({ settings: parsed.value });
}

async function familyAccessSettings() {
  const defaults = Object.fromEntries(Object.entries(FAMILY_ACCESS_SETTING_DEFS).map(([key, def]) => [key, def.defaultValue]));
  const keys = Object.keys(FAMILY_ACCESS_SETTING_DEFS);
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(",");
  const result = await pool.query(`SELECT setting_key,setting_value FROM system_settings WHERE setting_key IN (${placeholders})`, keys);
  for (const row of result.rows) {
    const def = FAMILY_ACCESS_SETTING_DEFS[row.setting_key];
    if (!def) continue;
    let value = row.setting_value;
    try { value = JSON.parse(row.setting_value); } catch {}
    if (def.type === "boolean") defaults[row.setting_key] = value === true || value === 1 || value === "1" || value === "true";
    if (def.type === "integer") {
      const numeric = Number(value);
      defaults[row.setting_key] = Number.isInteger(numeric) && numeric >= def.min && numeric <= def.max ? numeric : def.defaultValue;
    }
  }
  return defaults;
}

function validateFamilyAccessSettings(input) {
  const value = Object.fromEntries(Object.entries(FAMILY_ACCESS_SETTING_DEFS).map(([key, def]) => [key, def.defaultValue]));
  for (const key of Object.keys(input || {})) if (!FAMILY_ACCESS_SETTING_DEFS[key]) return { error: "FAMILY_ACCESS_SETTING_UNKNOWN" };
  for (const [key, def] of Object.entries(FAMILY_ACCESS_SETTING_DEFS)) {
    const raw = Object.prototype.hasOwnProperty.call(input, key) ? input[key] : def.defaultValue;
    if (def.type === "boolean") {
      if (typeof raw !== "boolean") return { error: "FAMILY_ACCESS_SETTING_BOOLEAN_REQUIRED" };
      value[key] = raw;
    } else {
      const numeric = Number(raw);
      if (!Number.isInteger(numeric) || numeric < def.min || numeric > def.max) return { error: "FAMILY_ACCESS_SETTING_INTEGER_RANGE" };
      value[key] = numeric;
    }
  }
  if (!value.family_access_enabled) {
    value.family_trusted_contacts_enabled = false;
    value.family_invites_enabled = false;
  }
  return { value };
}
async function adminNotificationSettings(_req, res) {
  const settings = await notificationSettings();
  const recent = await pool.query(
    "SELECT id,title,locale,status,recipient_count,delivered_count,created_at,scheduled_at,sent_at FROM notification_campaigns ORDER BY created_at DESC LIMIT 10"
  );
  res.json({ settings, defaults: notificationDefaults(), schema: notificationSchema(), rows: recent.rows, total: recent.rows.length, page: 1, limit: 10 });
}

async function adminUpdateNotificationSettings(req, res) {
  const parsed = validateNotificationSettings(req.body?.settings || {});
  if (parsed.error) return res.status(400).json({ code: parsed.error });
  const before = await notificationSettings();
  await pool.transaction(async (query) => {
    for (const [key, value] of Object.entries(parsed.value)) {
      await query(
        "INSERT INTO system_settings(setting_key,setting_value,is_secret,updated_by,updated_at) VALUES($1,$2,0,$3,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),is_secret=0,updated_by=VALUES(updated_by),updated_at=VALUES(updated_at)",
        [key, JSON.stringify(value), req.admin.id]
      );
    }
    await query(
      "INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES($1,'settings.notifications.updated','system_settings','notifications',$2,$3,$4)",
      [req.admin.id, JSON.stringify({ before, after: parsed.value }), cleanText(req.ip, 64), cleanText(req.headers["user-agent"], 512)]
    );
  });
  res.json({ ok: true, settings: parsed.value });
}

async function notificationSettings() {
  const settings = notificationDefaults();
  const keys = Object.keys(NOTIFICATION_SETTING_DEFS);
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(",");
  const result = await pool.query(`SELECT setting_key,setting_value FROM system_settings WHERE setting_key IN (${placeholders})`, keys);
  for (const row of result.rows) {
    const def = NOTIFICATION_SETTING_DEFS[row.setting_key];
    if (!def) continue;
    let value = row.setting_value;
    try { value = JSON.parse(row.setting_value); } catch {}
    settings[row.setting_key] = parseNotificationSetting(def, value);
  }
  return settings;
}

function notificationDefaults() {
  return Object.fromEntries(Object.entries(NOTIFICATION_SETTING_DEFS).map(([key, def]) => [key, def.defaultValue]));
}

function notificationSchema() {
  return Object.fromEntries(Object.entries(NOTIFICATION_SETTING_DEFS).map(([key, def]) => [key, { type: def.type, min: def.min, max: def.max, values: def.values }]));
}

function parseNotificationSetting(def, value) {
  if (def.type === "boolean") return value === true || value === 1 || value === "1" || value === "true";
  if (def.type === "integer") {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric >= def.min && numeric <= def.max ? numeric : def.defaultValue;
  }
  if (def.type === "enum") return def.values.includes(String(value)) ? String(value) : def.defaultValue;
  return def.defaultValue;
}

function validateNotificationSettings(input) {
  const value = notificationDefaults();
  for (const key of Object.keys(input || {})) if (!NOTIFICATION_SETTING_DEFS[key]) return { error: "NOTIFICATION_SETTING_UNKNOWN" };
  for (const [key, def] of Object.entries(NOTIFICATION_SETTING_DEFS)) {
    const raw = Object.prototype.hasOwnProperty.call(input, key) ? input[key] : def.defaultValue;
    if (def.type === "boolean") {
      if (typeof raw !== "boolean") return { error: "NOTIFICATION_SETTING_BOOLEAN_REQUIRED" };
      value[key] = raw;
    } else if (def.type === "integer") {
      const numeric = Number(raw);
      if (!Number.isInteger(numeric) || numeric < def.min || numeric > def.max) return { error: "NOTIFICATION_SETTING_INTEGER_RANGE" };
      value[key] = numeric;
    } else if (def.type === "enum") {
      if (!def.values.includes(String(raw))) return { error: "NOTIFICATION_SETTING_ENUM_INVALID" };
      value[key] = String(raw);
    }
  }
  if (!value.notifications_enabled) {
    value.notification_push_enabled = false;
    value.notification_email_enabled = false;
    value.notification_sms_enabled = false;
    value.notification_in_app_enabled = false;
  }
  if (!value.notification_push_enabled) value.notification_default_push = false;
  if (!value.notification_email_enabled) value.notification_default_email = false;
  if (!value.notification_sms_enabled) value.notification_default_sms = false;
  if (!value.notification_in_app_enabled) value.notification_default_in_app = false;
  return { value };
}
async function adminBackupSettings(_req, res) {
  await ensureBackupSchema();
  const settings = await backupSettings();
  res.json({ settings, defaults: backupDefaults(), schema: backupSchema(), modes: backupModes(settings), status: await backupRuntimeStatus(), rows: await recentBackupRows() });
}

async function adminUpdateBackupSettings(req, res) {
  const next = validateBackupSettings(req.body?.settings ?? req.body ?? {});
  if (next.error) return res.status(400).json({ code: next.error });
  await saveBackupSettings(next.value, req.admin.id, req, "settings.backup.update");
  res.json({ ok: true, settings: await backupSettings() });
}

async function adminResetBackupSettings(req, res) {
  await saveBackupSettings(backupDefaults(), req.admin.id, req, "settings.backup.reset");
  res.json({ ok: true, settings: await backupSettings() });
}

async function adminBackupStatus(_req, res) {
  res.json(await backupRuntimeStatus());
}

async function adminCreateBackup(req, res) {
  await ensureBackupSchema();
  const settings = await backupSettings();
  if (!settings.backup_enabled || !settings.backup_manual_enabled) return res.status(403).json({ code: "ADMIN_BACKUP_DISABLED" });
  const mode = cleanText(req.body?.mode || req.body?.type || "database", 32);
  if (!BACKUP_MODE_DEFS[mode]) return res.status(400).json({ code: "ADMIN_BACKUP_TYPE_INVALID" });
  try {
    const result = await runManagedBackup({ mode, source: "manual", adminId: req.admin.id, req, settings });
    res.status(201).json({ ok: true, backup: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ code: error.publicCode || error.message || "ADMIN_BACKUP_FAILED" });
  }
}

async function adminVerifyBackup(req, res) {
  const row = await backupRun(req.params.id);
  if (!row) return res.status(404).json({ code: "ADMIN_BACKUP_NOT_FOUND" });
  const result = await verifyBackupArchive(row);
  await pool.query("UPDATE backup_runs SET verified_at=UTC_TIMESTAMP(),verification_status=$1,error_message=NULL WHERE id=$2", [result.ok ? "verified" : "failed", row.id]);
  await auditBackup(req.admin.id, "backup.verify", "backup_runs", String(row.id), { ok: result.ok, mode: row.mode || row.backup_type }, req);
  res.json({ ok: result.ok, result });
}

async function adminProtectBackup(req, res) {
  const protect = req.body?.protect !== false;
  const row = await backupRun(req.params.id);
  if (!row) return res.status(404).json({ code: "ADMIN_BACKUP_NOT_FOUND" });
  await pool.query("UPDATE backup_runs SET is_protected=$1 WHERE id=$2", [protect ? 1 : 0, row.id]);
  await auditBackup(req.admin.id, protect ? "backup.protect" : "backup.unprotect", "backup_runs", String(row.id), { mode: row.mode || row.backup_type }, req);
  res.json({ ok: true, id: String(row.id), protected: protect });
}

async function adminBackupCleanupDryRun(req, res) {
  const settings = await backupSettings();
  const plan = await backupCleanupPlan(settings);
  await auditBackup(req.admin.id, "backup.cleanup.dry_run", "backup_runs", "dry-run", { deleteIds: plan.delete.map((item) => item.id), reclaimBytes: plan.reclaimBytes }, req);
  res.json({ ok: true, plan });
}

async function adminConfirmBackupCleanup(req, res) {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
  if (!ids.length) return res.status(400).json({ code: "ADMIN_BACKUP_DELETE_IDS_REQUIRED" });
  const settings = await backupSettings();
  const plan = await backupCleanupPlan(settings);
  const allowed = new Set(plan.delete.map((item) => String(item.id)));
  const deleted = [];
  let freed = 0;
  for (const id of ids) {
    if (!allowed.has(id)) return res.status(400).json({ code: "ADMIN_BACKUP_DELETE_NOT_IN_DRY_RUN" });
    const row = await backupRun(id);
    if (!row) continue;
    await assertBackupDeletionAllowed(row);
    const target = await safeBackupPath(row.file_path);
    const stat = await fs.stat(target).catch(() => ({ size: 0 }));
    await fs.unlink(target);
    await pool.query("DELETE FROM backup_runs WHERE id=$1", [row.id]);
    deleted.push(String(row.id));
    freed += Number(stat.size || row.file_size_bytes || 0);
  }
  await auditBackup(req.admin.id, "backup.cleanup.confirm", "backup_runs", "cleanup", { deleted, freed }, req);
  res.json({ ok: true, deleted, freedBytes: freed });
}

async function adminDeleteBackup(req, res) {
  const row = await backupRun(req.params.id);
  if (!row) return res.status(404).json({ code: "ADMIN_BACKUP_NOT_FOUND" });
  await assertBackupDeletionAllowed(row);
  const target = await safeBackupPath(row.file_path);
  const stat = await fs.stat(target).catch(() => ({ size: 0 }));
  await fs.unlink(target);
  await pool.query("DELETE FROM backup_runs WHERE id=$1", [row.id]);
  await auditBackup(req.admin.id, "backup.delete", "backup_runs", String(row.id), { mode: row.mode || row.backup_type, freedBytes: Number(stat.size || 0) }, req);
  res.json({ ok: true, deletedId: String(row.id), freedBytes: Number(stat.size || 0) });
}

async function adminGdpr(req, res) {
  await cleanupGdprDrafts();
  await cleanupExpiredGdprExports();
  await listQuery(req, res, {
    select: `g.public_id publicId,g.user_id,u.email,g.request_type requestType,g.status,g.subject,g.due_at dueAt,a.email assignedAdminEmail,DATEDIFF(g.due_at, UTC_TIMESTAMP()) daysRemaining`,
    from: "gdpr_requests g LEFT JOIN users u ON u.id=g.user_id LEFT JOIN admin_users a ON a.id=g.assigned_admin_id",
    order: "g.created_at DESC"
  });
}


async function adminCreateGdpr(req, res) {
  const userId = cleanText(req.body?.userId, 32) || null;
  const email = normalizeEmail(req.body?.email);
  const requestType = cleanText(req.body?.requestType, 32);
  if (!GDPR_REQUEST_TYPES.has(requestType)) return res.status(400).json({ code: "GDPR_TYPE_INVALID" });
  let resolvedUserId = userId;
  if (!resolvedUserId && email) {
    const user = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    resolvedUserId = user.rows[0]?.id || null;
  }
  if (!resolvedUserId) return res.status(400).json({ code: "GDPR_USER_REQUIRED" });
  const dueDays = await gdprSettingInt("gdpr_due_days");
  const due = new Date(Date.now() + dueDays * 86400000).toISOString().slice(0, 19).replace("T", " ");
  const publicId = `gdpr_${randomBytes(8).toString("hex")}`;
  const inserted = await pool.query(
    `INSERT INTO gdpr_requests(public_id,user_id,request_type,status,subject,description,received_channel,identity_verification_method,requested_by_admin_id,source,locale,due_at,admin_comment,internal_admin_comment,submitted_at)
     VALUES($1,$2,$3,'new',$4,$5,$6,$7,$8,'admin',$9,$10,$11,$12,UTC_TIMESTAMP())`,
    [publicId, resolvedUserId, requestType, cleanText(req.body?.subject, 255) || requestType, cleanText(req.body?.description, 4000), cleanText(req.body?.receivedChannel, 64) || "admin", cleanText(req.body?.identityVerificationMethod, 64) || "admin_review", req.admin.id, cleanText(req.body?.locale, 16) || "en", due, cleanText(req.body?.adminComment, 1000), cleanText(req.body?.adminComment, 1000)]
  );
  await gdprEvent(inserted.insertId, req.admin.id, "created", null, "new", "Admin-created GDPR request");
  res.status(201).json({ ok: true, id: String(inserted.insertId), publicId });
}

async function adminGdprAssign(req, res) {
  const request = await gdprRequest(req.params.id);
  await pool.query("UPDATE gdpr_requests SET assigned_admin_id=$1 WHERE id=$2", [req.admin.id, request.id]);
  await gdprEvent(request.id, req.admin.id, "assigned", request.status, request.status, "Assigned to current admin");
  res.json({ ok: true });
}

async function adminGdprStatus(req, res) {
  const request = await gdprRequest(req.params.id);
  const status = cleanText(req.body?.status, 32);
  if (!GDPR_STATUSES.has(status)) return res.status(400).json({ code: "GDPR_STATUS_INVALID" });
  const updates = ["status=$1"];
  const params = [status];
  if (status === "in_progress") updates.push("processing_started_at=COALESCE(processing_started_at,UTC_TIMESTAMP())");
  if (["completed", "rejected", "cancelled"].includes(status)) updates.push("completed_at=COALESCE(completed_at,UTC_TIMESTAMP())", "completed_by_admin_id=$2");
  const adminParam = params.length + 1;
  if (["completed", "rejected", "cancelled"].includes(status)) params.push(req.admin.id);
  params.push(request.id);
  await pool.query(`UPDATE gdpr_requests SET ${updates.join(",")} WHERE id=$${params.length}`, params);
  await gdprEvent(request.id, req.admin.id, "status_changed", request.status, status, cleanText(req.body?.comment, 1000));
  res.json({ ok: true });
}

async function adminGdprComment(req, res) {
  const request = await gdprRequest(req.params.id);
  const comment = cleanText(req.body?.comment, 4000);
  if (!comment) return res.status(400).json({ code: "GDPR_COMMENT_REQUIRED" });
  const visibility = cleanText(req.body?.visibility, 32) === "user" ? "user" : "internal";
  await gdprEvent(request.id, req.admin.id, visibility === "user" ? "user_comment" : "internal_comment", request.status, request.status, comment);
  res.json({ ok: true });
}

async function adminGdprVerify(req, res) {
  const request = await gdprRequest(req.params.id);
  await pool.query("UPDATE gdpr_requests SET status='verified',identity_verified_at=UTC_TIMESTAMP(),identity_verification_method=COALESCE(NULLIF($1,''),identity_verification_method,'admin_review') WHERE id=$2", [cleanText(req.body?.method, 64), request.id]);
  await gdprEvent(request.id, req.admin.id, "identity_verified", request.status, "verified", cleanText(req.body?.comment, 1000));
  res.json({ ok: true });
}

async function adminGdprApprove(req, res) {
  await adminGdprStatus({ ...req, body: { status: "in_progress", comment: req.body?.comment || "Approved for processing" } }, res);
}

async function adminGdprReject(req, res) {
  const request = await gdprRequest(req.params.id);
  const reason = cleanText(req.body?.reason || req.body?.comment, 1000);
  if (!reason) return res.status(400).json({ code: "GDPR_REJECTION_REASON_REQUIRED" });
  await pool.query("UPDATE gdpr_requests SET status='rejected',rejection_reason=$1,rejected_at=UTC_TIMESTAMP(),completed_at=UTC_TIMESTAMP(),completed_by_admin_id=$2 WHERE id=$3", [reason, req.admin.id, request.id]);
  await gdprEvent(request.id, req.admin.id, "rejected", request.status, "rejected", reason);
  res.json({ ok: true });
}

async function adminGdprComplete(req, res) {
  const request = await gdprRequest(req.params.id);
  await pool.query("UPDATE gdpr_requests SET status='completed',completed_at=UTC_TIMESTAMP(),completed_by_admin_id=$1 WHERE id=$2", [req.admin.id, request.id]);
  await gdprEvent(request.id, req.admin.id, "completed", request.status, "completed", cleanText(req.body?.comment, 1000));
  res.json({ ok: true });
}

async function adminGdprGenerateExport(req, res) {
  await cleanupExpiredGdprExports();
  const request = await gdprRequest(req.params.id);
  if (!request.identity_verified_at) return res.status(409).json({ code: "GDPR_IDENTITY_NOT_VERIFIED" });
  const job = await pool.query("INSERT INTO gdpr_export_jobs(request_id,status,progress,started_at) VALUES($1,'running',10,UTC_TIMESTAMP())", [request.id]);
  try {
    const exportResult = await createGdprExport(request, req.admin.id);
    await pool.query("UPDATE gdpr_export_jobs SET status='completed',progress=100,completed_at=UTC_TIMESTAMP(),archive_path=$1,expires_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL $2 DAY) WHERE id=$3", [exportResult.path, exportResult.retentionDays, job.insertId]);
    await pool.query("UPDATE gdpr_requests SET export_file_id=$1 WHERE id=$2", [exportResult.fileId, request.id]);
    await gdprEvent(request.id, req.admin.id, "export_generated", request.status, request.status, `Export ${exportResult.fileId}`);
    res.json({ ok: true, fileId: String(exportResult.fileId), sha256: exportResult.sha256 });
  } catch (error) {
    await pool.query("UPDATE gdpr_export_jobs SET status='failed',failed_at=UTC_TIMESTAMP(),error_message=$1 WHERE id=$2", [cleanText(error?.message, 1000), job.insertId]);
    res.status(500).json({ code: "GDPR_EXPORT_FAILED" });
  }
}

async function adminGdprDownload(req, res) {
  await cleanupExpiredGdprExports();
  const request = await gdprRequest(req.params.id);
  const file = await gdprFile(request.id, req.params.fileId);
  const target = await safeGdprExportPath(file.storage_path);
  await pool.query("UPDATE gdpr_request_files SET download_count=download_count+1 WHERE id=$1", [file.id]);
  res.download(target, file.original_name || file.stored_name);
}

async function adminGdprPreviewErasure(req, res) {
  const request = await gdprRequest(req.params.id);
  res.json({ ok: true, preview: await gdprUserDataPreview(request.user_id) });
}

async function adminGdprAnonymize(req, res) {
  const request = await gdprRequest(req.params.id);
  if (!request.identity_verified_at) return res.status(409).json({ code: "GDPR_IDENTITY_NOT_VERIFIED" });
  await pool.query("UPDATE users SET email=CONCAT('anon+',id,'@glukotrack.local'), full_name='Anonymized user', password_hash='', gdpr_anonymized_at=UTC_TIMESTAMP() WHERE id=$1", [request.user_id]);
  await gdprAction(request.id, request.user_id, "anonymize", "completed", ["users"], "User account anonymized", req.admin.id);
  await gdprEvent(request.id, req.admin.id, "anonymized", request.status, "completed", "Super Admin anonymisation completed");
  await pool.query("UPDATE gdpr_requests SET status='completed',completed_at=UTC_TIMESTAMP(),completed_by_admin_id=$1 WHERE id=$2", [req.admin.id, request.id]);
  res.json({ ok: true });
}

async function adminGdprRestrict(req, res) {
  const request = await gdprRequest(req.params.id);
  const reason = cleanText(req.body?.reason || req.body?.comment, 255) || "GDPR restriction request";
  await pool.query("UPDATE users SET gdpr_processing_restricted_at=UTC_TIMESTAMP(),gdpr_processing_restriction_reason=$1,gdpr_marketing_opt_out_at=COALESCE(gdpr_marketing_opt_out_at,UTC_TIMESTAMP()) WHERE id=$2", [reason, request.user_id]);
  await gdprAction(request.id, request.user_id, "restrict_processing", "completed", ["users"], reason, req.admin.id);
  await gdprEvent(request.id, req.admin.id, "processing_restricted", request.status, request.status, reason);
  res.json({ ok: true });
}

async function adminGdprObject(req, res) {
  const request = await gdprRequest(req.params.id);
  const reason = cleanText(req.body?.reason || req.body?.comment, 255) || "GDPR objection request";
  await pool.query("UPDATE users SET gdpr_objection_at=UTC_TIMESTAMP(),gdpr_objection_reason=$1,gdpr_marketing_opt_out_at=COALESCE(gdpr_marketing_opt_out_at,UTC_TIMESTAMP()) WHERE id=$2", [reason, request.user_id]);
  await gdprAction(request.id, request.user_id, "object_processing", "completed", ["users"], reason, req.admin.id);
  await gdprEvent(request.id, req.admin.id, "processing_objection", request.status, request.status, reason);
  res.json({ ok: true });
}

async function adminGdprRectify(req, res) {
  const request = await gdprRequest(req.params.id);
  const fullName = cleanText(req.body?.fullName, 255);
  const preferredLocale = cleanText(req.body?.preferredLocale, 16);
  const before = await pool.query("SELECT full_name,preferred_locale FROM users WHERE id=$1", [request.user_id]);
  const updates = [];
  const params = [];
  if (fullName) { params.push(fullName); updates.push(`full_name=$${params.length}`); }
  if (preferredLocale) { params.push(preferredLocale); updates.push(`preferred_locale=$${params.length}`); }
  if (!updates.length) return res.status(400).json({ code: "GDPR_RECTIFICATION_EMPTY" });
  params.push(request.user_id);
  await pool.query(`UPDATE users SET ${updates.join(",")} WHERE id=$${params.length}`, params);
  await gdprAction(request.id, request.user_id, "rectification", "completed", ["users"], JSON.stringify({ before: before.rows[0] || {}, after: { fullName, preferredLocale } }), req.admin.id);
  await gdprEvent(request.id, req.admin.id, "rectified", request.status, request.status, "Selected profile fields updated");
  res.json({ ok: true });
}

async function adminVersions(req, res) {
  await listQuery(req, res, {
    select: `platform,current_version,minimum_version,recommended_version,force_update,rollout_percent,status,updated_at`,
    from: "app_versions",
    order: "updated_at DESC"
  });
}

async function adminAdmins(req, res) {
  const page = pageParams(req);
  const rows = await pool.query(
    `SELECT a.id,a.email,a.display_name displayName,a.is_active isActive,a.two_factor_enabled twoFactorEnabled,a.last_login_at lastLoginAt,
       GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ',') roles
     FROM admin_users a
     LEFT JOIN admin_user_roles ur ON ur.admin_user_id=a.id
     LEFT JOIN admin_roles r ON r.id=ur.role_id
     GROUP BY a.id,a.email,a.display_name,a.is_active,a.two_factor_enabled,a.last_login_at
     ORDER BY a.id LIMIT ${page.limit} OFFSET ${page.offset}`
  );
  const total = await pool.query("SELECT COUNT(*) count FROM admin_users");
  res.json({ rows: rows.rows.map((row) => ({ ...row, roles: row.roles ? row.roles.split(",") : [], directPermissions: [] })), total: Number(total.rows[0]?.count ?? 0), ...page });
}

async function adminAudit(req, res) {
  await listQuery(req, res, {
    select: `l.id,a.email admin_email,l.action,l.entity_type,l.entity_id,l.ip_address,l.created_at`,
    from: "admin_audit_logs l LEFT JOIN admin_users a ON a.id=l.admin_user_id",
    order: "l.created_at DESC"
  });
}

async function adminLoginAttempts(req, res) {
  await listQuery(req, res, {
    select: `id,email,ip_address,success,failure_reason,locked_until,attempted_at`,
    from: "admin_login_attempts",
    order: "attempted_at DESC"
  });
}


async function adminAiSettings(_req, res) {
  await ensureAiSchema();
  const settings = await aiSettings();
  const keyInfo = await aiApiKeyInfo();
  const stats = await aiStats();
  res.json({ settings, defaults: aiDefaults(), schema: aiSchema(), features: AI_FEATURES, plans: AI_PLANS, counters: AI_COUNTERS, apiKey: keyInfo, stats });
}

async function adminUpdateAiSettings(req, res) {
  const next = validateAiSettings(req.body?.settings ?? req.body ?? {});
  if (next.error) return res.status(400).json({ code: next.error });
  await saveAiSettings(next.value, req.admin.id, req, "settings.ai.update");
  res.json({ ok: true, settings: await aiSettings() });
}

async function adminResetAiSettings(req, res) {
  await saveAiSettings(aiDefaults(), req.admin.id, req, "settings.ai.reset");
  res.json({ ok: true, settings: await aiSettings() });
}

async function adminSaveAiApiKey(req, res) {
  const value = String(req.body?.apiKey || "").trim();
  if (!/^sk-[A-Za-z0-9_\-]{20,}$/.test(value)) return res.status(400).json({ code: "AI_API_KEY_INVALID" });
  const encrypted = encryptAiSecret(value);
  await pool.query(`INSERT INTO system_settings(setting_key,setting_value,is_secret,updated_by,updated_at)
    VALUES('ai_api_key_encrypted',$1,1,$2,UTC_TIMESTAMP())
    ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),is_secret=1,updated_by=VALUES(updated_by),updated_at=VALUES(updated_at)`, [JSON.stringify(encrypted), req.admin.id]);
  await auditAi(req.admin.id, "settings.ai.api_key.saved", "system_settings", "ai_api_key", { masked: maskAiKey(value) }, req);
  res.json({ ok: true, apiKey: await aiApiKeyInfo() });
}

async function adminTestAiConnection(req, res) {
  const key = await aiApiKeyPlain();
  if (!key) return res.status(400).json({ code: "AI_API_KEY_MISSING" });
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: key });
    await client.models.list();
    await auditAi(req.admin.id, "settings.ai.connection.test", "system_settings", "ai", { ok: true }, req);
    await pool.query("INSERT INTO system_settings(setting_key,setting_value,is_secret,updated_by,updated_at) VALUES('ai_connection_status',$1,0,$2,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by=VALUES(updated_by),updated_at=VALUES(updated_at)", [JSON.stringify("connected"), req.admin.id]);
    res.json({ ok: true, status: "connected" });
  } catch {
    await auditAi(req.admin.id, "settings.ai.connection.test", "system_settings", "ai", { ok: false }, req);
    res.status(502).json({ code: "AI_CONNECTION_FAILED" });
  }
}

async function ensureAiSchema() {
  await pool.query("ALTER TABLE ai_requests ADD COLUMN IF NOT EXISTS counter_type varchar(16) NOT NULL DEFAULT 'normal' AFTER is_photo");
  await pool.query("ALTER TABLE ai_requests ADD COLUMN IF NOT EXISTS fallback_used tinyint(1) NOT NULL DEFAULT 0 AFTER model");
  await pool.query("ALTER TABLE ai_requests ADD COLUMN IF NOT EXISTS limit_before int unsigned NULL AFTER estimated_cost_minor");
  await pool.query("ALTER TABLE ai_requests ADD COLUMN IF NOT EXISTS limit_after int unsigned NULL AFTER limit_before");
  await pool.query("CREATE INDEX IF NOT EXISTS ai_requests_counter_idx ON ai_requests(user_id,period_date,counter_type,status)");
}

function aiDefaults() { return Object.fromEntries(Object.entries(AI_SETTING_DEFS).map(([key, def]) => [key, def.defaultValue])); }
function aiSchema() { return Object.fromEntries(Object.entries(AI_SETTING_DEFS).map(([key, def]) => [key, { type: def.type, min: def.min, max: def.max, values: def.values }])); }
async function aiSettings() {
  const keys = Object.keys(AI_SETTING_DEFS);
  const result = await pool.query(`SELECT setting_key,setting_value FROM system_settings WHERE setting_key IN (${keys.map((_, i) => `$${i+1}`).join(",")})`, keys);
  const rows = Object.fromEntries(result.rows.map((row) => [row.setting_key, row.setting_value]));
  const settings = aiDefaults();
  for (const [key, def] of Object.entries(AI_SETTING_DEFS)) if (rows[key] != null) settings[key] = parseAiSetting(def, rows[key]);
  return settings;
}
function parseAiSetting(def, value) {
  let parsed = value; try { parsed = JSON.parse(value); } catch {}
  if (def.type === "boolean") return parsed === true || parsed === 1 || parsed === "true";
  if (def.type === "integer") { const n = Number(parsed); return Number.isInteger(n) && n >= def.min && n <= def.max ? n : def.defaultValue; }
  if (def.type === "enum") return def.values.includes(String(parsed)) ? String(parsed) : def.defaultValue;
  if (def.type === "models") return Array.isArray(parsed) ? parsed.map((v) => cleanText(v,80)).filter(Boolean) : def.defaultValue;
  if (def.type === "roles") return Array.isArray(parsed) ? parsed.filter((role) => AI_ROLE_OPTIONS.includes(role)) : def.defaultValue;
  return cleanText(parsed, 200) || def.defaultValue;
}
function validateAiSettings(input) {
  const value = aiDefaults();
  for (const key of Object.keys(input || {})) if (!AI_SETTING_DEFS[key]) return { error: "AI_SETTING_UNKNOWN" };
  for (const [key, def] of Object.entries(AI_SETTING_DEFS)) {
    const raw = Object.prototype.hasOwnProperty.call(input, key) ? input[key] : def.defaultValue;
    if (def.type === "boolean") { if (typeof raw !== "boolean") return { error: "AI_SETTING_BOOLEAN_REQUIRED" }; value[key] = raw; }
    else if (def.type === "integer") { const n = Number(raw); if (!Number.isInteger(n) || n < def.min || n > def.max) return { error: "AI_SETTING_INTEGER_RANGE" }; value[key] = n; }
    else if (def.type === "enum") { if (!def.values.includes(String(raw))) return { error: "AI_SETTING_ENUM_INVALID" }; value[key] = String(raw); }
    else if (def.type === "models") { if (!Array.isArray(raw) || raw.length < 1) return { error: "AI_MODELS_REQUIRED" }; value[key] = raw.map((v) => cleanText(v,80)).filter(Boolean); }
    else if (def.type === "roles") { if (!Array.isArray(raw) || raw.some((role) => !AI_ROLE_OPTIONS.includes(role))) return { error: "AI_ROLE_INVALID" }; value[key] = [...new Set(raw)]; }
    else { const s = cleanText(raw, 200); if (!s) return { error: "AI_SETTING_TEXT_REQUIRED" }; value[key] = s; }
  }
  const models = new Set(value.ai_models_available);
  for (const feature of AI_FEATURES) {
    if (!models.has(value[`ai_feature_${feature}_primary_model`]) || !models.has(value[`ai_feature_${feature}_fallback_model`])) return { error: "AI_MODEL_NOT_ALLOWED" };
  }
  return { value };
}
async function saveAiSettings(settings, adminId, req, action) {
  const before = await aiSettings();
  await pool.transaction(async (query) => {
    for (const key of Object.keys(AI_SETTING_DEFS)) await query("INSERT INTO system_settings(setting_key,setting_value,is_secret,updated_by,updated_at) VALUES($1,$2,0,$3,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),is_secret=0,updated_by=VALUES(updated_by),updated_at=VALUES(updated_at)", [key, JSON.stringify(settings[key]), adminId]);
    await query("INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES($1,$2,'system_settings','ai',$3,$4,$5)", [adminId, action, JSON.stringify({ before, after: settings }), cleanText(req.ip,64), cleanText(req.headers["user-agent"],512)]);
  });
}
async function aiStats() {
  const rows = await pool.query("SELECT request_type,counter_type,status,COUNT(*) count FROM ai_requests WHERE created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY GROUP BY request_type,counter_type,status");
  return rows.rows;
}
function aiSecretKey() { return createHash("sha256").update(process.env.JWT_SECRET || process.env.DB_PASSWORD || "glukotrack").digest(); }
function encryptAiSecret(value) { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", aiSecretKey(), iv); const encrypted = Buffer.concat([cipher.update(value,"utf8"), cipher.final()]); return { v:1, iv:iv.toString("base64"), tag:cipher.getAuthTag().toString("base64"), data:encrypted.toString("base64"), masked:maskAiKey(value) }; }
function decryptAiSecret(payload) { const decipher = createDecipheriv("aes-256-gcm", aiSecretKey(), Buffer.from(payload.iv,"base64")); decipher.setAuthTag(Buffer.from(payload.tag,"base64")); return Buffer.concat([decipher.update(Buffer.from(payload.data,"base64")), decipher.final()]).toString("utf8"); }
function maskAiKey(value) { return value ? `${value.slice(0, 7)}...${value.slice(-4)}` : ""; }
async function aiApiKeyPlain() { const row = (await pool.query("SELECT setting_value FROM system_settings WHERE setting_key='ai_api_key_encrypted' LIMIT 1")).rows[0]; if (!row) return process.env.OPENAI_API_KEY || ""; try { return decryptAiSecret(JSON.parse(row.setting_value)); } catch { return process.env.OPENAI_API_KEY || ""; } }
async function aiApiKeyInfo() { const row = (await pool.query("SELECT setting_value,updated_at FROM system_settings WHERE setting_key='ai_api_key_encrypted' LIMIT 1")).rows[0]; if (!row) return { configured: Boolean(process.env.OPENAI_API_KEY), masked: process.env.OPENAI_API_KEY ? maskAiKey(process.env.OPENAI_API_KEY) : "", source: process.env.OPENAI_API_KEY ? "env" : "none" }; try { const payload = JSON.parse(row.setting_value); return { configured: true, masked: payload.masked || "sk-...", source: "database", updatedAt: row.updated_at }; } catch { return { configured: false, masked: "", source: "invalid" }; } }
async function auditAi(adminId, action, entityType, entityId, metadata, req) { await pool.query("INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7)", [adminId, action, entityType, entityId, JSON.stringify(metadata || {}), cleanText(req.ip,64), cleanText(req.headers["user-agent"],512)]); }
async function requireAiManage(req, res, next) { const roles = await adminRoles(req.admin.id); if (roles.some((r) => r === "Super Admin" || r === "super_admin")) return next(); const permissions = await permissionsForAdmin(req.admin.id, roles); if (permissions.includes("*") || permissions.includes("ai.manage")) return next(); return res.status(403).json({ code: "ADMIN_AI_MANAGE_REQUIRED" }); }

async function adminNotificationProviderSettings(_req, res) {
  res.json(await notificationProviderSettingsService.settings());
}

async function adminUpdateNotificationProviderSettings(req, res) {
  const result = await notificationProviderSettingsService.save(req.body || {}, req.admin.id, req);
  if (result.error) return res.status(400).json({ code: result.error });
  res.json({ ok: true, ...result.settings });
}

async function adminTestNotificationProviderConnection(req, res) {
  res.json(await notificationProviderSettingsService.testConnection(req.body?.provider, req.admin.id, req));
}

async function adminTestNotificationProviderSend(req, res) {
  res.json(await notificationProviderSettingsService.testSend({ provider: req.body?.provider, phone: req.body?.phone }, req.admin.id, req));
}

async function adminSosSettings(_req, res) {
  res.json({
    settings: await sosSettings(),
    defaults: sosDefaults(),
    schema: sosSchema(),
    metadata: await sosSettingMetadata(),
    roles: SOS_ROLE_OPTIONS,
    channelStatus: sosChannelStatus(),
  });
}

async function adminUpdateSosSettings(req, res) {
  const next = validateSosSettings(req.body?.settings ?? req.body ?? {});
  if (next.error) return res.status(400).json({ code: next.error });
  await saveSosSettings(next.value, req.admin.id, req, "settings.sos.update");
  res.json({ ok: true, settings: await sosSettings() });
}

async function adminResetSosSettings(req, res) {
  await saveSosSettings(sosDefaults(), req.admin.id, req, "settings.sos.reset");
  res.json({ ok: true, settings: await sosSettings() });
}

async function sosSettings() {
  const keys = Object.keys(SOS_SETTING_DEFS);
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(",");
  const result = await pool.query(`SELECT setting_key,setting_value FROM system_settings WHERE setting_key IN (${placeholders})`, keys);
  const rows = Object.fromEntries(result.rows.map((row) => [row.setting_key, row.setting_value]));
  const settings = sosDefaults();
  for (const [key, def] of Object.entries(SOS_SETTING_DEFS)) {
    if (rows[key] != null) settings[key] = parseSosSetting(def, rows[key]);
  }
  return settings;
}

function sosDefaults() {
  return Object.fromEntries(Object.entries(SOS_SETTING_DEFS).map(([key, def]) => [key, def.defaultValue]));
}

function sosSchema() {
  return Object.fromEntries(Object.entries(SOS_SETTING_DEFS).map(([key, def]) => [key, {
    type: def.type,
    min: def.min,
    max: def.max,
    values: def.values,
    maxLength: def.max,
    group: def.group || null,
    app: def.app === true,
    wired: def.wired === true,
  }]));
}

async function sosSettingMetadata() {
  const keys = Object.keys(SOS_SETTING_DEFS);
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(",");
  const result = await pool.query(`SELECT setting_key,updated_at FROM system_settings WHERE setting_key IN (${placeholders})`, keys);
  return Object.fromEntries(result.rows.map((row) => [row.setting_key, { updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null }]));
}

function sosChannelStatus() {
  const pushConfigured = process.env.SOS_PUSH_PROVIDER === "configured" || process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const workerConfigured = process.env.SOS_NOTIFICATION_WORKER_ENABLED === "true" || process.env.SOS_WORKER_ENABLED === "true";
  const smsProviderConfigured = process.env.SOS_SMS_PROVIDER && process.env.SOS_SMS_PROVIDER !== "none";
  return {
    push: pushConfigured ? "configured" : "not_configured",
    notificationWorker: workerConfigured ? "configured" : "not_configured",
    smsExternalProvider: smsProviderConfigured ? "configured" : "reserved_not_configured",
    systemSmsComposer: "dry_run_or_user_composer",
  };
}

function parseSosSetting(def, value) {
  let parsed = value;
  try { parsed = JSON.parse(value); } catch {}
  if (def.type === "boolean") return parsed === true || parsed === 1 || parsed === "1" || parsed === "true";
  if (def.type === "integer") {
    const numeric = Number(parsed);
    return Number.isInteger(numeric) && numeric >= def.min && numeric <= def.max ? numeric : def.defaultValue;
  }
  if (def.type === "roles") {
    return Array.isArray(parsed) ? parsed.filter((role) => SOS_ROLE_OPTIONS.includes(role)) : def.defaultValue;
  }
  if (def.type === "enum") return def.values.includes(String(parsed)) ? String(parsed) : def.defaultValue;
  return cleanText(parsed, def.max || 1000) || def.defaultValue;
}

function serializeSosSetting(value) {
  return JSON.stringify(value);
}

function validateSosSettings(input) {
  const value = sosDefaults();
  for (const key of Object.keys(input || {})) {
    if (!SOS_SETTING_DEFS[key]) return { error: "SOS_SETTING_UNKNOWN" };
  }
  for (const [key, def] of Object.entries(SOS_SETTING_DEFS)) {
    const raw = Object.prototype.hasOwnProperty.call(input, key) ? input[key] : def.defaultValue;
    if (def.type === "boolean") {
      if (typeof raw !== "boolean") return { error: "SOS_SETTING_BOOLEAN_REQUIRED" };
      value[key] = raw;
    } else if (def.type === "integer") {
      const numeric = Number(raw);
      if (!Number.isInteger(numeric) || numeric < def.min || numeric > def.max) return { error: "SOS_SETTING_INTEGER_RANGE" };
      value[key] = numeric;
    } else if (def.type === "roles") {
      if (!Array.isArray(raw) || raw.some((role) => !SOS_ROLE_OPTIONS.includes(role))) return { error: "SOS_SETTING_ROLE_INVALID" };
      value[key] = [...new Set(raw)];
    } else if (def.type === "enum") {
      if (!def.values.includes(String(raw))) return { error: "SOS_SETTING_ENUM_INVALID" };
      value[key] = String(raw);
    } else {
      const text = cleanText(raw, def.max || 1000);
      if (!text) return { error: "SOS_SETTING_TEXT_REQUIRED" };
      value[key] = text;
    }
  }
  if (value.sos_auto_close_enabled && !Number.isInteger(value.sos_auto_close_after_hours)) return { error: "SOS_AUTO_CLOSE_PERIOD_REQUIRED" };
  if (value.sos_repeat_notifications && value.sos_max_notification_repeats < 1) return { error: "SOS_REPEAT_COUNT_REQUIRED" };
  if (value.sos_escalation_enabled && value.sos_escalation_after_minutes < 1) return { error: "SOS_ESCALATION_PERIOD_REQUIRED" };
  if (value.sos_sms_type === "external_reserved") value.sos_sms_enabled = false;
  if (value.sos_sms_type === "disabled") value.sos_sms_enabled = false;
  return { value };
}

async function saveSosSettings(settings, adminId, req, action) {
  const before = await sosSettings();
  await pool.transaction(async (query) => {
    for (const [key, def] of Object.entries(SOS_SETTING_DEFS)) {
      const raw = settings[key];
      const stored = serializeSosSetting(raw);
      await query(
        `INSERT INTO system_settings(setting_key,setting_value,is_secret,updated_by,updated_at)
         VALUES($1,$2,0,$3,UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),is_secret=0,updated_by=VALUES(updated_by),updated_at=VALUES(updated_at)`,
        [key, stored, adminId]
      );
    }
    await query(
      "INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [adminId, action, "system_settings", "sos", JSON.stringify({ before, after: settings }), cleanText(req.ip, 64), cleanText(req.headers["user-agent"], 512)]
    );
  });
}

async function adminSettings(req, res) {
  const keys = Object.keys(GDPR_SETTINGS);
  const rows = await pool.query(
    `SELECT setting_key, setting_value, is_secret, updated_at FROM system_settings
     WHERE setting_key IN ($1,$2,$3) ORDER BY FIELD(setting_key,$4,$5,$6)`,
    [...keys, ...keys]
  );
  res.json({ rows: rows.rows, total: rows.rows.length, page: 1, limit: rows.rows.length });
}

async function adminUpdateSetting(req, res) {
  const key = cleanText(req.params.key, 96);
  const rule = GDPR_SETTINGS[key];
  if (!rule) return res.status(404).json({ code: "SETTING_NOT_MANAGED" });
  const numeric = Number(req.body?.value);
  if (!Number.isInteger(numeric) || numeric < rule.min || numeric > rule.max) {
    return res.status(400).json({ code: "SETTING_POSITIVE_INTEGER_REQUIRED" });
  }
  const before = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key=$1", [key]);
  await pool.query(
    `INSERT INTO system_settings(setting_key, setting_value, is_secret, updated_by, updated_at)
     VALUES($1,$2,0,$3,UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), is_secret=0, updated_by=VALUES(updated_by), updated_at=VALUES(updated_at)`,
    [key, String(numeric), req.admin.id]
  );
  await pool.query(
    "INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES($1,'settings.update','system_settings',$2,$3,$4,$5)",
    [req.admin.id, key, JSON.stringify({ before: before.rows[0]?.setting_value ?? null, after: String(numeric) }), cleanText(req.ip, 64), cleanText(req.headers["user-agent"], 512)]
  );
  res.json({ ok: true, key, value: String(numeric) });
}

async function listQuery(req, res, { select, from, order }) {
  const page = pageParams(req);
  const rows = await pool.query(`SELECT ${select} FROM ${from} ORDER BY ${order} LIMIT ${page.limit} OFFSET ${page.offset}`);
  const total = await pool.query(`SELECT COUNT(*) count FROM ${from}`);
  res.json({ rows: rows.rows, total: Number(total.rows[0]?.count ?? 0), ...page });
}

function pageParams(req) {
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 25, 1), 100);
  const page = Math.max(Number.parseInt(req.query?.page, 10) || 1, 1);
  return { page, limit, offset: (page - 1) * limit };
}

function searchTerm(req) {
  return cleanText(req.query?.q, 120);
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
    trialUsed: Boolean(row.trial_used),
    emailVerified: Boolean(row.email_verified),
    createdAt: row.created_at
  };
}

function adminAuth({ allowPending2fa = false } = {}) {
  return async function adminAuthMiddleware(req, res, next) {
    try {
      const token = bearerToken(req) || cookieToken(req);
      if (!token) return res.status(401).json({ code: "UNAUTHORIZED" });
      const tokenHash = hashToken(token);
      const result = await pool.query(
        `SELECT s.id session_id, s.admin_user_id, s.two_factor_verified, s.expires_at,
                a.id, a.email, a.display_name, a.is_active, a.two_factor_enabled
         FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_user_id
         WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()`,
        [tokenHash]
      );
      const row = result.rows[0];
      if (!row || !row.is_active) return res.status(401).json({ code: "UNAUTHORIZED" });
      if (row.two_factor_enabled && !row.two_factor_verified && !allowPending2fa) {
        return res.status(401).json({ code: "ADMIN_2FA_REQUIRED" });
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        const csrf = req.headers[ADMIN_CSRF_HEADER];
        if (!csrf || csrf !== csrfForToken(token)) return res.status(403).json({ code: "ADMIN_CSRF_INVALID" });
      }
      await pool.query("UPDATE admin_sessions SET last_seen_at = UTC_TIMESTAMP() WHERE id = $1", [row.session_id]);
      req.admin = {
        id: row.admin_user_id,
        sessionId: row.session_id,
        email: row.email,
        displayName: row.display_name
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

async function createAdminSession(admin, req, { twoFactorVerified }) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const inserted = await pool.query(
    `INSERT INTO admin_sessions(admin_user_id, token_hash, ip_address, user_agent, two_factor_verified, expires_at)
     VALUES($1, $2, $3, $4, $5, $6)`,
    [admin.id, hashToken(token), cleanText(req.ip, 64), cleanText(req.headers["user-agent"], 512), twoFactorVerified ? 1 : 0, toMysqlDate(expiresAt)]
  );
  return { id: inserted.insertId, token, csrfToken: csrfForToken(token), expiresAt };
}

async function publicAdmin(id) {
  const result = await pool.query(
    "SELECT id, email, display_name, two_factor_enabled, last_login_at FROM admin_users WHERE id = $1",
    [id]
  );
  const admin = result.rows[0];
  const roles = await adminRoles(id);
  return {
    id: String(admin.id),
    email: admin.email,
    displayName: admin.display_name,
    twoFactorEnabled: Boolean(admin.two_factor_enabled),
    lastLoginAt: admin.last_login_at,
    roles,
    permissions: await permissionsForAdmin(id, roles)
  };
}

async function adminRoles(id) {
  const result = await pool.query(
    `SELECT r.code, r.name FROM admin_user_roles ur JOIN admin_roles r ON r.id = ur.role_id
     WHERE ur.admin_user_id = $1 ORDER BY r.name`,
    [id]
  );
  return result.rows.map((row) => row.name || row.code).filter(Boolean);
}

async function permissionsForAdmin(id, roles) {
  if (roles.some((role) => role === "Super Admin" || role === "super_admin")) return ["*"];
  const result = await pool.query(
    `SELECT DISTINCT p.code FROM admin_permissions p
     LEFT JOIN admin_role_permissions rp ON rp.permission_id = p.id
     LEFT JOIN admin_user_roles ur ON ur.role_id = rp.role_id AND ur.admin_user_id = $1
     LEFT JOIN admin_user_permissions up ON up.permission_id = p.id AND up.admin_user_id = $2
     WHERE ur.admin_user_id IS NOT NULL OR up.admin_user_id IS NOT NULL
     ORDER BY p.code`,
    [id, id]
  );
  return result.rows.map((row) => row.code);
}

async function incrementFailedLogin(id) {
  await pool.query(
    `UPDATE admin_users
     SET failed_login_count = failed_login_count + 1,
         locked_until = CASE WHEN failed_login_count + 1 >= 8 THEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE) ELSE locked_until END
     WHERE id = $1`,
    [id]
  );
}

async function logAdminLogin(adminId, email, ip, userAgent, success, failureReason) {
  await pool.query(
    `INSERT INTO admin_login_attempts(admin_user_id,email,ip_address,user_agent,success,failure_reason)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [adminId, email, ip, userAgent, success ? 1 : 0, failureReason]
  );
}


async function requireGdprExecutor(req, res, next) {
  const roles = await adminRoles(req.admin.id);
  const permissions = await permissionsForAdmin(req.admin.id, roles);
  if (permissions.includes("*") || permissions.includes("gdpr.execute") || permissions.includes("gdpr:execute")) return next();
  return res.status(403).json({ code: "GDPR_EXECUTOR_REQUIRED" });
}

async function gdprRequest(id) {
  const result = await pool.query("SELECT * FROM gdpr_requests WHERE public_id=$1 OR id=$2", [id, id]);
  const request = result.rows[0];
  if (!request) {
    const error = new Error("GDPR_REQUEST_NOT_FOUND");
    error.statusCode = 404;
    throw error;
  }
  return request;
}

async function gdprFile(requestId, fileId) {
  const result = await pool.query("SELECT * FROM gdpr_request_files WHERE id=$1 AND request_id=$2 AND deleted_at IS NULL", [fileId, requestId]);
  const file = result.rows[0];
  if (!file) {
    const error = new Error("GDPR_FILE_NOT_FOUND");
    error.statusCode = 404;
    throw error;
  }
  return file;
}

async function gdprEvent(requestId, adminId, eventType, oldStatus, newStatus, comment = "") {
  await pool.query(
    "INSERT INTO gdpr_request_events(request_id,actor_type,actor_id,event_type,old_status,new_status,comment,metadata_json) VALUES($1,'admin',$2,$3,$4,$5,$6,$7)",
    [requestId, String(adminId || ""), eventType, oldStatus || null, newStatus || null, comment || null, {}]
  );
}

async function gdprAction(requestId, userId, type, status, tables, result, adminId) {
  await pool.query(
    "INSERT INTO gdpr_data_actions(request_id,action_type,entity_type,entity_id,action_result,details_json,executed_by) VALUES($1,$2,'user',$3,$4,$5,$6)",
    [requestId, type, String(userId || ""), status, { affectedTables: tables, result }, adminId]
  );
}

async function gdprUserDataPreview(userId) {
  const tables = ["users","account_devices","subscriptions","trial_periods","sos_profiles","health_snapshots","support_tickets","gdpr_requests"];
  const rows = [];
  for (const table of tables) {
    const column = table === "users" ? "id" : "user_id";
    try {
      const count = await pool.query(`SELECT COUNT(*) count FROM ${table} WHERE ${column}=$1`, [userId]);
      rows.push({ table, rows: Number(count.rows[0]?.count || 0) });
    } catch {}
  }
  return rows;
}

async function createGdprExport(request, adminId = null) {
  await fs.mkdir(GDPR_EXPORT_DIR, { recursive: true, mode: 0o700 });
  await fs.chmod(GDPR_EXPORT_DIR, 0o700).catch(() => {});
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `gdpr_export_${request.public_id || request.id}_${stamp}`;
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "gdpr-export-"));
  const jsonPath = path.join(workDir, "data.json");
  const zipPath = path.join(GDPR_EXPORT_DIR, `${base}.zip`);
  const payload = { request: { id: String(request.id), publicId: request.public_id, type: request.request_type }, generatedAt: new Date().toISOString(), data: await collectGdprUserData(request.user_id) };
  try {
    await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), { mode: 0o600 });
    await execFileAsync("zip", ["-j", "-q", zipPath, jsonPath], { timeout: 120000 });
    await fs.chmod(zipPath, 0o600);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
  const stat = await fs.stat(zipPath);
  if (!stat.size) throw new Error("empty GDPR export");
  const sha = await sha256File(zipPath);
  const retentionDays = await gdprSettingInt("gdpr_export_retention_days");
  const inserted = await pool.query(
    `INSERT INTO gdpr_request_files(request_id,file_type,original_name,stored_name,storage_path,mime_type,size_bytes,checksum,expires_at)
     VALUES($1,'export',$2,$3,$4,'application/zip',$5,$6,DATE_ADD(UTC_TIMESTAMP(), INTERVAL $7 DAY))`,
    [request.id, `${base}.zip`, `${base}.zip`, zipPath, stat.size, sha, retentionDays]
  );
  await gdprAction(request.id, request.user_id, "export", "completed", Object.keys(payload.data), `sha256:${sha}`, adminId);
  return { fileId: inserted.insertId, path: zipPath, sha256: sha, size: stat.size, retentionDays };
}

async function gdprSettingInt(key) {
  const rule = GDPR_SETTINGS[key];
  if (!rule) throw new Error("unknown GDPR setting");
  const result = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key=$1", [key]);
  const value = Number(result.rows[0]?.setting_value);
  return Number.isInteger(value) && value >= rule.min && value <= rule.max ? value : rule.defaultValue;
}

async function cleanupExpiredGdprExports() {
  const expired = await pool.query("SELECT id, storage_path FROM gdpr_request_files WHERE file_type='export' AND deleted_at IS NULL AND expires_at < UTC_TIMESTAMP() LIMIT 100");
  for (const file of expired.rows) {
    try {
      const safePath = await safeGdprExportPath(file.storage_path);
      await fs.rm(safePath, { force: true });
    } catch {}
    await pool.query("UPDATE gdpr_request_files SET deleted_at=UTC_TIMESTAMP() WHERE id=$1", [file.id]);
  }
  await pool.query("UPDATE gdpr_export_jobs SET status='expired' WHERE status='completed' AND expires_at IS NOT NULL AND expires_at < UTC_TIMESTAMP()");
  return expired.rows.length;
}

async function cleanupGdprDrafts() {
  const days = await gdprSettingInt("gdpr_draft_retention_days");
  const result = await pool.query("UPDATE gdpr_requests SET status='cancelled', completed_at=UTC_TIMESTAMP() WHERE status='new' AND source='draft' AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL $1 DAY)", [days]);
  return result.affectedRows || result.rowCount || 0;
}

async function collectGdprUserData(userId) {
  const specs = {
    users: ["id"], account_devices: ["user_id"], subscriptions: ["user_id"], trial_periods: ["user_id"], sos_profiles: ["user_id"], sos_scans: ["user_id"], health_snapshots: ["user_id"], notifications: ["user_id"], support_tickets: ["user_id"], gdpr_requests: ["user_id"]
  };
  const data = {};
  for (const [table, columns] of Object.entries(specs)) {
    const column = columns[0];
    try {
      const result = await pool.query(`SELECT * FROM ${table} WHERE ${column}=$1 LIMIT 1000`, [userId]);
      data[table] = result.rows;
    } catch { data[table] = []; }
  }
  return data;
}

async function safeGdprExportPath(value) {
  const root = await fs.realpath(GDPR_EXPORT_DIR);
  const target = await fs.realpath(value);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("GDPR_EXPORT_PATH_FORBIDDEN");
  return target;
}

async function ensureBackupSchema() {
  await pool.query("ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS mode varchar(32) NULL AFTER backup_type");
  await pool.query("ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS components longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL CHECK (json_valid(components)) AFTER mode");
  await pool.query("ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS source varchar(32) NOT NULL DEFAULT 'manual' AFTER components");
  await pool.query("ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS manifest_path varchar(512) NULL AFTER file_path");
  await pool.query("ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS verification_status varchar(32) NULL AFTER verified_at");
  await pool.query("ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS is_protected tinyint(1) NOT NULL DEFAULT 0 AFTER verification_status");
}

function backupDefaults() {
  return Object.fromEntries(Object.entries(BACKUP_SETTING_DEFS).map(([key, def]) => [key, def.defaultValue]));
}

function backupSchema() {
  return Object.fromEntries(Object.entries(BACKUP_SETTING_DEFS).map(([key, def]) => [key, { type: def.type, min: def.min, max: def.max, values: def.values }]));
}

async function backupSettings() {
  const keys = Object.keys(BACKUP_SETTING_DEFS);
  const result = await pool.query(`SELECT setting_key,setting_value FROM system_settings WHERE setting_key IN (${keys.map((_, i) => `$${i+1}`).join(",")})`, keys);
  const rows = Object.fromEntries(result.rows.map((row) => [row.setting_key, row.setting_value]));
  const settings = backupDefaults();
  for (const [key, def] of Object.entries(BACKUP_SETTING_DEFS)) if (rows[key] != null) settings[key] = parseBackupSetting(def, rows[key]);
  return settings;
}

function parseBackupSetting(def, value) {
  let parsed = value;
  try { parsed = JSON.parse(value); } catch {}
  if (def.type === "boolean") return parsed === true || parsed === 1 || parsed === "1" || parsed === "true";
  if (def.type === "integer") {
    const n = Number(parsed);
    return Number.isInteger(n) && n >= def.min && n <= def.max ? n : def.defaultValue;
  }
  if (def.type === "enum") return def.values.includes(String(parsed)) ? String(parsed) : def.defaultValue;
  if (def.type === "time") return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(parsed)) ? String(parsed) : def.defaultValue;
  if (def.type === "days") return Array.isArray(parsed) ? parsed.filter((day) => ["mon","tue","wed","thu","fri","sat","sun"].includes(day)) : def.defaultValue;
  if (def.type === "roles") return Array.isArray(parsed) ? parsed.filter((role) => BACKUP_ROLE_OPTIONS.includes(role)) : def.defaultValue;
  return def.defaultValue;
}

function validateBackupSettings(input) {
  const value = backupDefaults();
  for (const key of Object.keys(input || {})) if (!BACKUP_SETTING_DEFS[key]) return { error: "BACKUP_SETTING_UNKNOWN" };
  for (const [key, def] of Object.entries(BACKUP_SETTING_DEFS)) {
    const raw = Object.prototype.hasOwnProperty.call(input, key) ? input[key] : def.defaultValue;
    if (def.type === "boolean") { if (typeof raw !== "boolean") return { error: "BACKUP_SETTING_BOOLEAN_REQUIRED" }; value[key] = raw; }
    else if (def.type === "integer") { const n = Number(raw); if (!Number.isInteger(n) || n < def.min || n > def.max) return { error: "BACKUP_SETTING_INTEGER_RANGE" }; value[key] = n; }
    else if (def.type === "enum") { if (!def.values.includes(String(raw))) return { error: "BACKUP_SETTING_ENUM_INVALID" }; value[key] = String(raw); }
    else if (def.type === "time") { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw))) return { error: "BACKUP_SETTING_TIME_INVALID" }; value[key] = String(raw); }
    else if (def.type === "days") { if (!Array.isArray(raw) || raw.some((day) => !["mon","tue","wed","thu","fri","sat","sun"].includes(day))) return { error: "BACKUP_SETTING_DAYS_INVALID" }; value[key] = [...new Set(raw)]; }
    else if (def.type === "roles") { if (!Array.isArray(raw) || raw.some((role) => !BACKUP_ROLE_OPTIONS.includes(role))) return { error: "BACKUP_SETTING_ROLE_INVALID" }; value[key] = [...new Set(raw)]; }
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.backup_schedule_time)) return { error: "BACKUP_SETTING_TIME_INVALID" };
  if (value.backup_auto_enabled && value.backup_schedule_days.length < 1) return { error: "BACKUP_SETTING_DAYS_REQUIRED" };
  return { value };
}

async function saveBackupSettings(settings, adminId, req, action) {
  const before = await backupSettings();
  await pool.transaction(async (query) => {
    for (const key of Object.keys(BACKUP_SETTING_DEFS)) {
      await query(
        `INSERT INTO system_settings(setting_key,setting_value,is_secret,updated_by,updated_at)
         VALUES($1,$2,0,$3,UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),is_secret=0,updated_by=VALUES(updated_by),updated_at=VALUES(updated_at)`,
        [key, JSON.stringify(settings[key]), adminId]
      );
    }
    await query("INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [adminId, action, "system_settings", "backup", JSON.stringify({ before, after: settings }), cleanText(req.ip, 64), cleanText(req.headers["user-agent"], 512)]);
  });
}

function backupModes(settings) {
  return Object.fromEntries(Object.entries(BACKUP_MODE_DEFS).map(([mode, def]) => [mode, { components: effectiveBackupComponents(mode, settings, false, def.components) }]));
}

function effectiveBackupComponents(mode, settings, includeEnv = false, base = BACKUP_MODE_DEFS[mode]?.components || []) {
  const map = { database: settings.backup_include_database, frontend: settings.backup_include_frontend, backend: settings.backup_include_backend, configs: settings.backup_include_configs, uploads: settings.backup_include_uploads, nginx: settings.backup_include_nginx, systemd: settings.backup_include_systemd };
  const selected = base.filter((item) => map[item] !== false);
  if (includeEnv && settings.backup_include_env) selected.push("env");
  return [...new Set(selected)];
}

async function backupRuntimeStatus() {
  await ensureBackupDir();
  const running = await pool.query("SELECT id,mode,started_at FROM backup_runs WHERE status IN ('queued','running') ORDER BY started_at DESC LIMIT 1");
  const stat = await fs.statfs(ADMIN_BACKUP_DIR);
  return { running: running.rows[0] || null, backupDir: ADMIN_BACKUP_DIR, freeBytes: Number(stat.bavail) * Number(stat.bsize) };
}

async function recentBackupRows() {
  const result = await pool.query("SELECT id,COALESCE(mode,backup_type) mode,status,file_path,file_size_bytes,sha256,duration_ms,source,started_at,finished_at,verified_at,verification_status,is_protected,error_message FROM backup_runs ORDER BY started_at DESC,id DESC LIMIT 25");
  return result.rows;
}

async function backupRun(id) {
  await ensureBackupSchema();
  const result = await pool.query("SELECT * FROM backup_runs WHERE id=$1 LIMIT 1", [id]);
  return result.rows[0] || null;
}

async function runManagedBackup({ mode, source, adminId = null, req = null, settings = null }) {
  settings = settings || await backupSettings();
  const started = Date.now();
  let lockHandle;
  let runId = null;
  let archivePath = null;
  let partialPath = null;
  let workDir = null;
  const components = effectiveBackupComponents(mode, settings, false);
  try {
    await ensureBackupSchema();
    await ensureBackupDir();
    if (settings.backup_prevent_parallel) {
      const running = await pool.query("SELECT id FROM backup_runs WHERE status IN ('queued','running') LIMIT 1");
      if (running.rowCount) throw Object.assign(new Error("ADMIN_BACKUP_ALREADY_RUNNING"), { code: "ADMIN_BACKUP_ALREADY_RUNNING", statusCode: 409 });
      lockHandle = await fs.open(ADMIN_BACKUP_LOCK, "wx").catch((error) => error?.code === "EEXIST" ? null : Promise.reject(error));
      if (!lockHandle) throw Object.assign(new Error("ADMIN_BACKUP_ALREADY_RUNNING"), { code: "ADMIN_BACKUP_ALREADY_RUNNING", statusCode: 409 });
    }
    await assertBackupFreeSpace(settings.backup_min_free_mb);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const name = `glukotrack_${mode}_${timestamp}_${randomBytes(4).toString("hex")}`;
    workDir = path.join(ADMIN_BACKUP_DIR, `${name}.stage`);
    archivePath = path.join(ADMIN_BACKUP_DIR, `${name}.tar.gz`);
    partialPath = `${archivePath}.partial`;
    await fs.mkdir(workDir, { recursive: true, mode: 0o700 });
    const inserted = await pool.query(
      "INSERT INTO backup_runs(backup_type,mode,components,source,status,file_path,created_by,started_at) VALUES($1,$2,$3,$4,'running',$5,$6,UTC_TIMESTAMP())",
      [mode, mode, JSON.stringify(components), source, archivePath, adminId]
    );
    runId = inserted.insertId;
    if (components.includes("database")) await runDatabaseDump(path.join(workDir, "ODESSA_glukotrack.sql"), settings.backup_max_duration_minutes);
    const manifest = await writeBackupManifest(workDir, { runId, mode, source, components, archivePath });
    await createBackupArchive(workDir, partialPath, components, settings);
    await verifyBackupArchiveFile(partialPath, components);
    await fs.rename(partialPath, archivePath);
    await fs.chmod(archivePath, 0o600);
    const stat = await fs.stat(archivePath);
    if (!stat.isFile() || stat.size <= 0) throw new Error("backup archive is empty");
    const sha256 = await sha256File(archivePath);
    const duration = Date.now() - started;
    await pool.query(
      "UPDATE backup_runs SET status='completed',file_size_bytes=$1,sha256=$2,duration_ms=$3,finished_at=UTC_TIMESTAMP(),verified_at=UTC_TIMESTAMP(),verification_status='verified',manifest_path=$4,error_message=NULL WHERE id=$5",
      [stat.size, sha256, duration, manifest.path, runId]
    );
    await auditBackup(adminId, "backup.run.completed", "backup_runs", String(runId), { mode, source, components, size: stat.size, sha256 }, req);
    await backupNotification(adminId, settings.backup_notify_completed, "backup.completed", runId, mode, req);
    return { id: String(runId), mode, status: "completed", filePath: archivePath, fileSizeBytes: stat.size, sha256, durationMs: duration, components };
  } catch (error) {
    const message = safeBackupError(error);
    if (partialPath) await fs.rm(partialPath, { force: true }).catch(() => {});
    if (runId) await pool.query("UPDATE backup_runs SET status='failed',duration_ms=$1,finished_at=UTC_TIMESTAMP(),error_message=$2,verification_status='failed' WHERE id=$3", [Date.now() - started, message, runId]);
    await auditBackup(adminId, "backup.run.failed", "backup_runs", runId ? String(runId) : mode, { mode, source, error: message }, req);
    await backupNotification(adminId, settings.backup_notify_failed, "backup.failed", runId, mode, req);
    const status = error.statusCode || (error.code === "ADMIN_BACKUP_ALREADY_RUNNING" ? 409 : 500);
    throw Object.assign(new Error(error.code || "ADMIN_BACKUP_FAILED"), { statusCode: status, publicCode: error.code || "ADMIN_BACKUP_FAILED" });
  } finally {
    if (lockHandle) await lockHandle.close().catch(() => {});
    await fs.rm(ADMIN_BACKUP_LOCK, { force: true }).catch(() => {});
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function writeBackupManifest(workDir, meta) {
  const manifest = { createdAt: new Date().toISOString(), project: "glukotrack.com", database: "ODESSA_glukotrack", ...meta, secretsIncluded: false, notes: "Archive generated outside web root. Env/secrets are excluded unless explicitly enabled." };
  const manifestPath = path.join(workDir, "backup-manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  return { path: manifestPath, manifest };
}

async function createBackupArchive(workDir, archivePath, components, settings) {
  const include = ["backup-manifest.json"];
  if (components.includes("database")) include.push("ODESSA_glukotrack.sql");
  const args = [
    "--ignore-failed-read",
    "--exclude=home/ODESSA/web/glukotrack.com/backend/node_modules",
    "--exclude=home/ODESSA/web/glukotrack.com/backend/.env",
    "--exclude=home/ODESSA/web/glukotrack.com/backend/.env.*",
    "--exclude=*.log",
    "--exclude=*.partial",
    "--exclude=*.tar.gz",
    "--exclude=cache",
    "--exclude=tmp",
    "-czf", archivePath, "-C", workDir, ...include
  ];
  const paths = backupSourcePaths(components, settings);
  for (const item of paths) args.push("-C", item.base, item.relative);
  await execFileAsync("tar", args, { timeout: Number(settings.backup_max_duration_minutes) * 60 * 1000, maxBuffer: 4 * 1024 * 1024 });
}

function backupSourcePaths(components, settings) {
  const items = [];
  const add = (component, absolute) => { if (components.includes(component)) items.push({ base: "/", relative: absolute.replace(/^\/+/, "") }); };
  add("frontend", "/home/ODESSA/web/glukotrack.com/public_html");
  add("backend", "/home/ODESSA/web/glukotrack.com/backend");
  add("configs", "/home/ODESSA/conf/web/glukotrack.com");
  add("uploads", "/home/ODESSA/web/glukotrack.com/public_html/uploads");
  add("nginx", "/etc/nginx/conf.d");
  add("systemd", "/etc/systemd/system/glukotrack-backend.service");
  if (settings.backup_include_env) add("env", "/home/ODESSA/web/glukotrack.com/backend/.env");
  return items;
}

async function verifyBackupArchive(row) {
  const target = await safeBackupPath(row.file_path);
  const components = parseJson(row.components, []);
  await verifyBackupArchiveFile(target, components);
  const stat = await fs.stat(target);
  const sha = await sha256File(target);
  return { ok: true, fileSizeBytes: stat.size, sha256: sha, components };
}

async function verifyBackupArchiveFile(filePath, components) {
  const stat = await fs.stat(filePath);
  if (!stat.isFile() || stat.size <= 0) throw new Error("backup archive is empty");
  const result = await execFileAsync("tar", ["-tzf", filePath], { timeout: 2 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 });
  if (!result.stdout.includes("backup-manifest.json")) throw new Error("backup manifest missing");
  if (components.includes("database") && !result.stdout.includes("ODESSA_glukotrack.sql")) throw new Error("backup database dump missing");
}

async function backupCleanupPlan(settings) {
  const rows = (await pool.query("SELECT id,COALESCE(mode,backup_type) mode,status,file_path,file_size_bytes,started_at,finished_at,verified_at,is_protected FROM backup_runs ORDER BY started_at DESC,id DESC")).rows;
  const latestFull = rows.find((row) => row.status === "completed" && row.verified_at && ["full","pre-deploy","pre-wipe"].includes(row.mode));
  const now = Date.now();
  const maxAgeMs = settings.backup_retention_max_age_days * 86400000;
  const keep = [];
  const del = [];
  for (const row of rows) {
    const reason = [];
    const age = row.started_at ? now - new Date(row.started_at).getTime() : 0;
    if (row.status === "running" || row.status === "queued") { keep.push({ id: String(row.id), reason: "running" }); continue; }
    if (row.is_protected) { keep.push({ id: String(row.id), reason: "protected" }); continue; }
    if (latestFull && String(latestFull.id) === String(row.id)) { keep.push({ id: String(row.id), reason: "latest_verified_full" }); continue; }
    if (row.status === "failed" || age > maxAgeMs) reason.push(row.status === "failed" ? "failed" : "max_age");
    if (reason.length) del.push({ id: String(row.id), path: row.file_path, mode: row.mode, status: row.status, sizeBytes: Number(row.file_size_bytes || 0), startedAt: row.started_at, reason: reason.join(",") });
    else keep.push({ id: String(row.id), reason: "within_policy" });
  }
  return { delete: del, keep, reclaimBytes: del.reduce((sum, row) => sum + Number(row.sizeBytes || 0), 0) };
}

async function assertBackupDeletionAllowed(row) {
  if (row.status === "running" || row.status === "queued") throw Object.assign(new Error("ADMIN_BACKUP_RUNNING_DELETE_FORBIDDEN"), { statusCode: 409 });
  if (row.is_protected) throw Object.assign(new Error("ADMIN_BACKUP_PROTECTED_DELETE_FORBIDDEN"), { statusCode: 409 });
  const latest = await pool.query("SELECT id FROM backup_runs WHERE status='completed' AND verified_at IS NOT NULL AND COALESCE(mode,backup_type) IN ('full','pre-deploy','pre-wipe') ORDER BY finished_at DESC,id DESC LIMIT 1");
  if (latest.rows[0] && String(latest.rows[0].id) === String(row.id)) throw Object.assign(new Error("ADMIN_BACKUP_LAST_DELETE_FORBIDDEN"), { statusCode: 409 });
}

async function auditBackup(adminId, action, entityType, entityId, metadata, req) {
  await pool.query("INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [adminId || null, action, entityType, entityId, JSON.stringify(metadata || {}), cleanText(req?.ip || "system", 64), cleanText(req?.headers?.["user-agent"] || "system", 512)]).catch(() => {});
}

async function backupNotification(adminId, enabled, type, runId, mode, req) {
  if (!enabled || !adminId) return;
  await pool.query("INSERT INTO notifications(user_id,type,title,body,metadata) VALUES($1,'admin_backup',$2,$3,$4)",
    [adminId, type, `Backup ${mode}`, JSON.stringify({ runId: runId ? String(runId) : null, mode })]).catch(() => {});
}

function safeBackupError(error) {
  const code = error?.code || error?.publicCode || error?.message || "ADMIN_BACKUP_FAILED";
  if (String(code).includes("password") || String(code).includes("DB_PASSWORD")) return "ADMIN_BACKUP_FAILED";
  return cleanText(code, 512);
}

function parseJson(value, fallback) {
  try { return typeof value === "string" ? JSON.parse(value) : value ?? fallback; } catch { return fallback; }
}


function backupScheduleRunKey(settings) {
  const zone = settings.backup_schedule_timezone || "UTC";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const hhmm = `${parts.hour}:${parts.minute}`;
  if (hhmm !== settings.backup_schedule_time) return "";
  const day = { Sun: "sun", Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat" }[parts.weekday];
  if (!settings.backup_schedule_days.includes(day)) return "";
  if (settings.backup_schedule_frequency === "monthly" && parts.day !== "01") return "";
  return `${zone}-${settings.backup_schedule_frequency}-${parts.year}-${parts.month}-${parts.day}-${hhmm}`;
}

function startBackupScheduler() {
  if (backupSchedulerStarted) return;
  backupSchedulerStarted = true;
  setInterval(async () => {
    try {
      const settings = await backupSettings();
      if (!settings.backup_enabled || !settings.backup_auto_enabled) return;
      const key = backupScheduleRunKey(settings);
      if (!key || key === backupSchedulerLastRunKey) return;
      backupSchedulerLastRunKey = key;
      await runManagedBackup({ mode: "full", source: "schedule", settings });
    } catch (error) {
      console.error("BACKUP_SCHEDULER_ERROR", safeBackupError(error));
    }
  }, 60 * 1000).unref?.();
}

async function ensureBackupDir() {
  await fs.mkdir(ADMIN_BACKUP_DIR, { recursive: true, mode: 0o700 });
  await fs.chmod(ADMIN_BACKUP_DIR, 0o700).catch(() => {});
}

async function assertBackupFreeSpace(minFreeMb = 50) {
  const size = await pool.query(
    "SELECT COALESCE(SUM(data_length + index_length),0) bytes FROM information_schema.TABLES WHERE table_schema = DATABASE()"
  );
  const estimated = Number(size.rows[0]?.bytes || 0);
  const stat = await fs.statfs(ADMIN_BACKUP_DIR);
  const available = Number(stat.bavail) * Number(stat.bsize);
  const required = Math.max(estimated * 2, estimated + Number(minFreeMb || 50) * 1024 * 1024);
  if (available < required) throw new Error("not enough free disk space for backup");
}

async function runDatabaseDump(filePath, timeoutMinutes = 10) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gt-backup-"));
  const defaultsFile = path.join(tempDir, "client.cnf");
  const dbName = process.env.DB_NAME || "ODESSA_glukotrack";
  const defaults = [
    "[client]",
    `host=${process.env.DB_HOST || "localhost"}`,
    `port=${process.env.DB_PORT || "3306"}`,
    `user=${process.env.DB_USER || ""}`,
    `password=${process.env.DB_PASSWORD || ""}`,
    ""
  ].join("\n");
  try {
    await fs.writeFile(defaultsFile, defaults, { mode: 0o600 });
    await execFileAsync("mariadb-dump", [
      `--defaults-extra-file=${defaultsFile}`,
      "--single-transaction",
      "--quick",
      "--routines",
      "--triggers",
      "--events",
      "--databases",
      dbName,
      `--result-file=${filePath}`
    ], { timeout: Number(timeoutMinutes || 10) * 60 * 1000, maxBuffer: 1024 * 1024 });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function appendBackupRestoreMetadata(filePath, runId, size, duration) {
  const sql = [
    "",
    "-- GlukoTrack backup metadata: keep this backup_runs row completed after restore.",
    `UPDATE backup_runs SET status='completed', file_size_bytes=${Number(size) || 0}, duration_ms=${Number(duration) || 0}, finished_at=UTC_TIMESTAMP(), verified_at=UTC_TIMESTAMP(), error_message=NULL WHERE id=${Number(runId) || 0};`,
    ""
  ].join("\n");
  await fs.appendFile(filePath, sql, { mode: 0o600 });
}

async function verifyDumpReadable(filePath) {
  await fs.access(filePath);
  const head = await fs.readFile(filePath, { encoding: "utf8" });
  if (!head.includes("CREATE TABLE") || !head.includes("Dump completed")) {
    throw new Error("backup dump verification failed");
  }
}

async function sha256File(filePath) {
  const data = await fs.readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

async function safeBackupPath(value) {
  if (!value || typeof value !== "string") throw new Error("ADMIN_BACKUP_FILE_NOT_FOUND");
  const allowedRoot = await fs.realpath(ADMIN_BACKUP_DIR);
  const target = await fs.realpath(value);
  const relative = path.relative(allowedRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    const error = new Error("ADMIN_BACKUP_PATH_FORBIDDEN");
    error.statusCode = 400;
    throw error;
  }
  return target;
}

async function requireSuperAdmin(req, res, next) {
  const roles = await adminRoles(req.admin.id);
  if (!roles.some((role) => role === "Super Admin" || role === "super_admin")) {
    return res.status(403).json({ code: "ADMIN_SUPER_ADMIN_REQUIRED" });
  }
  next();
}

async function requireBackupManage(req, res, next) {
  const roles = await adminRoles(req.admin.id);
  if (roles.some((role) => role === "Super Admin" || role === "super_admin")) return next();
  const permissions = await permissionsForAdmin(req.admin.id, roles);
  if (permissions.includes("*") || permissions.includes("backup.manage") || permissions.includes("backups:write")) return next();
  return res.status(403).json({ code: "ADMIN_BACKUP_MANAGE_REQUIRED" });
}

function adminNotFound(_req, res) {
  res.status(404).json({ code: "ADMIN_ROUTE_NOT_FOUND" });
}

function bearerToken(req) {
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function cookieToken(req) {
  const cookie = req.headers.cookie ?? "";
  const found = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_COOKIE}=`));
  return found ? decodeURIComponent(found.slice(ADMIN_COOKIE.length + 1)) : "";
}

function setAdminCookie(res, token, expiresAt) {
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Expires=${new Date(expiresAt).toUTCString()}`
  );
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function csrfForToken(token) {
  return createHash("sha256").update(`${token}:${process.env.JWT_SECRET ?? ""}:admin-csrf`).digest("hex");
}

function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : "";
}

function cleanText(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function positiveId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

async function auditAdminAction(req, action, entityType, entityId, metadata = {}) {
  await pool.query(
    "INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [req.admin.id, action, entityType, String(entityId), JSON.stringify(metadata || {}), cleanText(req.ip, 64), cleanText(req.headers["user-agent"], 512)]
  ).catch(() => {});
}
function toMysqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}


async function countWhere(table, where = "") {
  const result = await pool.query(`SELECT COUNT(*) count FROM ${table}${where ? ` WHERE ${where}` : ""}`);
  return Number(result.rows[0]?.count ?? 0);
}

function publicUserRow(row) {
  return {
    id: String(row.id),
    email: row.email,
    fullName: row.full_name,
    createdAt: row.created_at,
    subscriptionStatus: row.subscription_status
  };
}
