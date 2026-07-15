import { createHash, randomBytes } from "node:crypto";

import { pool } from "./db.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_SETTINGS = {
  programEnabled: true,
  referrerRewardDays: 14,
  referredRewardEnabled: true,
  referredRewardDays: 7,
  attributionDays: 30,
  monthlyRewardLimit: 10,
  lifetimeRewardLimit: 0,
  minimumPaymentMinor: 1,
  eligiblePlans: ["monthly", "yearly", "family", "premium"],
  reviewDelayDays: 0
};

export function registerReferralPublicRoutes(app, { asyncHandler }) {
  app.get("/referrals/validate/:code", asyncHandler(validateReferralCode));
  app.post("/referrals/track-click", asyncHandler(trackReferralClick));
}

export function registerReferralRoutes(app, { asyncHandler }) {
  app.get("/referrals/me", asyncHandler(myReferralOverview));
  app.get("/referrals/me/code", asyncHandler(myReferralCode));
  app.get("/referrals/me/stats", asyncHandler(myReferralStats));
  app.get("/referrals/me/history", asyncHandler(myReferralHistory));
  app.post("/referrals/attach", asyncHandler(attachReferralForCurrentUser));
}

export function generateReferralCode(bytes = randomBytes(5)) {
  let code = "GT";
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code.slice(0, 8);
}

export function addDays(base, days) {
  const date = new Date(base);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date;
}

export function bestBonusStart(existingUntil, now = new Date()) {
  const until = existingUntil ? new Date(existingUntil) : null;
  return until && until.getTime() > now.getTime() ? until : now;
}

export async function ensureReferralCode(userId, query = pool.query) {
  const existing = await query(
    "SELECT id, code, is_active FROM referral_codes WHERE user_id = $1",
    [userId]
  );
  if (existing.rowCount) return existing.rows[0];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generateReferralCode();
    try {
      const inserted = await query(
        "INSERT INTO referral_codes(user_id, code, is_active) VALUES($1, $2, TRUE)",
        [userId, code]
      );
      return { id: inserted.insertId, code, is_active: true };
    } catch (error) {
      if (error?.code !== "ER_DUP_ENTRY") throw error;
    }
  }
  throw new Error("REFERRAL_CODE_GENERATION_FAILED");
}

export async function attachReferralOnRegistration({ referredUserId, referralCode, clickToken, device, req }) {
  const settings = await referralSettings();
  if (!settings.programEnabled) return null;
  const code = normalizeReferralCode(referralCode);
  if (!code && !clickToken) return null;
  const resolved = await resolveReferralAttribution({ code, clickToken });
  if (!resolved?.referralCodeId || !resolved?.referrerUserId) return null;
  if (String(resolved.referrerUserId) === String(referredUserId)) {
    return createRejectedRelation({
      referrerUserId: resolved.referrerUserId,
      referredUserId,
      referralCodeId: resolved.referralCodeId,
      referralClickId: resolved.referralClickId,
      reason: "self_referral"
    });
  }
  const duplicate = await pool.query(
    "SELECT id FROM referral_relations WHERE referred_user_id = $1 LIMIT 1",
    [referredUserId]
  );
  if (duplicate.rowCount) return duplicate.rows[0];
  const risk = await referralRisk({ referrerUserId: resolved.referrerUserId, referredUserId, device });
  const status = risk.result === "review" ? "manual_review" : "email_pending";
  const relation = await pool.query(
    `INSERT INTO referral_relations(
       referrer_user_id, referred_user_id, referral_code_id, referral_click_id,
       status, registered_at, rejection_reason
     ) VALUES($1, $2, $3, $4, $5, UTC_TIMESTAMP(), $6)`,
    [resolved.referrerUserId, referredUserId, resolved.referralCodeId, resolved.referralClickId, status, risk.reason]
  );
  if (risk.checkType) {
    await recordFraudCheck(relation.insertId, risk.checkType, risk.result, risk.score, risk.reason, {
      platform: device?.platform ?? null
    });
  }
  await notifyUser(resolved.referrerUserId, "referral_registered", "Ваш друг зарегистрировался в GlukoTrack", "Награда будет начислена после первой оплаты Premium.");
  await referralAudit("relation", relation.insertId, "created", null, { status }, null, req);
  return { id: relation.insertId, status };
}

export async function markReferralEmailVerified(userId) {
  await pool.query(
    `UPDATE referral_relations
     SET status = CASE WHEN status = 'email_pending' THEN 'awaiting_payment' ELSE status END,
         email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP())
     WHERE referred_user_id = $1 AND status IN ('email_pending', 'awaiting_payment', 'manual_review')`,
    [userId]
  );
}

export async function processReferralPayment({ userId, plan, amountMinor = null, provider = "stripe", paymentId = null }) {
  const settings = await referralSettings();
  if (!settings.programEnabled) return null;
  if (!settings.eligiblePlans.includes(plan)) return null;
  if (amountMinor != null && Number(amountMinor) < settings.minimumPaymentMinor) return null;
  return pool.transaction(async (query) => {
    const relations = await query(
      `SELECT rr.*, u.email referred_email
       FROM referral_relations rr
       JOIN users u ON u.id = rr.referred_user_id
       WHERE rr.referred_user_id = $1
       ORDER BY rr.id ASC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );
    const relation = relations.rows[0];
    if (!relation || ["rewarded", "rejected", "revoked"].includes(relation.status)) return null;
    if (relation.status === "manual_review") return { status: "manual_review" };
    if (!relation.email_verified_at) {
      await query("UPDATE referral_relations SET status = 'email_pending' WHERE id = $1", [relation.id]);
      return { status: "email_pending" };
    }
    const existingRewards = await query(
      "SELECT id FROM referral_rewards WHERE referral_relation_id = $1 AND status IN ('pending','granted') LIMIT 1",
      [relation.id]
    );
    if (existingRewards.rowCount) return { status: "already_rewarded" };
    const monthly = await query(
      `SELECT COUNT(*) count FROM referral_rewards rw
       JOIN referral_relations rr ON rr.id = rw.referral_relation_id
       WHERE rr.referrer_user_id = $1 AND rw.reward_type = 'referrer'
         AND rw.created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')`,
      [relation.referrer_user_id]
    );
    if (settings.monthlyRewardLimit > 0 && Number(monthly.rows[0]?.count ?? 0) >= settings.monthlyRewardLimit) {
      await rejectRelation(query, relation.id, "monthly_limit_reached");
      return { status: "rejected", reason: "monthly_limit_reached" };
    }
    await query(
      `UPDATE referral_relations
       SET status = 'qualified', qualified_at = UTC_TIMESTAMP()
       WHERE id = $1`,
      [relation.id]
    );
    const availableFrom = addDays(new Date(), settings.reviewDelayDays);
    await createReward(query, relation.id, relation.referrer_user_id, "referrer", settings.referrerRewardDays, availableFrom, `${provider}:${paymentId || "subscription"}:${relation.id}:referrer`);
    if (settings.referredRewardEnabled && settings.referredRewardDays > 0) {
      await createReward(query, relation.id, relation.referred_user_id, "referred", settings.referredRewardDays, availableFrom, `${provider}:${paymentId || "subscription"}:${relation.id}:referred`);
    }
    const granted = settings.reviewDelayDays <= 0 ? await grantDueReferralRewards(query, relation.id) : 0;
    await query(
      `UPDATE referral_relations
       SET status = CASE WHEN $2 > 0 THEN 'rewarded' ELSE 'payment_pending' END,
           rewarded_at = CASE WHEN $2 > 0 THEN UTC_TIMESTAMP() ELSE rewarded_at END
       WHERE id = $1`,
      [relation.id, granted]
    );
    return { status: granted > 0 ? "rewarded" : "payment_pending", granted };
  });
}

export async function revokeReferralRewardsForUser(userId, reason = "payment_refunded") {
  await pool.transaction(async (query) => {
    const relations = await query("SELECT id FROM referral_relations WHERE referred_user_id = $1 FOR UPDATE", [userId]);
    for (const relation of relations.rows) {
      await rejectRelation(query, relation.id, reason, "revoked");
      await query(
        `UPDATE referral_rewards SET status = 'revoked', revoked_at = UTC_TIMESTAMP(), revoke_reason = $2
         WHERE referral_relation_id = $1 AND status <> 'revoked'`,
        [relation.id, reason]
      );
      await query(
        `UPDATE premium_bonus_periods SET status = 'revoked', revoked_at = UTC_TIMESTAMP(), revoke_reason = $2
         WHERE source = 'referral' AND source_id IN (
           SELECT id FROM referral_rewards WHERE referral_relation_id = $1
         ) AND starts_at > UTC_TIMESTAMP()`,
        [relation.id, reason]
      );
    }
  });
}

export async function referralBonusUntil(userId, query = pool.query) {
  const result = await query(
    `SELECT MAX(ends_at) bonus_until
     FROM premium_bonus_periods
     WHERE user_id = $1 AND status = 'active' AND ends_at > UTC_TIMESTAMP()`,
    [userId]
  );
  return result.rows[0]?.bonus_until ?? null;
}

async function validateReferralCode(req, res) {
  const code = normalizeReferralCode(req.params.code);
  const result = await pool.query(
    `SELECT rc.code, rc.is_active, u.full_name
     FROM referral_codes rc JOIN users u ON u.id = rc.user_id
     WHERE rc.code = $1`,
    [code]
  );
  const row = result.rows[0];
  res.json({
    valid: Boolean(row?.is_active),
    code,
    referrerName: row?.is_active ? publicName(row.full_name) : null
  });
}

async function trackReferralClick(req, res) {
  const code = normalizeReferralCode(req.body?.code);
  const platform = cleanText(req.body?.platform, 32) || "unknown";
  const result = await pool.query("SELECT id FROM referral_codes WHERE code = $1 AND is_active = TRUE", [code]);
  if (!result.rowCount) return res.status(404).json({ code: "REFERRAL_CODE_INVALID" });
  const clickToken = randomBytes(24).toString("base64url");
  const settings = await referralSettings();
  const inserted = await pool.query(
    `INSERT INTO referral_clicks(referral_code_id, click_token, ip_hash, user_agent_hash, platform, expires_at)
     VALUES($1, $2, $3, $4, $5, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${settings.attributionDays} DAY))`,
    [result.rows[0].id, clickToken, hashSafe(requestIp(req)), hashSafe(req.headers["user-agent"]), platform]
  );
  res.status(201).json({ clickToken, id: String(inserted.insertId), expiresInDays: settings.attributionDays });
}

async function myReferralOverview(req, res) {
  const code = await ensureReferralCode(req.user.id);
  const stats = await referralStats(req.user.id);
  const history = await referralHistory(req.user.id, 10);
  res.json({ code: referralCodePayload(code), stats, history });
}

async function myReferralCode(req, res) {
  res.json({ code: referralCodePayload(await ensureReferralCode(req.user.id)) });
}

async function myReferralStats(req, res) {
  res.json({ stats: await referralStats(req.user.id) });
}

async function myReferralHistory(req, res) {
  res.json({ history: await referralHistory(req.user.id, 50) });
}

async function attachReferralForCurrentUser(req, res) {
  const result = await attachReferralOnRegistration({
    referredUserId: req.user.id,
    referralCode: req.body?.code,
    clickToken: req.body?.clickToken,
    device: req.body?.device,
    req
  });
  res.json({ ok: true, relation: result });
}

async function resolveReferralAttribution({ code, clickToken }) {
  if (clickToken) {
    const click = await pool.query(
      `SELECT c.id click_id, rc.id referral_code_id, rc.user_id referrer_user_id
       FROM referral_clicks c JOIN referral_codes rc ON rc.id = c.referral_code_id
       WHERE c.click_token = $1 AND c.expires_at > UTC_TIMESTAMP() AND rc.is_active = TRUE`,
      [cleanText(clickToken, 128)]
    );
    if (click.rowCount) {
      return {
        referralClickId: click.rows[0].click_id,
        referralCodeId: click.rows[0].referral_code_id,
        referrerUserId: click.rows[0].referrer_user_id
      };
    }
  }
  if (!code) return null;
  const direct = await pool.query(
    "SELECT id referral_code_id, user_id referrer_user_id FROM referral_codes WHERE code = $1 AND is_active = TRUE",
    [code]
  );
  return direct.rows[0] ? { ...direct.rows[0], referralClickId: null } : null;
}

async function referralSettings() {
  const result = await pool.query("SELECT setting_key, setting_value FROM referral_settings");
  const settings = { ...DEFAULT_SETTINGS };
  for (const row of result.rows) {
    if (row.setting_key in settings) settings[row.setting_key] = row.setting_value;
  }
  settings.referrerRewardDays = boundedInt(settings.referrerRewardDays, 0, 3650, DEFAULT_SETTINGS.referrerRewardDays);
  settings.referredRewardDays = boundedInt(settings.referredRewardDays, 0, 3650, DEFAULT_SETTINGS.referredRewardDays);
  settings.attributionDays = boundedInt(settings.attributionDays, 1, 365, DEFAULT_SETTINGS.attributionDays);
  settings.monthlyRewardLimit = boundedInt(settings.monthlyRewardLimit, 0, 1000, DEFAULT_SETTINGS.monthlyRewardLimit);
  settings.minimumPaymentMinor = boundedInt(settings.minimumPaymentMinor, 0, 100000000, DEFAULT_SETTINGS.minimumPaymentMinor);
  settings.reviewDelayDays = boundedInt(settings.reviewDelayDays, 0, 365, DEFAULT_SETTINGS.reviewDelayDays);
  settings.eligiblePlans = Array.isArray(settings.eligiblePlans) ? settings.eligiblePlans.map(String) : DEFAULT_SETTINGS.eligiblePlans;
  settings.programEnabled = settings.programEnabled !== false;
  settings.referredRewardEnabled = settings.referredRewardEnabled !== false;
  return settings;
}

async function referralRisk({ referrerUserId, referredUserId, device }) {
  const referrer = await pool.query("SELECT email FROM users WHERE id = $1", [referrerUserId]);
  const referred = await pool.query("SELECT email FROM users WHERE id = $1", [referredUserId]);
  if (normalizeEmail(referrer.rows[0]?.email) === normalizeEmail(referred.rows[0]?.email)) {
    return { checkType: "email", result: "fail", score: 100, reason: "self_referral" };
  }
  const deviceId = cleanText(device?.id, 128);
  if (deviceId) {
    const matches = await pool.query(
      `SELECT user_id FROM account_devices
       WHERE device_id = $1 AND user_id <> $2
       ORDER BY created_at ASC LIMIT 5`,
      [deviceId, referredUserId]
    );
    if (matches.rows.some((row) => String(row.user_id) === String(referrerUserId))) {
      return { checkType: "device", result: "review", score: 70, reason: "duplicate_device" };
    }
  }
  return { result: "pass", score: 0, reason: null };
}

async function createRejectedRelation({ referrerUserId, referredUserId, referralCodeId, referralClickId, reason }) {
  const inserted = await pool.query(
    `INSERT INTO referral_relations(
       referrer_user_id, referred_user_id, referral_code_id, referral_click_id,
       status, registered_at, rejected_at, rejection_reason
     ) VALUES($1, $2, $3, $4, 'rejected', UTC_TIMESTAMP(), UTC_TIMESTAMP(), $5)`,
    [referrerUserId, referredUserId, referralCodeId, referralClickId, reason]
  );
  return { id: inserted.insertId, status: "rejected", reason };
}

async function createReward(query, relationId, userId, type, days, availableFrom, idempotencyKey) {
  await query(
    `INSERT INTO referral_rewards(
       referral_relation_id, beneficiary_user_id, reward_type, reward_days, status, available_from, idempotency_key
     ) VALUES($1, $2, $3, $4, 'pending', $5, $6)
     ON DUPLICATE KEY UPDATE updated_at = UTC_TIMESTAMP()`,
    [relationId, userId, type, days, availableFrom, idempotencyKey]
  );
}

async function grantDueReferralRewards(query, relationId = null) {
  const params = [];
  const where = ["rw.status = 'pending'", "rw.available_from <= UTC_TIMESTAMP()"];
  if (relationId) {
    params.push(relationId);
    where.push(`rw.referral_relation_id = $${params.length}`);
  }
  const rewards = await query(
    `SELECT rw.id, rw.beneficiary_user_id, rw.reward_days, rw.reward_type,
       u.premium_until, u.subscription_expires_at
     FROM referral_rewards rw
     JOIN users u ON u.id = rw.beneficiary_user_id
     WHERE ${where.join(" AND ")}
     ORDER BY rw.id ASC
     FOR UPDATE`,
    params
  );
  for (const reward of rewards.rows) {
    const start = bestBonusStart(reward.subscription_expires_at ?? reward.premium_until);
    const end = addDays(start, reward.reward_days);
    await query(
      `INSERT INTO premium_bonus_periods(
         user_id, source, source_id, bonus_days, starts_at, ends_at, status
       ) VALUES($1, 'referral', $2, $3, $4, $5, 'active')
       ON DUPLICATE KEY UPDATE updated_at = UTC_TIMESTAMP()`,
      [reward.beneficiary_user_id, reward.id, reward.reward_days, start, end]
    );
    await query(
      `UPDATE users
       SET premium_status = 'active',
           subscription_status = 'active',
           premium_plan = COALESCE(premium_plan, 'premium'),
           premium_until = GREATEST(COALESCE(premium_until, $2), $2),
           subscription_expires_at = GREATEST(COALESCE(subscription_expires_at, $2), $2)
       WHERE id = $1`,
      [reward.beneficiary_user_id, end]
    );
    await query(
      "UPDATE referral_rewards SET status = 'granted', granted_at = UTC_TIMESTAMP() WHERE id = $1",
      [reward.id]
    );
    await notifyUser(reward.beneficiary_user_id, "referral_reward", "Реферальная награда начислена", `Вам начислено ${reward.reward_days} дней Premium.`);
  }
  return rewards.rowCount;
}

async function rejectRelation(query, relationId, reason, status = "rejected") {
  await query(
    `UPDATE referral_relations
     SET status = $2, rejected_at = COALESCE(rejected_at, UTC_TIMESTAMP()), rejection_reason = $3
     WHERE id = $1`,
    [relationId, status, reason]
  );
}

async function referralStats(userId) {
  const result = await pool.query(
    `SELECT
       SUM(status IN ('registered','email_pending','awaiting_payment','payment_pending','qualified','manual_review','rewarded')) total,
       SUM(status = 'rewarded') rewarded,
       SUM(status = 'manual_review') manual_review,
       SUM(status = 'rejected') rejected
     FROM referral_relations WHERE referrer_user_id = $1`,
    [userId]
  );
  const row = result.rows[0] ?? {};
  return {
    total: Number(row.total ?? 0),
    rewarded: Number(row.rewarded ?? 0),
    manualReview: Number(row.manual_review ?? 0),
    rejected: Number(row.rejected ?? 0)
  };
}

async function referralHistory(userId, limit) {
  const result = await pool.query(
    `SELECT rr.id, rr.status, rr.registered_at, rr.qualified_at, rr.rewarded_at, rr.rejection_reason,
       COUNT(rw.id) rewards,
       COALESCE(SUM(CASE WHEN rw.status = 'granted' THEN rw.reward_days ELSE 0 END), 0) granted_days
     FROM referral_relations rr
     LEFT JOIN referral_rewards rw ON rw.referral_relation_id = rr.id
     WHERE rr.referrer_user_id = $1 OR rr.referred_user_id = $1
     GROUP BY rr.id
     ORDER BY rr.created_at DESC
     LIMIT ${Math.min(Math.max(Number(limit) || 10, 1), 100)}`,
    [userId]
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    status: row.status,
    registeredAt: row.registered_at,
    qualifiedAt: row.qualified_at,
    rewardedAt: row.rewarded_at,
    rejectionReason: row.rejection_reason,
    rewards: Number(row.rewards ?? 0),
    grantedDays: Number(row.granted_days ?? 0)
  }));
}

function referralCodePayload(row) {
  return {
    code: row.code,
    active: Boolean(row.is_active),
    link: `https://glukotrack.com/r/${encodeURIComponent(row.code)}`
  };
}

async function recordFraudCheck(relationId, checkType, result, riskScore, reason, details = {}) {
  await pool.query(
    `INSERT INTO referral_fraud_checks(referral_relation_id, check_type, result, risk_score, matched_entity_hash, details_json)
     VALUES($1, $2, $3, $4, $5, $6)`,
    [relationId, checkType, result, riskScore, reason ? hashSafe(reason) : null, details]
  );
}

async function referralAudit(entityType, entityId, action, oldValue, newValue, adminUserId, req) {
  await pool.query(
    `INSERT INTO referral_audit_log(entity_type, entity_id, action, old_value_json, new_value_json, admin_user_id, ip_hash)
     VALUES($1, $2, $3, $4, $5, $6, $7)`,
    [entityType, String(entityId), action, oldValue ?? {}, newValue ?? {}, adminUserId, req ? hashSafe(requestIp(req)) : null]
  );
}

async function notifyUser(userId, type, title, body) {
  await pool.query(
    "INSERT INTO notifications(user_id,type,title,body,metadata) VALUES($1,$2,$3,$4,$5)",
    [userId, type, title, body, { source: "referrals" }]
  ).catch(() => {});
}

function normalizeReferralCode(value) {
  const code = cleanText(value, 32).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^GT[A-Z0-9]{4,10}$/.test(code) ? code : "";
}

function boundedInt(value, min, max, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback;
}

function hashSafe(value) {
  const text = cleanText(value, 512);
  return text ? createHash("sha256").update(`${process.env.REFERRAL_HASH_SALT || process.env.JWT_SECRET || "glukotrack"}:${text}`).digest("hex") : null;
}

function requestIp(req) {
  return cleanText(req.headers["x-forwarded-for"]?.split(",")[0] ?? req.ip ?? "", 64);
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeEmail(value) {
  return cleanText(value, 255).toLowerCase();
}

function publicName(value) {
  const text = cleanText(value, 120);
  return text ? text.split(/\s+/)[0] : "GlucoTrack user";
}
