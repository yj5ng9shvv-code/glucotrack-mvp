import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import OpenAI from "openai";
import Stripe from "stripe";

import { getDatabaseStatus, initializeDatabase, pool } from "./db.js";

const app = express();
const upload = multer({ limits: { fileSize: bytesFromMb(envNumber("MAX_IMAGE_MB", 8)) } });
const rateBuckets = new Map();

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
          `UPDATE users SET premium_status = 'active', premium_plan = $1,
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
        `UPDATE users SET premium_status = $1, premium_until = FROM_UNIXTIME($2)
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
    "INSERT INTO users(email, password_hash, full_name) VALUES($1, $2, $3)",
    [email, passwordHash, fullName]
  );
  const result = await pool.query(
    "SELECT id, email, full_name, premium_status, premium_plan, premium_until FROM users WHERE id = $1",
    [inserted.insertId]
  );
  res.status(201).json(authPayload(result.rows[0]));
}));

app.post("/auth/login", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!isEmail(email) || typeof password !== "string") {
    return res.status(400).json({ error: "email and password are required" });
  }
  const result = await pool.query(
    "SELECT id, email, full_name, password_hash, premium_status, premium_plan, premium_until FROM users WHERE email = $1",
    [email]
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "invalid credentials" });
  }
  res.json(authPayload(user));
}));

app.get("/sos/:token", asyncHandler(async (req, res) => {
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
  const profile = await findSosProfile(req.params.token);
  if (!profile) return res.status(404).json({ error: "SOS card not found" });
  if (!profile.pin_hash || typeof req.body?.pin !== "string") {
    return res.status(403).json({ error: "PIN access is unavailable" });
  }
  const valid = await bcrypt.compare(req.body.pin, profile.pin_hash);
  if (!valid) return res.status(403).json({ error: "invalid PIN" });
  res.json({ card: profile.card });
}));

app.use(authGuard);

app.get("/auth/me", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT id, email, full_name, premium_status, premium_plan, premium_until FROM users WHERE id = $1",
    [req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "user not found" });
  res.json({ user: publicUser(result.rows[0]) });
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

app.use(["/reports", "/ai"], premiumGuard);

app.post("/sync/push", asyncHandler(async (req, res) => {
  const payload = req.body ?? {};
  await pool.query(
    `INSERT INTO health_snapshots(user_id, payload, updated_at)
     VALUES($1, $2, NOW())
     ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW()`,
    [req.user.id, payload]
  );
  res.json({ ok: true, acceptedAt: new Date().toISOString() });
}));

app.post("/sync/pull", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT payload, updated_at FROM health_snapshots WHERE user_id = $1",
    [req.user.id]
  );
  res.json({ ok: true, snapshot: result.rows[0] ?? null });
}));

app.get("/subscription/status", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT premium_status, premium_plan, premium_until FROM users WHERE id = $1",
    [req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "user not found" });
  res.json({ subscription: subscriptionPayload(result.rows[0]) });
}));

app.post("/billing/checkout", asyncHandler(async (req, res) => {
  const plan = req.body?.plan === "yearly" ? "yearly" : "monthly";
  const priceId = plan === "yearly"
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

app.post("/family/invitations", asyncHandler(async (req, res) => {
  const inviteEmail = normalizeEmail(req.body?.email);
  if (!isEmail(inviteEmail) || inviteEmail === req.user.email) {
    return res.status(400).json({ error: "valid caregiver email is required" });
  }
  const permissions = sanitizePermissions(req.body?.permissions);
  const inviteCode = randomBytes(18).toString("base64url");
  await pool.query(
    `INSERT INTO family_links(
       owner_user_id, invite_email, invite_code, permissions, status, expires_at
     ) VALUES($1, $2, $3, $4, 'pending', DATE_ADD(NOW(), INTERVAL 7 DAY))
     ON DUPLICATE KEY UPDATE
       invite_code = VALUES(invite_code),
       permissions = VALUES(permissions),
       status = 'pending', caregiver_user_id = NULL,
       expires_at = VALUES(expires_at), accepted_at = NULL`,
    [req.user.id, inviteEmail, inviteCode, permissions]
  );
  const result = await pool.query(
    "SELECT id, invite_email, invite_code, permissions, status, expires_at FROM family_links WHERE owner_user_id = $1 AND invite_email = $2",
    [req.user.id, inviteEmail]
  );
  res.status(201).json({ invitation: familyLink(result.rows[0]) });
}));

app.post("/family/invitations/accept", asyncHandler(async (req, res) => {
  const code = cleanText(req.body?.code, 200);
  const updated = await pool.query(
    `UPDATE family_links SET
       caregiver_user_id = $1, status = 'accepted', accepted_at = NOW()
     WHERE invite_code = $2 AND invite_email = $3
       AND status = 'pending' AND expires_at > NOW()`,
    [req.user.id, code, req.user.email]
  );
  if (!updated.rowCount) {
    return res.status(404).json({ error: "invitation is invalid, expired, or belongs to another email" });
  }
  const result = await pool.query(
    "SELECT id, owner_user_id, invite_email, permissions, status, accepted_at FROM family_links WHERE invite_code = $1 AND invite_email = $2",
    [code, req.user.email]
  );
  res.json({ link: familyLink(result.rows[0]) });
}));

app.get("/family/members", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT fl.id, fl.invite_email, fl.invite_code, fl.permissions, fl.status, fl.expires_at,
            fl.accepted_at, u.full_name
     FROM family_links fl
     LEFT JOIN users u ON u.id = fl.caregiver_user_id
     WHERE fl.owner_user_id = $1 AND fl.status <> 'revoked'
     ORDER BY fl.created_at DESC`,
    [req.user.id]
  );
  res.json({ members: result.rows.map(familyLink) });
}));

app.delete("/family/members/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "UPDATE family_links SET status = 'revoked' WHERE id = $1 AND owner_user_id = $2",
    [req.params.id, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "family link not found" });
  res.json({ ok: true });
}));

app.get("/family/patients", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT fl.owner_user_id, fl.permissions, u.full_name, u.email,
            hs.payload, hs.updated_at
     FROM family_links fl
     JOIN users u ON u.id = fl.owner_user_id
     LEFT JOIN health_snapshots hs ON hs.user_id = fl.owner_user_id
     WHERE fl.caregiver_user_id = $1 AND fl.status = 'accepted'
     ORDER BY u.full_name`,
    [req.user.id]
  );
  res.json({ patients: result.rows.map(patientSummary) });
}));

app.get("/family/patients/:ownerId", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT fl.permissions, u.id, u.full_name, u.email, hs.payload, hs.updated_at
     FROM family_links fl
     JOIN users u ON u.id = fl.owner_user_id
     LEFT JOIN health_snapshots hs ON hs.user_id = fl.owner_user_id
     WHERE fl.owner_user_id = $1 AND fl.caregiver_user_id = $2 AND fl.status = 'accepted'`,
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
  const response = await openAi().chat.completions.create({
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
          "Be concise, practical, and medically cautious.",
          `Profile JSON: ${JSON.stringify(profile)}`
        ].join(" ")
      },
      { role: "user", content: message }
    ]
  });
  res.json({ text: response.choices?.[0]?.message?.content?.trim() ?? "" });
}));

app.post("/ai/recognize-food", upload.single("image"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "image is required" });
  const mimeType = req.file.mimetype || "image/jpeg";
  const response = await openAi().responses.create({
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

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ error: "email already registered" });
  }
  res.status(500).json({ error: "internal server error" });
});

const port = envNumber("PORT", 8787);
console.log("Checking and installing the database...");
await initializeDatabase();
app.listen(port, () => console.log(`GlucoTrack backend listening on ${port}`));

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
      "SELECT premium_status FROM users WHERE id = $1",
      [req.user.id]
    );
    if (!["active", "trialing"].includes(result.rows[0]?.premium_status)) {
      return res.status(403).json({ error: "premium subscription required" });
    }
    next();
  } catch (error) {
    next(error);
  }
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
    ...subscriptionPayload(user)
  };
}

function subscriptionPayload(row) {
  return {
    premium: ["active", "trialing"].includes(row.premium_status),
    premiumStatus: row.premium_status ?? "inactive",
    premiumPlan: row.premium_plan ?? null,
    premiumUntil: row.premium_until ?? null
  };
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
    fullName: row.full_name ?? null,
    inviteCode: row.invite_code,
    permissions: row.permissions,
    status: row.status,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at
  };
}

function patientSummary(row) {
  const profile = row.payload?.profile ?? {};
  return {
    id: String(row.owner_user_id),
    fullName: row.full_name,
    email: row.email,
    permissions: row.permissions,
    glucoseMmol: row.permissions.glucose ? profile.glucoseMmol ?? null : null,
    updatedAt: row.updated_at
  };
}

function patientDetails(row) {
  const payload = row.payload ?? {};
  const permissions = row.permissions;
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
    glucose: value?.glucose !== false,
    history: value?.history === true,
    emergency: value?.emergency === true
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
    allergies: cleanText(card.allergies, 2000),
    medications: cleanText(card.medications, 4000),
    contactName: cleanText(card.contactName, 200),
    contactPhone: cleanText(card.contactPhone, 80),
    additionalContacts: cleanText(card.additionalContacts, 2000),
    doctorContact: cleanText(card.doctorContact, 1000),
    bloodType: cleanText(card.bloodType, 40),
    communicationLanguages: cleanText(card.communicationLanguages, 300),
    instructions: cleanText(card.instructions, 2000)
  };
}

function publicSosCard(profile) {
  const card = profile.card ?? {};
  if (!profile.hide_sensitive) return card;
  return {
    fullName: "Пациент GlucoTrack",
    age: 0,
    photoBase64: "",
    diabetesType: card.diabetesType,
    diabetesTreatment: card.diabetesTreatment,
    bloodType: card.bloodType,
    communicationLanguages: card.communicationLanguages,
    instructions: card.instructions,
    contactName: card.contactName,
    contactPhone: card.contactPhone
  };
}

function renderSosPage(card, token, locked) {
  const row = (label, value) => value
    ? `<div class="row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`
    : "";
  const photo = card.photoBase64
    ? `<img class="photo" alt="" src="data:image/jpeg;base64,${escapeHtml(card.photoBase64)}">`
    : `<div class="photo placeholder">SOS</div>`;
  const phone = String(card.contactPhone ?? "").replace(/[^\d+]/g, "");
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
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
.secondary{background:#075bbb}.lock{background:#fff;padding:15px;border-radius:10px}
input{padding:12px;font-size:16px;max-width:150px}button{padding:12px;cursor:pointer}
#private .row{border:1px solid #e4e7ec}@media(max-width:480px){.row{grid-template-columns:1fr}}
@media print{body{background:#fff}main{max-width:105mm;padding:8mm}.actions,.lock{display:none}
.row{break-inside:avoid;border:1px solid #ddd}p{display:none}}
</style></head><body><main>
<div class="head">${photo}<div><h1>${escapeHtml(card.fullName || "Пациент GlucoTrack")}</h1>
<b style="color:#b42318">ДИАБЕТ • SOS</b></div></div>
<div class="warning">${escapeHtml(card.instructions || "При потере сознания вызвать 112. Не давать инсулин без проверки сахара.")}</div>
${row("Тип диабета", diabetesLabel(card.diabetesType))}
${row("Лечение", card.diabetesTreatment)}
${row("Группа крови", card.bloodType)}
${row("Языки", card.communicationLanguages)}
<div class="actions"><a class="btn" href="tel:112">Вызвать 112</a>
${phone ? `<a class="btn secondary" href="tel:${escapeHtml(phone)}">Позвонить близкому</a>` : ""}</div>
${locked ? `<div class="lock"><b>Чувствительные данные скрыты</b><p>Введите PIN родственника или врача.</p>
<input id="pin" inputmode="numeric" type="password" maxlength="8" placeholder="PIN">
<button onclick="unlock()">Открыть</button><div id="private"></div></div>` : renderPrivateRows(card)}
<p style="color:#667085;font-size:12px">GlucoTrack SOS не заменяет медицинскую помощь.</p>
</main><script>
const token=${JSON.stringify(token)};const sosPath=location.pathname.replace(/\\/$/,'');
function scan(pos){fetch(sosPath+'/scan',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify(pos||{})}).catch(()=>{});}
if(navigator.geolocation){navigator.geolocation.getCurrentPosition(
p=>scan({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),
()=>scan({}),{timeout:7000,maximumAge:60000});}else{scan({});}
if(new URLSearchParams(location.search).get('print')==='1'){setTimeout(()=>window.print(),500);}
async function unlock(){const response=await fetch(sosPath+'/unlock',{method:'POST',
headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:document.getElementById('pin').value})});
if(!response.ok){alert('Неверный PIN');return;}const data=await response.json();
document.getElementById('private').innerHTML=privateRows(data.card);}
function esc(v){const d=document.createElement('div');d.textContent=v||'';return d.innerHTML;}
function privateRows(c){return [
['ФИО',c.fullName],['Возраст',c.age?String(c.age):''],['Диагнозы',c.importantDiagnoses],
['Инсулин',c.insulinName],['Аллергии',c.allergies],['Лекарства',c.medications],
['Врач / клиника',c.doctorContact],['Другие близкие',c.additionalContacts]
].filter(x=>x[1]).map(x=>'<div class="row"><span>'+esc(x[0])+'</span><b>'+esc(x[1])+'</b></div>').join('');}
</script></body></html>`;
}

function renderPrivateRows(card) {
  return [
    ["ФИО", card.fullName],
    ["Возраст", card.age ? String(card.age) : ""],
    ["Диагнозы", card.importantDiagnoses],
    ["Инсулин", card.insulinName],
    ["Аллергии", card.allergies],
    ["Лекарства", card.medications],
    ["Врач / клиника", card.doctorContact],
    ["Другие близкие", card.additionalContacts]
  ].filter(([, value]) => value).map(([label, value]) =>
    `<div class="row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`
  ).join("");
}

function diabetesLabel(value) {
  if (value === "type2") return "Тип 2";
  if (value === "gestational") return "Гестационный";
  return "Тип 1";
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
      message: "QR пациента отсканирован",
      location,
      scannedAt: new Date().toISOString()
    })
  });
}

function openAi() {
  return new OpenAI({ apiKey: requiredEnv("OPENAI_API_KEY") });
}

function stripeClient() {
  return new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
}

function corsGuard(req, res, next) {
  const allowed = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}

function rateLimitGuard(req, res, next) {
  if (req.path === "/health") return next();
  const limit = envNumber("RATE_LIMIT_PER_MINUTE", 60);
  const key = req.headers.authorization || req.ip || "anonymous";
  const now = Date.now();
  const bucket = rateBuckets.get(key) ?? { start: now, count: 0 };
  if (now - bucket.start > 60_000) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
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

function bytesFromMb(value) {
  return Math.round(value * 1024 * 1024);
}
