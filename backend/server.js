import { createHash, createPublicKey, randomBytes, randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import { OAuth2Client } from "google-auth-library";

import { getDatabaseStatus, initializeDatabase, pool } from "./db.js";
import { assertTestRuntime } from "./config/runtime-check.js";
import { createServiceFactory } from "./services/serviceFactory.js";
import {
  isMatchingRefreshDevice,
  isValidDeviceIdentity,
  sanitizeDeviceIdentity
} from "./security-policy.js";
import { isFullRefund, stripeSubscriptionState } from "./billing-policy.js";
import { isAllowedAudioUpload, isAllowedImageUpload } from "./ai-upload-policy.js";
import { mergeHealthSnapshots, validateHealthSnapshot } from "./sync-policy.js";
import { sosPinAttemptPolicy, sosPinWindowSeconds } from "./sos-pin-policy.js";
import { FAMILY_PRESENCE_ONLINE_WINDOW_SECONDS, finitePresenceCoordinate, isFamilyPresenceOnline } from "./family-presence-policy.js";
import { registerAdminRoutes } from "./admin.js";
import { registerAboutPublicRoutes } from "./about.js";
import { registerHelpPublicRoutes } from "./help.js";
import { registerGdprUserRoutes } from "./gdpr.js";
import { registerFoodCatalogRoutes } from "./food-catalog.js";
import {
  attachReferralOnRegistration,
  markReferralEmailVerified,
  processReferralPayment,
  referralBonusUntil,
  registerReferralPublicRoutes,
  registerReferralRoutes,
  revokeReferralRewardsForUser
} from "./referrals.js";

const isTestRuntime = process.env.NODE_ENV === "test";
if (isTestRuntime) assertTestRuntime();
const services = createServiceFactory({ requiredEnv, envNumber, envBoolean });
const app = express();
const upload = multer({ limits: { fileSize: bytesFromMb(envNumber("MAX_IMAGE_MB", 8)) } });
const rateBuckets = new Map();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((_req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (!res.headersSent && !res.getHeader("Content-Type")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    return sendJson(body);
  };
  next();
});

app.post("/billing/webhook", express.raw({ type: "application/json" }), asyncHandler(async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (!signature) return res.status(400).send("missing signature");
  let event;
  try {
    event = services.payment.verifyWebhook({ payload: req.body, signature });
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
          `UPDATE users SET premium_status = 'inactive', subscription_status = 'pending', premium_plan = $1,
            stripe_customer_id = $2, stripe_subscription_id = $3
           WHERE id = $4 AND (stripe_event_created_at IS NULL OR stripe_event_created_at <= FROM_UNIXTIME($5))`,
          [session.metadata?.plan ?? "monthly", String(session.customer ?? ""), String(session.subscription ?? ""), userId, event.created]
        );
        if (session.subscription) {
          const subscription = await services.payment.retrieveSubscription(String(session.subscription));
          await applyStripeSubscription(subscription, event.created, userId);
        }
      }
    }

    if (event.type.startsWith("customer.subscription.")) {
      await applyStripeSubscription(event.data.object, event.created);
    }

    if (["invoice.payment_failed", "invoice.payment_succeeded"].includes(event.type)) {
      const subscriptionId = event.data.object?.subscription;
      if (subscriptionId) {
        const subscription = await services.payment.retrieveSubscription(String(subscriptionId));
        await applyStripeSubscription(subscription, event.created);
      }
    }

    if (event.type === "charge.refunded" && isFullRefund(event.data.object)) {
      const charge = event.data.object;
      const owners = await pool.query("SELECT id FROM users WHERE stripe_customer_id = $1", [String(charge.customer ?? "")]);
      for (const owner of owners.rows) {
        await pool.query(
          `UPDATE users SET premium_status = 'inactive', subscription_status = 'refunded',
             premium_until = UTC_TIMESTAMP(), subscription_expires_at = UTC_TIMESTAMP(),
             stripe_event_created_at = FROM_UNIXTIME($1)
           WHERE id = $2 AND (stripe_event_created_at IS NULL OR stripe_event_created_at <= FROM_UNIXTIME($1))`,
          [event.created, owner.id]
        );
        await revokeReferralRewardsForUser(owner.id, "payment_refunded");
        await reconcileFamilyAccess(owner.id);
      }
    }
  } catch (error) {
    await pool.query("DELETE FROM processed_webhooks WHERE event_id = $1", [event.id]);
    throw error;
  }
  res.json({ received: true });
}));

app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  req.requestId = cleanText(req.headers["x-request-id"], 80) || randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  next();
});
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

// Public one-click invitation landing page. It contains no medical data and
// only forwards the opaque, short-lived invitation token to the app.
app.get("/family/invite/:token", (req, res) => {
  const token = cleanText(req.params.token, 200);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return res.status(404).send("Invitation not found");
  const appUrl = `${(process.env.APP_PUBLIC_URL ?? "https://glukotrack.com/app/").replace(/\/$/, "")}?familyInvite=${encodeURIComponent(token)}`;
  const deepLink = `glucotrack://family/invite/${encodeURIComponent(token)}`;
  res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>GlucoTrack family invitation</title><main><h1>Вас пригласили в семейный доступ GlucoTrack</h1><p>Войдите в свой аккаунт, чтобы принять приглашение.</p><p><a href="${escapeHtml(deepLink)}">Открыть GlucoTrack</a></p><p><a href="${escapeHtml(appUrl)}">Открыть веб-версию</a></p></main>`);
});

// Isolated Family Access API namespace. Existing /family routes remain for
// released clients; new clients use the explicit /api/family boundary.
app.use("/api/family", (req, _res, next) => {
  req.url = `/family${req.url}`;
  next();
});

app.get("/health", (_req, res) => {
  const database = getDatabaseStatus();
  res.status(database.ready ? 200 : 503).json({
    ok: database.ready,
    status: database.ready ? "ok" : "unavailable",
    service: "glucotrack-backend",
    ...(isTestRuntime
      ? { environment: "test", database: process.env.TEST_DATABASE_NAME, external_services: "mock" }
      : { database }),
    time: new Date().toISOString()
  });
});

app.post("/auth/register", asyncHandler(async (req, res) => {
  const fullName = cleanText(req.body?.fullName, 120);
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const device = sanitizeDevice(req.body?.device);
  if (fullName.length < 2 || !isEmail(email) || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "invalid registration data" });
  }
  if (!device) return res.status(400).json({ error: "valid device data is required" });

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
       trial_used, email_verified, token_version FROM users WHERE id = $1`,
    [inserted.insertId]
  );
  await registerAccountDevice(inserted.insertId, device);
  await registerTrialDevice(inserted.insertId, device.id);
  await attachReferralOnRegistration({
    referredUserId: inserted.insertId,
    referralCode: req.body?.referralCode,
    clickToken: req.body?.referralClickToken,
    device,
    req
  }).catch((error) => console.error("Referral attach failed", error?.message ?? error));
  let emailDeliverySent = true;
  try {
    await issueEmailVerification(result.rows[0], req.body?.locale);
  } catch (error) {
    emailDeliverySent = false;
    console.error("Email verification delivery failed", error?.message ?? error);
  }
  const session = await issueSessionTokens(result.rows[0], device);
  res.status(201).json({
    ...session,
    emailVerificationRequired: true,
    emailDeliverySent
  });
}));

app.post("/auth/login", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const device = sanitizeDevice(req.body?.device);
  if (!isEmail(email) || typeof password !== "string") {
    return res.status(400).json({ error: "email and password are required" });
  }
  if (!device) return res.status(400).json({ error: "valid device data is required" });
  const result = await pool.query(
    `SELECT id, email, full_name, password_hash, premium_status, premium_plan, premium_until,
       subscription_status, subscription_expires_at, trial_started_at, trial_ends_at,
       trial_used, email_verified, diabetes_type, glucose_unit, token_version, admin_blocked_at FROM users WHERE email = $1`,
    [email]
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "invalid credentials" });
  }
  if (user.admin_blocked_at) return res.status(403).json({ error: "account blocked" });
  const registeredDevice = await registerAccountDevice(user.id, device, { enforceLimit: true });
  if (!registeredDevice) {
    return res.status(409).json({
      error: "device limit reached",
      code: "DEVICE_LIMIT_REACHED",
      managementToken: authPayload(user, { scope: "device_management" }).token
    });
  }
  const session = await issueSessionTokens(user, { ...device, id: registeredDevice.id });
  res.json({ ...session, device: registeredDevice });
}));

app.post("/auth/google", asyncHandler(async (req, res) => {
  const idToken = typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";
  const device = sanitizeDevice(req.body?.device);
  if (!idToken || idToken.length > 10000) {
    return res.status(400).json({ error: "google_id_token_required" });
  }
  if (!device) return res.status(400).json({ error: "valid device data is required" });

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
       u.trial_used, u.email_verified, u.diabetes_type, u.glucose_unit, u.token_version, u.admin_blocked_at
     FROM oauth_identities o JOIN users u ON u.id = o.user_id
     WHERE o.provider = 'google' AND o.provider_subject = $1`,
    [subject]
  );
  let user = result.rows[0];
  if (!user) {
    result = await pool.query(
      `SELECT id, email, full_name, premium_status, premium_plan, premium_until,
          subscription_status, subscription_expires_at, trial_started_at, trial_ends_at,
         trial_used, email_verified, diabetes_type, glucose_unit, token_version, admin_blocked_at FROM users WHERE email = $1`,
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
           trial_used, email_verified, diabetes_type, glucose_unit, token_version, admin_blocked_at FROM users WHERE id = $1`,
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
           u.trial_used, u.email_verified, u.diabetes_type, u.glucose_unit, u.token_version, u.admin_blocked_at
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
  if (user.admin_blocked_at) return res.status(403).json({ error: "account blocked" });

  const registeredDevice = await registerAccountDevice(user.id, device, { enforceLimit: true });
  if (!registeredDevice) {
    return res.status(409).json({
      error: "device limit reached",
      code: "DEVICE_LIMIT_REACHED",
      managementToken: authPayload(user, { scope: "device_management" }).token
    });
  }
  await registerTrialDevice(user.id, device.id);
  const session = await issueSessionTokens(user, { ...device, id: registeredDevice.id });
  res.json({ ...session, device: registeredDevice });
}));

app.post("/auth/apple", asyncHandler(async (req, res) => {
  const identityToken = typeof req.body?.identityToken === "string" ? req.body.identityToken.trim() : "";
  const device = sanitizeDevice(req.body?.device);
  if (!identityToken || identityToken.length > 10000) {
    return res.status(400).json({ error: "apple_identity_token_required" });
  }
  if (!device) return res.status(400).json({ error: "valid device data is required" });

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
       u.trial_used, u.email_verified, u.diabetes_type, u.glucose_unit, u.token_version, u.admin_blocked_at
     FROM oauth_identities o JOIN users u ON u.id = o.user_id
      WHERE o.provider = 'apple' AND o.provider_subject = $1`,
    [subject]
  );
  let user = result.rows[0];
  if (!user) {
    result = await pool.query(
      `SELECT id, email, full_name, premium_status, premium_plan, premium_until,
          subscription_status, subscription_expires_at, trial_started_at, trial_ends_at,
         trial_used, email_verified, diabetes_type, glucose_unit, token_version, admin_blocked_at FROM users WHERE email = $1`,
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
           trial_used, email_verified, diabetes_type, glucose_unit, token_version, admin_blocked_at FROM users WHERE id = $1`,
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
           u.trial_used, u.email_verified, u.diabetes_type, u.glucose_unit, u.token_version, u.admin_blocked_at
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
  if (user.admin_blocked_at) return res.status(403).json({ error: "account blocked" });

  const registeredDevice = await registerAccountDevice(user.id, device, { enforceLimit: true });
  if (!registeredDevice) {
    return res.status(409).json({
      error: "device limit reached",
      code: "DEVICE_LIMIT_REACHED",
      managementToken: authPayload(user, { scope: "device_management" }).token
    });
  }
  await registerTrialDevice(user.id, device.id);
  const session = await issueSessionTokens(user, { ...device, id: registeredDevice.id });
  res.json({ ...session, device: registeredDevice });
}));

app.post("/auth/refresh", asyncHandler(async (req, res) => {
  const incomingToken = cleanText(req.body?.refreshToken, 640);
  if (!incomingToken) {
    return res.status(400).json({ error: "refresh token required" });
  }
  const requestDevice = sanitizeDeviceIdentity(req.body?.device);
  if (!requestDevice) {
    return res.status(400).json({ error: "valid device data is required" });
  }
  const tokenHash = hashToken(incomingToken);
  const tokenRow = await pool.query(
    `SELECT id, user_id, device_id, device_name, platform, fingerprint_hash,
       revoked_at, last_used_at, expires_at, token_version
     FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash]
  );
  if (!tokenRow.rowCount) {
    return res.status(401).json({ error: "invalid refresh token" });
  }
  const tokenData = tokenRow.rows[0];
  if (tokenData.revoked_at || new Date(tokenData.expires_at).getTime() <= Date.now()) {
    return res.status(401).json({ error: "refresh token expired" });
  }
  const userResult = await pool.query(
    `SELECT id, email, full_name, premium_status, premium_plan, premium_until,
       subscription_status, subscription_expires_at, trial_started_at, trial_ends_at,
       trial_used, email_verified, diabetes_type, glucose_unit, token_version, admin_blocked_at FROM users WHERE id = $1`,
    [tokenData.user_id]
  );
  if (!userResult.rowCount) {
    return res.status(401).json({ error: "invalid refresh token" });
  }
  const user = userResult.rows[0];
  if (user.admin_blocked_at) {
    await pool.query("UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE id = $1 AND revoked_at IS NULL", [tokenData.id]);
    return res.status(403).json({ error: "account blocked" });
  }
  if (Number(tokenData.token_version ?? 0) !== Number(user.token_version ?? 0)) {
    return res.status(401).json({ error: "invalid refresh token" });
  }
  if (!isMatchingRefreshDevice(user.id, requestDevice, tokenData)) {
    return res.status(401).json({ error: "refresh token device mismatch" });
  }
  const refreshDevice = await pool.query(
    "SELECT revoked_at FROM account_devices WHERE user_id = $1 AND device_id = $2",
    [user.id, tokenData.device_id]
  );
  if (refreshDevice.rowCount && refreshDevice.rows[0].revoked_at) {
    return res.status(401).json({ error: "refresh token device revoked" });
  }
  const session = await issueSessionTokens(user, requestDevice, { existingRefreshTokenId: tokenData.id });
  res.json(session);
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
       token_version = token_version + 1,
       password_reset_expires_at = NULL
     WHERE password_reset_token_hash = $2
       AND password_reset_expires_at > UTC_TIMESTAMP()
     RETURNING id`,
    [passwordHash, hashToken(token)]
  );
  if (!result.rowCount) {
    return res.status(400).json({ error: "invalid or expired reset token" });
  }
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = $1 AND revoked_at IS NULL",
    [result.rows[0].id]
  );
  res.json({ ok: true });
}));

app.get("/auth/password/reset", (req, res) => {
  const token = cleanText(req.query?.token, 256);
  res.type("html").send(renderPasswordResetPage(token, req.query?.lang));
});

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
  const pinAccess = await sosPinAccessState(profile, req);
  if (pinAccess.locked) {
    return res
      .status(429)
      .set("Retry-After", String(pinAccess.retryAfterSeconds))
      .json({ error: "PIN temporarily locked", retryAfterSeconds: pinAccess.retryAfterSeconds });
  }
  const valid = await bcrypt.compare(req.body.pin, profile.pin_hash);
  await recordSosPinAttempt(profile, req, valid, pinAccess.nextDelaySeconds);
  if (!valid) return res.status(403).json({ error: "invalid PIN" });
  res.json({ card: profile.card });
}));

registerAdminRoutes(app, { asyncHandler, services });
registerAboutPublicRoutes(app, { asyncHandler });
registerReferralPublicRoutes(app, { asyncHandler });
registerHelpPublicRoutes(app, { asyncHandler });

app.use(authGuard);
registerReferralRoutes(app, { asyncHandler });
registerGdprUserRoutes(app, { asyncHandler });
registerFoodCatalogRoutes(app, { asyncHandler });

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

app.post("/auth/logout", asyncHandler(async (req, res) => {
  const refreshToken = cleanText(req.body?.refreshToken, 640);
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  } else if (req.headers["x-device-id"]) {
    await revokeRefreshTokenForUserAndDevice(req.user.id, req.headers["x-device-id"]);
  }
  await revokeAllRefreshTokensForUser(req.user.id);
  await pool.query("UPDATE users SET token_version = token_version + 1 WHERE id = $1", [req.user.id]);
  res.json({ ok: true });
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
     ) VALUES($1, $2, $3, $4, $5, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       card = VALUES(card),
       pin_hash = VALUES(pin_hash),
       hide_sensitive = VALUES(hide_sensitive),
       updated_at = UTC_TIMESTAMP()`,
    [req.user.id, token, card, pinHash, hideSensitive]
  );
  res.json({ token, publicUrl: `${publicBaseUrl(req)}/sos/${token}` });
}));

app.post("/sos/events", asyncHandler(async (req, res) => {
  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  const accuracy = Number(req.body?.accuracyMeters);
  const glucose = Number(req.body?.glucoseMmol);
  const created = await pool.query(
    `INSERT INTO sos_events(user_id, glucose_mmol, latitude, longitude, accuracy_meters)
     VALUES($1, $2, $3, $4, $5)`,
    [req.user.id, Number.isFinite(glucose) ? glucose : null,
      Number.isFinite(latitude) ? latitude : null,
      Number.isFinite(longitude) ? longitude : null,
      Number.isFinite(accuracy) ? accuracy : null]
  );
  const caregivers = await pool.query(
    `SELECT caregiver_user_id, permissions FROM family_links
     WHERE owner_user_id = $1 AND status = 'accepted' AND caregiver_user_id IS NOT NULL`,
    [req.user.id]
  );
  for (const caregiver of caregivers.rows) {
    const permissions = normalizeFamilyPermissions(caregiver.permissions);
    if (!permissions.alerts && !permissions.emergency) continue;
    await pool.query(
      `INSERT INTO notifications(user_id, type, title, body, metadata)
       VALUES($1, 'sos', 'SOS GlucoTrack', 'Требуется помощь: активирована экстренная тревога', $2)`,
      [caregiver.caregiver_user_id, { eventId: String(created.insertId), patientId: String(req.user.id) }]
    );
  }
  await recordFamilyAudit(req.user.id, req.user.id, null, "sos_activated");
  res.status(201).json({ id: String(created.insertId), status: "active" });
}));

app.post("/sos/events/:id/cancel", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `UPDATE sos_events SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP()
     WHERE id = $1 AND user_id = $2 AND status = 'active'`,
    [req.params.id, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "active SOS event not found" });
  const caregivers = await pool.query(
    `SELECT caregiver_user_id, permissions FROM family_links
     WHERE owner_user_id = $1 AND status = 'accepted' AND caregiver_user_id IS NOT NULL`,
    [req.user.id]
  );
  for (const caregiver of caregivers.rows) {
    const permissions = normalizeFamilyPermissions(caregiver.permissions);
    if (!permissions.alerts && !permissions.emergency) continue;
    await pool.query(
      `INSERT INTO notifications(user_id, type, title, body, metadata)
       VALUES($1, 'sos', 'SOS завершён', 'Пациент отменил экстренную тревогу', $2)`,
      [caregiver.caregiver_user_id, { eventId: String(req.params.id), patientId: String(req.user.id), status: 'cancelled' }]
    );
  }
  await recordFamilyAudit(req.user.id, req.user.id, null, "sos_cancelled");
  res.json({ ok: true });
}));

// The patient device may update this while SOS is active. It is intentionally
// limited to the event itself, so no permanent location trail is created.
app.post("/sos/events/:id/location", asyncHandler(async (req, res) => {
  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  const accuracy = Number(req.body?.accuracyMeters);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: "invalid location" });
  }
  const updated = await pool.query(
    `UPDATE sos_events SET latitude = $1, longitude = $2, accuracy_meters = $3, updated_at = UTC_TIMESTAMP()
     WHERE id = $4 AND user_id = $5 AND status = 'active'`,
    [latitude, longitude, Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
      req.params.id, req.user.id]
  );
  if (!updated.rowCount) return res.status(404).json({ error: "active SOS event not found" });
  await pool.query(
    `INSERT INTO patient_locations(
       patient_id, latitude, longitude, accuracy, sos_session_id, status, captured_at
     ) VALUES($1, $2, $3, $4, $5, 'sos', UTC_TIMESTAMP())`,
    [req.user.id, latitude, longitude,
      Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null, req.params.id]
  );
  res.json({ ok: true });
}));

app.get("/family/patients/:ownerId/sos", asyncHandler(async (req, res) => {
  const access = await pool.query(
    `SELECT permissions FROM family_links
     JOIN users owner ON owner.id = family_links.owner_user_id
     WHERE owner_user_id = $1 AND caregiver_user_id = $2 AND status = 'accepted'
       AND owner.premium_plan IN ('family', 'family_semiannual', 'family_yearly')
       AND owner.premium_status = 'active'
       AND COALESCE(owner.subscription_expires_at, owner.premium_until) > UTC_TIMESTAMP()`,
    [req.params.ownerId, req.user.id]
  );
  const permissions = normalizeFamilyPermissions(access.rows[0]?.permissions);
  if (!access.rowCount || !permissions.emergency) return res.status(403).json({ error: "SOS access denied" });
  const event = await pool.query(
    `SELECT id, status, glucose_mmol, latitude, longitude, accuracy_meters, activated_at, updated_at
     FROM sos_events WHERE user_id = $1 AND status = 'active' ORDER BY activated_at DESC LIMIT 1`,
    [req.params.ownerId]
  );
  await recordFamilyAudit(req.user.id, req.params.ownerId, null, "sos_viewed");
  res.json({ event: event.rows[0] ?? null });
}));

app.get("/family/patients/:ownerId/sos/history", asyncHandler(async (req, res) => {
  const access = await pool.query(
    `SELECT permissions FROM family_links
     JOIN users owner ON owner.id = family_links.owner_user_id
     WHERE owner_user_id = $1 AND caregiver_user_id = $2 AND status = 'accepted'
       AND owner.premium_plan IN ('family', 'family_semiannual', 'family_yearly')
       AND owner.premium_status = 'active'
       AND COALESCE(owner.subscription_expires_at, owner.premium_until) > UTC_TIMESTAMP()`,
    [req.params.ownerId, req.user.id]
  );
  if (!access.rowCount || !normalizeFamilyPermissions(access.rows[0].permissions).emergency) {
    return res.status(403).json({ error: "SOS access denied" });
  }
  const events = await pool.query(
    `SELECT id, status, glucose_mmol, latitude, longitude, accuracy_meters, activated_at, cancelled_at
     FROM sos_events WHERE user_id = $1 ORDER BY activated_at DESC LIMIT 50`,
    [req.params.ownerId]
  );
  await recordFamilyAudit(req.user.id, req.params.ownerId, null, "sos_history_viewed");
  res.json({ events: events.rows });
}));

app.get("/family/live-location/settings", asyncHandler(async (req, res) => {
  const [settings, members] = await Promise.all([
    pool.query(
      "SELECT enabled, consented_at, updated_at FROM family_live_location_settings WHERE user_id = $1",
      [req.user.id]
    ),
    pool.query(
      `SELECT fl.caregiver_user_id AS id, COALESCE(u.full_name, fl.member_name, fl.invite_email) AS name,
              u.email, g.granted_at, g.revoked_at
       FROM family_links fl
       JOIN users u ON u.id = fl.caregiver_user_id
       LEFT JOIN family_live_location_grants g
         ON g.owner_user_id = fl.owner_user_id AND g.caregiver_user_id = fl.caregiver_user_id
       WHERE fl.owner_user_id = $1 AND fl.status = 'accepted'
       ORDER BY name`,
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

app.put("/family/live-location/settings", asyncHandler(async (req, res) => {
  const enabled = req.body?.enabled === true;
  const caregiverIds = Array.from(new Set(
    (Array.isArray(req.body?.caregiverIds) ? req.body.caregiverIds : [])
      .map((id) => String(id)).filter((id) => /^\d+$/.test(id))
  ));
  if (enabled && !caregiverIds.length) {
    return res.status(400).json({ error: "choose at least one recipient" });
  }
  const allowed = caregiverIds.length ? await pool.query(
    `SELECT caregiver_user_id FROM family_links
     WHERE owner_user_id = $1 AND status = 'accepted' AND caregiver_user_id IN (${caregiverIds.map((_, index) => `$${index + 2}`).join(',')})`,
    [req.user.id, ...caregiverIds]
  ) : { rows: [] };
  if (allowed.rows.length !== caregiverIds.length) {
    return res.status(400).json({ error: "invalid live location recipient" });
  }
  await pool.transaction(async (query) => {
    await query(
      `INSERT INTO family_live_location_settings(user_id, enabled, consented_at)
       VALUES($1, $2, CASE WHEN $2 THEN UTC_TIMESTAMP() ELSE NULL END)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled),
         consented_at = CASE WHEN VALUES(enabled) THEN COALESCE(consented_at, UTC_TIMESTAMP()) ELSE NULL END`,
      [req.user.id, enabled]
    );
    await query(
      "UPDATE family_live_location_grants SET revoked_at = UTC_TIMESTAMP() WHERE owner_user_id = $1 AND revoked_at IS NULL",
      [req.user.id]
    );
    for (const caregiverId of caregiverIds) {
      await query(
        `INSERT INTO family_live_location_grants(owner_user_id, caregiver_user_id, granted_at, revoked_at)
         VALUES($1, $2, UTC_TIMESTAMP(), NULL)
         ON DUPLICATE KEY UPDATE granted_at = UTC_TIMESTAMP(), revoked_at = NULL`,
        [req.user.id, caregiverId]
      );
    }
    if (!enabled) {
      await query("DELETE FROM family_live_location_current WHERE user_id = $1", [req.user.id]);
    }
  });
  await recordFamilyAudit(req.user.id, req.user.id, null,
    enabled ? "live_location_enabled" : "live_location_disabled", { caregiverIds });
  res.json({ ok: true });
}));

app.post("/family/live-location/position", asyncHandler(async (req, res) => {
  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  const accuracy = Number(req.body?.accuracyMeters);
  const speed = Number(req.body?.speedMps);
  const heading = Number(req.body?.headingDegrees);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: "invalid location" });
  }
  const setting = await pool.query(
    "SELECT enabled FROM family_live_location_settings WHERE user_id = $1", [req.user.id]
  );
  if (!setting.rowCount || !(setting.rows[0].enabled === true || Number(setting.rows[0].enabled) === 1)) {
    return res.status(403).json({ error: "live location is disabled" });
  }
  await pool.query(
    `INSERT INTO family_live_location_current(
       user_id, latitude, longitude, accuracy_meters, speed_mps, heading_degrees, captured_at
     ) VALUES($1, $2, $3, $4, $5, $6, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE latitude = VALUES(latitude), longitude = VALUES(longitude),
       accuracy_meters = VALUES(accuracy_meters), speed_mps = VALUES(speed_mps),
       heading_degrees = VALUES(heading_degrees), captured_at = VALUES(captured_at)`,
    [req.user.id, latitude, longitude,
      Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
      Number.isFinite(speed) && speed >= 0 ? speed : null,
      Number.isFinite(heading) && heading >= 0 && heading <= 360 ? heading : null]
  );
  // Compatibility heartbeat for released mobile clients which already send
  // live location but do not yet have the dedicated presence service.
  // Keep any glucose/battery value supplied by a newer heartbeat intact.
  await pool.query(
    `INSERT INTO patient_presence(patient_id, last_seen, online_status, latitude, longitude)
     VALUES($1, UTC_TIMESTAMP(), TRUE, $2, $3)
     ON DUPLICATE KEY UPDATE last_seen = UTC_TIMESTAMP(), online_status = TRUE,
       latitude = VALUES(latitude), longitude = VALUES(longitude)`,
    [req.user.id, latitude, longitude]
  );
  console.info("live_location location_saved", { userId: req.user.id });
  res.json({ ok: true });
}));

// A patient writes only their own current heartbeat. The supplied patientId is
// checked rather than trusted, so this endpoint cannot impersonate another user.
app.post("/family/presence", asyncHandler(async (req, res) => {
  const requestedPatientId = req.body?.patientId ?? req.body?.patient_id;
  if (requestedPatientId != null && String(requestedPatientId) !== String(req.user.id)) {
    return res.status(403).json({ error: "patient identity mismatch" });
  }
  const latitude = finitePresenceCoordinate(req.body?.latitude, -90, 90);
  const longitude = finitePresenceCoordinate(req.body?.longitude, -180, 180);
  if ((latitude == null) !== (longitude == null)) {
    return res.status(400).json({ error: "latitude and longitude must be supplied together" });
  }
  const batteryValue = Number(req.body?.battery);
  const glucoseValue = Number(req.body?.glucoseMmol ?? req.body?.glucose);
  const battery = Number.isFinite(batteryValue) && batteryValue >= 0 && batteryValue <= 100
    ? Math.round(batteryValue) : null;
  const glucose = Number.isFinite(glucoseValue) && glucoseValue > 0 && glucoseValue <= 100
    ? glucoseValue : null;
  await pool.query(
    `INSERT INTO patient_presence(patient_id, last_seen, online_status, latitude, longitude, battery, glucose)
     VALUES($1, UTC_TIMESTAMP(), TRUE, $2, $3, $4, $5)
     ON DUPLICATE KEY UPDATE last_seen = UTC_TIMESTAMP(), online_status = TRUE,
       latitude = VALUES(latitude), longitude = VALUES(longitude), battery = VALUES(battery),
       glucose = VALUES(glucose)`,
    [req.user.id, latitude, longitude, battery, glucose]
  );
  res.json({ ok: true, onlineWindowSeconds: FAMILY_PRESENCE_ONLINE_WINDOW_SECONDS });
}));

app.get("/family/patients/:ownerId/live-location", asyncHandler(async (req, res) => {
  const allowed = await pool.query(
    `SELECT 1 FROM family_live_location_settings s
     JOIN family_live_location_grants g ON g.owner_user_id = s.user_id AND g.revoked_at IS NULL
     JOIN family_links fl ON fl.owner_user_id = s.user_id
       AND fl.caregiver_user_id = g.caregiver_user_id AND fl.status = 'accepted'
     JOIN users owner ON owner.id = s.user_id
     WHERE s.user_id = $1 AND s.enabled = TRUE AND g.caregiver_user_id = $2
       AND owner.premium_plan IN ('family', 'family_semiannual', 'family_yearly')
       AND owner.premium_status = 'active'
       AND COALESCE(owner.subscription_expires_at, owner.premium_until) > UTC_TIMESTAMP()`,
    [req.params.ownerId, req.user.id]
  );
  if (!allowed.rowCount) return res.status(403).json({ error: "live location access denied" });
  const location = await pool.query(
    `SELECT latitude, longitude, accuracy_meters, speed_mps, heading_degrees, captured_at
     FROM family_live_location_current WHERE user_id = $1`, [req.params.ownerId]
  );
  await recordFamilyAudit(req.user.id, req.params.ownerId, null, "live_location_viewed");
  const currentLocation = location.rows[0] ?? null;
  console.info("live_location location_sent", {
    caregiverUserId: req.user.id,
    patientUserId: String(req.params.ownerId),
    hasLocation: currentLocation != null
  });
  res.json({
    trackingStatus: currentLocation == null ? "waiting" : "active",
    location: currentLocation
  });
}));

// SOS route history is available only to an accepted caregiver with emergency
// permission. Normal family tracking never exposes a historical route.
app.get("/family/patients/:ownerId/sos/location-history", asyncHandler(async (req, res) => {
  const access = await pool.query(
    `SELECT permissions FROM family_links
     JOIN users owner ON owner.id = family_links.owner_user_id
     WHERE owner_user_id = $1 AND caregiver_user_id = $2 AND status = 'accepted'
       AND owner.premium_plan IN ('family', 'family_semiannual', 'family_yearly')
       AND owner.premium_status = 'active'
       AND COALESCE(owner.subscription_expires_at, owner.premium_until) > UTC_TIMESTAMP()`,
    [req.params.ownerId, req.user.id]
  );
  if (!access.rowCount || !normalizeFamilyPermissions(access.rows[0].permissions).emergency) {
    return res.status(403).json({ error: "SOS access denied" });
  }
  const active = await pool.query(
    `SELECT id FROM sos_events WHERE user_id = $1 AND status = 'active'
     ORDER BY activated_at DESC LIMIT 1`, [req.params.ownerId]
  );
  if (!active.rowCount) return res.json({ eventId: null, points: [] });
  const points = await pool.query(
    `SELECT latitude, longitude, accuracy, battery_level, captured_at
     FROM patient_locations WHERE patient_id = $1 AND sos_session_id = $2
     ORDER BY captured_at ASC LIMIT 1000`,
    [req.params.ownerId, active.rows[0].id]
  );
  await recordFamilyAudit(req.user.id, req.params.ownerId, null, "sos_location_history_viewed");
  res.json({ eventId: String(active.rows[0].id), points: points.rows });
}));

app.get("/sos/scans/recent", asyncHandler(async (req, res) => {
  await purgeExpiredSosScans(req.user.id);
  const result = await pool.query(
    `SELECT id, latitude, longitude, accuracy_meters, scanned_at
     FROM sos_scans
     WHERE user_id = $1
     ORDER BY scanned_at DESC
     LIMIT 50`,
    [req.user.id]
  );
  res.json({ scans: result.rows, retentionDays: sosScanRetentionDays() });
}));

app.delete("/sos/scans", asyncHandler(async (req, res) => {
  await pool.query("DELETE FROM sos_scans WHERE user_id = $1", [req.user.id]);
  res.json({ ok: true });
}));

// Cloud backup is available to every authenticated account.  It must not be
// handled by the premium-only report gate: the client exposes it as a core
// data-safety feature and needs it to restore a user's own records.
app.use("/reports", premiumGuard);
app.get("/ai/limits", asyncHandler(async (req, res) => {
  const access = await resolveAiAccess(req.user.id);
  if (!access) return sendAiLimitError(res, "AI_PREMIUM_REQUIRED", null);
  const periodDate = new Date().toISOString().slice(0, 10);
  const limits = access.plan === "family" ? { total: 40, photo: 10 } : { total: 20, photo: 5 };
  const usage = await pool.query(
    "SELECT COUNT(*) total, SUM(is_photo = TRUE) photos FROM ai_requests WHERE user_id = $1 AND period_date = $2 AND status IN ('reserved', 'success')",
    [req.user.id, periodDate]
  );
  const used = Number(usage.rows[0]?.total ?? 0);
  const photos = Number(usage.rows[0]?.photos ?? 0);
  res.json({ plan: access.plan, total_limit: limits.total, photo_limit: limits.photo, used, photo_used: photos, remaining: Math.max(0, limits.total - used), photo_remaining: Math.max(0, limits.photo - photos), next_reset_at: `${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}T00:00:00.000Z` });
}));
app.use("/ai", aiLimitGuard);

app.post("/sync/push", asyncHandler(async (req, res) => {
  const schemaVersion = Number(req.body?.schemaVersion ?? 1);
  const baseRevision = Number(req.body?.baseRevision ?? 0);
  const payload = req.body?.payload ?? req.body;
  if (schemaVersion !== 1 || !Number.isSafeInteger(baseRevision) || baseRevision < 0) {
    return res.status(400).json({ error: "unsupported sync version or revision" });
  }
  const validationError = validateHealthSnapshot(payload);
  if (validationError) return res.status(400).json({ error: validationError });
  const outcome = await pool.transaction(async (query) => {
    const current = await query(
      "SELECT payload, revision FROM health_snapshots WHERE user_id = $1 FOR UPDATE",
      [req.user.id]
    );
    const revision = Number(current.rows[0]?.revision ?? 0);
    if (current.rowCount && baseRevision !== revision) {
      return { conflict: true, revision, payload: current.rows[0].payload };
    }
    const mergedPayload = mergeHealthSnapshots(current.rows[0]?.payload ?? null, payload);
    const nextRevision = revision + 1;
    await query(
      `INSERT INTO health_snapshots(user_id, payload, schema_version, revision, updated_at)
       VALUES($1, $2, $3, $4, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), schema_version = VALUES(schema_version),
         revision = VALUES(revision), updated_at = UTC_TIMESTAMP()`,
      [req.user.id, mergedPayload, schemaVersion, nextRevision]
    );
    await query(
      `INSERT INTO sync_changes(user_id, revision, base_revision, payload, created_at)
       VALUES($1, $2, $3, $4, UTC_TIMESTAMP())`,
      [req.user.id, nextRevision, baseRevision, mergedPayload]
    );
    await purgeOldSyncChanges(query, req.user.id);
    return { conflict: false, revision: nextRevision };
  });
  if (outcome.conflict) {
    return res.status(409).json({ code: "SYNC_CONFLICT", revision: outcome.revision, payload: outcome.payload });
  }
  res.json({ ok: true, revision: outcome.revision, acceptedAt: new Date().toISOString() });
}));

app.post("/sync/pull", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT payload, schema_version, revision, updated_at FROM health_snapshots WHERE user_id = $1",
    [req.user.id]
  );
  res.json({ ok: true, snapshot: result.rows[0] ?? null });
}));

app.get("/subscription/status", asyncHandler(async (req, res) => {
  const stripeLink = await pool.query(
    "SELECT stripe_subscription_id FROM users WHERE id = $1",
    [req.user.id]
  );
  const stripeSubscriptionId = stripeLink.rows[0]?.stripe_subscription_id;
  if (stripeSubscriptionId) {
    try {
      const current = await services.payment.retrieveSubscription(String(stripeSubscriptionId));
      await applyStripeSubscription(current, Math.floor(Date.now() / 1000), req.user.id);
    } catch (error) {
      console.error("Stripe subscription reconciliation failed", error?.message ?? error);
    }
  }
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
      return res.status(409).json({
        error: "device limit reached",
        code: "DEVICE_LIMIT_REACHED"
      });
    }
  await registerAccountDevice(req.user.id, device);
  res.status(existing.rowCount ? 200 : 201).json({
    devices: await accountDevices(req.user.id),
    deviceLimit: deviceLimit(subscription.premiumPlan)
  });
}));

app.delete("/subscription/devices/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "UPDATE account_devices SET revoked_at = UTC_TIMESTAMP() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL",
    [req.params.id, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "device not found" });
  res.json({ ok: true });
}));

app.post("/billing/checkout", asyncHandler(async (req, res) => {
  const requestedPlan = cleanText(req.body?.plan, 32);
  const plan = ["monthly", "semiannual", "yearly", "family", "family_semiannual", "family_yearly"].includes(requestedPlan)
    ? requestedPlan
    : "monthly";
  const priceId = requiredEnv({
    monthly: "STRIPE_MONTHLY_PRICE_ID",
    semiannual: "STRIPE_SEMIANNUAL_PRICE_ID",
    yearly: "STRIPE_YEARLY_PRICE_ID",
    family: "STRIPE_FAMILY_PRICE_ID",
    family_semiannual: "STRIPE_FAMILY_SEMIANNUAL_PRICE_ID",
    family_yearly: "STRIPE_FAMILY_YEARLY_PRICE_ID"
  }[plan]);
  const userResult = await pool.query(
    "SELECT id, email, stripe_customer_id FROM users WHERE id = $1",
    [req.user.id]
  );
  const user = userResult.rows[0];
  if (!user) return res.status(404).json({ error: "user not found" });

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await services.payment.createCustomer({ email: user.email, userId: user.id });
    customerId = customer.id;
    await pool.query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [customerId, user.id]);
  }

  const session = await services.payment.createCheckoutSession({
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
  const session = await services.payment.createPortalSession({
    customerId,
    returnUrl: requiredEnv("STRIPE_PORTAL_RETURN_URL")
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

app.post("/family/invitations", asyncHandler(async (req, res) => {
  if (!(await reconcileFamilyAccess(req.user.id))) {
    return res.status(403).json({ error: "family subscription required" });
  }
  await pool.query(
    "UPDATE family_links SET status = 'revoked' WHERE owner_user_id = $1 AND status = 'pending' AND caregiver_user_id IS NULL AND expires_at <= UTC_TIMESTAMP()",
    [req.user.id]
  );
  const memberCount = await pool.query(
    "SELECT COUNT(*) AS count FROM family_links WHERE owner_user_id = $1 AND status IN ('pending', 'accepted')",
    [req.user.id]
  );
  if (Number(memberCount.rows[0]?.count ?? 0) >= 5) {
    return res.status(409).json({ error: "family member limit reached" });
  }
  const inviteEmail = normalizeEmail(req.body?.email);
  if (!isEmail(inviteEmail) || inviteEmail === req.user.email) {
    return res.status(400).json({ error: "valid caregiver email is required" });
  }
  const permissions = sanitizePermissions(req.body?.permissions);
  const memberName = cleanText(req.body?.name, 255) || null;
  const memberRole = familyRole(req.body?.role);
  const inviteCode = randomBytes(18).toString("base64url");
  await pool.query(
    `INSERT INTO family_links(
       owner_user_id, invite_email, invite_code, permissions, member_name, member_role, status, expires_at
     ) VALUES($1, $2, $3, $4, $5, $6, 'pending', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 72 HOUR))
    ON DUPLICATE KEY UPDATE
       invite_code = VALUES(invite_code),
       permissions = VALUES(permissions),
       member_name = VALUES(member_name), member_role = VALUES(member_role),
       status = 'pending', caregiver_user_id = NULL,
       expires_at = VALUES(expires_at), accepted_at = NULL,
       email_sent = FALSE, email_sent_at = NULL, email_error = NULL`,
    [req.user.id, inviteEmail, inviteCode, permissions, memberName, memberRole]
  );
  const result = await pool.query(
    "SELECT id, invite_email, invite_code, permissions, member_name, member_role, status, expires_at FROM family_links WHERE owner_user_id = $1 AND invite_email = $2",
    [req.user.id, inviteEmail]
  );
  console.info("INVITE_EMAIL_START", {
    recipient: inviteEmail,
    // Do not place a reusable invitation secret in production logs.
    invite_code_prefix: `${inviteCode.slice(0, 6)}…`,
    user_id: req.user.id,
  });
  try {
    const delivery = await sendFamilyInvitationEmail({
      email: inviteEmail,
      inviteCode,
      locale: req.body?.locale,
    });
    console.info("SMTP_STATUS", {
      accepted: delivery.accepted,
      rejected: delivery.rejected,
      message_id: delivery.messageId,
    });
    await pool.query(
      "UPDATE family_links SET email_sent = TRUE, email_sent_at = UTC_TIMESTAMP(), email_error = NULL WHERE id = $1",
      [result.rows[0].id]
    );
    console.info("INVITE_EMAIL_END", { recipient: inviteEmail, user_id: req.user.id });
  } catch (error) {
    await pool.query(
      "UPDATE family_links SET email_sent = FALSE, email_error = $1 WHERE id = $2",
      [cleanText(error instanceof Error ? error.message : String(error), 500), result.rows[0].id]
    ).catch(() => {});
    console.error("SMTP_STATUS", {
      recipient: inviteEmail,
      user_id: req.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(502).json({ error: "invitation email failed" });
  }
  const saved = await pool.query(
    "SELECT id, invite_email, invite_code, permissions, member_name, member_role, status, expires_at, email_sent, email_sent_at, email_error FROM family_links WHERE id = $1",
    [result.rows[0].id]
  );
  res.status(201).json({
    invitation: {
      ...familyLink(saved.rows[0]),
      invitationUrl: familyInvitationUrl(inviteCode),
    },
  });
}));

app.post("/family/invitations/:id/resend", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, invite_email, invite_code, status, expires_at
     FROM family_links WHERE id = $1 AND owner_user_id = $2`,
    [req.params.id, req.user.id]
  );
  const invitation = result.rows[0];
  if (!invitation || invitation.status !== "pending" || new Date(invitation.expires_at) <= new Date()) {
    return res.status(404).json({ error: "pending invitation not found" });
  }
  console.info("INVITE_EMAIL_RESEND_START", {
    recipient: invitation.invite_email,
    invite_code_prefix: `${String(invitation.invite_code).slice(0, 6)}…`,
    user_id: req.user.id
  });
  try {
    const delivery = await sendFamilyInvitationEmail({
      email: invitation.invite_email,
      inviteCode: invitation.invite_code,
      locale: req.body?.locale
    });
    console.info("INVITE_EMAIL_RESEND_STATUS", {
      accepted: delivery.accepted,
      rejected: delivery.rejected,
      message_id: delivery.messageId
    });
    await pool.query(
      "UPDATE family_links SET email_sent = TRUE, email_sent_at = UTC_TIMESTAMP(), email_error = NULL WHERE id = $1",
      [invitation.id]
    );
  } catch (error) {
    await pool.query(
      "UPDATE family_links SET email_sent = FALSE, email_error = $1 WHERE id = $2",
      [cleanText(error instanceof Error ? error.message : String(error), 500), invitation.id]
    ).catch(() => {});
    console.error("INVITE_EMAIL_RESEND_STATUS", {
      recipient: invitation.invite_email,
      user_id: req.user.id,
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(502).json({ error: "invitation email failed" });
  }
  res.json({ ok: true });
}));

app.post("/family/invitations/accept", asyncHandler(async (req, res) => {
  const code = cleanText(req.body?.code, 200);
  const userEmail = normalizeEmail(req.user.email);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(code)) {
    return res.status(400).json({ error: "invalid invitation code" });
  }
  const invitation = await pool.query(
    "SELECT owner_user_id FROM family_links WHERE invite_code = $1 AND invite_email = $2",
    [code, userEmail]
  );
  if (!invitation.rowCount || !(await reconcileFamilyAccess(invitation.rows[0].owner_user_id))) {
    return res.status(404).json({ error: "invitation is invalid, expired, or belongs to another email" });
  }
  const updated = await pool.query(
    `UPDATE family_links SET
       caregiver_user_id = $1, status = 'accepted', accepted_at = UTC_TIMESTAMP()
     WHERE invite_code = $2 AND invite_email = $3
        AND status = 'pending' AND expires_at > UTC_TIMESTAMP()`,
    [req.user.id, code, userEmail]
  );
  if (!updated.rowCount) {
    return res.status(404).json({ error: "invitation is invalid, expired, or belongs to another email" });
  }
  const result = await pool.query(
    "SELECT id, owner_user_id, invite_email, permissions, status, accepted_at FROM family_links WHERE invite_code = $1 AND invite_email = $2",
    [code, userEmail]
  );
  res.json({ link: familyLink(result.rows[0]) });
}));

app.get("/family/members", asyncHandler(async (req, res) => {
  await reconcileFamilyAccess(req.user.id);
  const result = await pool.query(
    `SELECT fl.id, fl.invite_email, fl.invite_code, fl.permissions, fl.member_name, fl.member_role, fl.status, fl.expires_at,
            fl.accepted_at, fl.email_sent, fl.email_sent_at, fl.email_error, u.full_name
     FROM family_links fl
     LEFT JOIN users u ON u.id = fl.caregiver_user_id
     WHERE fl.owner_user_id = $1 AND fl.status <> 'revoked'
     ORDER BY fl.created_at DESC`,
    [req.user.id]
  );
  res.json({ members: result.rows.map(familyLink) });
}));

app.delete("/family/members/:id", asyncHandler(async (req, res) => {
  const result = await pool.transaction(async (query) => {
    const link = await query(
      "SELECT owner_user_id, caregiver_user_id FROM family_links WHERE id = $1 AND owner_user_id = $2 FOR UPDATE",
      [req.params.id, req.user.id]
    );
    if (!link.rowCount) return { rowCount: 0 };
    await query("UPDATE family_links SET status = 'revoked' WHERE id = $1", [req.params.id]);
    if (link.rows[0].caregiver_user_id != null) {
      await query(
        "UPDATE family_live_location_grants SET revoked_at = UTC_TIMESTAMP() WHERE owner_user_id = $1 AND caregiver_user_id = $2 AND revoked_at IS NULL",
        [link.rows[0].owner_user_id, link.rows[0].caregiver_user_id]
      );
    }
    return { rowCount: 1 };
  });
  if (!result.rowCount) return res.status(404).json({ error: "family link not found" });
  await recordFamilyAudit(req.user.id, null, req.params.id, "member_revoked");
  res.json({ ok: true });
}));

app.patch("/family/members/:id/permissions", asyncHandler(async (req, res) => {
  if (!(await reconcileFamilyAccess(req.user.id))) {
    return res.status(403).json({ code: "FAMILY_SUBSCRIPTION_REQUIRED", error: "family subscription required" });
  }
  const permissions = sanitizePermissions(req.body?.permissions);
  const updated = await pool.query(
    "UPDATE family_links SET permissions = $1 WHERE id = $2 AND owner_user_id = $3 AND status = 'accepted'",
    [permissions, req.params.id, req.user.id]
  );
  if (!updated.rowCount) return res.status(404).json({ error: "family member not found" });
  await recordFamilyAudit(req.user.id, null, req.params.id, "permissions_changed", permissions);
  res.json({ permissions: normalizeFamilyPermissions(permissions) });
}));

app.get("/family/patients", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT fl.owner_user_id, fl.permissions, u.full_name, u.email,
            hs.payload, hs.updated_at, pp.last_seen, pp.online_status,
            pp.battery, pp.glucose AS presence_glucose
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

app.get("/family/patients/:ownerId", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT fl.permissions, u.id, u.full_name, u.email, hs.payload, hs.updated_at,
            pp.last_seen, pp.online_status, pp.battery, pp.glucose AS presence_glucose
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
  await recordFamilyAudit(req.user.id, req.params.ownerId, null, "glucose_viewed");
  res.json({ patient: patientDetails(result.rows[0]) });
}));

app.post("/ai/chat", asyncHandler(async (req, res) => {
  const { message, language_code = "en", profile = {} } = req.body ?? {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }
  const response = await services.ai.chat({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.25,
    max_tokens: 700,
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
  });
  await recordAiRequest(req.user.id, {
    requestType: "chat",
    locale: language_code,
    status: "success",
    model: response.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    usage: response.usage
  });
  res.json({ text: response.choices?.[0]?.message?.content?.trim() ?? "" });
}));

app.post("/ai/search-food", asyncHandler(async (req, res) => {
  const { query, language_code = "en" } = req.body ?? {};
  if (!query || typeof query !== "string" || query.trim().length < 2) {
    return res.status(400).json({ error: "query must contain at least 2 characters" });
  }
  const response = await services.ai.searchFood({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.1,
    max_tokens: 900,
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
  });
  await recordAiRequest(req.user.id, {
    requestType: "search_food",
    locale: language_code,
    status: "success",
    model: response.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    usage: response.usage
  });
  let data;
  try {
    data = JSON.parse(response.choices?.[0]?.message?.content ?? "{}");
  } catch {
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
  res.json({ items, disclaimer: String(data.disclaimer ?? "").trim() });
}));

app.post("/ai/transcribe", upload.single("audio"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "audio is required" });
  const mimeType = req.file.mimetype || "audio/webm";
  if (!isAllowedAudioUpload(mimeType, req.file.buffer)) {
    return res.status(415).json({ error: "unsupported audio type" });
  }
  const languageCode = cleanText(req.body?.language_code, 12);
  const response = await services.ai.transcribe({
    buffer: req.file.buffer,
    filename: req.file.originalname || "voice.webm",
    mimeType,
    model: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe",
    language: transcriptionLanguage(languageCode),
  });
  await recordAiRequest(req.user.id, {
    requestType: "transcribe",
    locale: languageCode || "auto",
    status: "success",
    model: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe",
    usage: response.usage
  });
  res.json({ text: String(response.text ?? "").trim() });
}));

app.post("/ai/recognize-food", upload.single("image"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "image is required" });
  const mimeType = req.file.mimetype || "image/jpeg";
  if (!isAllowedImageUpload(mimeType, req.file.buffer)) {
    return res.status(415).json({ error: "unsupported image type" });
  }
  const response = await services.ai.recognizeFood({
    model: process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini",
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
  });
  await recordAiRequest(req.user.id, {
    requestType: "recognize_food",
    locale: cleanText(req.body?.language_code, 12) || "en",
    status: "success",
    model: response.model ?? process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini",
    usage: response.usage
  });
  let data;
  try {
    data = JSON.parse(stripJsonFence(response.output_text ?? "{}"));
  } catch {
    return res.status(502).json({ error: "model returned invalid JSON" });
  }
  const validationError = validateFoodPayload(data);
  if (validationError) return res.status(502).json({ error: validationError });
  res.json({ data });
}));

app.post("/ai/lab-analysis", upload.single("image"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "image is required" });
  const mimeType = req.file.mimetype || "image/jpeg";
  if (!isAllowedImageUpload(mimeType, req.file.buffer)) {
    return res.status(415).json({ error: "unsupported image type" });
  }
  const languageCode = cleanText(req.body?.language_code, 12) || "en";
  const response = await services.ai.analyzeLab({
    model: process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini",
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
  });
  await recordAiRequest(req.user.id, {
    requestType: "lab_analysis",
    locale: languageCode,
    status: "success",
    model: response.model ?? process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini",
    usage: response.usage
  });
  res.json({ text: String(response.output_text ?? "").trim() });
}));

app.post("/ai/medication-check", asyncHandler(async (req, res) => {
  const medications = cleanText(req.body?.medications, 4000);
  if (medications.length < 2) {
    return res.status(400).json({ error: "medications are required" });
  }
  const languageCode = cleanText(req.body?.language_code, 12) || "en";
  const context = cleanText(req.body?.context, 2000);
  const diabetesType = cleanText(req.body?.diabetes_type, 40);
  const response = await services.ai.analyzeMedication({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.1,
    max_tokens: 1100,
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
  });
  await recordAiRequest(req.user.id, {
    requestType: "medication_check",
    locale: languageCode,
    status: "success",
    model: response.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    usage: response.usage
  });
  res.json({ text: response.choices?.[0]?.message?.content?.trim() ?? "" });
}));

app.use((err, req, res, _next) => {
  console.error(err);
  recordSystemError(err, req).catch(() => {});
  if (err?.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ error: "email already registered" });
  }
  res.status(500).json({ error: "internal server error" });
});

const port = isTestRuntime ? 8788 : envNumber("PORT", 8787);
const host = isTestRuntime ? "127.0.0.1" : undefined;
if (isTestRuntime) {
  console.log("GLUCOTRACK TEST RUNTIME");
  console.log("Environment: TEST");
  console.log(`Database: ${process.env.TEST_DATABASE_NAME}`);
  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log("SMTP: MOCK");
  console.log("Stripe: MOCK");
  console.log("OpenAI: MOCK");
  console.log("Production secrets: BLOCKED");
}
console.log("Checking and installing the database...");
await initializeDatabase();
// Server-side escalation remains active even when neither patient nor family
// member currently has the app open. Delivery is through the existing in-app
// notification channel; external SMS/push providers are intentionally not
// simulated here.
setInterval(() => {
  escalateActiveSosEvents().catch((error) => console.error("SOS escalation failed", error));
}, 60_000).unref();
app.listen(port, ...(host ? [host] : []), () => {
  console.log(`GlucoTrack backend listening on ${host ? `${host}:` : ""}${port}`);
  if (isTestRuntime) console.log("Status: READY");
});

async function authGuard(req, res, next) {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return res.status(401).json({ error: "unauthorized" });
  try {
    req.user = jwt.verify(header.slice(7), jwtSecret());
    const version = await pool.query("SELECT token_version, admin_blocked_at FROM users WHERE id = $1", [req.user.id]);
    if (!version.rowCount || version.rows[0].admin_blocked_at || Number(version.rows[0].token_version) !== Number(req.user.version ?? 0)) {
      return res.status(401).json({ error: "session revoked" });
    }
    if (req.user.scope === "device_management" &&
        !(req.path === "/subscription/status" || req.path.startsWith("/subscription/devices"))) {
      return res.status(403).json({ error: "device management token required" });
    }
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

async function aiLimitGuard(req, res, next) {
  try {
    const aiType = aiRequestType(req.path);
    const isPhoto = ["recognize_food", "lab_analysis"].includes(aiType);
    const access = await resolveAiAccess(req.user.id);
    if (!access) return sendAiLimitError(res, "AI_PREMIUM_REQUIRED", null);

    const requestId = cleanText(req.headers["idempotency-key"], 80) || req.requestId;
    const periodDate = new Date().toISOString().slice(0, 10);
    const limits = access.plan === "family"
      ? { total: 40, photo: 10 }
      : { total: 20, photo: 5 };
    const result = await pool.transaction(async (query) => {
      const lockKey = `ai:${req.user.id}:${periodDate}`;
      await query("INSERT IGNORE INTO ai_limit_locks(lock_key) VALUES($1)", [lockKey]);
      await query("SELECT lock_key FROM ai_limit_locks WHERE lock_key = $1 FOR UPDATE", [lockKey]);
      const duplicate = await query(
        "SELECT status FROM ai_requests WHERE user_id = $1 AND request_id = $2 LIMIT 1",
        [req.user.id, requestId]
      );
      if (duplicate.rowCount) return { code: "AI_REQUEST_IN_PROGRESS" };
      const recent = await query(
        `SELECT created_at FROM ai_requests WHERE user_id = $1
         AND status IN ('reserved', 'success') ORDER BY created_at DESC LIMIT 1`,
        [req.user.id]
      );
      const elapsed = recent.rows[0]?.created_at
        ? Date.now() - new Date(recent.rows[0].created_at).getTime() : Infinity;
      if (elapsed < 5000) return { code: "AI_COOLDOWN_ACTIVE", retry: Math.ceil((5000 - elapsed) / 1000) };
      const minute = await query(
        `SELECT COUNT(*) count FROM ai_requests WHERE user_id = $1
         AND status IN ('reserved', 'success') AND created_at >= UTC_TIMESTAMP() - INTERVAL 1 MINUTE`,
        [req.user.id]
      );
      if (Number(minute.rows[0]?.count ?? 0) >= 5) return { code: "AI_RATE_LIMIT_REACHED", retry: 60 };
      const today = await query(
        `SELECT COUNT(*) total, SUM(is_photo = TRUE) photos FROM ai_requests
         WHERE user_id = $1 AND period_date = $2 AND status IN ('reserved', 'success')`,
        [req.user.id, periodDate]
      );
      const used = Number(today.rows[0]?.total ?? 0);
      const photos = Number(today.rows[0]?.photos ?? 0);
      if (used >= limits.total) return { code: "AI_DAILY_LIMIT_REACHED", used, photos };
      if (isPhoto && photos >= limits.photo) return { code: "AI_PHOTO_DAILY_LIMIT_REACHED", used, photos };
      const globalLimit = envNumber("AI_GLOBAL_DAILY_REQUEST_LIMIT", 0);
      if (globalLimit > 0) {
        const global = await query("SELECT COUNT(*) count FROM ai_requests WHERE period_date = $1 AND status IN ('reserved', 'success')", [periodDate]);
        if (Number(global.rows[0]?.count ?? 0) >= globalLimit) return { code: "AI_GLOBAL_BUDGET_REACHED", used, photos };
      }
      await query(
        `INSERT INTO ai_requests(user_id, request_id, idempotency_key, request_type, locale, status, plan, is_photo, period_date, created_at)
         VALUES($1, $2, $3, $4, $5, 'reserved', $6, $7, $8, UTC_TIMESTAMP())`,
        [req.user.id, requestId, requestId, aiType, cleanText(req.body?.language_code, 16) || "en", access.plan, isPhoto, periodDate]
      );
      return { used: used + 1, photos: photos + (isPhoto ? 1 : 0) };
    });
    if (result.code) return sendAiLimitError(res, result.code, { ...limits, ...result });
    req.aiLimit = { requestId, plan: access.plan, limits, isPhoto, startedAt: Date.now() };
    res.on("finish", () => {
      const status = res.statusCode >= 200 && res.statusCode < 400 ? "success" : "rejected";
      pool.query(
        "UPDATE ai_requests SET status = $1, duration_ms = $2 WHERE user_id = $3 AND request_id = $4 AND status = 'reserved'",
        [status, Date.now() - req.aiLimit.startedAt, req.user.id, requestId]
      ).catch(() => {});
    });
    next();
  } catch (error) { next(error); }
}

async function resolveAiAccess(userId) {
  const result = await pool.query(
    `SELECT premium_status, premium_plan, premium_until, subscription_status, subscription_expires_at
     FROM users WHERE id = $1`, [userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  // Family access is a read-only relation to the patient's explicitly shared
  // data. It must never inherit the owner's paid features (AI, reports,
  // diary writes, or any other Premium capability). A caregiver can use AI
  // only after purchasing their own subscription.
  if (subscriptionPayload(row).accessStatus === "subscribed") return { plan: isFamilyPlan(row.premium_plan) ? "family" : "premium" };
  return null;
}

function aiRequestType(path) {
  return ({ "/chat": "chat", "/search-food": "search_food", "/transcribe": "transcribe", "/recognize-food": "recognize_food", "/lab-analysis": "lab_analysis", "/medication-check": "medication_check" })[path] ?? "other";
}

function sendAiLimitError(res, code, detail) {
  const retry = Number(detail?.retry ?? 0);
  return res.status(429).json({ code, message_key: `ai.${code.toLowerCase()}`, limit: detail?.total ?? 0, used: detail?.used ?? 0, remaining: Math.max(0, (detail?.total ?? 0) - (detail?.used ?? 0)), next_reset_at: `${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}T00:00:00.000Z`, ...(retry ? { retry_after_seconds: retry } : {}) });
}

async function reconcileFamilyAccess(ownerUserId) {
  return pool.transaction(async (query) => {
    const result = await query(
      `SELECT premium_status, premium_plan, premium_until, subscription_status,
         subscription_expires_at, trial_started_at, trial_ends_at, trial_used
       FROM users WHERE id = $1 FOR UPDATE`,
      [ownerUserId]
    );
    const subscription = subscriptionPayload(result.rows[0] ?? {});
    const active = subscription.premium && isFamilyPlan(subscription.premiumPlan);
    if (active) {
      await query(
        `UPDATE family_links SET status = CASE
           WHEN caregiver_user_id IS NULL AND expires_at > UTC_TIMESTAMP() THEN 'pending'
           WHEN caregiver_user_id IS NOT NULL THEN 'accepted'
           ELSE 'revoked' END
         WHERE owner_user_id = $1 AND status = 'suspended'`,
        [ownerUserId]
      );
    } else {
      await query(
        `UPDATE family_links SET status = 'suspended'
         WHERE owner_user_id = $1 AND status IN ('pending', 'accepted')`,
        [ownerUserId]
      );
    }
    return active;
  });
}

async function applyStripeSubscription(subscription, eventCreated, fallbackUserId = null) {
  const state = stripeSubscriptionState(subscription, Math.floor(Date.now() / 1000), billingPricePlanMap());
  if (!state.id) throw new Error("Stripe subscription id is required");
  const existing = await pool.query("SELECT id FROM users WHERE stripe_subscription_id = $1", [state.id]);
  const existingByCustomer = state.customerId
    ? await pool.query("SELECT id FROM users WHERE stripe_customer_id = $1", [state.customerId])
    : { rows: [] };
  const userId = existing.rows[0]?.id ?? existingByCustomer.rows[0]?.id ?? (state.userId || fallbackUserId);
  if (!userId) throw new Error("Stripe subscription is not linked to a GlukoTrack user");
  await pool.transaction(async (query) => {
    await query(
      `UPDATE users SET premium_status = $1, subscription_status = $2, premium_plan = $3,
         premium_until = IF($4 > 0, FROM_UNIXTIME($4), NULL),
         subscription_expires_at = IF($4 > 0, FROM_UNIXTIME($4), NULL),
         stripe_customer_id = $5, stripe_subscription_id = $6,
         stripe_event_created_at = FROM_UNIXTIME($7)
       WHERE id = $8 AND (stripe_event_created_at IS NULL OR stripe_event_created_at <= FROM_UNIXTIME($7))`,
      [state.active ? "active" : "inactive", state.status, state.plan, state.periodEnd,
        state.customerId, state.id, eventCreated, userId]
    );
    await query(
      `INSERT INTO subscriptions(user_id, provider, provider_subscription_id, plan, status,
         expires_at, event_created_at, updated_at)
       VALUES($1, 'stripe', $2, $3, $4, IF($5 > 0, FROM_UNIXTIME($5), NULL), FROM_UNIXTIME($6), UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         plan = IF(event_created_at IS NULL OR event_created_at <= VALUES(event_created_at), VALUES(plan), plan),
         status = IF(event_created_at IS NULL OR event_created_at <= VALUES(event_created_at), VALUES(status), status),
         expires_at = IF(event_created_at IS NULL OR event_created_at <= VALUES(event_created_at), VALUES(expires_at), expires_at),
         updated_at = IF(event_created_at IS NULL OR event_created_at <= VALUES(event_created_at), UTC_TIMESTAMP(), updated_at),
         event_created_at = GREATEST(COALESCE(event_created_at, VALUES(event_created_at)), VALUES(event_created_at))`,
      [userId, state.id, state.plan, state.status, state.periodEnd, eventCreated]
    );
  });
  if (state.active) {
    await processReferralPayment({
      userId,
      plan: state.plan,
      provider: "stripe",
      paymentId: state.id
    }).catch((error) => console.error("Referral reward processing failed", error?.message ?? error));
  }
  await reconcileFamilyAccess(userId);
}

function billingPricePlanMap() {
  const map = {};
  const entries = [
    ["STRIPE_MONTHLY_PRICE_ID", "monthly"],
    ["STRIPE_SEMIANNUAL_PRICE_ID", "semiannual"],
    ["STRIPE_YEARLY_PRICE_ID", "yearly"],
    ["STRIPE_FAMILY_PRICE_ID", "family"],
    ["STRIPE_FAMILY_SEMIANNUAL_PRICE_ID", "family_semiannual"],
    ["STRIPE_FAMILY_YEARLY_PRICE_ID", "family_yearly"],
  ];
  for (const [envName, plan] of entries) {
    const value = process.env[envName]?.trim();
    if (value) {
      map[value] = plan;
    }
  }
  return map;
}

function authPayload(user, { scope = "access" } = {}) {
  return {
    token: jwt.sign(
      { id: String(user.id), email: user.email, scope, version: Number(user.token_version ?? 0) },
      jwtSecret(),
      { expiresIn: process.env.JWT_EXPIRES_IN ?? "30d" }
    ),
    user: publicUser(user)
  };
}

async function issueSessionTokens(user, device, { existingRefreshTokenId = null } = {}) {
  const payload = authPayload(user);
  const refreshToken = randomBytes(48).toString("base64url");
  const refreshExpiresAt = new Date(Date.now() + refreshTokenTtlMs());
  await pool.query("DELETE FROM refresh_tokens WHERE expires_at <= UTC_TIMESTAMP()");
  await persistRefreshToken({
    existingRefreshTokenId,
    tokenVersion: Number(user.token_version ?? 0),
    userId: user.id,
    refreshToken,
    device,
    expiresAt: refreshExpiresAt
  });
  return {
    ...payload,
    refreshToken,
    refreshExpiresAt: refreshExpiresAt.toISOString(),
  };
}

async function persistRefreshToken({
  existingRefreshTokenId = null,
  tokenVersion,
  userId,
  refreshToken,
  device,
  expiresAt
}) {
  const refreshTokenHash = hashToken(refreshToken);
  const refreshDevice = normalizeRefreshDevice(userId, device);
  if (existingRefreshTokenId) {
    await pool.query(
      `UPDATE refresh_tokens
       SET token_hash = $1, device_id = $2, device_name = $3, platform = $4,
           fingerprint_hash = $5, token_version = $6, last_used_at = UTC_TIMESTAMP(), expires_at = $7, revoked_at = NULL
       WHERE id = $8`,
      [
        refreshTokenHash,
        refreshDevice.id,
        refreshDevice.name,
        refreshDevice.platform,
        refreshDevice.fingerprintHash,
        tokenVersion,
        expiresAt,
        existingRefreshTokenId
      ]
    );
    return;
  }
  await pool.query(
    `INSERT INTO refresh_tokens
      (user_id, token_hash, device_id, device_name, platform, fingerprint_hash, token_version, created_at, last_used_at, expires_at, revoked_at)
     VALUES($1, $2, $3, $4, $5, $6, $7, UTC_TIMESTAMP(), UTC_TIMESTAMP(), $8, NULL)
     ON DUPLICATE KEY UPDATE
       token_hash = VALUES(token_hash), device_name = VALUES(device_name),
       platform = VALUES(platform), fingerprint_hash = VALUES(fingerprint_hash),
       token_version = VALUES(token_version),
       last_used_at = VALUES(last_used_at), expires_at = VALUES(expires_at), revoked_at = NULL`,
    [
      userId,
      refreshTokenHash,
      refreshDevice.id,
      refreshDevice.name,
      refreshDevice.platform,
      refreshDevice.fingerprintHash,
      tokenVersion,
      expiresAt
    ]
  );
}

function normalizeRefreshDevice(userId, device) {
  const safeId = cleanText(device?.id, 128);
  const safeName = cleanText(device?.name, 120) || "Unknown device";
  const safePlatform = cleanText(device?.platform, 32).toLowerCase() || "unknown";
  const safeFingerprintHash = device?.fingerprint ? hashToken(`${userId}|${safePlatform}|${safeName}|${cleanText(device.fingerprint, 512)}`) : null;
  return {
    id: safeId || `device-${userId}`,
    name: safeName,
    platform: safePlatform,
    fingerprintHash: safeFingerprintHash
  };
}

async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE token_hash = $1",
    [tokenHash]
  );
}

async function revokeRefreshTokenForUserAndDevice(userId, deviceIdValue) {
  const deviceId = cleanText(deviceIdValue, 128);
  if (!deviceId) return;
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL",
    [userId, deviceId]
  );
}

async function revokeAllRefreshTokensForUser(userId) {
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = $1 AND revoked_at IS NULL",
    [userId]
  );
}

function refreshTokenTtlMs() {
  const days = envNumber("REFRESH_TOKEN_TTL_DAYS", 30);
  return Math.max(days, 1) * 24 * 60 * 60 * 1000;
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
  const hasPaidAccess = String(row.premium_status ?? "") === "active" && Boolean(subscriptionUntil) &&
    new Date(subscriptionUntil).getTime() > now;
  const accessStatus = hasPaidAccess ? "subscribed" : trialActive ? "trial_active" :
    row.trial_used ? "trial_expired" : "free";
  return {
    premium: hasPaidAccess || trialActive,
    premiumStatus: hasPaidAccess ? "active" : trialActive ? "trialing" : "inactive",
    premiumPlan: row.premium_plan ?? null,
    premiumUntil: hasPaidAccess ? subscriptionUntil : trialActive ? trialUntil : null,
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
  const tokenHash = hashToken(token);
  const user = await pool.query(
    `SELECT id FROM users
     WHERE email_verification_token_hash = $1
       AND email_verification_expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    [tokenHash]
  );
  const userId = user.rows[0]?.id;
  if (!userId) return false;
  const result = await pool.query(
    `UPDATE users SET email_verified = TRUE, email_verification_token_hash = NULL,
       email_verification_expires_at = NULL
     WHERE id = $1`,
    [userId]
  );
  if (result.rowCount > 0) {
    await markReferralEmailVerified(userId).catch(() => {});
    return true;
  }
  return false;
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

async function sendVerificationEmail(email, name, verificationUrl) {
  return services.email.sendVerificationEmail({ email, verificationUrl });
}

async function sendPasswordResetEmail(email, name, resetUrl) {
  return services.email.sendPasswordResetEmail({ email, resetUrl });
}

async function sendFamilyInvitationEmail({ email, inviteCode, locale }) {
  const language = supportedLocale(locale);
  const message = FAMILY_INVITATION_EMAIL[language] ?? FAMILY_INVITATION_EMAIL.en;
  const appUrl = (process.env.APP_PUBLIC_URL ?? "https://glukotrack.com/app/").replace(/\/$/, "");
  const invitationUrl = familyInvitationUrl(inviteCode);
  return services.email.sendFamilyInvitationEmail({
    email,
    message,
    inviteCode,
    invitationUrl,
    applicationUrl: appUrl
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
    subject: "Вас пригласили в GlucoTrack",
    title: "Вас пригласили в GlucoTrack",
    body: "Нажмите кнопку ниже, войдите в свой аккаунт и примите семейный доступ.",
    code: "Код приглашения",
    expires: "Срок действия приглашения — 72 часа.",
  },
  pl: {
    subject: "Zostałeś zaproszony do GlucoTrack",
    title: "Zostałeś zaproszony do GlucoTrack",
    body: "Otwórz GlucoTrack i wpisz ten kod zaproszenia, aby zaakceptować dostęp.",
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
  en:["Enter a new password of at least 8 characters.","Save new password","Saving…","Password changed. You can return to GlukoTrack.","The link is invalid or expired."],
  de:["Geben Sie ein neues Passwort mit mindestens 8 Zeichen ein.","Neues Passwort speichern","Wird gespeichert…","Passwort geändert. Sie können zu GlukoTrack zurückkehren.","Der Link ist ungültig oder abgelaufen."],
  fr:["Saisissez un nouveau mot de passe d’au moins 8 caractères.","Enregistrer le nouveau mot de passe","Enregistrement…","Mot de passe modifié. Vous pouvez revenir à GlukoTrack.","Le lien est invalide ou a expiré."],
  es:["Introduzca una nueva contraseña de al menos 8 caracteres.","Guardar nueva contraseña","Guardando…","Contraseña cambiada. Puede volver a GlukoTrack.","El enlace no es válido o ha caducado."],
  it:["Inserisci una nuova password di almeno 8 caratteri.","Salva nuova password","Salvataggio…","Password modificata. Puoi tornare a GlukoTrack.","Il link non è valido o è scaduto."],
  pl:["Wprowadź nowe hasło składające się z co najmniej 8 znaków.","Zapisz nowe hasło","Zapisywanie…","Hasło zmienione. Możesz wrócić do GlukoTrack.","Link jest nieprawidłowy lub wygasł."],
  uk:["Введіть новий пароль щонайменше з 8 символів.","Зберегти новий пароль","Збереження…","Пароль змінено. Можна повернутися до GlukoTrack.","Посилання недійсне або прострочене."],
  ru:["Введите новый пароль длиной не менее 8 символов.","Сохранить новый пароль","Сохранение…","Пароль изменён. Можно вернуться в GlukoTrack.","Ссылка недействительна или устарела."],
  pt:["Introduza uma nova palavra-passe com pelo menos 8 caracteres.","Guardar nova palavra-passe","A guardar…","Palavra-passe alterada. Pode voltar ao GlukoTrack.","A ligação é inválida ou expirou."],
  nl:["Voer een nieuw wachtwoord van minimaal 8 tekens in.","Nieuw wachtwoord opslaan","Opslaan…","Wachtwoord gewijzigd. U kunt terugkeren naar GlukoTrack.","De link is ongeldig of verlopen."],
  ro:["Introduceți o parolă nouă de cel puțin 8 caractere.","Salvați parola nouă","Se salvează…","Parola a fost schimbată. Puteți reveni la GlukoTrack.","Linkul este invalid sau a expirat."],
  cs:["Zadejte nové heslo o délce alespoň 8 znaků.","Uložit nové heslo","Ukládání…","Heslo bylo změněno. Můžete se vrátit do GlukoTrack.","Odkaz je neplatný nebo vypršel."],
  sk:["Zadajte nové heslo s najmenej 8 znakmi.","Uložiť nové heslo","Ukladanie…","Heslo bolo zmenené. Môžete sa vrátiť do GlukoTrack.","Odkaz je neplatný alebo vypršal."],
  hu:["Adjon meg egy legalább 8 karakteres új jelszót.","Új jelszó mentése","Mentés…","A jelszó megváltozott. Visszatérhet a GlukoTrackhez.","A hivatkozás érvénytelen vagy lejárt."],
  sv:["Ange ett nytt lösenord med minst 8 tecken.","Spara nytt lösenord","Sparar…","Lösenordet har ändrats. Du kan återgå till GlukoTrack.","Länken är ogiltig eller har upphört."],
  da:["Indtast en ny adgangskode på mindst 8 tegn.","Gem ny adgangskode","Gemmer…","Adgangskoden er ændret. Du kan vende tilbage til GlukoTrack.","Linket er ugyldigt eller udløbet."],
  fi:["Anna uusi vähintään 8 merkin salasana.","Tallenna uusi salasana","Tallennetaan…","Salasana vaihdettu. Voit palata GlukoTrackiin.","Linkki on virheellinen tai vanhentunut."],
  no:["Skriv inn et nytt passord på minst 8 tegn.","Lagre nytt passord","Lagrer…","Passordet er endret. Du kan gå tilbake til GlukoTrack.","Lenken er ugyldig eller utløpt."],
  el:["Εισαγάγετε νέο κωδικό πρόσβασης τουλάχιστον 8 χαρακτήρων.","Αποθήκευση νέου κωδικού","Αποθήκευση…","Ο κωδικός άλλαξε. Μπορείτε να επιστρέψετε στο GlukoTrack.","Ο σύνδεσμος δεν είναι έγκυρος ή έχει λήξει."],
  tr:["En az 8 karakterli yeni bir parola girin.","Yeni parolayı kaydet","Kaydediliyor…","Parola değiştirildi. GlukoTrack’e dönebilirsiniz.","Bağlantı geçersiz veya süresi dolmuş."],
  bg:["Въведете нова парола с поне 8 знака.","Запазване на новата парола","Запазване…","Паролата е променена. Можете да се върнете в GlukoTrack.","Връзката е невалидна или изтекла."],
  hr:["Unesite novu lozinku od najmanje 8 znakova.","Spremi novu lozinku","Spremanje…","Lozinka je promijenjena. Možete se vratiti u GlukoTrack.","Poveznica nije valjana ili je istekla."],
  sl:["Vnesite novo geslo z vsaj 8 znaki.","Shrani novo geslo","Shranjevanje…","Geslo je spremenjeno. Lahko se vrnete v GlukoTrack.","Povezava ni veljavna ali je potekla."],
  lt:["Įveskite naują bent 8 simbolių slaptažodį.","Išsaugoti naują slaptažodį","Išsaugoma…","Slaptažodis pakeistas. Galite grįžti į GlukoTrack.","Nuoroda netinkama arba nebegalioja."],
  lv:["Ievadiet jaunu paroli ar vismaz 8 rakstzīmēm.","Saglabāt jauno paroli","Saglabā…","Parole mainīta. Varat atgriezties GlukoTrack.","Saite nav derīga vai ir beidzies tās termiņš."],
  et:["Sisestage uus vähemalt 8 tähemärgi pikkune parool.","Salvesta uus parool","Salvestamine…","Parool on muudetud. Võite naasta GlukoTracki.","Link on vigane või aegunud."],
  sr:["Унесите нову лозинку од најмање 8 знакова.","Сачувај нову лозинку","Чување…","Лозинка је промењена. Можете се вратити у GlukoTrack.","Веза је неважећа или је истекла."],
  sq:["Vendosni një fjalëkalim të ri me të paktën 8 shenja.","Ruaj fjalëkalimin e ri","Duke ruajtur…","Fjalëkalimi u ndryshua. Mund të ktheheni te GlukoTrack.","Lidhja është e pavlefshme ose ka skaduar."],
  mk:["Внесете нова лозинка од најмалку 8 знаци.","Зачувај нова лозинка","Зачувување…","Лозинката е сменета. Може да се вратите во GlukoTrack.","Врската е неважечка или истечена."],
  is:["Sláðu inn nýtt lykilorð með að minnsta kosti 8 stöfum.","Vista nýtt lykilorð","Vista…","Lykilorðinu var breytt. Þú getur farið aftur í GlukoTrack.","Tengillinn er ógildur eða útrunninn."]
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
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GlukoTrack</title><style>body{font-family:Arial;background:#f4f8fc;margin:0;padding:24px;color:#182230}.card{max-width:440px;margin:8vh auto;background:white;padding:24px;border-radius:16px;box-shadow:0 8px 30px #0002}input,button{box-sizing:border-box;width:100%;padding:13px;margin-top:12px;font-size:16px;border-radius:8px}button{border:0;background:#075bbb;color:white;font-weight:700}.ok{color:#027a48}.error{color:#b42318}</style></head><body><main class="card"><h1>GlukoTrack</h1><p>${escapeHtml(strings.prompt)}</p><form id="form"><input id="password" aria-label="${escapeHtml(strings.prompt)}" type="password" minlength="8" maxlength="128" autocomplete="new-password" required><button type="submit">${escapeHtml(strings.save)}</button></form><p id="status" role="status"></p></main><script>const token=${safeToken},i18n=${i18n};document.getElementById('form').addEventListener('submit',async e=>{e.preventDefault();const status=document.getElementById('status');status.textContent=i18n.saving;status.className='';try{const r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({token,password:document.getElementById('password').value})});if(!r.ok)throw new Error();status.textContent=i18n.changed;status.className='ok';e.target.remove();}catch(_){status.textContent=i18n.invalidLink;status.className='error';}});</script></body></html>`;
}

function isFamilyPlan(plan) {
  return ["family", "family_semiannual", "family_yearly"].includes(plan);
}

function deviceLimit(plan) {
  return isFamilyPlan(plan) ? 8 : 3;
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
  return sanitizeDeviceIdentity(value);
}

async function registerAccountDevice(userId, value, { enforceLimit = false } = {}) {
  const device = sanitizeDevice(value);
  if (!device) return null;
  const fingerprintHash = createHash("sha256")
    .update(`${userId}|${device.platform}|${device.name}|${device.fingerprint || device.id}`)
    .digest("hex");
  return pool.transaction(async (query) => {
    const subscriptionResult = await query(
      "SELECT premium_plan FROM users WHERE id = $1 FOR UPDATE", [userId]
    );
    await query(
      "SELECT id FROM account_devices WHERE user_id = $1 AND revoked_at IS NULL FOR UPDATE",
      [userId]
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
     ) VALUES($1, $2, $3, $4, $5, UTC_TIMESTAMP(), NULL)
     ON DUPLICATE KEY UPDATE
       device_name = VALUES(device_name), platform = VALUES(platform),
       fingerprint_hash = VALUES(fingerprint_hash), last_seen_at = UTC_TIMESTAMP(), revoked_at = NULL`,
    [userId, canonicalId, device.name, device.platform, fingerprintHash]
  );
    return { id: canonicalId };
  });
}

async function touchAccountDevice(userId, deviceIdValue) {
  const deviceId = cleanText(deviceIdValue, 128);
  if (!deviceId) return;
  await pool.query(
    "UPDATE account_devices SET last_seen_at = UTC_TIMESTAMP() WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL",
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
  return {
    id: String(row.id),
    email: row.invite_email,
    fullName: row.full_name ?? row.member_name ?? null,
    role: row.member_role ?? "guardian",
    inviteCode: row.invite_code,
    permissions: row.permissions,
    status: row.status,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    emailSent: row.email_sent === true || Number(row.email_sent) === 1,
    emailSentAt: row.email_sent_at,
    emailError: row.email_error ?? null
  };
}

function patientSummary(row) {
  const profile = row.payload?.profile ?? {};
  const permissions = normalizeFamilyPermissions(row.permissions);
  // profile.glucoseMmol is a cached fallback. A manual measurement or a
  // sensor reading is the clinical source of truth, so use the latest valid
  // reading already present in the patient's synced snapshot.
  const latest = latestFamilyGlucose(row.payload);
  return {
    id: String(row.owner_user_id),
    fullName: row.full_name,
    email: row.email,
    permissions,
    glucoseMmol: permissions.glucose ? latest.value ?? null : null,
    glucoseUnitPreference: permissions.glucose
      ? profile.glucoseUnitPreference ?? "mmolL"
      : "mmolL",
    glucoseMeasuredAt: permissions.glucose ? latest.measuredAt ?? null : null,
    latestRecords: permissions.history ? familyLatestRecords(row.payload) : null,
    sensor: permissions.glucose ? familySensorStatus(row.payload) : null,
    // Presence is independent from cloud snapshot sync. Never infer online
    // status from a glucose reading or a stale backup timestamp.
    lastSeenAt: row.last_seen ?? null,
    isOnline: row.online_status === true || Number(row.online_status) === 1
      ? isFamilyPresenceOnline(row.last_seen) : false,
    battery: row.battery == null ? null : Number(row.battery),
    updatedAt: row.updated_at
  };
}

function familyLatestRecords(payload) {
  const entries = Array.isArray(payload?.diaryEntries) ? payload.diaryEntries : [];
  const latest = (predicate) => latestSnapshotGlucose(entries.filter(predicate));
  const record = (predicate, field) => {
    const matches = entries.filter((entry) => Number(entry?.[field]) > 0 && predicate(entry));
    if (!matches.length) return null;
    matches.sort((a, b) => new Date(b.time) - new Date(a.time));
    const item = matches[0];
    return { value: Number(item[field]), at: item.time };
  };
  const notes = entries.filter((entry) => String(entry?.note ?? "").trim());
  notes.sort((a, b) => new Date(b.time) - new Date(a.time));
  return {
    insulin: record(() => true, "insulinUnits"),
    carbohydrates: record(() => true, "carbs"),
    note: notes.length ? { value: String(notes[0].note).trim(), at: notes[0].time } : null
  };
}

function familySensorStatus(payload) {
  const latest = latestSnapshotGlucose(payload?.sensorReadings);
  if (!latest || !latest.measuredAtDate) return { active: false, lastAt: null };
  return {
    active: Date.now() - latest.measuredAtDate.getTime() <= 20 * 60 * 1000,
    // Keep the patient's originally saved local timestamp. Serializing a
    // Date here turns it into UTC and the browser applies the timezone again.
    lastAt: latest.measuredAt
  };
}

function latestFamilyGlucose(payload) {
  const profile = payload?.profile ?? {};
  // Match the patient's dashboard: compare manual and sensor measurements by
  // their measurement time, then use the newest valid reading. The profile
  // value remains a fallback for older snapshots which have no history yet.
  const readings = [
    ...(Array.isArray(payload?.diaryEntries) ? payload.diaryEntries : []),
    ...(Array.isArray(payload?.sensorReadings) ? payload.sensorReadings : [])
  ];
  const profileValue = Number(profile.glucoseMmol);
  // The visible profile value and its timestamp must always belong to the
  // same reading. Never attach a newer, unrelated diary/sensor timestamp.
  const matching = Number.isFinite(profileValue) && profileValue > 0
    ? latestSnapshotGlucose(readings.filter((reading) => Math.abs(Number(reading?.glucoseMmol) - profileValue) < 0.0001))
    : null;
  if (matching) return matching;
  const latest = latestSnapshotGlucose(readings);
  if (latest) return latest;
  const fallback = profileValue;
  return Number.isFinite(fallback) && fallback > 0
    ? { value: fallback, measuredAt: null, measuredAtDate: null }
    : { value: null, measuredAt: null, measuredAtDate: null };
}

function latestSnapshotGlucose(readings) {
  if (!Array.isArray(readings)) return null;
  let latest = null;
  for (const reading of readings) {
    const value = Number(reading?.glucoseMmol);
    if (!Number.isFinite(value) || value <= 0) continue;
    const parsed = new Date(reading?.time);
    const measuredAtDate = Number.isNaN(parsed.getTime()) ? null : parsed;
    if (!latest || (measuredAtDate && (!latest.measuredAtDate || measuredAtDate > latest.measuredAtDate))) {
      latest = {
        value,
        // Diary timestamps are stored as the patient's local wall-clock time.
        // Returning the original string prevents a UTC-to-local double shift.
        measuredAt: typeof reading?.time === "string" ? reading.time : null,
        measuredAtDate
      };
    }
  }
  return latest;
}

function patientDetails(row) {
  const payload = row.payload ?? {};
  const permissions = normalizeFamilyPermissions(row.permissions);
  return {
    id: String(row.id),
    fullName: row.full_name,
    email: row.email,
    permissions,
    profile: permissions.glucose ? payload.profile ?? null : null,
    sensorReadings: permissions.history ? payload.sensorReadings ?? [] : [],
    diaryEntries: permissions.history ? payload.diaryEntries ?? [] : [],
    emergency: permissions.emergency ? payload.emergency ?? null : null,
    updatedAt: row.updated_at
  };
}

function sanitizePermissions(value) {
  return {
    glucose: value?.glucose !== false && value?.viewGlucose !== false,
    history: value?.history === true || value?.viewInsulin === true || value?.viewFood === true,
    emergency: value?.emergency === true || value?.sosAccess === true || value?.receiveAlerts === true,
    viewGlucose: value?.glucose !== false && value?.viewGlucose !== false,
    viewInsulin: value?.viewInsulin === true,
    viewFood: value?.viewFood === true,
    viewReports: value?.viewReports === true,
    receiveAlerts: value?.receiveAlerts === true,
    sosAccess: value?.sosAccess === true || value?.emergency === true
  };
}

function normalizeFamilyPermissions(value) {
  return {
    glucose: value?.glucose === true,
    history: value?.history === true,
    emergency: value?.emergency === true,
    viewGlucose: value?.viewGlucose === true || value?.glucose === true,
    viewInsulin: value?.viewInsulin === true,
    viewFood: value?.viewFood === true,
    viewReports: value?.viewReports === true,
    receiveAlerts: value?.receiveAlerts === true,
    sosAccess: value?.sosAccess === true || value?.emergency === true
  };
}

function familyRole(value) {
  return ["patient", "guardian", "doctor"].includes(value) ? value : "guardian";
}

async function escalateActiveSosEvents() {
  const active = await pool.query(
    `SELECT id, user_id, activated_at, escalated_5_at, escalated_15_at
     FROM sos_events WHERE status = 'active'
       AND activated_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)`
  );
  for (const event of active.rows) {
    const ageMinutes = Math.floor((Date.now() - new Date(event.activated_at).getTime()) / 60_000);
    const level = ageMinutes >= 15 && !event.escalated_15_at ? 15 :
      ageMinutes >= 5 && !event.escalated_5_at ? 5 : null;
    if (level == null) continue;
    const column = level === 15 ? 'escalated_15_at' : 'escalated_5_at';
    const claimed = await pool.query(
      `UPDATE sos_events SET ${column} = UTC_TIMESTAMP()
       WHERE id = $1 AND status = 'active' AND ${column} IS NULL`, [event.id]
    );
    if (!claimed.rowCount) continue;
    const caregivers = await pool.query(
      `SELECT caregiver_user_id, permissions FROM family_links
       WHERE owner_user_id = $1 AND status = 'accepted' AND caregiver_user_id IS NOT NULL`,
      [event.user_id]
    );
    const title = level === 15 ? 'SOS: пациент не подтвердил безопасность' : 'SOS всё ещё активен';
    const body = level === 15
      ? 'Прошло 15 минут с момента SOS. Откройте мониторинг пациента.'
      : 'Прошло 5 минут с момента SOS. Пациент ещё не отменил тревогу.';
    for (const caregiver of caregivers.rows) {
      const permissions = normalizeFamilyPermissions(caregiver.permissions);
      if (!permissions.alerts && !permissions.emergency) continue;
      await pool.query(
        `INSERT INTO notifications(user_id, type, title, body, metadata)
         VALUES($1, 'sos', $2, $3, $4)`,
        [caregiver.caregiver_user_id, title, body,
          { eventId: String(event.id), patientId: String(event.user_id), escalationMinutes: level }]
      );
    }
    await recordFamilyAudit(event.user_id, event.user_id, null, `sos_escalated_${level}m`);
  }
}

async function recordFamilyAudit(actorUserId, subjectUserId, familyMemberId, action, details = null) {
  await pool.query(
    "INSERT INTO family_access_audit(actor_user_id, subject_user_id, family_member_id, action, details) VALUES($1, $2, $3, $4, $5)",
    [actorUserId, subjectUserId, familyMemberId, action, details]
  ).catch(() => {});
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

async function sosPinAccessState(profile, req) {
  const ipAddress = cleanText(req.ip, 64);
  const activeLock = await pool.query(
    `SELECT locked_until, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), locked_until) AS retry_after
     FROM sos_pin_attempts
     WHERE public_token = $1 AND ip_address = $2 AND locked_until > UTC_TIMESTAMP()
     ORDER BY locked_until DESC LIMIT 1`,
    [profile.public_token, ipAddress]
  );
  if (activeLock.rowCount) {
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Number(activeLock.rows[0].retry_after ?? 1)),
      nextDelaySeconds: 0
    };
  }
  const failures = await pool.query(
    `SELECT COUNT(*) AS count FROM sos_pin_attempts
     WHERE public_token = $1 AND ip_address = $2 AND success = FALSE
       AND attempted_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${sosPinWindowSeconds()} SECOND)`,
    [profile.public_token, ipAddress]
  );
  const nextPolicy = sosPinAttemptPolicy(Number(failures.rows[0]?.count ?? 0) + 1);
  return {
    locked: false,
    retryAfterSeconds: 0,
    nextDelaySeconds: nextPolicy.delaySeconds
  };
}

async function recordSosPinAttempt(profile, req, success, delaySeconds) {
  const lockedUntil = !success && delaySeconds > 0
    ? new Date(Date.now() + delaySeconds * 1000)
    : null;
  await pool.query(
    `INSERT INTO sos_pin_attempts(
       user_id, public_token, ip_address, user_agent, success, locked_until
     ) VALUES($1, $2, $3, $4, $5, $6)`,
    [
      profile.user_id,
      profile.public_token,
      cleanText(req.ip, 64),
      cleanText(req.headers["user-agent"], 512),
      success,
      lockedUntil
    ]
  );
}

async function purgeExpiredSosScans(userId) {
  await pool.query(
    `DELETE FROM sos_scans
     WHERE user_id = $1 AND scanned_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${sosScanRetentionDays()} DAY)`,
    [userId]
  );
}

async function purgeOldSyncChanges(query, userId) {
  const retentionDays = syncChangesRetentionDays();
  if (retentionDays <= 0) return;
  await query(
    `DELETE FROM sync_changes
     WHERE user_id = $1 AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL $2 DAY)`,
    [userId, retentionDays]
  );
}

function syncChangesRetentionDays() {
  return Math.max(1, Math.floor(envNumber("SYNC_CHANGES_RETENTION_DAYS", 30)));
}

function sosScanRetentionDays() {
  return Math.max(1, envNumber("SOS_SCAN_RETENTION_DAYS", 30));
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
  "sendSms", "geoConsent", "sensitiveHidden", "pinPrompt", "open", "disclaimer", "name",
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
  sendSms: "Send SOS SMS with location",
  geoConsent: "Share your current location for this SOS message?",
  sensitiveHidden: "Sensitive data is hidden",
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
<title>SOS • GlucoTrack</title>
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
<b style="color:#b42318">${escapeHtml(labels.diabetes)} • SOS</b></div></div>
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
function scan(pos){fetch(sosPath+'/scan',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},
body:JSON.stringify(pos||{})}).catch(()=>{});}
scan({});
if(new URLSearchParams(location.search).get('print')==='1'){setTimeout(()=>window.print(),500);}
const geoSmsButton=document.getElementById('send-geo-sms');
if(geoSmsButton)geoSmsButton.addEventListener('click',sendGeoSms);
function setGeoStatus(type,text){const status=document.getElementById('geo-status');if(!status)return;
status.className=type||'';status.textContent=text||'';}
function openSms(message){const separator=/iPad|iPhone|iPod/i.test(navigator.userAgent)?'&':'?';
location.href='sms:'+emergencyPhone+separator+'body='+encodeURIComponent(message);}
function sendGeoSms(){if(!emergencyPhone){setGeoStatus('error',i18n.error);return;}
if(!navigator.geolocation){setGeoStatus('error',i18n.error);return;}
if(!confirm(i18n.geoConsent||i18n.sendSms+'?')){setGeoStatus('','');return;}
geoSmsButton.disabled=true;setGeoStatus('',i18n.checking);
navigator.geolocation.getCurrentPosition(position=>{const coords=position.coords;
const latitude=Number(coords.latitude).toFixed(6);const longitude=Number(coords.longitude).toFixed(6);
const mapsUrl='https://maps.google.com/?q='+latitude+','+longitude;
const message='SOS GlucoTrack: '+patientName+'. '+latitude+', '+longitude+'. '+mapsUrl+'.';
scan({latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy});
setGeoStatus('success',i18n.success);
openSms(message);setTimeout(()=>{geoSmsButton.disabled=false;},1500);
},()=>{geoSmsButton.disabled=false;setGeoStatus('error',i18n.error);},
{enableHighAccuracy:true,timeout:15000,maximumAge:30000});}
const unlockForm=document.getElementById('unlock-form');
if(unlockForm)unlockForm.addEventListener('submit',unlock);
async function unlock(event){event.preventDefault();const button=document.getElementById('unlock-button');
const status=document.getElementById('unlock-status');button.disabled=true;status.className='';status.textContent=i18n.checking;
try{const response=await fetch(sosPath+'/unlock',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},
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
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      event: "sos.qr_scanned",
      userId: String(profile.user_id),
      code: "SOS_QR_SCANNED",
      location,
      scannedAt: new Date().toISOString()
    })
  });
}

async function recordAiRequest(userId, { requestType, locale, status, model, usage } = {}) {
  const inputTokens = Number(usage?.prompt_tokens ?? usage?.input_tokens ?? 0) || null;
  const outputTokens = Number(usage?.completion_tokens ?? usage?.output_tokens ?? 0) || null;
  const updated = await pool.query(
    `UPDATE ai_requests SET status = $1, model = $2, input_tokens = $3, output_tokens = $4
     WHERE user_id = $5 AND request_type = $6 AND status = 'reserved'
     ORDER BY created_at DESC LIMIT 1`,
    [
      cleanText(status, 32) || "success",
      cleanText(model, 64) || null,
      inputTokens,
      outputTokens,
      userId,
      cleanText(requestType, 64) || "unknown"
    ]
  );
  if (updated.rowCount) return;
  await pool.query(
    `INSERT INTO ai_requests(user_id, request_type, locale, status, model, input_tokens, output_tokens, created_at)
     VALUES($1, $2, $3, $4, $5, $6, $7, UTC_TIMESTAMP())`,
    [
      userId,
      cleanText(requestType, 64) || "unknown",
      cleanText(locale, 16) || "en",
      cleanText(status, 32) || "success",
      cleanText(model, 64) || null,
      inputTokens,
      outputTokens
    ]
  );
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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

async function recordSystemError(error, req) {
  const source = req?.path?.startsWith("/admin") ? "admin_api" : "api";
  const code = cleanText(error?.code || error?.name || "INTERNAL_ERROR", 96);
  const endpoint = cleanText(`${req?.method ?? "UNKNOWN"} ${req?.path ?? ""}`, 255);
  const safeMessage = cleanText(error instanceof Error ? error.message : "internal error", 512)
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/password=([^&\s]+)/gi, "password=[redacted]")
    .replace(/token=([^&\s]+)/gi, "token=[redacted]");
  const dedupeKey = createHash("sha256")
    .update(`${source}|${code}|${endpoint}|${safeMessage}`)
    .digest("hex");
  await pool.query(
    `INSERT INTO system_errors(source,severity,code,endpoint,dedupe_key,safe_message,status,occurrences,first_seen_at,last_seen_at)
     VALUES($1,'error',$2,$3,$4,$5,'open',1,UTC_TIMESTAMP(),UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE occurrences = occurrences + 1, last_seen_at = UTC_TIMESTAMP()`,
    [source, code, endpoint, dedupeKey, safeMessage]
  ).catch(async () => {
    await pool.query(
      "INSERT INTO system_errors(source,severity,code,endpoint,dedupe_key,safe_message,status) VALUES($1,'error',$2,$3,$4,$5,'open')",
      [source, code, endpoint, dedupeKey, safeMessage]
    );
  });
}


