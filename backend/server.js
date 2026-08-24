import { createCipheriv, createDecipheriv, createHash, createPublicKey, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import nodemailer from "nodemailer";
import OpenAI, { toFile } from "openai";
import Stripe from "stripe";
import { OAuth2Client } from "google-auth-library";

import { getDatabaseStatus, initializeDatabase, pool } from "./db.js";
import { createFamilyRouter } from "./family/api/familyRoutes.js";
import { createLocationRouter } from "./family/api/locationRoutes.js";
import { createSosRouter } from "./family/api/sosRoutes.js";
import { createPushDeviceRouter } from "./api/pushDeviceRoutes.js";
import { createPushDeviceTokenRepository } from "./repositories/pushDeviceTokenRepository.js";
import { createPushDeviceTokenService } from "./services/pushDeviceTokenService.js";
import { createPushTokenCipher } from "./services/pushTokenCrypto.js";
import { createFcmPushProvider } from "./notifications/providers/fcmPushProvider.js";
import { createApnsPushProvider } from "./notifications/providers/apnsPushProvider.js";
import { createPlatformPushProvider } from "./notifications/providers/platformPushProvider.js";
import { createFamilyRepository } from "./family/repositories/familyRepository.js";
import { createInvitationRepository } from "./family/repositories/invitationRepository.js";
import { createLocationRepository } from "./family/repositories/locationRepository.js";
import { createSosNotificationRepository } from "./family/repositories/sosNotificationRepository.js";
import { createSosRepository } from "./family/repositories/sosRepository.js";
import { createPermissionRepository } from "./family/repositories/permissionRepository.js";
import { createFamilyService } from "./family/services/familyService.js";
import { createFamilyInvitationService } from "./family/services/familyInvitationService.js";
import { createFamilyMemberService } from "./family/services/familyMemberService.js";
import { createLocationService } from "./family/services/locationService.js";
import { createLocationRetentionService } from "./family/services/locationRetentionService.js";
import { createLocationRetentionWorker } from "./family/services/locationRetentionWorker.js";
import { createSosNotificationService } from "./family/services/sosNotificationService.js";
import { createPushDeliveryService } from "./family/services/pushDeliveryService.js";
import { createSosNotificationWorker } from "./family/services/sosNotificationWorker.js";
import { createSosService } from "./family/services/sosService.js";
import { createFamilyPermissionService } from "./family/services/familyPermissionService.js";
import { registerAdminAuthRoutes } from "./admin-auth-routes.js";
import { createSosSettingsService } from "./sos-settings-service.js";
import { createNotificationProviderSettingsService } from "./notification-provider-settings-service.js";
import { validateHealthSnapshot } from "./sync-policy.js";

const app = express();
const upload = multer({ limits: { fileSize: bytesFromMb(envNumber("MAX_IMAGE_MB", 8)) } });

const AI_FEATURES = ["basic_text","medication","lab_analysis","photo_food","photo_document","doctor_report"];
const AI_PLANS = ["free","basic","premium","family"];
const AI_COUNTERS = ["normal","photo"];
const AI_SETTING_DEFS = {
  ai_enabled: { type: "boolean", defaultValue: true },
  ai_models_available: { type: "models", defaultValue: ["gpt-4o-mini","gpt-4o","gpt-4.1-mini","gpt-4.1"] },
  ai_connection_status: { type: "text", defaultValue: "not_configured" },
  ...Object.fromEntries(AI_FEATURES.flatMap((feature) => [
    [`ai_feature_${feature}_enabled`, { type: "boolean", defaultValue: true }],
    [`ai_feature_${feature}_primary_model`, { type: "text", defaultValue: feature.startsWith("photo") || feature === "lab_analysis" ? "gpt-4o-mini" : "gpt-4o-mini" }],
    [`ai_feature_${feature}_fallback_model`, { type: "text", defaultValue: "gpt-4o" }],
    [`ai_feature_${feature}_fallback_enabled`, { type: "boolean", defaultValue: true }],
    [`ai_feature_${feature}_max_tokens`, { type: "integer", min: 128, max: 8000, defaultValue: feature === "basic_text" ? 700 : 1100 }],
    [`ai_feature_${feature}_counter`, { type: "enum", values: AI_COUNTERS, defaultValue: feature.startsWith("photo") || feature === "lab_analysis" ? "photo" : "normal" }]
  ])),
  ...Object.fromEntries(AI_PLANS.flatMap((plan) => [
    [`ai_limit_${plan}_normal`, { type: "integer", min: 0, max: 10000, defaultValue: plan === "free" ? 5 : plan === "basic" ? 20 : plan === "premium" ? 100 : 200 }],
    [`ai_limit_${plan}_photo`, { type: "integer", min: 0, max: 10000, defaultValue: plan === "free" ? 1 : plan === "basic" ? 5 : plan === "premium" ? 30 : 60 }]
  ]))
};
const rateBuckets = new Map();
const sosSettingsService = createSosSettingsService(pool.query);
const notificationProviderSettingsService = createNotificationProviderSettingsService(pool);
const GDPR_EXPORT_DIR = "/home/ODESSA/glukotrack-gdpr-exports";
const USER_GDPR_TYPES = new Set(["access","export","rectification","erasure","restriction","objection","portability"]);
const USER_GDPR_SETTINGS = {
  gdpr_draft_retention_days: { defaultValue: 14, min: 1, max: 365 },
  gdpr_due_days: { defaultValue: 30, min: 1, max: 365 },
  gdpr_export_retention_days: { defaultValue: 7, min: 1, max: 365 }
};

const SOS_SETTING_DEFS = {
  sos_enabled: { type: "boolean", defaultValue: true },
  sos_test_mode: { type: "boolean", defaultValue: true },
  sos_show_family_card: { type: "boolean", defaultValue: true },
  sos_activation_mode: { type: "enum", values: ["manual","automatic","both"], defaultValue: "both" },
  sos_stale_after_minutes: { type: "integer", min: 1, max: 10080, defaultValue: 240 },
  sos_patient_cancel_enabled: { type: "boolean", defaultValue: true },
  sos_caregiver_close_enabled: { type: "boolean", defaultValue: false },
  sos_push_enabled: { type: "boolean", defaultValue: false },
  sos_in_app_enabled: { type: "boolean", defaultValue: true },
  sos_sms_enabled: { type: "boolean", defaultValue: false },
  sos_sms_type: { type: "enum", values: ["disabled","system_composer","external_reserved"], defaultValue: "disabled" },
  sos_request_current_location: { type: "boolean", defaultValue: true },
  sos_use_last_known_location: { type: "boolean", defaultValue: true },
  sos_show_map_to_caregiver: { type: "boolean", defaultValue: true },
  sos_rate_limit_enabled: { type: "boolean", defaultValue: true },
  sos_rate_limit_count: { type: "integer", min: 1, max: 100, defaultValue: 5 },
  sos_rate_limit_window_minutes: { type: "integer", min: 1, max: 1440, defaultValue: 60 },
  sos_merge_duplicate_active: { type: "boolean", defaultValue: true },
  sos_duplicate_window_seconds: { type: "integer", min: 1, max: 3600, defaultValue: 120 },
  sos_show_history_caregiver: { type: "boolean", defaultValue: true },
  sos_include_events_in_gdpr_export: { type: "boolean", defaultValue: true }
};
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.post("/billing/webhook", express.raw({ type: "application/json" }), asyncHandler(async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (!signature) return res.status(400).send("missing signature");
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(
      req.body,
      signature,
      requiredEnv("STRIPE_WEBHOOK_SECRET")
    );
  } catch {
    return res.status(400).send("invalid signature");
  }

  const inserted = await pool.query(
    "INSERT IGNORE INTO processed_webhooks(event_id) VALUES($1)",
    [event.id]
  );
  if (!inserted.rowCount) return res.json({ received: true, duplicate: true });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.userId ?? session.client_reference_id;
      if (userId) {
        await pool.query(
          `UPDATE users SET premium_status = 'active', subscription_status = 'active', premium_plan = $1,
            stripe_customer_id = $2, stripe_subscription_id = $3
           WHERE id = $4`,
          [session.metadata?.plan ?? "monthly", String(session.customer ?? ""), String(session.subscription ?? ""), userId]
        );
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const active = ["active", "trialing"].includes(subscription.status);
      await pool.query(
        `UPDATE users SET premium_status = $1, subscription_status = $1,
          premium_until = FROM_UNIXTIME($2), subscription_expires_at = FROM_UNIXTIME($2)
         WHERE stripe_subscription_id = $3`,
        [active ? subscription.status : "inactive", subscription.current_period_end ?? 0, subscription.id]
      );
    }
  } catch (error) {
    await pool.query("DELETE FROM processed_webhooks WHERE event_id = $1", [event.id]);
    throw error;
  }
  res.json({ received: true });
}));

app.use(express.json({ limit: "2mb" }));
app.use((_req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === "object" && typeof body.error === "string" && !body.code) {
      body.code = normalizeErrorCode(body.error);
      delete body.error;
    }
    return sendJson(body);
  };
  next();
});
app.use(securityHeaders);
app.use(corsGuard);
app.use(rateLimitGuard);

app.get("/health", (_req, res) => {
  const database = getDatabaseStatus();
  res.status(database.ready ? 200 : 503).json({
    ok: database.ready,
    service: "glucotrack-backend",
    database,
    time: new Date().toISOString()
  });
});

app.post("/auth/register", asyncHandler(async (req, res) => {
  const fullName = cleanText(req.body?.fullName, 120);
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (fullName.length < 2 || !isEmail(email) || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "invalid registration data" });
  }

  const existing = await pool.query("SELECT 1 FROM users WHERE email = $1", [email]);
  if (existing.rowCount) return res.status(409).json({ error: "email already registered" });

  const passwordHash = await bcrypt.hash(password, 12);
  const inserted = await pool.query(
    `INSERT INTO users(email, password_hash, full_name, premium_status, subscription_status,
       premium_plan, premium_until, trial_used, email_verified)
     VALUES($1, $2, $3, 'inactive', 'inactive', NULL, NULL, FALSE, FALSE)`,
    [email, passwordHash, fullName]
  );
  const result = await pool.query(
    `SELECT id, email, full_name, premium_status, premium_plan, premium_until,
       subscription_status, subscription_expires_at, trial_started_at, trial_ends_at,
       trial_used, email_verified FROM users WHERE id = $1`,
    [inserted.insertId]
  );
  await registerAccountDevice(inserted.insertId, req.body?.device);
  await registerTrialDevice(inserted.insertId, req.body?.device?.id);
  let emailDeliverySent = true;
  try {
    await issueEmailVerification(result.rows[0], req.body?.locale);
  } catch (error) {
    emailDeliverySent = false;
    console.error("Email verification delivery failed", error?.message ?? error);
  }
  res.status(201).json({
    ...authPayload(result.rows[0]),
    emailVerificationRequired: true,
    emailDeliverySent
  });
}));

app.post("/auth/login", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!isEmail(email) || typeof password !== "string") {
    return res.status(400).json({ error: "email and password are required" });
  }
  const result = await pool.query(
    `SELECT id, email, full_name, password_hash, premium_status, premium_plan, premium_until,
       subscription_status, subscription_expires_at, trial_started_at, trial_ends_at,
       trial_used, email_verified, diabetes_type, glucose_unit FROM users WHERE email = $1`,
    [email]
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "invalid credentials" });
  }
  const registeredDevice = await registerAccountDevice(user.id, req.body?.device, { enforceLimit: true });
  if (!registeredDevice) {
    return res.status(409).json({
      error: "device limit reached",
      managementToken: authPayload(user).token
    });
  }
  res.json({ ...authPayload(user), device: registeredDevice });
}));

app.post("/auth/google", asyncHandler(async (req, res) => {
  const idToken = typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";
  if (!idToken || idToken.length > 10000) {
    return res.status(400).json({ error: "google_id_token_required" });
  }

  let googlePayload;
  try {
    const ticket = await googleOAuthClient().verifyIdToken({
      idToken,
      audience: googleClientIds()
    });
    googlePayload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: "invalid_google_token" });
  }
  const subject = cleanText(googlePayload?.sub, 255);
  const email = normalizeEmail(googlePayload?.email);
  const fullName = cleanText(googlePayload?.name, 120) || email.split("@")[0];
  if (!subject || !isEmail(email) || googlePayload?.email_verified !== true) {
    return res.status(403).json({ error: "google_email_not_verified" });
  }

  let result = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.premium_status, u.premium_plan, u.premium_until,
       u.subscription_status, u.subscription_expires_at, u.trial_started_at, u.trial_ends_at,
       u.trial_used, u.email_verified, u.diabetes_type, u.glucose_unit
     FROM oauth_identities o JOIN users u ON u.id = o.user_id
     WHERE o.provider = 'google' AND o.provider_subject = $1`,
    [subject]
  );
  let user = result.rows[0];
  if (!user) {
    result = await pool.query(
      `SELECT id, email, full_name, premium_status, premium_plan, premium_until,
         subscription_status, subscription_expires_at, trial_started_at, trial_ends_at,
         trial_used, email_verified, diabetes_type, glucose_unit FROM users WHERE email = $1`,
      [email]
    );
    user = result.rows[0];
    if (!user) {
      const passwordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
      const inserted = await pool.query(
        `INSERT INTO users(email, password_hash, full_name, premium_status, subscription_status,
           premium_plan, premium_until, trial_used, email_verified)
         VALUES($1, $2, $3, 'inactive', 'inactive', NULL, NULL, FALSE, TRUE)`,
        [email, passwordHash, fullName]
      );
      result = await pool.query(
        `SELECT id, email, full_name, premium_status, premium_plan, premium_until,
           subscription_status, subscription_expires_at, trial_started_at, trial_ends_at,
           trial_used, email_verified, diabetes_type, glucose_unit FROM users WHERE id = $1`,
        [inserted.insertId]
      );
      user = result.rows[0];
    } else if (!(user.email_verified === 1 || user.email_verified === true)) {
      await pool.query("UPDATE users SET email_verified = TRUE WHERE id = $1", [user.id]);
      user.email_verified = true;
    }
    try {
      await pool.query(
        `INSERT INTO oauth_identities(user_id, provider, provider_subject, email, last_login_at)
         VALUES($1, 'google', $2, $3, UTC_TIMESTAMP())`,
        [user.id, subject, email]
      );
    } catch (error) {
      if (error?.code !== "ER_DUP_ENTRY") throw error;
      const linked = await pool.query(
        `SELECT u.id, u.email, u.full_name, u.premium_status, u.premium_plan, u.premium_until,
           u.subscription_status, u.subscription_expires_at, u.trial_started_at, u.trial_ends_at,
           u.trial_used, u.email_verified, u.diabetes_type, u.glucose_unit
         FROM oauth_identities o JOIN users u ON u.id = o.user_id
         WHERE o.provider = 'google' AND o.provider_subject = $1`,
        [subject]
      );
      if (!linked.rows[0]) return res.status(409).json({ error: "google_account_link_conflict" });
      user = linked.rows[0];
    }
  } else {
    await pool.query(
      "UPDATE oauth_identities SET email = $1, last_login_at = UTC_TIMESTAMP() WHERE provider = 'google' AND provider_subject = $2",
      [email, subject]
    );
  }

  const registeredDevice = await registerAccountDevice(user.id, req.body?.device, { enforceLimit: true });
  if (!registeredDevice) {
    return res.status(409).json({
      error: "device limit reached",
      managementToken: authPayload(user).token
    });
  }
  await registerTrialDevice(user.id, req.body?.device?.id);
  res.json({ ...authPayload(user), device: registeredDevice });
}));

app.post("/auth/apple", asyncHandler(async (req, res) => {
  const identityToken = typeof req.body?.identityToken === "string" ? req.body.identityToken.trim() : "";
  if (!identityToken || identityToken.length > 10000) {
    return res.status(400).json({ error: "apple_identity_token_required" });
  }

  let applePayload;
  try {
    applePayload = await verifyAppleIdentityToken(identityToken);
  } catch {
    return res.status(401).json({ error: "invalid_apple_token" });
  }

  const subject = cleanText(applePayload?.sub, 255);
  const tokenEmail = normalizeEmail(applePayload?.email);
  const requestEmail = normalizeEmail(req.body?.email);
  const email = isEmail(tokenEmail) ? tokenEmail : requestEmail;
  const fullName = cleanText(req.body?.fullName, 120) || (isEmail(email) ? email.split("@")[0] : "Apple User");
  if (!subject || !isEmail(email)) {
    return res.status(403).json({ error: "apple_email_required" });
  }

  const emailVerified = applePayload?.email_verified === true || applePayload?.email_verified === "true";
  if (tokenEmail && !emailVerified) {
    return res.status(403).json({ error: "apple_email_not_verified" });
  }

  let result = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.premium_status, u.premium_plan, u.premium_until,
       u.subscription_status, u.subscription_expires_at, u.trial_started_at, u.trial_ends_at,
       u.trial_used, u.email_verified, u.diabetes_type, u.glucose_unit
     FROM oauth_identities o JOIN users u ON u.id = o.user_id
     WHERE o.provider = 'apple' AND o.provider_subject = $1`,
    [subject]
  );
  let user = result.rows[0];
  if (!user) {
    result = await pool.query(
      `SELECT id, email, full_name, premium_status, premium_plan, premium_until,
         subscription_status, subscription_expires_at, trial_started_at, trial_ends_at,
         trial_used, email_verified, diabetes_type, glucose_unit FROM users WHERE email = $1`,
      [email]
    );
    user = result.rows[0];
    if (!user) {
      const passwordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
      const inserted = await pool.query(
        `INSERT INTO users(email, password_hash, full_name, premium_status, subscription_status,
           premium_plan, premium_until, trial_used, email_verified)
         VALUES($1, $2, $3, 'inactive', 'inactive', NULL, NULL, FALSE, TRUE)`,
        [email, passwordHash, fullName]
      );
      result = await pool.query(
        `SELECT id, email, full_name, premium_status, premium_plan, premium_until,
           subscription_status, subscription_expires_at, trial_started_at, trial_ends_at,
           trial_used, email_verified, diabetes_type, glucose_unit FROM users WHERE id = $1`,
        [inserted.insertId]
      );
      user = result.rows[0];
    } else if (!(user.email_verified === 1 || user.email_verified === true)) {
      await pool.query("UPDATE users SET email_verified = TRUE WHERE id = $1", [user.id]);
      user.email_verified = true;
    }
    try {
      await pool.query(
        `INSERT INTO oauth_identities(user_id, provider, provider_subject, email, last_login_at)
         VALUES($1, 'apple', $2, $3, UTC_TIMESTAMP())`,
        [user.id, subject, email]
      );
    } catch (error) {
      if (error?.code !== "ER_DUP_ENTRY") throw error;
      const linked = await pool.query(
        `SELECT u.id, u.email, u.full_name, u.premium_status, u.premium_plan, u.premium_until,
           u.subscription_status, u.subscription_expires_at, u.trial_started_at, u.trial_ends_at,
           u.trial_used, u.email_verified, u.diabetes_type, u.glucose_unit
         FROM oauth_identities o JOIN users u ON u.id = o.user_id
         WHERE o.provider = 'apple' AND o.provider_subject = $1`,
        [subject]
      );
      if (!linked.rows[0]) return res.status(409).json({ error: "apple_account_link_conflict" });
      user = linked.rows[0];
    }
  } else {
    await pool.query(
      "UPDATE oauth_identities SET email = $1, last_login_at = UTC_TIMESTAMP() WHERE provider = 'apple' AND provider_subject = $2",
      [email, subject]
    );
  }

  const registeredDevice = await registerAccountDevice(user.id, req.body?.device, { enforceLimit: true });
  if (!registeredDevice) {
    return res.status(409).json({
      error: "device limit reached",
      managementToken: authPayload(user).token
    });
  }
  await registerTrialDevice(user.id, req.body?.device?.id);
  res.json({ ...authPayload(user), device: registeredDevice });
}));

app.post("/auth/email/verify", asyncHandler(async (req, res) => {
  if (!(await verifyEmailToken(req.body?.token))) {
    return res.status(400).json({ error: "invalid or expired verification token" });
  }
  res.json({ ok: true, emailVerified: true, serverTime: new Date().toISOString() });
}));

app.get("/auth/email/verify", asyncHandler(async (req, res) => {
  const verified = await verifyEmailToken(req.query?.token);
  const locale = supportedLocale(req.query?.lang);
  const result = verified ? "verified" : "invalid";
  res.redirect(303, `https://glukotrack.com/app/?lang=${locale}#/subscription?email=${result}`);
}));

app.post("/auth/email/verify/resend", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const result = await pool.query(
    "SELECT id, email, full_name, email_verified FROM users WHERE email = $1",
    [email]
  );
  const user = result.rows[0];
  if (user && !user.email_verified) await issueEmailVerification(user, req.body?.locale);
  res.json({ ok: true });
}));

app.post("/auth/password/forgot", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (isEmail(email)) {
    const result = await pool.query(
      "SELECT id, email, full_name FROM users WHERE email = $1",
      [email]
    );
    if (result.rows[0]) await issuePasswordReset(result.rows[0], req.body?.locale);
  }
  // Never reveal whether an account exists.
  res.json({ ok: true });
}));

app.post("/auth/password/reset", asyncHandler(async (req, res) => {
  const token = cleanText(req.body?.token, 256);
  const password = req.body?.password;
  if (token.length < 32 || typeof password !== "string" ||
      password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "invalid reset data" });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `UPDATE users SET password_hash = $1, password_reset_token_hash = NULL,
       password_reset_expires_at = NULL
     WHERE password_reset_token_hash = $2
       AND password_reset_expires_at > UTC_TIMESTAMP()`,
    [passwordHash, hashToken(token)]
  );
  if (!result.rowCount) {
    return res.status(400).json({ error: "invalid or expired reset token" });
  }
  res.json({ ok: true });
}));

app.get("/auth/password/reset", (req, res) => {
  const token = cleanText(req.query?.token, 256);
  res.type("html").send(renderPasswordResetPage(token, req.query?.lang));
});

app.get("/sos/config", authGuard, asyncHandler(async (req, res) => {
  const config = await sosSettingsService.appConfig({ viewer: "patient" });
  res.json(config);
}));

app.get("/sos/:token", asyncHandler(async (req, res) => {
  noStore(res);
  const profile = await findSosProfile(req.params.token);
  if (!profile) return res.status(404).send("SOS card not found");
  const card = publicSosCard(profile);
  res.type("html").send(renderSosPage(card, profile.public_token, profile.hide_sensitive));
}));

app.post("/sos/:token/scan", asyncHandler(async (req, res) => {
  const profile = await findSosProfile(req.params.token);
  if (!profile) return res.status(404).json({ error: "SOS card not found" });
  const latitude = finiteCoordinate(req.body?.latitude, -90, 90);
  const longitude = finiteCoordinate(req.body?.longitude, -180, 180);
  const accuracy = finiteCoordinate(req.body?.accuracy, 0, 100000);
  await pool.query(
    `INSERT INTO sos_scans(
       user_id, latitude, longitude, accuracy_meters, ip_address, user_agent
     ) VALUES($1, $2, $3, $4, $5, $6)`,
    [
      profile.user_id,
      latitude,
      longitude,
      accuracy,
      cleanText(req.ip, 64),
      cleanText(req.headers["user-agent"], 512)
    ]
  );
  notifySosScan(profile, { latitude, longitude, accuracy }).catch(() => {});
  res.status(201).json({ ok: true });
}));

app.post("/sos/:token/unlock", asyncHandler(async (req, res) => {
  noStore(res);
  const profile = await findSosProfile(req.params.token);
  if (!profile) return res.status(404).json({ error: "SOS card not found" });
  if (!profile.pin_hash || typeof req.body?.pin !== "string") {
    return res.status(403).json({ error: "PIN access is unavailable" });
  }
  const valid = await bcrypt.compare(req.body.pin, profile.pin_hash);
  if (!valid) return res.status(403).json({ error: "invalid PIN" });
  res.json({ card: profile.card });
}));

// Public family invitation landing page. It exposes no health data and keeps the
// opaque token in the app URL until the recipient authenticates.
// Public invitation entry point. It contains no medical data and forwards the
// opaque, short-lived token straight into the Flutter login/acceptance flow.
app.get(["/family/invite/:token", "/api/family/invite/:token"], (req, res) => {
  const token = cleanText(req.params.token, 200);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    return res.status(404).send("Invitation not found");
  }
  const appUrl = (process.env.APP_PUBLIC_URL ?? "https://glukotrack.com/app/").replace(/\/$/, "") + "?familyInvite=" + encodeURIComponent(token);
  res.redirect(302, appUrl);
});

registerAdminAuthRoutes(app, { asyncHandler });
app.use(authGuard);
const familyRepository = createFamilyRepository(pool.query);
const familyMemberService = createFamilyMemberService(familyRepository);
const permissionRepository = createPermissionRepository(pool.query);
const locationRepository = createLocationRepository(pool.query);
const familyRouter = createFamilyRouter({
  familyService: createFamilyService(familyRepository),
  memberService: familyMemberService,
  invitationService: createFamilyInvitationService(createInvitationRepository(pool.query), familyRepository, familyMemberService),
  permissionService: createFamilyPermissionService(familyRepository, permissionRepository)
});
const locationRouter = createLocationRouter({
  locationService: createLocationService({
    familyRepository,
    permissionRepository,
    locationRepository
  })
});
const sosRepository = createSosRepository(pool.query);
const sosNotificationService = createSosNotificationService({
  familyRepository,
  permissionRepository,
  sosRepository,
  notificationRepository: createSosNotificationRepository(pool.query),
  settingsService: sosSettingsService
});
const sosRouter = createSosRouter({
  sosService: createSosService({
    familyRepository,
    permissionRepository,
    sosRepository,
    locationRepository,
    notificationService: sosNotificationService,
    settingsService: sosSettingsService
  })
});
const pushDeviceTokenService = createPushDeviceTokenService({
  repository: createPushDeviceTokenRepository(pool.query),
  // Keep configuration validation at registration time so environments that do
  // not offer push registration can still start the rest of the backend.
  tokenCipher: {
    encrypt(token) {
      return createPushTokenCipher(process.env.PUSH_TOKEN_ENCRYPTION_KEY).encrypt(token);
    }
  }
});
app.use("/api/family", (req, res, next) => {
  const legacyFamilyPath = /^(\/invitations|\/members|\/patients|\/presence|\/live-location)(\/|$)/.test(req.path);
  if (legacyFamilyPath) return next();
  return familyRouter(req, res, next);
});
app.use("/api/location", locationRouter);
app.use("/api/sos", sosRouter);
app.use("/api/devices", createPushDeviceRouter({ pushDeviceTokenService }));

app.get("/auth/me", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, email, full_name, premium_status, premium_plan, premium_until,
       subscription_status, subscription_expires_at, trial_started_at, trial_ends_at,
       trial_used, email_verified, diabetes_type, glucose_unit FROM users WHERE id = $1`,
    [req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "user not found" });
  await touchAccountDevice(req.user.id, req.headers["x-device-id"]);
  res.json({ user: publicUser(result.rows[0]) });
}));

app.put("/auth/profile", asyncHandler(async (req, res) => {
  const diabetesType = cleanText(req.body?.diabetesType, 32);
  const glucoseUnit = cleanText(req.body?.glucoseUnit, 16);
  if (!["type1", "type2", "gestational"].includes(diabetesType) ||
      !["auto", "mmolL", "mgDl"].includes(glucoseUnit)) {
    return res.status(400).json({ error: "invalid onboarding profile" });
  }
  await pool.query(
    "UPDATE users SET diabetes_type = $1, glucose_unit = $2 WHERE id = $3",
    [diabetesType, glucoseUnit, req.user.id]
  );
  res.json({ profile: { diabetesType, glucoseUnit, onboardingCompleted: true } });
}));

app.get("/privacy/gdpr/requests", asyncHandler(async (req, res) => {
  await cleanupGdprDrafts();
  await cleanupExpiredGdprExports();
  const result = await pool.query(
    `SELECT public_id id,request_type requestType,status,subject,description,due_at dueAt,completed_at completedAt,created_at createdAt
     FROM gdpr_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
    [req.user.id]
  );
  res.json({ requests: result.rows });
}));

app.get("/privacy/gdpr/requests/:id", asyncHandler(async (req, res) => {
  await cleanupExpiredGdprExports();
  const request = await userGdprRequest(req.user.id, req.params.id);
  const [events, files] = await Promise.all([
    pool.query("SELECT event_type eventType,new_status newStatus,comment,created_at createdAt FROM gdpr_request_events WHERE request_id=$1 ORDER BY created_at DESC", [request.id]),
    pool.query("SELECT id,file_type fileType,original_name originalName,size_bytes sizeBytes,checksum,expires_at expiresAt,created_at createdAt FROM gdpr_request_files WHERE request_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC", [request.id])
  ]);
  res.json({ request, events: events.rows, files: files.rows });
}));

app.post("/privacy/gdpr/requests", asyncHandler(async (req, res) => {
  const requestType = cleanText(req.body?.requestType, 32);
  if (!USER_GDPR_TYPES.has(requestType)) return res.status(400).json({ error: "invalid gdpr request type" });
  const dueDays = await gdprSettingInt("gdpr_due_days");
  const due = new Date(Date.now() + dueDays * 86400000).toISOString().slice(0, 19).replace("T", " ");
  const publicId = `gdpr_${randomBytes(8).toString("hex")}`;
  const inserted = await pool.query(
    `INSERT INTO gdpr_requests(public_id,user_id,request_type,status,subject,description,received_channel,source,locale,due_at,submitted_at)
     VALUES($1,$2,$3,'new',$4,$5,'app','user',$6,$7,UTC_TIMESTAMP())`,
    [publicId, req.user.id, requestType, cleanText(req.body?.subject, 255) || requestType, cleanText(req.body?.description, 4000), cleanText(req.body?.locale, 16) || "en", due]
  );
  await pool.query(
    "INSERT INTO gdpr_request_events(request_id,actor_type,actor_id,event_type,old_status,new_status,comment,metadata_json) VALUES($1,'user',$2,'created',NULL,'new','User-created GDPR request',$3)",
    [inserted.insertId, String(req.user.id), {}]
  );
  res.status(201).json({ ok: true, id: publicId, dueAt: due });
}));

app.get("/privacy/gdpr/requests/:id/download/:fileId", asyncHandler(async (req, res) => {
  await cleanupExpiredGdprExports();
  const request = await userGdprRequest(req.user.id, req.params.id);
  const file = await pool.query("SELECT * FROM gdpr_request_files WHERE id=$1 AND request_id=$2 AND deleted_at IS NULL AND expires_at > UTC_TIMESTAMP()", [req.params.fileId, request.id]);
  const row = file.rows[0];
  if (!row) return res.status(404).json({ error: "export not found" });
  const target = await safeUserGdprExportPath(row.storage_path);
  await pool.query("UPDATE gdpr_request_files SET download_count=download_count+1 WHERE id=$1", [row.id]);
  res.download(target, row.original_name || row.stored_name);
}));

app.get("/notifications", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, type, title, body, metadata, read_at, created_at
     FROM notifications WHERE user_id = $1
     ORDER BY created_at DESC LIMIT 100`,
    [req.user.id]
  );
  res.json({ notifications: result.rows });
}));

app.post("/notifications", asyncHandler(async (req, res) => {
  const type = cleanText(req.body?.type, 64) || "general";
  const title = cleanText(req.body?.title, 255);
  const body = cleanText(req.body?.body, 4000);
  if (!title || !body) {
    return res.status(400).json({ error: "title and body are required" });
  }
  const inserted = await pool.query(
    `INSERT INTO notifications(user_id, type, title, body, metadata)
     VALUES($1, $2, $3, $4, $5)`,
    [req.user.id, type, title, body,
      req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {}]
  );
  res.status(201).json({ id: String(inserted.insertId) });
}));

app.patch("/notifications/:id/read", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `UPDATE notifications SET read_at = COALESCE(read_at, UTC_TIMESTAMP())
     WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "notification not found" });
  res.json({ ok: true });
}));

app.delete("/notifications/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "DELETE FROM notifications WHERE id = $1 AND user_id = $2",
    [req.params.id, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "notification not found" });
  res.json({ ok: true });
}));

app.post("/sos/profile", asyncHandler(async (req, res) => {
  const card = sanitizeSosCard(req.body?.card);
  const hideSensitive = req.body?.hideSensitive !== false;
  const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : "";
  if (hideSensitive && !/^\d{4,8}$/.test(pin)) {
    return res.status(400).json({ error: "PIN must contain 4-8 digits" });
  }
  const current = await pool.query(
    "SELECT public_token FROM sos_profiles WHERE user_id = $1",
    [req.user.id]
  );
  const token = current.rows[0]?.public_token ?? randomBytes(24).toString("base64url");
  const pinHash = pin ? await bcrypt.hash(pin, 12) : null;
  await pool.query(
    `INSERT INTO sos_profiles(
       user_id, public_token, card, pin_hash, hide_sensitive, updated_at
     ) VALUES($1, $2, $3, $4, $5, NOW())
     ON DUPLICATE KEY UPDATE
       card = VALUES(card),
       pin_hash = VALUES(pin_hash),
       hide_sensitive = VALUES(hide_sensitive),
       updated_at = NOW()`,
    [req.user.id, token, card, pinHash, hideSensitive]
  );
  res.json({ token, publicUrl: `${publicBaseUrl(req)}/sos/${token}` });
}));

app.get("/sos/scans/recent", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, latitude, longitude, accuracy_meters, scanned_at
     FROM sos_scans
     WHERE user_id = $1
     ORDER BY scanned_at DESC
     LIMIT 50`,
    [req.user.id]
  );
  res.json({ scans: result.rows });
}));

app.get("/ai/limits", asyncHandler(async (req, res) => {
  res.json(await aiLimitStatus(req.user.id));
}));

app.use(["/reports", "/ai"], premiumGuard);

app.post("/sync/push", asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const incomingPayload = healthSnapshotPayload(body);
  const validationError = validateHealthSnapshot(incomingPayload);
  if (validationError) {
    return res.status(400).json({ code: "INVALID_SYNC_PAYLOAD", error: validationError });
  }
  const baseRevision = Number.isInteger(Number(body.baseRevision))
    ? Number(body.baseRevision)
    : 0;
  const schemaVersion = Number.isInteger(Number(body.schemaVersion))
    ? Math.max(1, Number(body.schemaVersion))
    : 1;

  const result = await pool.transaction(async (query) => {
    const current = await query(
      "SELECT payload, revision FROM health_snapshots WHERE user_id = $1 FOR UPDATE",
      [req.user.id]
    );
    const currentSnapshot = current.rows[0] ?? null;
    const currentRevision = Number(currentSnapshot?.revision ?? 0);
    const currentPayload = currentSnapshot == null
      ? null
      : healthSnapshotPayload(currentSnapshot.payload);

    if (currentSnapshot != null && baseRevision !== currentRevision) {
      return {
        conflict: true,
        revision: currentRevision,
        payload: currentPayload ?? {}
      };
    }

    const nextRevision = currentRevision + 1;
    const payload = incomingPayload;
    await query(
      `INSERT INTO health_snapshots(user_id, payload, schema_version, revision, updated_at)
       VALUES($1, $2, $3, $4, NOW())
       ON DUPLICATE KEY UPDATE
         payload = VALUES(payload),
         schema_version = VALUES(schema_version),
         revision = VALUES(revision),
         updated_at = NOW()`,
      [req.user.id, payload, schemaVersion, nextRevision]
    );
    await query(
      `INSERT INTO sync_changes(user_id, revision, base_revision, payload, created_at)
       VALUES($1, $2, $3, $4, NOW())`,
      [req.user.id, nextRevision, baseRevision, payload]
    );
    return { conflict: false, revision: nextRevision, payload };
  });

  if (result.conflict) {
    return res.status(409).json({
      code: "SYNC_CONFLICT",
      revision: result.revision,
      payload: result.payload
    });
  }

  res.json({ ok: true, revision: result.revision, acceptedAt: new Date().toISOString() });
}));

app.post("/sync/pull", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT payload, schema_version, revision, updated_at FROM health_snapshots WHERE user_id = $1",
    [req.user.id]
  );
  const snapshot = result.rows[0] ?? null;
  res.json({
    ok: true,
    snapshot: snapshot == null
      ? null
      : { ...snapshot, payload: healthSnapshotPayload(snapshot.payload) }
  });
}));

app.get("/subscription/status", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT premium_status, premium_plan, premium_until, subscription_status,
       subscription_expires_at, trial_started_at, trial_ends_at, trial_used,
       email_verified FROM users WHERE id = $1`,
    [req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "user not found" });
  const subscription = subscriptionPayload(result.rows[0]);
  const devices = await accountDevices(req.user.id);
  res.json({
    subscription: {
      ...subscription,
      accessStatus: subscription.accessStatus,
      serverTime: new Date().toISOString(),
      deviceLimit: deviceLimit(subscription.premiumPlan),
      devices
    }
  });
}));

app.post("/device/register", asyncHandler(async (req, res) => {
  const deviceHash = sanitizeDeviceHash(req.body?.deviceHash ?? req.body?.id);
  if (!deviceHash) return res.status(400).json({ error: "valid device_hash is required" });
  await registerTrialDevice(req.user.id, deviceHash);
  res.status(201).json({ ok: true, serverTime: new Date().toISOString() });
}));

app.post("/trial/start", asyncHandler(async (req, res) => {
  const deviceHash = sanitizeDeviceHash(req.body?.deviceHash ?? req.headers["x-device-id"]);
  if (!deviceHash) return res.status(400).json({ error: "valid device_hash is required" });
  const result = await pool.query(
    `SELECT email, email_verified, trial_used, trial_started_at, trial_ends_at,
       subscription_status, subscription_expires_at, premium_status, premium_until
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: "user not found" });
  if (!user.email_verified) {
    return res.status(403).json({ error: "email_not_verified" });
  }
  if (user.trial_used) {
    return res.status(409).json({ error: "trial_already_used" });
  }
  const emailHash = hashToken(normalizeEmail(user.email));
  const identityHistory = await pool.query(
    "SELECT trial_used FROM trial_identities WHERE email_hash = $1",
    [emailHash]
  );
  if (identityHistory.rows[0]?.trial_used) {
    return res.status(409).json({ error: "trial_already_used" });
  }
  const deviceHistory = await pool.query(
    `SELECT COUNT(DISTINCT user_id) AS used_accounts
     FROM trial_devices
     WHERE device_hash = $1 AND trial_used = TRUE AND user_id <> $2`,
    [deviceHash, req.user.id]
  );
  // A shared family phone may legitimately serve a parent and a child.
  // The device is therefore an additional abuse signal, not a one-account ban.
  if (Number(deviceHistory.rows[0]?.used_accounts ?? 0) >= 2) {
    return res.status(409).json({ error: "trial_already_used" });
  }
  await registerTrialDevice(req.user.id, deviceHash);
  const deviceResult = await pool.query(
    "SELECT trial_used FROM trial_devices WHERE user_id = $1 AND device_hash = $2",
    [req.user.id, deviceHash]
  );
  if (deviceResult.rows[0]?.trial_used) {
    return res.status(409).json({ error: "trial_already_used" });
  }
  const started = await pool.query(
    `UPDATE users SET trial_started_at = UTC_TIMESTAMP(),
       trial_ends_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY), trial_used = TRUE,
       premium_status = 'trialing', subscription_status = 'trialing', premium_plan = 'trial',
       premium_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY)
     WHERE id = $1 AND trial_used = FALSE AND email_verified = TRUE`,
    [req.user.id]
  );
  if (!started.rowCount) return res.status(409).json({ error: "trial_already_used" });
  await pool.query(
    `INSERT INTO trial_identities(email_hash, first_user_id, trial_used, first_seen_at, last_seen_at)
     VALUES($1, $2, TRUE, UTC_TIMESTAMP(), UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE trial_used = TRUE, last_seen_at = UTC_TIMESTAMP()`,
    [emailHash, req.user.id]
  );
  await pool.query(
    `INSERT INTO trial_periods(user_id, started_at, ends_at, status, device_hash, created_at)
     VALUES($1, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY),
       'active', $2, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE started_at = VALUES(started_at), ends_at = VALUES(ends_at),
       status = VALUES(status), device_hash = VALUES(device_hash)`,
    [req.user.id, deviceHash]
  );
  await pool.query(
    `UPDATE trial_devices SET trial_used = TRUE, last_seen_at = UTC_TIMESTAMP()
     WHERE user_id = $1 AND device_hash = $2`,
    [req.user.id, deviceHash]
  );
  const updated = await pool.query(
    `SELECT premium_status, premium_plan, premium_until, subscription_status,
       subscription_expires_at, trial_started_at, trial_ends_at, trial_used,
       email_verified FROM users WHERE id = $1`,
    [req.user.id]
  );
  res.status(201).json({
    subscription: subscriptionPayload(updated.rows[0]),
    serverTime: new Date().toISOString()
  });
}));

app.post("/subscription/devices", asyncHandler(async (req, res) => {
  const subscriptionResult = await pool.query(
    `SELECT premium_status, premium_plan, premium_until, subscription_status,
       subscription_expires_at, trial_started_at, trial_ends_at, trial_used
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  const subscription = subscriptionPayload(subscriptionResult.rows[0] ?? {});
  const device = sanitizeDevice(req.body);
  if (!device) return res.status(400).json({ error: "valid device data is required" });

  const existing = await pool.query(
    "SELECT id, revoked_at FROM account_devices WHERE user_id = $1 AND device_id = $2",
    [req.user.id, device.id]
  );
  const activeCount = (await accountDevices(req.user.id)).length;
  if ((!existing.rowCount || existing.rows[0].revoked_at) &&
      activeCount >= deviceLimit(subscription.premiumPlan)) {
    return res.status(409).json({ error: "device limit reached" });
  }
  await registerAccountDevice(req.user.id, device);
  res.status(existing.rowCount ? 200 : 201).json({
    devices: await accountDevices(req.user.id),
    deviceLimit: deviceLimit(subscription.premiumPlan)
  });
}));

app.delete("/subscription/devices/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "UPDATE account_devices SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL",
    [req.params.id, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "device not found" });
  res.json({ ok: true });
}));

app.post("/billing/checkout", asyncHandler(async (req, res) => {
  const requestedPlan = cleanText(req.body?.plan, 32);
  const plan = ["monthly", "yearly", "family"].includes(requestedPlan)
    ? requestedPlan
    : "monthly";
  const priceId = plan === "family"
    ? requiredEnv("STRIPE_FAMILY_PRICE_ID")
    : plan === "yearly"
      ? requiredEnv("STRIPE_YEARLY_PRICE_ID")
      : requiredEnv("STRIPE_MONTHLY_PRICE_ID");
  const userResult = await pool.query(
    "SELECT id, email, stripe_customer_id FROM users WHERE id = $1",
    [req.user.id]
  );
  const user = userResult.rows[0];
  if (!user) return res.status(404).json({ error: "user not found" });

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripeClient().customers.create({
      email: user.email,
      metadata: { userId: String(user.id) }
    });
    customerId = customer.id;
    await pool.query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [customerId, user.id]);
  }

  const session = await stripeClient().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: String(user.id),
    metadata: { userId: String(user.id), plan },
    subscription_data: { metadata: { userId: String(user.id), plan } },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: requiredEnv("STRIPE_SUCCESS_URL"),
    cancel_url: requiredEnv("STRIPE_CANCEL_URL")
  });
  res.json({ checkoutUrl: session.url });
}));

app.post("/billing/portal", asyncHandler(async (req, res) => {
  const result = await pool.query("SELECT stripe_customer_id FROM users WHERE id = $1", [req.user.id]);
  const customerId = result.rows[0]?.stripe_customer_id;
  if (!customerId) return res.status(400).json({ error: "billing account not found" });
  const session = await stripeClient().billingPortal.sessions.create({
    customer: customerId,
    return_url: requiredEnv("STRIPE_PORTAL_RETURN_URL")
  });
  res.json({ portalUrl: session.url });
}));

app.post("/reports", asyncHandler(async (req, res) => {
  const title = cleanText(req.body?.title, 160);
  const content = cleanText(req.body?.content, 100000);
  const metadata = req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {};
  if (!title || !content) return res.status(400).json({ error: "title and content are required" });
  const inserted = await pool.query(
    `INSERT INTO reports(user_id, title, content, metadata)
     VALUES($1, $2, $3, $4)`,
    [req.user.id, title, content, metadata]
  );
  const result = await pool.query(
    "SELECT id, title, metadata, created_at FROM reports WHERE id = $1 AND user_id = $2",
    [inserted.insertId, req.user.id]
  );
  res.status(201).json({ report: reportSummary(result.rows[0]) });
}));

app.get("/reports", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT id, title, metadata, created_at FROM reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100",
    [req.user.id]
  );
  res.json({ reports: result.rows.map(reportSummary) });
}));

app.get("/reports/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT id, title, content, metadata, created_at FROM reports WHERE id = $1 AND user_id = $2",
    [req.params.id, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "report not found" });
  res.json({ report: { ...reportSummary(result.rows[0]), content: result.rows[0].content } });
}));

app.delete("/reports/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "DELETE FROM reports WHERE id = $1 AND user_id = $2",
    [req.params.id, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "report not found" });
  res.json({ ok: true });
}));

app.post(["/family/invitations", "/api/family/invitations"], asyncHandler(async (req, res) => {
  const familyPolicy = await familyAccessPolicy();
  if (!familyPolicy.family_access_enabled || !familyPolicy.family_trusted_contacts_enabled || !familyPolicy.family_invites_enabled) return res.status(403).json({ error: "family access disabled" });
  const subscriptionResult = await pool.query(
    `SELECT premium_status, premium_plan, premium_until, subscription_status,
       subscription_expires_at, trial_started_at, trial_ends_at, trial_used
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  const subscription = subscriptionPayload(subscriptionResult.rows[0] ?? {});
  if (!subscription.premium || subscription.premiumPlan !== "family") {
    return res.status(403).json({ error: "family subscription required" });
  }
  const memberCount = await pool.query(
    "SELECT COUNT(*) AS count FROM family_links WHERE owner_user_id = $1 AND status <> 'revoked'",
    [req.user.id]
  );
  if (Number(memberCount.rows[0]?.count ?? 0) >= familyPolicy.family_max_members) {
    return res.status(409).json({ error: "family member limit reached" });
  }
  const inviteEmail = normalizeEmail(req.body?.email);
  if (!isEmail(inviteEmail) || inviteEmail === req.user.email) {
    return res.status(400).json({ error: "valid caregiver email is required" });
  }
  const permissions = sanitizePermissions(req.body?.permissions);
  const inviteCode = randomBytes(18).toString("base64url");
  const inviteCodeHash = hashToken(inviteCode);
  await pool.query(
    `INSERT INTO family_links(
       owner_user_id, invite_email, invite_code_hash, permissions, status, expires_at
     ) VALUES($1, $2, $3, $4, 'pending', DATE_ADD(NOW(), INTERVAL 7 DAY))
     ON DUPLICATE KEY UPDATE
       invite_code = NULL,
       invite_code_hash = VALUES(invite_code_hash),
       permissions = VALUES(permissions),
       status = 'pending', caregiver_user_id = NULL,
       expires_at = VALUES(expires_at), accepted_at = NULL`,
    [req.user.id, inviteEmail, inviteCodeHash, permissions]
  );
  const result = await pool.query(
    "SELECT id, invite_email, permissions, status, expires_at, email_sent, email_sent_at, email_error, member_name, member_role FROM family_links WHERE owner_user_id = $1 AND invite_email = $2",
    [req.user.id, inviteEmail]
  );
  const invitation = result.rows[0];
  const patient = await pool.query("SELECT full_name FROM users WHERE id = $1", [req.user.id]);
  const invitationUrl = `${(process.env.APP_PUBLIC_ORIGIN ?? "https://glukotrack.com").replace(/\/$/, "")}/api/family/invite/${encodeURIComponent(inviteCode)}`;
  console.info("INVITATION_CREATED", { invitation_id: String(invitation.id), patient_id: String(req.user.id) });
  try {
    await sendFamilyInvitationEmail({
      email: inviteEmail,
      inviteCode,
      locale: req.body?.locale
    });
    await pool.query(
      "UPDATE family_links SET email_sent = TRUE, email_sent_at = UTC_TIMESTAMP(), email_error = NULL WHERE id = $1",
      [invitation.id]
    );
    console.info("INVITATION_EMAIL_SENT", { invitation_id: String(invitation.id), patient_id: String(req.user.id) });
  } catch (error) {
    const emailError = cleanText(error instanceof Error ? error.message : String(error), 500);
    await pool.query(
      "UPDATE family_links SET email_sent = FALSE, email_error = $1 WHERE id = $2",
      [emailError, invitation.id]
    ).catch(() => {});
    console.error("INVITATION_EMAIL_FAILED", { invitation_id: String(invitation.id), patient_id: String(req.user.id), error: emailError });
    return res.status(502).json({ error: "invitation email failed" });
  }
  res.status(201).json({ invitation: { ...familyLink({ ...result.rows[0], inviteCode, email_sent: true, email_sent_at: new Date().toISOString() }), inviteCode } });
}));

app.post(["/family/invitations/:id/resend", "/api/family/invitations/:id/resend"], asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, invite_email, status, expires_at
     FROM family_links WHERE id = $1 AND owner_user_id = $2`,
    [req.params.id, req.user.id]
  );
  const invitation = result.rows[0];
  if (!invitation || invitation.status !== "pending" || new Date(invitation.expires_at) <= new Date()) {
    return res.status(404).json({ error: "pending invitation not found" });
  }
  const inviteCode = randomBytes(18).toString("base64url");
  const inviteCodeHash = hashToken(inviteCode);
  await pool.query(
    `UPDATE family_links SET invite_code = NULL, invite_code_hash = $1,
       expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY),
       email_sent = FALSE, email_sent_at = NULL, email_error = NULL
     WHERE id = $2`,
    [inviteCodeHash, invitation.id]
  );
  try {
    const patient = await pool.query("SELECT full_name FROM users WHERE id = $1", [req.user.id]);
    const invitationUrl = `${(process.env.APP_PUBLIC_ORIGIN ?? "https://glukotrack.com").replace(/\/$/, "")}/api/family/invite/${encodeURIComponent(inviteCode)}`;
    console.info("INVITATION_CREATED", { invitation_id: String(invitation.id), patient_id: String(req.user.id) });
    await sendFamilyInvitationEmail({
      email: invitation.invite_email,
      inviteCode,
      locale: req.body?.locale
    });
    await pool.query(
      "UPDATE family_links SET email_sent = TRUE, email_sent_at = UTC_TIMESTAMP(), email_error = NULL WHERE id = $1",
      [invitation.id]
    );
    console.info("INVITATION_EMAIL_SENT", { invitation_id: String(invitation.id), patient_id: String(req.user.id) });
  } catch (error) {
    const emailError = cleanText(error instanceof Error ? error.message : String(error), 500);
    await pool.query(
      "UPDATE family_links SET email_sent = FALSE, email_error = $1 WHERE id = $2",
      [emailError, invitation.id]
    ).catch(() => {});
    console.error("INVITATION_EMAIL_FAILED", { invitation_id: String(invitation.id), patient_id: String(req.user.id), error: emailError });
    return res.status(502).json({ error: "invitation email failed" });
  }
  res.json({ ok: true });
}));
// Compatibility routes used by the released Family Live Location screen.
// They deliberately use accepted family_links, the same relationship created by
// the existing Family Access invitation flow.
// Existing foreground heartbeat used by Family Watch. A user may only update their own presence.
app.post(["/family/presence", "/api/family/presence"], asyncHandler(async (req, res) => {
  const requestedPatientId = req.body?.patientId ?? req.body?.patient_id;
  if (requestedPatientId != null && String(requestedPatientId) !== String(req.user.id)) return res.status(403).json({ error: "patient identity mismatch" });
  const latitude = req.body?.latitude == null ? null : Number(req.body.latitude);
  const longitude = req.body?.longitude == null ? null : Number(req.body.longitude);
  if ((latitude == null) !== (longitude == null) || (latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180))) return res.status(400).json({ error: "invalid location" });
  const batteryValue = Number(req.body?.battery);
  const glucoseValue = Number(req.body?.glucoseMmol ?? req.body?.glucose);
  const battery = Number.isFinite(batteryValue) && batteryValue >= 0 && batteryValue <= 100 ? Math.round(batteryValue) : null;
  const glucose = Number.isFinite(glucoseValue) && glucoseValue > 0 && glucoseValue <= 100 ? glucoseValue : null;
  await pool.query("INSERT INTO patient_presence(patient_id,last_seen,online_status,latitude,longitude,battery,glucose) VALUES($1,UTC_TIMESTAMP(),TRUE,$2,$3,$4,$5) ON DUPLICATE KEY UPDATE last_seen=UTC_TIMESTAMP(),online_status=TRUE,latitude=VALUES(latitude),longitude=VALUES(longitude),battery=VALUES(battery),glucose=VALUES(glucose)", [req.user.id, latitude, longitude, battery, glucose]);
  res.json({ ok: true, onlineWindowSeconds: 150 });
}));

app.get(["/family/live-location/settings", "/api/family/live-location/settings"], asyncHandler(async (req, res) => {
  const [settings, members] = await Promise.all([
    pool.query("SELECT enabled, consented_at, updated_at FROM family_live_location_settings WHERE user_id = $1", [req.user.id]),
    pool.query(
      "SELECT fl.caregiver_user_id AS id, COALESCE(u.full_name, fl.member_name, fl.invite_email) AS name, u.email, g.granted_at, g.revoked_at FROM family_links fl JOIN users u ON u.id = fl.caregiver_user_id LEFT JOIN family_live_location_grants g ON g.owner_user_id = fl.owner_user_id AND g.caregiver_user_id = fl.caregiver_user_id WHERE fl.owner_user_id = $1 AND fl.status = 'accepted' ORDER BY name",
      [req.user.id]
    )
  ]);
  const setting = settings.rows[0];
  res.json({
    enabled: setting?.enabled === true || Number(setting?.enabled) === 1,
    consentedAt: setting?.consented_at ?? null,
    updatedAt: setting?.updated_at ?? null,
    recipients: members.rows.map((row) => ({
      id: String(row.id), name: row.name, email: row.email,
      granted: row.granted_at != null && row.revoked_at == null,
      grantedAt: row.granted_at ?? null
    }))
  });
}));

app.put(["/family/live-location/settings", "/api/family/live-location/settings"], asyncHandler(async (req, res) => {
  const enabled = req.body?.enabled === true;
  const caregiverIds = Array.from(new Set((Array.isArray(req.body?.caregiverIds) ? req.body.caregiverIds : []).map((id) => String(id)).filter((id) => /^\d+$/.test(id))));
  if (enabled && !caregiverIds.length) return res.status(400).json({ error: "choose at least one recipient" });
  const allowed = caregiverIds.length ? await pool.query(
    "SELECT caregiver_user_id FROM family_links WHERE owner_user_id = $1 AND status = 'accepted' AND caregiver_user_id IN (" + caregiverIds.map((_, index) => "$" + (index + 2)).join(",") + ")",
    [req.user.id, ...caregiverIds]
  ) : { rows: [] };
  if (allowed.rows.length !== caregiverIds.length) return res.status(400).json({ error: "invalid live location recipient" });
  await pool.transaction(async (query) => {
    await query("INSERT INTO family_live_location_settings(user_id, enabled, consented_at) VALUES($1, $2, CASE WHEN $2 THEN UTC_TIMESTAMP() ELSE NULL END) ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), consented_at = CASE WHEN VALUES(enabled) THEN COALESCE(consented_at, UTC_TIMESTAMP()) ELSE NULL END", [req.user.id, enabled, enabled]);
    await query("UPDATE family_live_location_grants SET revoked_at = UTC_TIMESTAMP() WHERE owner_user_id = $1 AND revoked_at IS NULL", [req.user.id]);
    for (const caregiverId of caregiverIds) await query("INSERT INTO family_live_location_grants(owner_user_id, caregiver_user_id, granted_at, revoked_at) VALUES($1, $2, UTC_TIMESTAMP(), NULL) ON DUPLICATE KEY UPDATE granted_at = UTC_TIMESTAMP(), revoked_at = NULL", [req.user.id, caregiverId]);
    if (!enabled) await query("DELETE FROM family_live_location_current WHERE user_id = $1", [req.user.id]);
  });
  res.json({ ok: true });
}));

app.post(["/family/live-location/position", "/api/family/live-location/position"], asyncHandler(async (req, res) => {
  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return res.status(400).json({ error: "invalid location" });
  const setting = await pool.query("SELECT enabled FROM family_live_location_settings WHERE user_id = $1", [req.user.id]);
  if (!setting.rowCount || !(setting.rows[0].enabled === true || Number(setting.rows[0].enabled) === 1)) return res.status(403).json({ error: "live location is disabled" });
  await pool.query("INSERT INTO family_live_location_current(user_id, latitude, longitude, accuracy_meters, speed_mps, heading_degrees, captured_at) VALUES($1, $2, $3, $4, $5, $6, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE latitude=VALUES(latitude), longitude=VALUES(longitude), accuracy_meters=VALUES(accuracy_meters), speed_mps=VALUES(speed_mps), heading_degrees=VALUES(heading_degrees), captured_at=VALUES(captured_at)", [req.user.id, latitude, longitude, Number.isFinite(Number(req.body?.accuracyMeters)) ? Number(req.body.accuracyMeters) : null, Number.isFinite(Number(req.body?.speedMps)) ? Number(req.body.speedMps) : null, Number.isFinite(Number(req.body?.headingDegrees)) ? Number(req.body.headingDegrees) : null]);
  res.json({ ok: true });
}));

app.get(["/family/patients/:ownerId/live-location", "/api/family/patients/:ownerId/live-location"], asyncHandler(async (req, res) => {
  const allowed = await pool.query("SELECT 1 FROM family_live_location_settings s JOIN family_live_location_grants g ON g.owner_user_id=s.user_id AND g.revoked_at IS NULL JOIN family_links fl ON fl.owner_user_id=s.user_id AND fl.caregiver_user_id=g.caregiver_user_id AND fl.status='accepted' JOIN users owner ON owner.id=s.user_id WHERE s.user_id=$1 AND s.enabled=TRUE AND g.caregiver_user_id=$2 AND owner.premium_plan IN ('family','family_semiannual','family_yearly') AND owner.premium_status='active' AND COALESCE(owner.subscription_expires_at, owner.premium_until)>UTC_TIMESTAMP()", [req.params.ownerId, req.user.id]);
  if (!allowed.rowCount) return res.status(403).json({ error: "live location access denied" });
  const location = await pool.query("SELECT latitude, longitude, accuracy_meters, speed_mps, heading_degrees, captured_at FROM family_live_location_current WHERE user_id = $1", [req.params.ownerId]);
  const currentLocation = location.rows[0] ?? null;
  res.json({ trackingStatus: currentLocation == null ? "waiting" : "active", location: currentLocation });
}));

app.post(["/family/invitations/accept", "/api/family/invitations/accept"], asyncHandler(async (req, res) => {
  const familyPolicy = await familyAccessPolicy();
  if (!familyPolicy.family_access_enabled || !familyPolicy.family_trusted_contacts_enabled) return res.status(403).json({ error: "family access disabled" });
  const code = cleanText(req.body?.code, 200);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(code)) {
    return res.status(400).json({ error: "invalid invitation code" });
  }
  const codeHash = hashToken(code);
  const attemptEmail = normalizeEmail(req.user.email);
  const attemptIp = cleanText(req.ip, 64) || "unknown";

  // A cryptographically random, pending invitation is allowed before the
  // rate-limit branch. Previous invalid links from the same IP must not block
  // the recipient's newly issued valid invitation.
  const invitation = await pool.query(
    "SELECT id, invite_email FROM family_links WHERE invite_code_hash = $1 AND status = 'pending' AND expires_at > NOW()",
    [codeHash]
  );
  if (invitation.rowCount && invitation.rows[0].invite_email !== attemptEmail) {
    console.info("FAMILY_INVITE_ACCEPT_EMAIL_MISMATCH", { invitation_id: String(invitation.rows[0].id), user_id: String(req.user.id) });
    return res.status(403).json({ code: "INVITATION_EMAIL_MISMATCH", error: "sign in with the invited email" });
  }
  if (invitation.rowCount) {
    const updated = await pool.query(
      "UPDATE family_links SET caregiver_user_id = $1, status = 'accepted', accepted_at = NOW() WHERE id = $2 AND status = 'pending' AND expires_at > NOW()",
      [req.user.id, invitation.rows[0].id]
    );
    if (updated.rowCount) {
      await pool.query(
        "INSERT INTO family_invite_attempts(invite_code_hash, attempted_email, ip_address, success) VALUES($1, $2, $3, TRUE)",
        [codeHash, attemptEmail, attemptIp]
      );
      const result = await pool.query(
        "SELECT id, owner_user_id, invite_email, permissions, status, accepted_at, email_sent, email_sent_at, email_error, member_name, member_role FROM family_links WHERE id = $1",
        [invitation.rows[0].id]
      );
      return res.json({ link: familyLink(result.rows[0]) });
    }
  }

  const failures = await pool.query(
    "SELECT COUNT(*) AS count FROM family_invite_attempts WHERE ip_address = $1 AND success = FALSE AND attempted_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)",
    [attemptIp]
  );
  if (Number(failures.rows[0]?.count ?? 0) >= 5) {
    return res.status(429).json({ error: "too many invalid invitation attempts" });
  }
  await pool.query(
    "INSERT INTO family_invite_attempts(invite_code_hash, attempted_email, ip_address, success) VALUES($1, $2, $3, FALSE)",
    [codeHash, attemptEmail, attemptIp]
  );
  return res.status(404).json({ error: "invitation is invalid, expired, or belongs to another email" });
}));

app.get(["/family/members", "/api/family/members"], asyncHandler(async (req, res) => {
  const familyPolicy = await familyAccessPolicy();
  if (!familyPolicy.family_access_enabled) return res.status(403).json({ error: "family access disabled" });
  const result = await pool.query(
    `SELECT fl.id, fl.invite_email, fl.invite_code, fl.permissions, fl.status, fl.expires_at,
            fl.accepted_at, fl.email_sent, fl.email_sent_at, fl.email_error, fl.member_name, fl.member_role, u.full_name
     FROM family_links fl
     LEFT JOIN users u ON u.id = fl.caregiver_user_id
     WHERE fl.owner_user_id = $1 AND fl.status <> 'revoked'
     ORDER BY fl.created_at DESC`,
    [req.user.id]
  );
  res.json({ members: result.rows.map(familyLink) });
}));

app.delete(["/family/members/:id", "/api/family/members/:id"], asyncHandler(async (req, res) => {
  const familyPolicy = await familyAccessPolicy();
  if (!familyPolicy.family_access_enabled) return res.status(403).json({ error: "family access disabled" });
  const result = await pool.query(
    "UPDATE family_links SET status = 'revoked' WHERE id = $1 AND owner_user_id = $2",
    [req.params.id, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "family link not found" });
  res.json({ ok: true });
}));

app.patch(["/family/members/:id/permissions", "/api/family/members/:id/permissions"], asyncHandler(async (req, res) => {
  const familyPolicy = await familyAccessPolicy();
  if (!familyPolicy.family_access_enabled) return res.status(403).json({ error: "family access disabled" });
  const permissions = sanitizePermissions(req.body?.permissions);
  const result = await pool.query(
    `UPDATE family_links
     SET permissions = $1
     WHERE id = $2 AND owner_user_id = $3 AND status IN ('pending','accepted')`,
    [permissions, req.params.id, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "family link not found" });
  const updated = await pool.query(
    "SELECT permissions FROM family_links WHERE id = $1 AND owner_user_id = $2",
    [req.params.id, req.user.id]
  );
  res.json({ permissions: sanitizePermissions(updated.rows[0]?.permissions) });
}));

app.get(["/family/patients", "/api/family/patients"], asyncHandler(async (req, res) => {
  const familyPolicy = await familyAccessPolicy();
  if (!familyPolicy.family_access_enabled || !familyPolicy.family_trusted_contacts_enabled) return res.status(403).json({ error: "family access disabled" });
  const result = await pool.query(
    `SELECT fl.owner_user_id, fl.permissions, u.full_name, u.email,
            hs.payload, hs.updated_at, pp.last_seen, pp.online_status,
            pp.battery, pp.glucose AS presence_glucose,
            (SELECT se.glucose_mmol
             FROM sos_events se
             WHERE se.user_id = fl.owner_user_id
               AND se.glucose_mmol IS NOT NULL AND se.glucose_mmol > 0
             ORDER BY se.activated_at DESC LIMIT 1) AS sos_glucose,
            (SELECT se.activated_at
             FROM sos_events se
             WHERE se.user_id = fl.owner_user_id
               AND se.glucose_mmol IS NOT NULL AND se.glucose_mmol > 0
             ORDER BY se.activated_at DESC LIMIT 1) AS sos_glucose_at
     FROM family_links fl
     JOIN users u ON u.id = fl.owner_user_id
     LEFT JOIN health_snapshots hs ON hs.user_id = fl.owner_user_id
     LEFT JOIN patient_presence pp ON pp.patient_id = fl.owner_user_id
     WHERE fl.caregiver_user_id = $1 AND fl.status = 'accepted'
       AND u.premium_plan IN ('family', 'family_semiannual', 'family_yearly')
       AND u.premium_status = 'active'
       AND COALESCE(u.subscription_expires_at, u.premium_until) > UTC_TIMESTAMP()
     ORDER BY u.full_name`,
    [req.user.id]
  );
  res.json({ patients: result.rows.map(patientSummary) });
}));

app.get(["/family/patients/:ownerId", "/api/family/patients/:ownerId"], asyncHandler(async (req, res) => {
  const familyPolicy = await familyAccessPolicy();
  if (!familyPolicy.family_access_enabled || !familyPolicy.family_trusted_contacts_enabled) return res.status(403).json({ error: "family access disabled" });
  const result = await pool.query(
    `SELECT fl.owner_user_id, fl.permissions, u.id, u.full_name, u.email, hs.payload, hs.updated_at,
            pp.last_seen, pp.online_status, pp.battery, pp.glucose AS presence_glucose,
            (SELECT se.glucose_mmol
             FROM sos_events se
             WHERE se.user_id = fl.owner_user_id
               AND se.glucose_mmol IS NOT NULL AND se.glucose_mmol > 0
             ORDER BY se.activated_at DESC LIMIT 1) AS sos_glucose,
            (SELECT se.activated_at
             FROM sos_events se
             WHERE se.user_id = fl.owner_user_id
               AND se.glucose_mmol IS NOT NULL AND se.glucose_mmol > 0
             ORDER BY se.activated_at DESC LIMIT 1) AS sos_glucose_at
     FROM family_links fl
     JOIN users u ON u.id = fl.owner_user_id
     LEFT JOIN health_snapshots hs ON hs.user_id = fl.owner_user_id
     LEFT JOIN patient_presence pp ON pp.patient_id = fl.owner_user_id
     WHERE fl.owner_user_id = $1 AND fl.caregiver_user_id = $2 AND fl.status = 'accepted'
       AND u.premium_plan IN ('family', 'family_semiannual', 'family_yearly')
       AND u.premium_status = 'active'
       AND COALESCE(u.subscription_expires_at, u.premium_until) > UTC_TIMESTAMP()`,
    [req.params.ownerId, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "access not found" });
  res.json({ patient: patientDetails(result.rows[0]) });
}));

app.post("/ai/chat", asyncHandler(async (req, res) => {
  const { message, language_code = "en", profile = {} } = req.body ?? {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }
  const aiRun = await reserveAiRequest(req, "basic_text", language_code, false);
  const response = await callAiWithFallback(aiRun, (client, model) => client.chat.completions.create({
    model,
    temperature: 0.25,
    max_tokens: aiRun.maxTokens,
    messages: [
      {
        role: "system",
        content: [
          "You are GlucoTrack's diabetes assistant.",
          `Answer in ${language_code}.`,
          "Do not diagnose or prescribe treatment.",
          "Do not present insulin doses as medical prescriptions.",
          "Use sensor readings and diary entries when the user asks about trends, nighttime events, meals, insulin, or personal history.",
          "Clearly distinguish observed facts from possible explanations and say when data is insufficient.",
          "Be concise, practical, and medically cautious.",
          `Profile JSON: ${JSON.stringify(profile)}`
        ].join(" ")
      },
      { role: "user", content: message }
    ]
  }));
  await completeAiRequest(aiRun, response, response.model);
  res.json({ text: response.choices?.[0]?.message?.content?.trim() ?? "", limits: await aiLimitStatus(req.user.id) });
}));

app.post("/ai/search-food", asyncHandler(async (req, res) => {
  const { query, language_code = "en" } = req.body ?? {};
  if (!query || typeof query !== "string" || query.trim().length < 2) {
    return res.status(400).json({ error: "query must contain at least 2 characters" });
  }
  const aiRun = await reserveAiRequest(req, "basic_text", language_code, false);
  const response = await callAiWithFallback(aiRun, (client, model) => client.chat.completions.create({
    model,
    temperature: 0.1,
    max_tokens: aiRun.maxTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are a food nutrition search engine for a diabetes app.",
          `Return human-readable text in language code ${language_code}.`,
          "Find up to 5 likely foods matching the user's request, including branded or prepared foods when possible.",
          "Nutrition values must be realistic estimates per 100 grams unless the query clearly requests another basis.",
          "Return JSON only with this exact shape:",
          '{"items":[{"name":"","category":"","carbs_per_100g":0,"calories_per_100g":0,"protein_per_100g":0,"fat_per_100g":0,"fiber_per_100g":0,"serving_grams":100,"recommendation":"recommended|limited|notRecommended","note":""}],"disclaimer":""}',
          "The recommendation is informational for diabetes: consider carbohydrate density, added sugar, fiber and portion size. Never claim medical certainty."
        ].join(" ")
      },
      { role: "user", content: query.trim().slice(0, 300) }
    ]
  }));
  let data;
  try {
    data = JSON.parse(response.choices?.[0]?.message?.content ?? "{}");
  } catch (error) {
    await failAiRequest(aiRun, error);
    return res.status(502).json({ error: "model returned invalid JSON" });
  }
  const rawItems = Array.isArray(data.items) ? data.items.slice(0, 5) : [];
  const items = rawItems
    .filter((item) => item && typeof item.name === "string" && item.name.trim())
    .map((item) => ({
      name: item.name.trim(),
      category: String(item.category ?? "Food").trim(),
      carbs_per_100g: safeNutritionNumber(item.carbs_per_100g),
      calories_per_100g: safeNutritionNumber(item.calories_per_100g, 2000),
      protein_per_100g: safeNutritionNumber(item.protein_per_100g),
      fat_per_100g: safeNutritionNumber(item.fat_per_100g),
      fiber_per_100g: safeNutritionNumber(item.fiber_per_100g),
      serving_grams: safeNutritionNumber(item.serving_grams, 2000) || 100,
      recommendation: ["recommended", "limited", "notRecommended"].includes(item.recommendation)
        ? item.recommendation
        : "limited",
      note: String(item.note ?? "").trim()
    }));
  await completeAiRequest(aiRun, response, response.model);
  res.json({ items, disclaimer: String(data.disclaimer ?? "").trim(), limits: await aiLimitStatus(req.user.id) });
}));

app.post("/ai/transcribe", upload.single("audio"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "audio is required" });
  const mimeType = req.file.mimetype || "audio/webm";
  const languageCode = cleanText(req.body?.language_code, 12);
  const file = await toFile(
    req.file.buffer,
    req.file.originalname || "voice.webm",
    { type: mimeType }
  );
  const aiRun = await reserveAiRequest(req, "basic_text", languageCode || "en", false);
  const response = await callAiWithFallback(aiRun, (client, model) => client.audio.transcriptions.create({
    file,
    model: model.includes("transcribe") ? model : (process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe"),
    language: transcriptionLanguage(languageCode),
  }));
  await completeAiRequest(aiRun, response, response.model || process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
  res.json({ text: String(response.text ?? "").trim(), limits: await aiLimitStatus(req.user.id) });
}));

app.post("/ai/recognize-food", upload.single("image"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "image is required" });
  const mimeType = req.file.mimetype || "image/jpeg";
  const aiRun = await reserveAiRequest(req, "photo_food", req.body.language_code || "en", true);
  const response = await callAiWithFallback(aiRun, (client, model) => client.responses.create({
    model,
    temperature: 0.1,
    input: [{
      role: "user",
      content: [
        {
          type: "input_text",
          text: [
            "Recognize foods in the image for a diabetes assistant app.",
            `Use ${req.body.language_code ?? "en"} for human-readable fields.`,
            `The user's glucose unit is ${req.body.glucose_unit ?? "mmol/L"}.`,
            "Return only valid JSON, no Markdown.",
            '{"foods":[{"name":"","portion_grams":0,"carbs_per_100g":0,"carbs_grams":0,"calories":0,"confidence":0,"note":""}],"total_carbs_grams":0,"total_calories":0,"warnings":[],"summary":""}'
          ].join(" ")
        },
        { type: "input_image", image_url: `data:${mimeType};base64,${req.file.buffer.toString("base64")}` }
      ]
    }]
  }));
  let data;
  try {
    data = JSON.parse(stripJsonFence(response.output_text ?? "{}"));
  } catch (error) {
    await failAiRequest(aiRun, error);
    return res.status(502).json({ error: "model returned invalid JSON" });
  }
  const validationError = validateFoodPayload(data);
  if (validationError) {
    await failAiRequest(aiRun, new Error(validationError));
    return res.status(502).json({ error: validationError });
  }
  await completeAiRequest(aiRun, response, response.model);
  res.json({ data, limits: await aiLimitStatus(req.user.id) });
}));

app.post("/ai/lab-analysis", upload.single("image"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "image is required" });
  const mimeType = req.file.mimetype || "image/jpeg";
  const languageCode = cleanText(req.body?.language_code, 12) || "en";
  const aiRun = await reserveAiRequest(req, "lab_analysis", languageCode, true);
  const response = await callAiWithFallback(aiRun, (client, model) => client.responses.create({
    model,
    temperature: 0.1,
    input: [{
      role: "user",
      content: [
        {
          type: "input_text",
          text: [
            "Read the laboratory report image carefully and explain it in plain language.",
            `Answer in language code ${languageCode}.`,
            "Transcribe only values that are clearly visible; mark uncertain or unreadable values.",
            "For each visible test provide: name, result, unit, printed reference interval, and whether it is low/in range/high according to that printed interval.",
            "Then summarize possible general meanings, especially diabetes-related markers, without diagnosing.",
            "Mention that reference ranges vary by laboratory, age, sex, pregnancy, medications and clinical context.",
            "Highlight results that may warrant prompt medical review and emergency warning signs, but never prescribe treatment or medication changes.",
            "Do not infer missing values. Do not claim the image replaces an original laboratory report or a clinician."
          ].join(" ")
        },
        { type: "input_image", image_url: `data:${mimeType};base64,${req.file.buffer.toString("base64")}` }
      ]
    }]
  }));
  await completeAiRequest(aiRun, response, response.model);
  res.json({ text: String(response.output_text ?? "").trim(), limits: await aiLimitStatus(req.user.id) });
}));

app.post("/ai/medication-check", asyncHandler(async (req, res) => {
  const medications = cleanText(req.body?.medications, 4000);
  if (medications.length < 2) {
    return res.status(400).json({ error: "medications are required" });
  }
  const languageCode = cleanText(req.body?.language_code, 12) || "en";
  const context = cleanText(req.body?.context, 2000);
  const diabetesType = cleanText(req.body?.diabetes_type, 40);
  const aiRun = await reserveAiRequest(req, "medication", languageCode, false);
  const response = await callAiWithFallback(aiRun, (client, model) => client.chat.completions.create({
    model,
    temperature: 0.1,
    max_tokens: aiRun.maxTokens,
    messages: [
      {
        role: "system",
        content: [
          "You are a cautious medication-safety explainer for a diabetes app.",
          `Answer in language code ${languageCode}.`,
          "Identify possible drug-drug interactions, duplicate therapy, effects on glucose, hypoglycemia/hyperglycemia risk, kidney/liver cautions and common timing issues.",
          "Separate urgent risks, points to discuss with a doctor/pharmacist, and monitoring suggestions.",
          "Do not declare a combination safe, diagnose, prescribe, recommend doses, or tell the user to start/stop/change medication.",
          "State that databases and patient factors may be incomplete and professional verification is required."
        ].join(" ")
      },
      {
        role: "user",
        content: `Diabetes type: ${diabetesType}. Medications: ${medications}. Additional context: ${context || "not provided"}.`
      }
    ]
  }));
  await completeAiRequest(aiRun, response, response.model);
  res.json({ text: response.choices?.[0]?.message?.content?.trim() ?? "", limits: await aiLimitStatus(req.user.id) });
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.statusCode) {
    return res.status(err.statusCode).json({ code: err.message || "REQUEST_FAILED" });
  }
  if (err?.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ error: "email already registered" });
  }
  res.status(500).json({ error: "internal server error" });
});

const port = envNumber("PORT", 8787);
console.log("Checking and installing the database...");
await initializeDatabase();
const sosNotificationWorker = await initializeSosNotificationWorker();
const locationRetentionWorker = await initializeLocationRetentionWorker();
const server = app.listen(port, () => console.log(`GlucoTrack backend listening on ${port}`));

let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}; stopping background workers...`);
  await sosNotificationWorker?.stop();
  await locationRetentionWorker?.stop();
  server.close(() => process.exit(0));
};
process.once("SIGINT", () => { void shutdown("SIGINT"); });
process.once("SIGTERM", () => { void shutdown("SIGTERM"); });

async function initializeSosNotificationWorker() {
  const enabled = envBoolean("SOS_WORKER_ENABLED", true);
  if (!enabled) {
    console.info("SOS notification worker disabled");
    return null;
  }

  try {
    let pushProvider = null;
    let tokenCipher = null;
    const pushConfigured = Boolean(
      process.env.PUSH_TOKEN_ENCRYPTION_KEY &&
      process.env.FCM_PROJECT_ID && process.env.FCM_PRIVATE_KEY && process.env.FCM_CLIENT_EMAIL &&
      process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_BUNDLE_ID && process.env.APNS_PRIVATE_KEY
    );
    if (pushConfigured) {
      tokenCipher = createPushTokenCipher(process.env.PUSH_TOKEN_ENCRYPTION_KEY);
      const [fcmProvider, apnsProvider] = await Promise.all([
        createFcmPushProvider(),
        createApnsPushProvider()
      ]);
      pushProvider = createPlatformPushProvider({ fcmProvider, apnsProvider });
    }
    const deliveryService = createPushDeliveryService({
      notificationRepository: createSosNotificationRepository(pool.query),
      sosNotificationService,
      settingsService: sosSettingsService,
      notificationProviderSettingsService,
      tokenCipher,
      pushProvider
    });
    const worker = createSosNotificationWorker({
      deliveryService,
      enabled: true,
      intervalSeconds: envNumber("SOS_WORKER_INTERVAL_SECONDS", 30),
      logger: console
    });
    await worker.start();
    return worker;
  } catch (error) {
    console.error("SOS notification worker unavailable", { message: String(error?.message ?? error).slice(0, 160) });
    return null;
  }
}

async function initializeLocationRetentionWorker() {
  if (!envBoolean("LOCATION_RETENTION_ENABLED", false)) {
    console.info("Location retention cleanup disabled");
    return null;
  }

  try {
    const worker = createLocationRetentionWorker({
      retentionService: createLocationRetentionService({ locationRepository }),
      enabled: true,
      intervalHours: envNumber("LOCATION_CLEANUP_INTERVAL_HOURS", 24),
      logger: console
    });
    await worker.start();
    return worker;
  } catch (error) {
    console.error("Location retention cleanup unavailable", error);
    return null;
  }
}


async function sosSettings(options = {}) {
  return sosSettingsService.effectiveSettings(options);
}

function parseSosSetting(def, value) {
  let parsed = value;
  try { parsed = JSON.parse(value); } catch {}
  if (def.type === "boolean") return parsed === true || parsed === 1 || parsed === "1" || parsed === "true";
  if (def.type === "integer") {
    const numeric = Number(parsed);
    return Number.isInteger(numeric) && numeric >= def.min && numeric <= def.max ? numeric : def.defaultValue;
  }
  if (def.type === "enum") return def.values.includes(String(parsed)) ? String(parsed) : def.defaultValue;
  return def.defaultValue;
}

async function gdprSettingInt(key) {
  const rule = USER_GDPR_SETTINGS[key];
  if (!rule) throw new Error("unknown GDPR setting");
  const result = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key=$1", [key]);
  const value = Number(result.rows[0]?.setting_value);
  return Number.isInteger(value) && value >= rule.min && value <= rule.max ? value : rule.defaultValue;
}

async function cleanupExpiredGdprExports() {
  const expired = await pool.query("SELECT id, storage_path FROM gdpr_request_files WHERE file_type='export' AND deleted_at IS NULL AND expires_at < UTC_TIMESTAMP() LIMIT 100");
  for (const file of expired.rows) {
    try {
      const safePath = await safeUserGdprExportPath(file.storage_path);
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

async function userGdprRequest(userId, id) {
  const result = await pool.query("SELECT * FROM gdpr_requests WHERE user_id=$1 AND (public_id=$2 OR id=$3)", [userId, id, id]);
  const request = result.rows[0];
  if (!request) {
    const error = new Error("gdpr request not found");
    error.statusCode = 404;
    throw error;
  }
  return request;
}

async function safeUserGdprExportPath(value) {
  const root = await fs.realpath(GDPR_EXPORT_DIR);
  const target = await fs.realpath(value);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("forbidden export path");
  return target;
}

function authGuard(req, res, next) {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return res.status(401).json({ error: "unauthorized" });
  try {
    req.user = jwt.verify(header.slice(7), jwtSecret());
    next();
  } catch {
    res.status(401).json({ error: "invalid or expired token" });
  }
}

async function premiumGuard(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT premium_status, premium_until, subscription_status,
         subscription_expires_at, trial_ends_at FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!subscriptionPayload(result.rows[0] ?? {}).premium) {
      return res.status(403).json({ error: "premium subscription required" });
    }
    next();
  } catch (error) {
    next(error);
  }
}

function healthSnapshotPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  if (
    body.payload &&
    typeof body.payload === "object" &&
    !Array.isArray(body.payload)
  ) {
    return body.payload;
  }
  return body;
}

function authPayload(user) {
  return {
    token: jwt.sign(
      { id: String(user.id), email: user.email },
      jwtSecret(),
      { expiresIn: process.env.JWT_EXPIRES_IN ?? "30d" }
    ),
    user: publicUser(user)
  };
}

function publicUser(user) {
  return {
    id: String(user.id),
    email: user.email,
    fullName: user.full_name,
    profile: {
      diabetesType: user.diabetes_type ?? null,
      glucoseUnit: user.glucose_unit ?? null,
      onboardingCompleted: Boolean(user.diabetes_type && user.glucose_unit)
    },
    emailVerified: user.email_verified === 1 || user.email_verified === true,
    ...subscriptionPayload(user)
  };
}

function subscriptionPayload(row) {
  const status = row.subscription_status ?? row.premium_status ?? "inactive";
  const subscriptionUntil = row.subscription_expires_at ?? row.premium_until ?? null;
  const trialUntil = row.trial_ends_at ?? (status === "trialing" ? row.premium_until : null);
  const now = Date.now();
  const trialActive = Boolean(trialUntil && new Date(trialUntil).getTime() > now);
  const paidActive = status === "active" &&
    (!subscriptionUntil || new Date(subscriptionUntil).getTime() > now);
  const accessStatus = paidActive ? "subscribed" : trialActive ? "trial_active" :
    row.trial_used ? "trial_expired" : "free";
  return {
    premium: paidActive || trialActive,
    premiumStatus: paidActive ? "active" : trialActive ? "trialing" : "inactive",
    premiumPlan: row.premium_plan ?? null,
    premiumUntil: paidActive ? subscriptionUntil : trialActive ? trialUntil : null,
    accessStatus,
    trialStartedAt: row.trial_started_at ?? null,
    trialEndsAt: row.trial_ends_at ?? null,
    trialUsed: row.trial_used === 1 || row.trial_used === true,
    emailVerified: row.email_verified === 1 || row.email_verified === true
  };
}

function sanitizeDeviceHash(value) {
  const hash = cleanText(value, 128);
  return /^[A-Za-z0-9:_-]{16,128}$/.test(hash) ? hash : null;
}

async function registerTrialDevice(userId, value) {
  const deviceHash = sanitizeDeviceHash(value);
  if (!deviceHash) return;
  await pool.query(
    `INSERT INTO trial_devices(user_id, device_hash, first_seen_at, last_seen_at, trial_used)
     VALUES($1, $2, UTC_TIMESTAMP(), UTC_TIMESTAMP(), FALSE)
     ON DUPLICATE KEY UPDATE last_seen_at = UTC_TIMESTAMP()`,
    [userId, deviceHash]
  );
}

function hashToken(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function verifyEmailToken(value) {
  const token = cleanText(value, 256);
  if (token.length < 32) return false;
  const result = await pool.query(
    `UPDATE users SET email_verified = TRUE, email_verification_token_hash = NULL,
       email_verification_expires_at = NULL
     WHERE email_verification_token_hash = $1
       AND email_verification_expires_at > UTC_TIMESTAMP()`,
    [hashToken(token)]
  );
  return result.rowCount > 0;
}

async function issueEmailVerification(user, requestedLocale) {
  const locale = supportedLocale(requestedLocale);
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `UPDATE users SET email_verification_token_hash = $1,
       email_verification_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR)
     WHERE id = $2 AND email_verified = FALSE`,
    [hashToken(token), user.id]
  );
  const publicBase = (process.env.PUBLIC_BASE_URL ?? "https://glukotrack.com/api").replace(/\/$/, "");
  const verificationUrl = `${publicBase}/auth/email/verify?token=${encodeURIComponent(token)}&lang=${locale}`;
  await sendVerificationEmail(user.email, user.full_name, verificationUrl);
}

async function issuePasswordReset(user, requestedLocale) {
  const locale = supportedLocale(requestedLocale);
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `UPDATE users SET password_reset_token_hash = $1,
       password_reset_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR)
     WHERE id = $2`,
    [hashToken(token), user.id]
  );
  const publicBase = (process.env.PUBLIC_BASE_URL ?? "https://glukotrack.com/api").replace(/\/$/, "");
  const resetUrl = `${publicBase}/auth/password/reset?token=${encodeURIComponent(token)}&lang=${locale}`;
  await sendPasswordResetEmail(user.email, user.full_name, resetUrl);
}

let mailTransport;
function getMailTransport() {
  if (!mailTransport) {
    const smtpHost = process.env.SMTP_HOST ?? "127.0.0.1";
    const localSmtp = smtpHost === "127.0.0.1" || smtpHost === "localhost";
    mailTransport = nodemailer.createTransport({
      host: smtpHost,
      port: envNumber("SMTP_PORT", 25),
      secure: envBoolean("SMTP_SECURE", false),
      ignoreTLS: envBoolean("SMTP_IGNORE_TLS", localSmtp),
      ...(process.env.SMTP_USER ? {
        auth: { user: process.env.SMTP_USER, pass: requiredEnv("SMTP_PASSWORD") }
      } : {})
    });
  }
  return mailTransport;
}

async function sendVerificationEmail(email, name, verificationUrl) {
  await getMailTransport().sendMail({
    from: process.env.EMAIL_FROM ?? "GlucoTrack <support@glukotrack.com>",
    to: email,
    subject: "GlucoTrack",
    text: verificationUrl,
    html: `<p><a href="${escapeHtml(verificationUrl)}">GlucoTrack</a></p>`
  });
}

async function sendPasswordResetEmail(email, name, resetUrl) {
  await getMailTransport().sendMail({
    from: process.env.EMAIL_FROM ?? "GlucoTrack <support@glukotrack.com>",
    to: email,
    subject: "GlucoTrack",
    text: resetUrl,
    html: `<p><a href="${escapeHtml(resetUrl)}">GlucoTrack</a></p>`
  });
}

async function sendFamilyInvitationEmail({ email, inviteCode, locale }) {
  const language = supportedLocale(locale);
  const message = FAMILY_INVITATION_EMAIL[language] ?? FAMILY_INVITATION_EMAIL.en;
  const appUrl = (process.env.APP_PUBLIC_URL ?? "https://glukotrack.com/app/").replace(/\/$/, "");
  const invitationUrl = familyInvitationUrl(inviteCode);
  const safeCode = escapeHtml(inviteCode);
  const safeAppUrl = escapeHtml(appUrl);
  if (!mailTransport) {
    const smtpHost = process.env.SMTP_HOST ?? "127.0.0.1";
    const localSmtp = smtpHost === "127.0.0.1" || smtpHost === "localhost";
    mailTransport = nodemailer.createTransport({
      host: smtpHost,
      port: envNumber("SMTP_PORT", 25),
      secure: envBoolean("SMTP_SECURE", false),
      ignoreTLS: envBoolean("SMTP_IGNORE_TLS", localSmtp),
      tls: { rejectUnauthorized: envBoolean("SMTP_REJECT_UNAUTHORIZED", true) },
      ...(process.env.SMTP_USER ? {
        auth: { user: process.env.SMTP_USER, pass: requiredEnv("SMTP_PASSWORD") }
      } : {})
    });
  }
  return mailTransport.sendMail({
    from: process.env.EMAIL_FROM ?? "GlucoTrack <support@glukotrack.com>",
    to: email,
    subject: message.subject,
    text: `${message.title}\n\n${message.body}\n\n${message.code}: ${inviteCode}\n${message.expires}\n\n${invitationUrl}`,
    html: `<main><h1>${escapeHtml(message.title)}</h1><p>${escapeHtml(message.body)}</p><p><a href="${escapeHtml(invitationUrl)}" style="display:inline-block;padding:12px 18px;background:#0b7cff;color:#fff;border-radius:8px;text-decoration:none">РџСЂРёРЅСЏС‚СЊ СЃРµРјРµР№РЅС‹Р№ РґРѕСЃС‚СѓРї</a></p><p><strong>${escapeHtml(message.code)}:</strong> ${safeCode}</p><p>${escapeHtml(message.expires)}</p><p>${safeAppUrl}</p></main>`,
  });
}

function familyInvitationUrl(inviteCode) {
  const publicOrigin = (process.env.APP_PUBLIC_ORIGIN ?? "https://glukotrack.com").replace(/\/$/, "");
  return `${publicOrigin}/api/family/invite/${encodeURIComponent(inviteCode)}`;
}

const FAMILY_INVITATION_EMAIL = {
  en: {
    subject: "You have been invited to GlucoTrack",
    title: "You have been invited to GlucoTrack",
    body: "Tap the button below, sign in to your own account, and accept family access.",
    code: "Invitation code",
    expires: "The invitation expires in 72 hours.",
  },
  ru: {
    subject: "Р’Р°СЃ РїСЂРёРіР»Р°СЃРёР»Рё РІ GlucoTrack",
    title: "Р’Р°СЃ РїСЂРёРіР»Р°СЃРёР»Рё РІ GlucoTrack",
    body: "РќР°Р¶РјРёС‚Рµ РєРЅРѕРїРєСѓ РЅРёР¶Рµ, РІРѕР№РґРёС‚Рµ РІ СЃРІРѕР№ Р°РєРєР°СѓРЅС‚ Рё РїСЂРёРјРёС‚Рµ СЃРµРјРµР№РЅС‹Р№ РґРѕСЃС‚СѓРї.",
    code: "РљРѕРґ РїСЂРёРіР»Р°С€РµРЅРёСЏ",
    expires: "РЎСЂРѕРє РґРµР№СЃС‚РІРёСЏ РїСЂРёРіР»Р°С€РµРЅРёСЏ вЂ” 72 С‡Р°СЃР°.",
  },
  pl: {
    subject: "ZostaЕ‚eЕ› zaproszony do GlucoTrack",
    title: "ZostaЕ‚eЕ› zaproszony do GlucoTrack",
    body: "OtwГіrz GlucoTrack i wpisz ten kod zaproszenia, aby zaakceptowaД‡ dostД™p.",
    code: "Kod zaproszenia",
    expires: "Zaproszenie wygasa za 7 dni.",
  },
};

const SUPPORTED_LOCALES = new Set(["en","de","fr","es","it","pl","uk","ru","pt","nl","ro","cs","sk","hu","sv","da","fi","no","el","tr","bg","hr","sl","lt","lv","et","sr","sq","mk","is"]);
function supportedLocale(value) {
  const locale = String(value ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LOCALES.has(locale) ? locale : "en";
}

const PASSWORD_PAGE_VALUES = {
  en:["Enter a new password of at least 8 characters.","Save new password","SavingвЂ¦","Password changed. You can return to GlukoTrack.","The link is invalid or expired."],
  de:["Geben Sie ein neues Passwort mit mindestens 8 Zeichen ein.","Neues Passwort speichern","Wird gespeichertвЂ¦","Passwort geГ¤ndert. Sie kГ¶nnen zu GlukoTrack zurГјckkehren.","Der Link ist ungГјltig oder abgelaufen."],
  fr:["Saisissez un nouveau mot de passe dвЂ™au moins 8 caractГЁres.","Enregistrer le nouveau mot de passe","EnregistrementвЂ¦","Mot de passe modifiГ©. Vous pouvez revenir Г  GlukoTrack.","Le lien est invalide ou a expirГ©."],
  es:["Introduzca una nueva contraseГ±a de al menos 8 caracteres.","Guardar nueva contraseГ±a","GuardandoвЂ¦","ContraseГ±a cambiada. Puede volver a GlukoTrack.","El enlace no es vГЎlido o ha caducado."],
  it:["Inserisci una nuova password di almeno 8 caratteri.","Salva nuova password","SalvataggioвЂ¦","Password modificata. Puoi tornare a GlukoTrack.","Il link non ГЁ valido o ГЁ scaduto."],
  pl:["WprowadЕє nowe hasЕ‚o skЕ‚adajД…ce siД™ z co najmniej 8 znakГіw.","Zapisz nowe hasЕ‚o","ZapisywanieвЂ¦","HasЕ‚o zmienione. MoЕјesz wrГіciД‡ do GlukoTrack.","Link jest nieprawidЕ‚owy lub wygasЕ‚."],
  uk:["Р’РІРµРґС–С‚СЊ РЅРѕРІРёР№ РїР°СЂРѕР»СЊ С‰РѕРЅР°Р№РјРµРЅС€Рµ Р· 8 СЃРёРјРІРѕР»С–РІ.","Р—Р±РµСЂРµРіС‚Рё РЅРѕРІРёР№ РїР°СЂРѕР»СЊ","Р—Р±РµСЂРµР¶РµРЅРЅСЏвЂ¦","РџР°СЂРѕР»СЊ Р·РјС–РЅРµРЅРѕ. РњРѕР¶РЅР° РїРѕРІРµСЂРЅСѓС‚РёСЃСЏ РґРѕ GlukoTrack.","РџРѕСЃРёР»Р°РЅРЅСЏ РЅРµРґС–Р№СЃРЅРµ Р°Р±Рѕ РїСЂРѕСЃС‚СЂРѕС‡РµРЅРµ."],
  ru:["Р’РІРµРґРёС‚Рµ РЅРѕРІС‹Р№ РїР°СЂРѕР»СЊ РґР»РёРЅРѕР№ РЅРµ РјРµРЅРµРµ 8 СЃРёРјРІРѕР»РѕРІ.","РЎРѕС…СЂР°РЅРёС‚СЊ РЅРѕРІС‹Р№ РїР°СЂРѕР»СЊ","РЎРѕС…СЂР°РЅРµРЅРёРµвЂ¦","РџР°СЂРѕР»СЊ РёР·РјРµРЅС‘РЅ. РњРѕР¶РЅРѕ РІРµСЂРЅСѓС‚СЊСЃСЏ РІ GlukoTrack.","РЎСЃС‹Р»РєР° РЅРµРґРµР№СЃС‚РІРёС‚РµР»СЊРЅР° РёР»Рё СѓСЃС‚Р°СЂРµР»Р°."],
  pt:["Introduza uma nova palavra-passe com pelo menos 8 caracteres.","Guardar nova palavra-passe","A guardarвЂ¦","Palavra-passe alterada. Pode voltar ao GlukoTrack.","A ligaГ§ГЈo Г© invГЎlida ou expirou."],
  nl:["Voer een nieuw wachtwoord van minimaal 8 tekens in.","Nieuw wachtwoord opslaan","OpslaanвЂ¦","Wachtwoord gewijzigd. U kunt terugkeren naar GlukoTrack.","De link is ongeldig of verlopen."],
  ro:["IntroduceИ›i o parolДѓ nouДѓ de cel puИ›in 8 caractere.","SalvaИ›i parola nouДѓ","Se salveazДѓвЂ¦","Parola a fost schimbatДѓ. PuteИ›i reveni la GlukoTrack.","Linkul este invalid sau a expirat."],
  cs:["Zadejte novГ© heslo o dГ©lce alespoЕ€ 8 znakЕЇ.","UloЕѕit novГ© heslo","UklГЎdГЎnГ­вЂ¦","Heslo bylo zmД›nД›no. MЕЇЕѕete se vrГЎtit do GlukoTrack.","Odkaz je neplatnГЅ nebo vyprЕЎel."],
  sk:["Zadajte novГ© heslo s najmenej 8 znakmi.","UloЕѕiЕҐ novГ© heslo","UkladanieвЂ¦","Heslo bolo zmenenГ©. MГґЕѕete sa vrГЎtiЕҐ do GlukoTrack.","Odkaz je neplatnГЅ alebo vyprЕЎal."],
  hu:["Adjon meg egy legalГЎbb 8 karakteres Гєj jelszГіt.","Гљj jelszГі mentГ©se","MentГ©sвЂ¦","A jelszГі megvГЎltozott. VisszatГ©rhet a GlukoTrackhez.","A hivatkozГЎs Г©rvГ©nytelen vagy lejГЎrt."],
  sv:["Ange ett nytt lГ¶senord med minst 8 tecken.","Spara nytt lГ¶senord","SpararвЂ¦","LГ¶senordet har Г¤ndrats. Du kan ГҐtergГҐ till GlukoTrack.","LГ¤nken Г¤r ogiltig eller har upphГ¶rt."],
  da:["Indtast en ny adgangskode pГҐ mindst 8 tegn.","Gem ny adgangskode","GemmerвЂ¦","Adgangskoden er Г¦ndret. Du kan vende tilbage til GlukoTrack.","Linket er ugyldigt eller udlГёbet."],
  fi:["Anna uusi vГ¤hintГ¤Г¤n 8 merkin salasana.","Tallenna uusi salasana","TallennetaanвЂ¦","Salasana vaihdettu. Voit palata GlukoTrackiin.","Linkki on virheellinen tai vanhentunut."],
  no:["Skriv inn et nytt passord pГҐ minst 8 tegn.","Lagre nytt passord","LagrerвЂ¦","Passordet er endret. Du kan gГҐ tilbake til GlukoTrack.","Lenken er ugyldig eller utlГёpt."],
  el:["О•О№ПѓО±ОіО¬ОіОµП„Оµ ОЅО­Ої ОєП‰ОґО№ОєПЊ ПЂПЃПЊПѓОІО±ПѓО·П‚ П„ОїП…О»О¬П‡О№ПѓП„ОїОЅ 8 П‡О±ПЃО±ОєП„О®ПЃП‰ОЅ.","О‘ПЂОїОёО®ОєОµП…ПѓО· ОЅО­ОїП… ОєП‰ОґО№ОєОїПЌ","О‘ПЂОїОёО®ОєОµП…ПѓО·вЂ¦","Оџ ОєП‰ОґО№ОєПЊП‚ О¬О»О»О±ОѕОµ. ОњПЂОїПЃОµОЇП„Оµ ОЅО± ОµПЂО№ПѓП„ПЃО­П€ОµП„Оµ ПѓП„Ої GlukoTrack.","Оџ ПѓПЌОЅОґОµПѓОјОїП‚ ОґОµОЅ ОµОЇОЅО±О№ О­ОіОєП…ПЃОїП‚ О® О­П‡ОµО№ О»О®ОѕОµО№."],
  tr:["En az 8 karakterli yeni bir parola girin.","Yeni parolayД± kaydet","KaydediliyorвЂ¦","Parola deДџiЕџtirildi. GlukoTrackвЂ™e dГ¶nebilirsiniz.","BaДџlantД± geГ§ersiz veya sГјresi dolmuЕџ."],
  bg:["Р’СЉРІРµРґРµС‚Рµ РЅРѕРІР° РїР°СЂРѕР»Р° СЃ РїРѕРЅРµ 8 Р·РЅР°РєР°.","Р—Р°РїР°Р·РІР°РЅРµ РЅР° РЅРѕРІР°С‚Р° РїР°СЂРѕР»Р°","Р—Р°РїР°Р·РІР°РЅРµвЂ¦","РџР°СЂРѕР»Р°С‚Р° Рµ РїСЂРѕРјРµРЅРµРЅР°. РњРѕР¶РµС‚Рµ РґР° СЃРµ РІСЉСЂРЅРµС‚Рµ РІ GlukoTrack.","Р’СЂСЉР·РєР°С‚Р° Рµ РЅРµРІР°Р»РёРґРЅР° РёР»Рё РёР·С‚РµРєР»Р°."],
  hr:["Unesite novu lozinku od najmanje 8 znakova.","Spremi novu lozinku","SpremanjeвЂ¦","Lozinka je promijenjena. MoЕѕete se vratiti u GlukoTrack.","Poveznica nije valjana ili je istekla."],
  sl:["Vnesite novo geslo z vsaj 8 znaki.","Shrani novo geslo","ShranjevanjeвЂ¦","Geslo je spremenjeno. Lahko se vrnete v GlukoTrack.","Povezava ni veljavna ali je potekla."],
  lt:["Д®veskite naujД… bent 8 simboliЕі slaptaЕѕodДЇ.","IЕЎsaugoti naujД… slaptaЕѕodДЇ","IЕЎsaugomaвЂ¦","SlaptaЕѕodis pakeistas. Galite grДЇЕѕti ДЇ GlukoTrack.","Nuoroda netinkama arba nebegalioja."],
  lv:["Ievadiet jaunu paroli ar vismaz 8 rakstzД«mД“m.","SaglabДЃt jauno paroli","SaglabДЃвЂ¦","Parole mainД«ta. Varat atgriezties GlukoTrack.","Saite nav derД«ga vai ir beidzies tДЃs termiЕ†ЕЎ."],
  et:["Sisestage uus vГ¤hemalt 8 tГ¤hemГ¤rgi pikkune parool.","Salvesta uus parool","SalvestamineвЂ¦","Parool on muudetud. VГµite naasta GlukoTracki.","Link on vigane vГµi aegunud."],
  sr:["РЈРЅРµСЃРёС‚Рµ РЅРѕРІСѓ Р»РѕР·РёРЅРєСѓ РѕРґ РЅР°СРјР°СљРµ 8 Р·РЅР°РєРѕРІР°.","РЎР°С‡СѓРІР°С РЅРѕРІСѓ Р»РѕР·РёРЅРєСѓ","Р§СѓРІР°СљРµвЂ¦","Р›РѕР·РёРЅРєР° СРµ РїСЂРѕРјРµСљРµРЅР°. РњРѕР¶РµС‚Рµ СЃРµ РІСЂР°С‚РёС‚Рё Сѓ GlukoTrack.","Р’РµР·Р° СРµ РЅРµРІР°Р¶РµС›Р° РёР»Рё СРµ РёСЃС‚РµРєР»Р°."],
  sq:["Vendosni njГ« fjalГ«kalim tГ« ri me tГ« paktГ«n 8 shenja.","Ruaj fjalГ«kalimin e ri","Duke ruajturвЂ¦","FjalГ«kalimi u ndryshua. Mund tГ« ktheheni te GlukoTrack.","Lidhja Г«shtГ« e pavlefshme ose ka skaduar."],
  mk:["Р’РЅРµСЃРµС‚Рµ РЅРѕРІР° Р»РѕР·РёРЅРєР° РѕРґ РЅР°СРјР°Р»РєСѓ 8 Р·РЅР°С†Рё.","Р—Р°С‡СѓРІР°С РЅРѕРІР° Р»РѕР·РёРЅРєР°","Р—Р°С‡СѓРІСѓРІР°СљРµвЂ¦","Р›РѕР·РёРЅРєР°С‚Р° Рµ СЃРјРµРЅРµС‚Р°. РњРѕР¶Рµ РґР° СЃРµ РІСЂР°С‚РёС‚Рµ РІРѕ GlukoTrack.","Р’СЂСЃРєР°С‚Р° Рµ РЅРµРІР°Р¶РµС‡РєР° РёР»Рё РёСЃС‚РµС‡РµРЅР°."],
  is:["SlГЎГ°u inn nГЅtt lykilorГ° meГ° aГ° minnsta kosti 8 stГ¶fum.","Vista nГЅtt lykilorГ°","VistaвЂ¦","LykilorГ°inu var breytt. ГћГє getur fariГ° aftur Г­ GlukoTrack.","Tengillinn er Гіgildur eГ°a Гєtrunninn."]
};
const PASSWORD_PAGE_KEYS = ["prompt", "save", "saving", "changed", "invalidLink"];
const PASSWORD_PAGE_I18N = Object.fromEntries(
  Object.entries(PASSWORD_PAGE_VALUES).map(([locale, values]) => [
    locale,
    Object.fromEntries(PASSWORD_PAGE_KEYS.map((key, index) => [key, values[index]]))
  ])
);

function renderPasswordResetPage(token, requestedLocale) {
  const safeToken = JSON.stringify(token);
  const locale = supportedLocale(requestedLocale);
  const strings = PASSWORD_PAGE_I18N[locale];
  const i18n = JSON.stringify(strings).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GlukoTrack</title><style>body{font-family:Arial;background:#f4f8fc;margin:0;padding:24px;color:#182230}.card{max-width:440px;margin:8vh auto;background:white;padding:24px;border-radius:16px;box-shadow:0 8px 30px #0002}input,button{box-sizing:border-box;width:100%;padding:13px;margin-top:12px;font-size:16px;border-radius:8px}button{border:0;background:#075bbb;color:white;font-weight:700}.ok{color:#027a48}.error{color:#b42318}</style></head><body><main class="card"><h1>GlukoTrack</h1><p>${escapeHtml(strings.prompt)}</p><form id="form"><input id="password" aria-label="${escapeHtml(strings.prompt)}" type="password" minlength="8" maxlength="128" autocomplete="new-password" required><button type="submit">${escapeHtml(strings.save)}</button></form><p id="status" role="status"></p></main><script>const token=${safeToken},i18n=${i18n};document.getElementById('form').addEventListener('submit',async e=>{e.preventDefault();const status=document.getElementById('status');status.textContent=i18n.saving;status.className='';try{const r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password:document.getElementById('password').value})});if(!r.ok)throw new Error();status.textContent=i18n.changed;status.className='ok';e.target.remove();}catch(_){status.textContent=i18n.invalidLink;status.className='error';}});</script></body></html>`;
}

function deviceLimit(plan) {
  return plan === "family" ? 8 : 3;
}

function normalizeErrorCode(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "UNKNOWN_ERROR";
}

function sanitizeDevice(value) {
  const id = cleanText(value?.id, 128);
  if (id.length < 8) return null;
  return {
    id,
    name: cleanText(value?.name, 120) || "GlucoTrack device",
    platform: cleanText(value?.platform, 32) || "unknown",
    fingerprint: cleanText(value?.fingerprint, 512)
  };
}

async function registerAccountDevice(userId, value, { enforceLimit = false } = {}) {
  const device = sanitizeDevice(value);
  if (!device) return { id: null };
  const fingerprintHash = createHash("sha256")
    .update(`${userId}|${device.platform}|${device.name}|${device.fingerprint || device.id}`)
    .digest("hex");
  return pool.transaction(async (query) => {
    const subscriptionResult = await query(
      "SELECT premium_plan FROM users WHERE id = $1 FOR UPDATE", [userId]
    );
    const known = await query(
      `SELECT device_id FROM account_devices
       WHERE user_id = $1 AND (device_id = $2 OR fingerprint_hash = $3 OR
         (fingerprint_hash IS NULL AND platform = $4 AND device_name = $5))
       ORDER BY revoked_at IS NULL DESC, last_seen_at DESC LIMIT 1`,
      [userId, device.id, fingerprintHash, device.platform, device.name]
    );
    const canonicalId = known.rows[0]?.device_id ?? device.id;
  if (enforceLimit) {
    const existing = await query(
      "SELECT revoked_at FROM account_devices WHERE user_id = $1 AND device_id = $2",
      [userId, canonicalId]
    );
    if (!existing.rowCount || existing.rows[0].revoked_at) {
      const countResult = await query(
        "SELECT COUNT(*) AS count FROM account_devices WHERE user_id = $1 AND revoked_at IS NULL",
        [userId]
      );
      const activeCount = Number(countResult.rows[0]?.count ?? 0);
      if (activeCount >= deviceLimit(subscriptionResult.rows[0]?.premium_plan)) {
        return false;
      }
    }
  }
  await query(
    `INSERT INTO account_devices(
       user_id, device_id, device_name, platform, fingerprint_hash, last_seen_at, revoked_at
     ) VALUES($1, $2, $3, $4, $5, NOW(), NULL)
     ON DUPLICATE KEY UPDATE
       device_name = VALUES(device_name), platform = VALUES(platform),
       fingerprint_hash = VALUES(fingerprint_hash), last_seen_at = NOW(), revoked_at = NULL`,
    [userId, canonicalId, device.name, device.platform, fingerprintHash]
  );
    return { id: canonicalId };
  });
}

async function touchAccountDevice(userId, deviceIdValue) {
  const deviceId = cleanText(deviceIdValue, 128);
  if (!deviceId) return;
  await pool.query(
    "UPDATE account_devices SET last_seen_at = NOW() WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL",
    [userId, deviceId]
  );
}

async function accountDevices(userId) {
  const result = await pool.query(
    `SELECT id, device_id, device_name, platform, last_seen_at, created_at
     FROM account_devices
     WHERE user_id = $1 AND revoked_at IS NULL
     ORDER BY last_seen_at DESC`,
    [userId]
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    deviceId: row.device_id,
    name: row.device_name,
    platform: row.platform,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at
  }));
}

function reportSummary(row) {
  return {
    id: String(row.id),
    title: row.title,
    metadata: row.metadata ?? {},
    createdAt: row.created_at
  };
}

function familyLink(row) {
  const emailSent = row.email_sent === true || Number(row.email_sent) === 1;
  const inviteCode = row.inviteCode ?? row.invite_code ?? null;
  return {
    id: String(row.id),
    email: row.invite_email,
    fullName: row.full_name ?? row.member_name ?? null,
    inviteCode,
    invitationUrl: inviteCode ? familyInvitationUrl(inviteCode) : null,
    emailSent,
    emailSentAt: row.email_sent_at ?? null,
    emailError: row.email_error ?? null,
    permissions: sanitizePermissions(row.permissions),
    status: row.status,
    role: row.member_role ?? "guardian",
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at
  };
}

function patientSummary(row) {
  const snapshot = row.payload?.payload ?? row.payload ?? {};
  const profile = snapshot.profile ?? {};
  const permissions = sanitizePermissions(row.permissions);
  const latest = latestFamilyGlucose(snapshot);
  const sosGlucose = Number(row.sos_glucose);
  const sosMeasuredAt = row.sos_glucose_at ?? null;
  const sosMeasuredAtDate = sosMeasuredAt == null
    ? null
    : new Date(sosMeasuredAt);
  const latestSos = Number.isFinite(sosGlucose) && sosGlucose > 0 &&
    sosGlucose <= 100
    ? {
        value: sosGlucose,
        measuredAt: sosMeasuredAt,
        measuredAtDate: Number.isNaN(sosMeasuredAtDate?.getTime())
          ? null
          : sosMeasuredAtDate
      }
    : null;
  const presenceGlucose = Number(row.presence_glucose);
  const hasPresenceGlucose = Number.isFinite(presenceGlucose) && presenceGlucose > 0 && presenceGlucose <= 100;
  // A SOS glucose value is a timestamped observation. It must be surfaced to
  // Family Watch when newer than the cached diary/sensor snapshot, without
  // overwriting the patient's clinical diary or profile.
  const glucose = latestSos != null &&
      (latest.measuredAtDate == null ||
        (latestSos.measuredAtDate != null && latestSos.measuredAtDate > latest.measuredAtDate))
    ? latestSos
    : latest.value != null
      ? latest
      : hasPresenceGlucose
        ? { value: presenceGlucose, measuredAt: null, measuredAtDate: null }
        : latest;
  const isOnline = (row.online_status === true || Number(row.online_status) === 1) && isFamilyPresenceOnline(row.last_seen);
  return {
    id: String(row.owner_user_id), fullName: row.full_name, email: row.email, permissions,
    glucoseMmol: permissions.glucose ? glucose.value ?? null : null,
    glucoseUnitPreference: permissions.glucose ? profile.glucoseUnitPreference ?? "mmolL" : "mmolL",
    glucoseMeasuredAt: permissions.glucose ? glucose.measuredAt ?? null : null,
    latestRecords: permissions.history ? familyLatestRecords(snapshot) : null,
    sensor: permissions.glucose ? familySensorStatus(snapshot) : null,
    lastSeenAt: row.last_seen ?? null, isOnline,
    battery: row.battery == null ? null : Number(row.battery), updatedAt: row.updated_at,
    diagnostics: {
      online: isOnline ? null : row.last_seen ? "patient_not_active" : "patient_has_not_signed_in",
      glucose: !permissions.glucose ? "permission_denied" : glucose.value != null ? null : row.updated_at ? "no_measurements" : "not_synced"
    }
  };
}

function isFamilyPresenceOnline(lastSeen, now = Date.now()) {
  const timestamp = new Date(lastSeen ?? 0).getTime();
  return Number.isFinite(timestamp) && timestamp > 0 && now - timestamp <= 150000;
}

function familyLatestRecords(payload) {
  const entries = Array.isArray(payload?.diaryEntries) ? payload.diaryEntries : [];
  const record = (field) => {
    const matches = entries.filter((entry) => Number(entry?.[field]) > 0).sort((a, b) => new Date(b.time) - new Date(a.time));
    if (!matches.length) return null;
    return { value: Number(matches[0][field]), at: matches[0].time };
  };
  const notes = entries.filter((entry) => String(entry?.note ?? "").trim()).sort((a, b) => new Date(b.time) - new Date(a.time));
  return { insulin: record("insulinUnits"), carbohydrates: record("carbs"), note: notes.length ? { value: String(notes[0].note).trim(), at: notes[0].time } : null };
}

function latestSnapshotGlucose(readings) {
  if (!Array.isArray(readings)) return null;
  let latest = null;
  for (const reading of readings) {
    const value = Number(reading?.glucoseMmol);
    if (!Number.isFinite(value) || value <= 0) continue;
    const parsed = new Date(reading?.time);
    const measuredAtDate = Number.isNaN(parsed.getTime()) ? null : parsed;
    if (!latest || (measuredAtDate && (!latest.measuredAtDate || measuredAtDate > latest.measuredAtDate))) latest = { value, measuredAt: typeof reading?.time === "string" ? reading.time : null, measuredAtDate };
  }
  return latest;
}

function latestFamilyGlucose(payload) {
  const profile = payload?.profile ?? {};
  const readings = [...(Array.isArray(payload?.diaryEntries) ? payload.diaryEntries : []), ...(Array.isArray(payload?.sensorReadings) ? payload.sensorReadings : [])];
  const latest = latestSnapshotGlucose(readings);
  if (latest) return latest;
  const fallback = Number(profile.glucoseMmol);
  return Number.isFinite(fallback) && fallback > 0 ? { value: fallback, measuredAt: null } : { value: null, measuredAt: null };
}

function familySensorStatus(payload) {
  const latest = latestSnapshotGlucose(payload?.sensorReadings);
  if (!latest?.measuredAtDate) return { active: false, lastAt: null };
  return { active: Date.now() - latest.measuredAtDate.getTime() <= 20 * 60 * 1000, lastAt: latest.measuredAt };
}

function patientDetails(row) {
  const payload = row.payload?.payload ?? row.payload ?? {};
  const permissions = sanitizePermissions(row.permissions);
  return {
    id: String(row.id), fullName: row.full_name, email: row.email, permissions,
    profile: permissions.glucose ? payload.profile ?? null : null,
    sensorReadings: permissions.history ? payload.sensorReadings ?? [] : [],
    diaryEntries: permissions.history ? payload.diaryEntries ?? [] : [],
    emergency: permissions.emergency ? payload.emergency ?? null : null,
    updatedAt: row.updated_at,
    diagnostics: !permissions.history ? { history: "permission_denied" } : { history: Array.isArray(payload.diaryEntries) || Array.isArray(payload.sensorReadings) ? null : "not_synced" }
  };
}

async function familyAccessPolicy() {
  const defaults = {
    family_access_enabled: true,
    family_trusted_contacts_enabled: true,
    family_invites_enabled: true,
    family_max_members: 5
  };
  const keys = Object.keys(defaults);
  const result = await pool.query(
    `SELECT setting_key,setting_value FROM system_settings WHERE setting_key IN (${keys.map((_, index) => `$${index + 1}`).join(",")})`,
    keys
  );
  for (const row of result.rows) {
    let value = row.setting_value;
    try { value = JSON.parse(row.setting_value); } catch {}
    if (row.setting_key === "family_max_members") {
      const numeric = Number(value);
      defaults.family_max_members = Number.isInteger(numeric) && numeric >= 1 && numeric <= 20 ? numeric : defaults.family_max_members;
    } else if (Object.prototype.hasOwnProperty.call(defaults, row.setting_key)) {
      defaults[row.setting_key] = value === true || value === 1 || value === "1" || value === "true";
    }
  }
  return defaults;
}
function sanitizePermissions(value) {
  const source = value && typeof value === "object" ? value : {};
  const viewInsulin = source.viewInsulin === true || source.insulin === true;
  const viewFood = source.viewFood === true || source.food === true;
  const viewReports = source.viewReports === true || source.reports === true || source.history === true;
  const receiveAlerts = source.receiveAlerts === true || source.alerts === true;
  const sosAccess = source.sosAccess === true || source.emergency === true;
  const viewGlucose = source.glucose !== false && source.viewGlucose !== false;
  return {
    glucose: viewGlucose,
    history: source.history === true || viewInsulin || viewFood || viewReports,
    emergency: sosAccess,
    viewGlucose,
    viewInsulin,
    viewFood,
    viewReports,
    receiveAlerts,
    sosAccess
  };
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function boolValue(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(normalized)) return true;
    if (["false", "no", "n", "0"].includes(normalized)) return false;
  }
  return fallback;
}

function noStore(res) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Surrogate-Control": "no-store"
  });
}

async function findSosProfile(token) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token ?? "")) return null;
  const result = await pool.query(
    `SELECT user_id, public_token, card, pin_hash, hide_sensitive
     FROM sos_profiles WHERE public_token = $1`,
    [token]
  );
  return result.rows[0] ?? null;
}

function sanitizeSosCard(value) {
  const card = value && typeof value === "object" ? value : {};
  const hasAllergy = boolValue(card.hasAllergy, boolValue(card.hasAllergies, false));
  return {
    fullName: cleanText(card.fullName, 120),
    age: Number.isInteger(card.age) && card.age >= 0 && card.age <= 130 ? card.age : 0,
    photoBase64: cleanText(card.photoBase64, 1_500_000),
    diabetesType: ["type1", "type2", "gestational"].includes(card.diabetesType)
      ? card.diabetesType
      : "type1",
    diabetesTreatment: cleanText(card.diabetesTreatment, 500),
    insulinName: cleanText(card.insulinName, 500),
    importantDiagnoses: cleanText(card.importantDiagnoses, 2000),
    hasAllergy,
    hasAllergies: hasAllergy,
    allergyStatusCode: hasAllergy ? "yes" : "no",
    allergyStatus: hasAllergy ? "YES" : "NO",
    allergies: hasAllergy ? cleanText(card.allergies, 2000) : "",
    medications: cleanText(card.medications, 4000),
    contactName: cleanText(card.contactName, 200),
    contactPhone: cleanText(card.contactPhone, 80),
    additionalContacts: cleanText(card.additionalContacts, 2000),
    doctorContact: cleanText(card.doctorContact, 1000),
    bloodType: cleanText(card.bloodType, 40),
    currentGlucose: cleanText(card.currentGlucose, 80),
    currentGlucoseMmol: Number.isFinite(Number(card.currentGlucoseMmol))
      ? Number(card.currentGlucoseMmol)
      : null,
    glucoseUpdatedAt: cleanText(card.glucoseUpdatedAt, 40),
    communicationLanguages: cleanText(card.communicationLanguages, 300),
    instructions: cleanText(card.instructions, 2000),
    languageCode: cleanText(card.languageCode, 16) || "en",
    labels: sanitizeSosLabels(card.labels)
  };
}

const SOS_LABEL_KEYS = [
  "patient", "diabetes", "diabetesType", "type1", "type2", "gestational",
  "treatment", "bloodType", "languages", "call112", "callRelative", "callRelativeWithName",
  "sendSms", "sensitiveHidden", "pinPrompt", "open", "disclaimer", "name",
  "age", "diagnoses", "insulin", "allergies", "allergyStatus",
  "allergyDetails", "medications", "doctor",
  "otherContacts", "checking", "success", "error", "instruction",
  "currentGlucose", "lastUpdated", "noData"
];

const SOS_FALLBACK_LABELS = {
  patient: "Patient GlukoTrack", diabetes: "Diabetes", diabetesType: "Diabetes type",
  type1: "Type 1", type2: "Type 2", gestational: "Gestational",
  treatment: "Treatment", bloodType: "Blood type", languages: "Languages",
  call112: "Call 112", callRelative: "Call emergency contact",
  callRelativeWithName: "Call emergency contact: {name}",
  sendSms: "Send SOS SMS with location", sensitiveHidden: "Sensitive data is hidden",
  pinPrompt: "Enter the relative or doctor PIN", open: "Open",
  disclaimer: "GlucoTrack SOS does not replace medical care", name: "Name",
  age: "Age", diagnoses: "Diagnoses", insulin: "Insulin", allergies: "Allergies",
  allergyStatus: "Allergy status", allergyDetails: "Allergy details",
  medications: "Medications", doctor: "Doctor / clinic", otherContacts: "Other contacts",
  checking: "Checking...", success: "Done", error: "The action could not be completed",
  instruction: "If unconscious, call 112. Do not give insulin without checking glucose.",
  currentGlucose: "Current glucose", lastUpdated: "Last updated", noData: "No data"
};

function sanitizeSosLabels(value) {
  const labels = value && typeof value === "object" ? value : {};
  return Object.fromEntries(SOS_LABEL_KEYS.map((key) => [
    key, cleanText(labels[key], 500) || SOS_FALLBACK_LABELS[key]
  ]));
}

function publicSosCard(profile) {
  const card = profile.card ?? {};
  if (!profile.hide_sensitive) return card;
  return {
    fullName: card.labels?.patient ?? SOS_FALLBACK_LABELS.patient,
    age: 0,
    photoBase64: card.photoBase64,
    diabetesType: card.diabetesType,
    diabetesTreatment: card.diabetesTreatment,
    bloodType: card.bloodType,
    hasAllergy: card.hasAllergy === true || card.hasAllergies === true,
    hasAllergies: card.hasAllergy === true || card.hasAllergies === true,
    allergyStatusCode: card.allergyStatusCode,
    allergyStatus: card.allergyStatus,
    currentGlucose: card.currentGlucose,
    currentGlucoseMmol: card.currentGlucoseMmol,
    glucoseUpdatedAt: card.glucoseUpdatedAt,
    communicationLanguages: card.communicationLanguages,
    instructions: card.instructions,
    contactName: card.contactName,
    contactPhone: card.contactPhone,
    languageCode: card.languageCode,
    labels: card.labels
  };
}

function renderSosPage(card, token, locked) {
  const labels = { ...SOS_FALLBACK_LABELS, ...(card.labels ?? {}) };
  const row = (label, value) => value
    ? `<div class="row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`
    : "";
  const photo = card.photoBase64
    ? `<img class="photo" alt="" src="data:image/jpeg;base64,${escapeHtml(card.photoBase64)}">`
    : `<div class="photo placeholder">SOS</div>`;
  const phone = String(card.contactPhone ?? "").replace(/[^\d+]/g, "");
  const contactName = String(card.contactName ?? "").trim();
  const callRelativeLabel = contactName
    ? String(labels.callRelativeWithName || labels.callRelative).replaceAll("{name}", contactName)
    : labels.callRelative;
  return `<!doctype html>
<html lang="${escapeHtml(card.languageCode || "en")}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SOS вЂў GlucoTrack</title>
<style>
body{margin:0;background:#f5f7fa;color:#182230;font-family:Arial,sans-serif}
main{max-width:680px;margin:auto;padding:18px}.head{display:flex;gap:15px;align-items:center}
.photo{width:82px;height:82px;border-radius:50%;object-fit:cover;background:#fee4e2}
.placeholder{display:grid;place-items:center;color:#b42318;font-weight:800}
h1{margin:0;font-size:25px}.warning{background:#fee4e2;border-left:5px solid #b42318;
padding:16px;margin:18px 0;font-size:19px;font-weight:700;line-height:1.4}
.row{background:#fff;padding:13px;margin:7px 0;border-radius:10px;display:grid;
grid-template-columns:145px 1fr;gap:10px}.row span{color:#667085}
.actions{display:grid;gap:10px;margin:18px 0}.btn{display:block;text-align:center;padding:15px;
border-radius:10px;text-decoration:none;font-weight:700;background:#b42318;color:#fff}
.secondary{background:#075bbb}.geo{background:#067647;border:0;font-size:16px}.lock{background:#fff;padding:15px;border-radius:10px}
input{padding:12px;font-size:16px;max-width:150px}button{padding:12px;cursor:pointer}
#unlock-status,#geo-status{margin-top:10px;font-size:14px}.error{color:#b42318}.success{color:#067647}
#private .row{border:1px solid #e4e7ec}@media(max-width:480px){.row{grid-template-columns:1fr}}
@media print{body{background:#fff}main{max-width:105mm;padding:8mm}.actions,.lock{display:none}
.row{break-inside:avoid;border:1px solid #ddd}p{display:none}}
</style></head><body><main>
<div class="head">${photo}<div><h1>${escapeHtml(card.fullName || labels.patient)}</h1>
<b style="color:#b42318">${escapeHtml(labels.diabetes)} вЂў SOS</b></div></div>
<div class="warning">${escapeHtml(card.instructions || labels.instruction)}</div>
${row(labels.currentGlucose, card.currentGlucose || labels.noData)}
${row(labels.lastUpdated, card.glucoseUpdatedAt)}
${row(labels.allergyStatus, card.allergyStatus)}
${row(labels.diabetesType, diabetesLabel(card.diabetesType, labels))}
${row(labels.treatment, card.diabetesTreatment)}
${row(labels.bloodType, card.bloodType)}
${row(labels.languages, card.communicationLanguages)}
<div class="actions"><a class="btn" href="tel:112">${escapeHtml(labels.call112)}</a>
${phone ? `<a class="btn secondary" href="tel:${escapeHtml(phone)}">${escapeHtml(callRelativeLabel)}</a>
<button class="btn geo" id="send-geo-sms" type="button">${escapeHtml(labels.sendSms)}</button>
<div id="geo-status" role="status" aria-live="polite"></div>` : ""}</div>
${locked ? `<div class="lock"><b>${escapeHtml(labels.sensitiveHidden)}</b><p>${escapeHtml(labels.pinPrompt)}</p>
<form id="unlock-form"><input id="pin" name="pin" inputmode="numeric" pattern="[0-9]{4,8}" type="password" minlength="4" maxlength="8" placeholder="PIN" required>
<button id="unlock-button" type="submit">${escapeHtml(labels.open)}</button></form><div id="unlock-status" role="status" aria-live="polite"></div><div id="private"></div></div>` : renderPrivateRows(card, labels)}
<p style="color:#667085;font-size:12px">${escapeHtml(labels.disclaimer)}</p>
</main><script>
const token=${JSON.stringify(token)};const sosPath=location.pathname.replace(/\\/$/,'');
const emergencyPhone=${JSON.stringify(phone)};
const patientName=${JSON.stringify(card.fullName || labels.patient)};
const i18n=${JSON.stringify(labels)};
function scan(pos){fetch(sosPath+'/scan',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify(pos||{})}).catch(()=>{});}
if(navigator.geolocation){navigator.geolocation.getCurrentPosition(
p=>scan({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),
()=>scan({}),{timeout:7000,maximumAge:60000});}else{scan({});}
if(new URLSearchParams(location.search).get('print')==='1'){setTimeout(()=>window.print(),500);}
const geoSmsButton=document.getElementById('send-geo-sms');
if(geoSmsButton)geoSmsButton.addEventListener('click',sendGeoSms);
function setGeoStatus(type,text){const status=document.getElementById('geo-status');if(!status)return;
status.className=type||'';status.textContent=text||'';}
function openSms(message){const separator=/iPad|iPhone|iPod/i.test(navigator.userAgent)?'&':'?';
location.href='sms:'+emergencyPhone+separator+'body='+encodeURIComponent(message);}
function sendGeoSms(){if(!emergencyPhone){setGeoStatus('error',i18n.error);return;}
if(!navigator.geolocation){setGeoStatus('error',i18n.error);return;}
geoSmsButton.disabled=true;setGeoStatus('',i18n.checking);
navigator.geolocation.getCurrentPosition(position=>{const coords=position.coords;
const latitude=Number(coords.latitude).toFixed(6);const longitude=Number(coords.longitude).toFixed(6);
const mapsUrl='https://maps.google.com/?q='+latitude+','+longitude;
const message='SOS GlucoTrack: '+patientName+'. '+latitude+', '+longitude+'. '+mapsUrl+'.';
if(!confirm(i18n.sendSms+'?')){geoSmsButton.disabled=false;setGeoStatus('','');return;}
scan({latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy});
setGeoStatus('success',i18n.success);
openSms(message);setTimeout(()=>{geoSmsButton.disabled=false;},1500);
},()=>{geoSmsButton.disabled=false;setGeoStatus('error',i18n.error);},
{enableHighAccuracy:true,timeout:15000,maximumAge:30000});}
const unlockForm=document.getElementById('unlock-form');
if(unlockForm)unlockForm.addEventListener('submit',unlock);
async function unlock(event){event.preventDefault();const button=document.getElementById('unlock-button');
const status=document.getElementById('unlock-status');button.disabled=true;status.className='';status.textContent=i18n.checking;
try{const response=await fetch(sosPath+'/unlock',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({pin:document.getElementById('pin').value.trim()})});
if(!response.ok){status.className='error';status.textContent=i18n.error;return;}
const data=await response.json();const rows=privateRows(data.card||{});document.getElementById('private').innerHTML=rows;
status.className='success';status.textContent=i18n.success;
document.getElementById('pin').value='';}catch(_){status.className='error';status.textContent=i18n.error;
}finally{button.disabled=false;}}
function esc(v){const d=document.createElement('div');d.textContent=v||'';return d.innerHTML;}
function privateRows(c){return [
[i18n.name,c.fullName],[i18n.age,c.age?String(c.age):''],[i18n.diagnoses,c.importantDiagnoses],
[i18n.insulin,c.insulinName],[i18n.allergyDetails||i18n.allergies,c.allergies],[i18n.medications,c.medications],
[i18n.doctor,c.doctorContact],[i18n.otherContacts,c.additionalContacts]
].filter(x=>x[1]).map(x=>'<div class="row"><span>'+esc(x[0])+'</span><b>'+esc(x[1])+'</b></div>').join('');}
</script></body></html>`;
}

function renderPrivateRows(card, labels = SOS_FALLBACK_LABELS) {
  return [
    [labels.name, card.fullName],
    [labels.age, card.age ? String(card.age) : ""],
    [labels.diagnoses, card.importantDiagnoses],
    [labels.insulin, card.insulinName],
    [labels.allergyDetails || labels.allergies, card.allergies],
    [labels.medications, card.medications],
    [labels.doctor, card.doctorContact],
    [labels.otherContacts, card.additionalContacts]
  ].filter(([, value]) => value).map(([label, value]) =>
    `<div class="row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`
  ).join("");
}

function diabetesLabel(value, labels = SOS_FALLBACK_LABELS) {
  if (value === "type2") return labels.type2;
  if (value === "gestational") return labels.gestational;
  return labels.type1;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function finiteCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function publicBaseUrl(req) {
  return (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

async function notifySosScan(profile, location) {
  const url = process.env.SOS_SCAN_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "sos.qr_scanned",
      userId: String(profile.user_id),
      code: "SOS_QR_SCANNED",
      location,
      scannedAt: new Date().toISOString()
    })
  });
}

async function aiSettings() {
  const keys = Object.keys(AI_SETTING_DEFS);
  const result = await pool.query(`SELECT setting_key,setting_value FROM system_settings WHERE setting_key IN (${keys.map((_, i) => `$${i+1}`).join(",")})`, keys);
  const rows = Object.fromEntries(result.rows.map((row) => [row.setting_key, row.setting_value]));
  const settings = Object.fromEntries(Object.entries(AI_SETTING_DEFS).map(([key, def]) => [key, def.defaultValue]));
  for (const [key, def] of Object.entries(AI_SETTING_DEFS)) if (rows[key] != null) settings[key] = parseAiSetting(def, rows[key]);
  return settings;
}

function parseAiSetting(def, value) {
  let parsed = value;
  try { parsed = JSON.parse(value); } catch {}
  if (def.type === "boolean") return parsed === true || parsed === 1 || parsed === "true";
  if (def.type === "integer") { const n = Number(parsed); return Number.isInteger(n) && n >= def.min && n <= def.max ? n : def.defaultValue; }
  if (def.type === "enum") return def.values.includes(String(parsed)) ? String(parsed) : def.defaultValue;
  if (def.type === "models") return Array.isArray(parsed) ? parsed.map((item) => cleanText(item, 80)).filter(Boolean) : def.defaultValue;
  return cleanText(parsed, 200) || def.defaultValue;
}

async function aiApiKey() {
  const row = (await pool.query("SELECT setting_value FROM system_settings WHERE setting_key='ai_api_key_encrypted' LIMIT 1")).rows[0];
  if (!row) return process.env.OPENAI_API_KEY || "";
  try { return decryptSecret(JSON.parse(row.setting_value)); } catch { return process.env.OPENAI_API_KEY || ""; }
}

function aiSecretKey() { return createHash("sha256").update(process.env.JWT_SECRET || process.env.DB_PASSWORD || "glukotrack").digest(); }
function encryptSecret(value) { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", aiSecretKey(), iv); const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]); return { v: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") }; }
function decryptSecret(payload) { const decipher = createDecipheriv("aes-256-gcm", aiSecretKey(), Buffer.from(payload.iv, "base64")); decipher.setAuthTag(Buffer.from(payload.tag, "base64")); return Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]).toString("utf8"); }

async function configuredOpenAi() { return new OpenAI({ apiKey: await aiApiKey() }); }

async function userPlan(userId) {
  const row = (await pool.query("SELECT premium_plan,premium_status,subscription_status,subscription_expires_at,premium_until FROM users WHERE id=$1", [userId])).rows[0] || {};
  const payload = subscriptionPayload(row);
  if (!payload.premium) return "free";
  const plan = String(row.premium_plan || payload.plan || "premium").toLowerCase();
  if (plan.includes("family")) return "family";
  if (plan.includes("basic")) return "basic";
  if (plan.includes("premium") || plan.includes("monthly") || plan.includes("yearly")) return "premium";
  return "premium";
}

async function aiLimitStatus(userId) {
  const settings = await aiSettings();
  const plan = await userPlan(userId);
  const period = new Date().toISOString().slice(0, 10);
  const counts = await pool.query("SELECT counter_type,COUNT(*) count FROM ai_requests WHERE user_id=$1 AND period_date=UTC_DATE() AND status IN ('reserved','completed') GROUP BY counter_type", [userId]);
  const used = Object.fromEntries(counts.rows.map((row) => [row.counter_type, Number(row.count || 0)]));
  const normalLimit = Number(settings[`ai_limit_${plan}_normal`] ?? 0);
  const photoLimit = Number(settings[`ai_limit_${plan}_photo`] ?? 0);
  const resetAt = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1)).toISOString();
  return { plan, periodDate: period, normal: { limit: normalLimit, remaining: Math.max(0, normalLimit - (used.normal || 0)) }, photo: { limit: photoLimit, remaining: Math.max(0, photoLimit - (used.photo || 0)) }, resetsAt: resetAt };
}

async function reserveAiRequest(req, feature, locale, isPhoto) {
  const settings = await aiSettings();
  if (!settings.ai_enabled) throw Object.assign(new Error("AI_DISABLED"), { statusCode: 403 });
  if (!settings[`ai_feature_${feature}_enabled`]) throw Object.assign(new Error("AI_FEATURE_DISABLED"), { statusCode: 403 });
  const plan = await userPlan(req.user.id);
  const counter = settings[`ai_feature_${feature}_counter`] || (isPhoto ? "photo" : "normal");
  const limit = Number(settings[`ai_limit_${plan}_${counter}`] || 0);
  const before = await pool.transaction(async (query) => {
    await query("INSERT INTO ai_limit_locks(lock_key,touched_at) VALUES($1,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE touched_at=UTC_TIMESTAMP()", [`${req.user.id}:${counter}:${new Date().toISOString().slice(0,10)}`]);
    await query("SELECT lock_key FROM ai_limit_locks WHERE lock_key=$1 FOR UPDATE", [`${req.user.id}:${counter}:${new Date().toISOString().slice(0,10)}`]);
    const used = await query("SELECT COUNT(*) count FROM ai_requests WHERE user_id=$1 AND period_date=UTC_DATE() AND counter_type=$2 AND status IN ('reserved','completed')", [req.user.id, counter]);
    const count = Number(used.rows[0]?.count || 0);
    if (count >= limit) throw Object.assign(new Error("AI_DAILY_LIMIT_EXCEEDED"), { statusCode: 429 });
    const requestId = randomBytes(12).toString("hex");
    const inserted = await query("INSERT INTO ai_requests(user_id,request_type,locale,status,model,request_id,plan,is_photo,period_date,counter_type,limit_before,created_at) VALUES($1,$2,$3,'reserved',$4,$5,$6,$7,UTC_DATE(),$8,$9,UTC_TIMESTAMP())", [req.user.id, feature, cleanText(locale,16)||"en", settings[`ai_feature_${feature}_primary_model`], requestId, plan, counter === "photo" ? 1 : 0, counter, Math.max(0, limit - count)]);
    return { remaining: Math.max(0, limit - count), id: inserted.insertId, requestId };
  });
  return { id: before.id, userId: req.user.id, feature, plan, counter, locale: cleanText(locale,16)||"en", primaryModel: settings[`ai_feature_${feature}_primary_model`], fallbackModel: settings[`ai_feature_${feature}_fallback_model`], fallbackEnabled: Boolean(settings[`ai_feature_${feature}_fallback_enabled`]), maxTokens: Number(settings[`ai_feature_${feature}_max_tokens`] || 1000), limitBefore: before.remaining };
}

async function callAiWithFallback(run, operation) {
  const client = await configuredOpenAi();
  try { const result = await operation(client, run.primaryModel); result.__gtModel = run.primaryModel; result.__gtFallback = false; return result; }
  catch (primaryError) {
    if (!run.fallbackEnabled || !run.fallbackModel || run.fallbackModel === run.primaryModel) { await failAiRequest(run, primaryError); throw primaryError; }
    try { const result = await operation(client, run.fallbackModel); result.__gtModel = run.fallbackModel; result.__gtFallback = true; await pool.query("INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES(NULL,'ai.fallback.used','ai_requests',$1,$2,'system','system')", [String(run.id), JSON.stringify({ feature: run.feature, primaryModel: run.primaryModel, fallbackModel: run.fallbackModel })]); return result; }
    catch (fallbackError) { await failAiRequest(run, fallbackError); throw fallbackError; }
  }
}

async function completeAiRequest(run, response, model) {
  const usage = response?.usage || {};
  const afterStatus = await aiLimitStatus(run.userId);
  const after = run.counter === "photo" ? afterStatus.photo.remaining : afterStatus.normal.remaining;
  await pool.query("UPDATE ai_requests SET status='completed',model=$1,input_tokens=$2,output_tokens=$3,duration_ms=TIMESTAMPDIFF(MICROSECOND,created_at,UTC_TIMESTAMP())/1000,fallback_used=$4,limit_after=$5 WHERE id=$6", [response.__gtModel || model || run.primaryModel, usage.prompt_tokens || usage.input_tokens || null, usage.completion_tokens || usage.output_tokens || null, response.__gtFallback ? 1 : 0, after, run.id]);
}

async function failAiRequest(run, error) {
  await pool.query("UPDATE ai_requests SET status='failed',error_code=$1,duration_ms=TIMESTAMPDIFF(MICROSECOND,created_at,UTC_TIMESTAMP())/1000 WHERE id=$2", [cleanText(error?.code || error?.message || "AI_PROVIDER_FAILED", 64), run.id]).catch(() => {});
}

function openAi() {
  return new OpenAI({ apiKey: requiredEnv("OPENAI_API_KEY") });
}

function transcriptionLanguage(languageCode) {
  const code = cleanText(languageCode, 12).toLowerCase();
  if (!code) return undefined;
  return code.split(/[-_]/)[0] || undefined;
}

let googleVerifier;
let appleKeysCache;

function googleClientIds() {
  const clientIds = (process.env.GOOGLE_CLIENT_ID ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!clientIds.length) throw new Error("Missing required environment variable: GOOGLE_CLIENT_ID");
  return clientIds;
}

function googleOAuthClient() {
  googleVerifier ??= new OAuth2Client();
  return googleVerifier;
}

function appleClientIds() {
  const clientIds = (process.env.APPLE_CLIENT_ID ?? process.env.IOS_BUNDLE_ID ?? "com.example.glucotrack")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!clientIds.length) throw new Error("Missing required environment variable: APPLE_CLIENT_ID");
  return clientIds;
}

async function verifyAppleIdentityToken(identityToken) {
  const decoded = jwt.decode(identityToken, { complete: true });
  const kid = decoded?.header?.kid;
  const alg = decoded?.header?.alg;
  if (!kid || alg !== "RS256") throw new Error("Invalid Apple token header");
  const keys = await applePublicKeys();
  const jwk = keys.find((key) => key.kid === kid);
  if (!jwk) throw new Error("Apple public key not found");
  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  return jwt.verify(identityToken, publicKey, {
    algorithms: ["RS256"],
    issuer: "https://appleid.apple.com",
    audience: appleClientIds()
  });
}

async function applePublicKeys() {
  const now = Date.now();
  if (appleKeysCache && appleKeysCache.expiresAt > now) return appleKeysCache.keys;
  const response = await fetch("https://appleid.apple.com/auth/keys");
  if (!response.ok) throw new Error("Unable to fetch Apple public keys");
  const body = await response.json();
  const keys = Array.isArray(body?.keys) ? body.keys : [];
  appleKeysCache = {
    keys,
    expiresAt: now + 60 * 60 * 1000
  };
  return keys;
}

function stripeClient() {
  return new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
}

function corsGuard(req, res, next) {
  const allowed = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (origin && !allowed.includes(origin)) {
    return res.status(403).json({ error: "origin is not allowed" });
  }
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-ID");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}

function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self)");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://checkout.stripe.com");
  next();
}

function rateLimitGuard(req, res, next) {
  if (req.path === "/health") return next();
  const limit = envNumber("RATE_LIMIT_PER_MINUTE", 60);
  const authorization = req.headers.authorization ?? "";
  const key = authorization
    ? `auth:${hashToken(authorization).slice(0, 24)}`
    : `ip:${req.ip || "anonymous"}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key) ?? { start: now, count: 0 };
  if (now - bucket.start > 60_000) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (rateBuckets.size > 10_000) {
    for (const [bucketKey, value] of rateBuckets) {
      if (now - value.start > 120_000) rateBuckets.delete(bucketKey);
    }
  }
  if (bucket.count > limit) return res.status(429).json({ error: "rate limit exceeded" });
  next();
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function validateFoodPayload(data) {
  if (!data || typeof data !== "object") return "payload must be an object";
  if (!Array.isArray(data.foods)) return "foods must be an array";
  if (typeof data.total_carbs_grams !== "number") return "total_carbs_grams must be a number";
  return null;
}

function safeNutritionNumber(value, maximum = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Math.max(number, 0), maximum);
}

function stripJsonFence(text) {
  return text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function jwtSecret() {
  const value = requiredEnv("JWT_SECRET");
  if (value.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
  return value;
}

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function envBoolean(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function bytesFromMb(value) {
  return Math.round(value * 1024 * 1024);
}
app.get(["/family/patients/:ownerId/sos", "/api/family/patients/:ownerId/sos"], asyncHandler(async (req, res) => {
  const access = await pool.query(
    `SELECT permissions FROM family_links
     JOIN users owner ON owner.id = family_links.owner_user_id
     WHERE owner_user_id = $1 AND caregiver_user_id = $2 AND status = 'accepted'
       AND owner.premium_plan IN ('family', 'family_semiannual', 'family_yearly')
       AND owner.premium_status = 'active'
       AND COALESCE(owner.subscription_expires_at, owner.premium_until) > UTC_TIMESTAMP()`,
    [req.params.ownerId, req.user.id]
  );
  const permissions = sanitizePermissions(access.rows[0]?.permissions);
  if (!access.rowCount || !permissions.emergency) {
    return res.status(403).json({ error: "SOS access denied" });
  }
  const settings = await sosSettings();
  await applyLegacySosLifecycleSettings(req.params.ownerId, settings);
  if (!settings.sos_enabled || !settings.sos_show_family_card) return res.json({ event: null, disabled: true });
  const event = await pool.query(
    `SELECT id, status, glucose_mmol, latitude, longitude, accuracy_meters, activated_at, updated_at
     FROM sos_events WHERE user_id = $1 AND status = 'active' ORDER BY activated_at DESC LIMIT 1`,
    [req.params.ownerId]
  );
  res.json({ event: event.rows[0] ?? null });
}));

// Compatibility endpoints for released Web clients. Nginx strips `/api/`
// before proxying, so these handlers intentionally use the legacy paths.
function legacySosPayload(req) {
  const hasLatitude = req.body?.latitude !== undefined && req.body?.latitude !== null;
  const hasLongitude = req.body?.longitude !== undefined && req.body?.longitude !== null;
  const hasAccuracy = req.body?.accuracyMeters !== undefined && req.body?.accuracyMeters !== null;
  const hasGlucose = req.body?.glucoseMmol !== undefined && req.body?.glucoseMmol !== null;
  const latitude = hasLatitude ? Number(req.body.latitude) : null;
  const longitude = hasLongitude ? Number(req.body.longitude) : null;
  const accuracy = hasAccuracy ? Number(req.body.accuracyMeters) : null;
  const glucose = hasGlucose ? Number(req.body.glucoseMmol) : null;
  const clientEventId = cleanText(req.body?.clientEventId ?? req.body?.client_event_id, 64);
  const clientRequestId = cleanText(req.body?.clientRequestId ?? req.body?.client_request_id, 64);
  const source = cleanText(req.body?.source, 32) || "manual";
  const safeId = (value) => !value || /^[A-Za-z0-9._:-]{8,64}$/.test(value);
  if (hasLatitude !== hasLongitude ||
      (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
      (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) ||
      (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) ||
      (glucose !== null && (!Number.isFinite(glucose) || glucose <= 0)) ||
      !safeId(clientEventId) || !safeId(clientRequestId)) {
    return null;
  }
  return { latitude, longitude, accuracy, glucose, clientEventId, clientRequestId, source };
}

async function applyLegacySosLifecycleSettings(patientId, settings) {
  if (!settings.sos_auto_close_enabled) return;
  await pool.query(
    `UPDATE sos_events
     SET status = 'resolved', resolved_at = UTC_TIMESTAMP(), status_updated_at = UTC_TIMESTAMP()
     WHERE patient_id = $1 AND LOWER(status) = 'active'
       AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL $2 HOUR)`,
    [patientId, settings.sos_auto_close_after_hours]
  );
}

async function notifyLegacySosCaregivers(patientId, eventId, title, body, extra = {}) {
  const caregivers = await pool.query(
    `SELECT caregiver_user_id, permissions FROM family_links
     WHERE owner_user_id = $1 AND status = 'accepted' AND caregiver_user_id IS NOT NULL`,
    [patientId]
  );
  for (const caregiver of caregivers.rows) {
    const permissions = sanitizePermissions(caregiver.permissions);
    if (!permissions.alerts && !permissions.emergency) continue;
    await pool.query(
      `INSERT INTO notifications(user_id, type, title, body, metadata)
       VALUES($1, 'sos', $2, $3, $4)`,
      [caregiver.caregiver_user_id, title, body,
        JSON.stringify({ eventId: String(eventId), patientId: String(patientId), ...extra })]
    );
  }
}

app.post("/sos/events", asyncHandler(async (req, res) => {
  console.info("SOS_CREATE_START", { userId: req.user?.id });
  const payload = legacySosPayload(req);
  if (!payload) {
    console.warn("SOS_CREATE_ERROR", { userId: req.user?.id, reason: "invalid_payload" });
    return res.status(400).json({ error: "invalid SOS payload" });
  }
  const settings = await sosSettings();
  await applyLegacySosLifecycleSettings(req.user.id, settings);
  if (!settings.sos_enabled) return res.status(403).json({ error: "SOS disabled" });
  if (!settings.sos_show_patient_card) return res.status(403).json({ error: "SOS patient card disabled" });
  if (payload.source === "automatic" && !["automatic","both"].includes(settings.sos_activation_mode)) return res.status(403).json({ error: "automatic SOS disabled" });
  if (payload.source !== "automatic" && !["manual","both"].includes(settings.sos_activation_mode)) return res.status(403).json({ error: "manual SOS disabled" });
  if (settings.sos_rate_limit_enabled) {
    const recent = await pool.query(
      `SELECT COUNT(*) count FROM sos_events WHERE user_id = $1 AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL $2 MINUTE)`,
      [req.user.id, settings.sos_rate_limit_window_minutes]
    );
    if (Number(recent.rows[0]?.count || 0) >= settings.sos_rate_limit_count) return res.status(429).json({ error: "SOS rate limit exceeded" });
  }
  if (payload.clientEventId) {
    const existing = await pool.query(
      `SELECT id, status FROM sos_events WHERE user_id = $1 AND client_event_id = $2 LIMIT 1`,
      [req.user.id, payload.clientEventId]
    );
    if (existing.rows[0]) {
      const row = existing.rows[0];
      return res.status(200).json({ id: String(row.id), event_id: String(row.id), status: String(row.status).toLowerCase(), idempotent: true });
    }
  }
  if (settings.sos_merge_duplicate_active) {
    const active = await pool.query(
      `SELECT id, status FROM sos_events WHERE user_id = $1 AND LOWER(status) = 'active' AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL $2 SECOND) ORDER BY activated_at DESC, created_at DESC, id DESC LIMIT 1`,
      [req.user.id, settings.sos_duplicate_window_seconds]
    );
    if (active.rows[0]) {
      const row = active.rows[0];
      return res.status(200).json({ id: String(row.id), event_id: String(row.id), status: String(row.status).toLowerCase(), active_existing: true });
    }
  }
  const created = await pool.query(
    `INSERT INTO sos_events(user_id, patient_id, client_event_id, client_request_id, source, glucose_mmol, latitude, longitude, accuracy_meters)
     VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [req.user.id, req.user.id, payload.clientEventId || null, payload.clientRequestId || null, payload.source, payload.glucose, payload.latitude, payload.longitude, payload.accuracy]
  );
  if (settings.sos_in_app_enabled && !settings.sos_test_mode) {
    await notifyLegacySosCaregivers(
      req.user.id, created.insertId, "SOS GlucoTrack",
      "SOS alert created"
    );
  }
  console.info("SOS_CREATE_SUCCESS", { userId: req.user.id, eventId: String(created.insertId) });
  res.status(201).json({ id: String(created.insertId), event_id: String(created.insertId), status: "active" });
}));

app.post("/sos/events/:id/cancel", asyncHandler(async (req, res) => {
  const settings = await sosSettings();
  if (!settings.sos_patient_cancel_enabled) return res.status(403).json({ error: "SOS cancellation disabled" });
  const existing = await pool.query(
    `SELECT id, status FROM sos_events WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [req.params.id, req.user.id]
  );
  if (!existing.rows[0]) return res.status(404).json({ error: "SOS event not found" });
  if (String(existing.rows[0].status).toLowerCase() !== "active") {
    return res.json({ ok: true, id: String(existing.rows[0].id), event_id: String(existing.rows[0].id), status: String(existing.rows[0].status).toLowerCase(), idempotent: true });
  }
  const result = await pool.query(
    `UPDATE sos_events SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(), status_updated_at = UTC_TIMESTAMP()
     WHERE id = $1 AND user_id = $2 AND LOWER(status) = 'active'`,
    [req.params.id, req.user.id]
  );
  if (!result.rowCount) return res.status(409).json({ error: "SOS status changed" });
  if (settings.sos_in_app_enabled && !settings.sos_test_mode) {
    await notifyLegacySosCaregivers(
      req.user.id, req.params.id, "SOS cancelled",
      "SOS alert cancelled", { status: "cancelled" }
    );
  }
  res.json({ ok: true, id: String(req.params.id), event_id: String(req.params.id), status: "cancelled" });
}));

app.post("/sos/events/:id/location", asyncHandler(async (req, res) => {
  const settings = await sosSettings();
  if (!settings.sos_enabled || !settings.sos_request_current_location) return res.status(403).json({ error: "SOS location disabled" });
  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  const accuracy = Number(req.body?.accuracyMeters);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: "invalid location" });
  }
  const event = await pool.query(
    `SELECT id, status FROM sos_events WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [req.params.id, req.user.id]
  );
  if (!event.rows[0]) return res.status(404).json({ error: "SOS event not found" });
  if (String(event.rows[0].status).toLowerCase() !== "active") {
    return res.json({ ok: true, id: String(event.rows[0].id), event_id: String(event.rows[0].id), status: String(event.rows[0].status).toLowerCase(), idempotent: true });
  }
  await pool.query(
    `UPDATE sos_events SET latitude = $1, longitude = $2, accuracy_meters = $3, last_location_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
     WHERE id = $4 AND user_id = $5 AND LOWER(status) = 'active'`,
    [latitude, longitude, Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
      req.params.id, req.user.id]
  );
  res.json({ ok: true, id: String(req.params.id), event_id: String(req.params.id), status: "active" });
}));

app.get(["/family/patients/:ownerId/sos/history", "/api/family/patients/:ownerId/sos/history"], asyncHandler(async (req, res) => {
  const access = await pool.query(
    `SELECT permissions FROM family_links
     JOIN users owner ON owner.id = family_links.owner_user_id
     WHERE owner_user_id = $1 AND caregiver_user_id = $2 AND status = 'accepted'
       AND owner.premium_plan IN ('family', 'family_semiannual', 'family_yearly')
       AND owner.premium_status = 'active'
       AND COALESCE(owner.subscription_expires_at, owner.premium_until) > UTC_TIMESTAMP()`,
    [req.params.ownerId, req.user.id]
  );
  if (!access.rowCount || !sanitizePermissions(access.rows[0].permissions).emergency) {
    return res.status(403).json({ error: "SOS access denied" });
  }
  const settings = await sosSettings();
  await applyLegacySosLifecycleSettings(req.params.ownerId, settings);
  if (!settings.sos_enabled || !settings.sos_show_history_caregiver) return res.json({ events: [], disabled: true });
  const events = await pool.query(
    `SELECT id, status, glucose_mmol, latitude, longitude, accuracy_meters, activated_at, cancelled_at
     FROM sos_events WHERE user_id = $1 ORDER BY activated_at DESC LIMIT 50`,
    [req.params.ownerId]
  );
  res.json({ events: events.rows });
}));

