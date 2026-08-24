import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const KEY_PATH = "/home/ODESSA/glukotrack-notification-provider.key";
const PROVIDERS = ["disabled", "custom", "twilio", "vonage"];
const SECRET_FIELDS = new Set([
  "custom_api_key",
  "twilio_account_sid",
  "twilio_auth_token",
  "twilio_from_number",
  "twilio_messaging_service_sid",
  "vonage_api_key",
  "vonage_api_secret"
]);

export const NOTIFICATION_PROVIDER_SETTING_DEFS = {
  notification_sms_provider: { type: "enum", values: PROVIDERS, defaultValue: "disabled" },
  notification_custom_sms_endpoint: { type: "url", defaultValue: "" },
  notification_custom_sms_sender_name: { type: "text", max: 32, defaultValue: "GlucoTrack" },
  notification_custom_sms_dry_run: { type: "boolean", defaultValue: true },
  notification_custom_sms_timeout_seconds: { type: "integer", min: 1, max: 60, defaultValue: 10 },
  notification_twilio_sender_name: { type: "text", max: 32, defaultValue: "GlucoTrack" },
  notification_twilio_dry_run: { type: "boolean", defaultValue: true },
  notification_vonage_sender_name: { type: "text", max: 32, defaultValue: "GlucoTrack" },
  notification_vonage_dry_run: { type: "boolean", defaultValue: true },
  notification_sms_daily_per_patient: { type: "integer", min: 0, max: 1000, defaultValue: 10 },
  notification_sms_monthly_per_patient: { type: "integer", min: 0, max: 10000, defaultValue: 100 },
  notification_sms_global_daily_limit: { type: "integer", min: 0, max: 100000, defaultValue: 1000 },
  notification_sms_global_daily_budget_minor: { type: "integer", min: 0, max: 100000000, defaultValue: 0 },
  notification_sms_budget_currency: { type: "currency", defaultValue: "EUR" },
  notification_sms_estimated_cost_minor: { type: "integer", min: 0, max: 1000000, defaultValue: 0 },
  notification_manual_sos_cooldown_minutes: { type: "integer", min: 0, max: 1440, defaultValue: 15 }
};

export const NOTIFICATION_PROVIDER_SECRET_KEYS = Object.fromEntries([...SECRET_FIELDS].map((field) => [field, `notification_${field}_encrypted`]));

export function notificationProviderDefaults() {
  return Object.fromEntries(Object.entries(NOTIFICATION_PROVIDER_SETTING_DEFS).map(([key, def]) => [key, def.defaultValue]));
}

export function notificationProviderSchema() {
  return Object.fromEntries(Object.entries(NOTIFICATION_PROVIDER_SETTING_DEFS).map(([key, def]) => [key, { type: def.type, values: def.values, min: def.min, max: def.max, maxLength: def.max }]));
}

export function parseNotificationProviderSetting(def, value) {
  let parsed = value;
  try { parsed = JSON.parse(value); } catch {}
  if (def.type === "boolean") return parsed === true || parsed === 1 || parsed === "1" || parsed === "true";
  if (def.type === "integer") {
    const n = Number(parsed);
    return Number.isInteger(n) && n >= def.min && n <= def.max ? n : def.defaultValue;
  }
  if (def.type === "enum") return def.values.includes(String(parsed)) ? String(parsed) : def.defaultValue;
  if (def.type === "currency") {
    const s = String(parsed || "").trim().toUpperCase();
    return /^[A-Z]{3}$/.test(s) ? s : def.defaultValue;
  }
  if (def.type === "url") {
    const s = String(parsed || "").trim();
    return s.length <= 500 ? s : def.defaultValue;
  }
  const s = String(parsed || "").trim();
  return s ? s.slice(0, def.max || 200) : def.defaultValue;
}

export function validateNotificationProviderSettings(input = {}) {
  const value = notificationProviderDefaults();
  for (const key of Object.keys(input || {})) if (!NOTIFICATION_PROVIDER_SETTING_DEFS[key]) return { error: "NOTIFICATION_SETTING_UNKNOWN" };
  for (const [key, def] of Object.entries(NOTIFICATION_PROVIDER_SETTING_DEFS)) {
    const raw = Object.prototype.hasOwnProperty.call(input, key) ? input[key] : def.defaultValue;
    if (def.type === "boolean") { if (typeof raw !== "boolean") return { error: "NOTIFICATION_BOOLEAN_REQUIRED" }; value[key] = raw; }
    else if (def.type === "integer") { const n = Number(raw); if (!Number.isInteger(n) || n < def.min || n > def.max) return { error: "NOTIFICATION_INTEGER_RANGE" }; value[key] = n; }
    else if (def.type === "enum") { if (!def.values.includes(String(raw))) return { error: "NOTIFICATION_PROVIDER_INVALID" }; value[key] = String(raw); }
    else if (def.type === "currency") { const s = String(raw || "").trim().toUpperCase(); if (!/^[A-Z]{3}$/.test(s)) return { error: "NOTIFICATION_CURRENCY_INVALID" }; value[key] = s; }
    else if (def.type === "url") { const s = String(raw || "").trim(); if (s && !isSafeHttpsUrlSyntax(s)) return { error: "NOTIFICATION_ENDPOINT_INVALID" }; value[key] = s; }
    else { value[key] = String(raw || "").trim().slice(0, def.max || 200); }
  }
  return { value };
}

export function createNotificationProviderSettingsService(database) {
  const query = typeof database === "function" ? database : database.query.bind(database);
  const transaction = typeof database === "function" ? null : database.transaction.bind(database);
  const settings = async () => {
    const keys = [...Object.keys(NOTIFICATION_PROVIDER_SETTING_DEFS), ...Object.values(NOTIFICATION_PROVIDER_SECRET_KEYS)];
    const result = await query(`SELECT setting_key,setting_value,updated_at FROM system_settings WHERE setting_key IN (${keys.map((_, i) => `$${i + 1}`).join(",")})`, keys);
    const rows = Object.fromEntries(result.rows.map((row) => [row.setting_key, row]));
    const current = notificationProviderDefaults();
    for (const [key, def] of Object.entries(NOTIFICATION_PROVIDER_SETTING_DEFS)) if (rows[key]) current[key] = parseNotificationProviderSetting(def, rows[key].setting_value);
    const secrets = {};
    for (const [field, key] of Object.entries(NOTIFICATION_PROVIDER_SECRET_KEYS)) secrets[field] = secretInfo(rows[key]);
    return { settings: current, secrets, status: providerStatuses(current, secrets), schema: notificationProviderSchema(), providers: PROVIDERS, criticalAlerts: "REQUIRES APPLE APPROVAL" };
  };

  const save = async ({ settings: inputSettings = {}, secrets: inputSecrets = {} }, adminId, req) => {
    const before = await settings();
    const validated = validateNotificationProviderSettings(inputSettings);
    if (validated.error) return { error: validated.error };
    const secretChanges = {};
    if (!transaction) return { error: "NOTIFICATION_TRANSACTION_UNAVAILABLE" };
    await transaction(async (tx) => {
      for (const [key, value] of Object.entries(validated.value)) {
        await tx(`INSERT INTO system_settings(setting_key,setting_value,is_secret,updated_by,updated_at) VALUES($1,$2,0,$3,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),is_secret=0,updated_by=VALUES(updated_by),updated_at=VALUES(updated_at)`, [key, JSON.stringify(value), adminId]);
      }
      for (const field of SECRET_FIELDS) {
        const action = String(inputSecrets[field]?.action || "keep");
        const key = NOTIFICATION_PROVIDER_SECRET_KEYS[field];
        if (action === "replace") {
          const raw = String(inputSecrets[field]?.value || "");
          if (!raw.trim()) throw Object.assign(new Error("NOTIFICATION_SECRET_REQUIRED"), { statusCode: 400 });
          const encrypted = await encryptNotificationSecret(raw.trim());
          await tx(`INSERT INTO system_settings(setting_key,setting_value,is_secret,updated_by,updated_at) VALUES($1,$2,1,$3,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),is_secret=1,updated_by=VALUES(updated_by),updated_at=VALUES(updated_at)`, [key, JSON.stringify(encrypted), adminId]);
          secretChanges[field] = "replaced";
        } else if (action === "clear") {
          await tx("DELETE FROM system_settings WHERE setting_key=$1", [key]);
          secretChanges[field] = "cleared";
        } else if (action !== "keep") {
          throw Object.assign(new Error("NOTIFICATION_SECRET_ACTION_INVALID"), { statusCode: 400 });
        }
      }
      await tx("INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES($1,'settings.notification_providers.update','system_settings','notification_providers',$2,$3,$4)", [adminId, JSON.stringify({ before: sanitizeForAudit(before), after: sanitizeForAudit({ settings: validated.value, secrets: {}, status: providerStatuses(validated.value, {}) }), secretChanges }), clean(req?.ip, 64), clean(req?.headers?.["user-agent"], 512)]);
    });
    return { settings: await settings(), secretChanges };
  };

  const testConnection = async (provider, adminId, req) => {
    const current = await settings();
    const selected = String(provider || current.settings.notification_sms_provider || "disabled");
    const status = providerConnectionStatus(selected, current.settings, current.secrets);
    await audit(query, adminId, "settings.notification_providers.test_connection", selected, { provider: selected, status }, req);
    return { provider: selected, status, externalRequest: false };
  };

  const testSend = async ({ provider, phone }, adminId, req) => {
    const current = await settings();
    const selected = String(provider || current.settings.notification_sms_provider || "disabled");
    const limits = await checkSmsLimits(query, { patientId: null, settings: current.settings });
    if (!limits.allowed) {
      await audit(query, adminId, "settings.notification_providers.test_send", selected, { provider: selected, status: "LIMIT_REACHED", reason: limits.reason }, req);
      return { status: "LIMIT_REACHED", reason: limits.reason, externalRequest: false };
    }
    const outbox = await createDryRunOutbox(query, { provider: selected, phone: clean(phone, 32), adminId });
    await audit(query, adminId, "settings.notification_providers.test_send", selected, { provider: selected, status: "DRY_RUN", outboxId: outbox.outboxId }, req);
    return { status: "DRY_RUN", provider: selected, outboxId: outbox.outboxId, eventId: outbox.eventId, externalRequest: false };
  };

  return { settings, save, testConnection, testSend };
}

export async function notificationProviderPublicSettings(query) {
  return (await createNotificationProviderSettingsService(query).settings()).settings;
}

export async function checkSmsLimits(query, { patientId, settings = null } = {}) {
  const cfg = settings || await notificationProviderPublicSettings(query);
  const estimatedCost = Number(cfg.notification_sms_estimated_cost_minor || 0);
  const nowWhere = "created_at >= UTC_DATE()";
  if (patientId) {
    const daily = await query(`SELECT COUNT(*) count FROM notification_delivery_logs ndl JOIN sos_notification_outbox sno ON sno.id=ndl.outbox_id JOIN sos_events se ON se.id=sno.sos_event_id WHERE se.patient_id=$1 AND sno.channel='sms' AND ndl.status IN ('SUCCESS','DRY_RUN') AND ndl.${nowWhere}`, [patientId]);
    if (Number(daily.rows[0]?.count || 0) >= Number(cfg.notification_sms_daily_per_patient || 0)) return { allowed: false, reason: "PATIENT_DAILY_LIMIT" };
    const monthly = await query("SELECT COUNT(*) count FROM notification_delivery_logs ndl JOIN sos_notification_outbox sno ON sno.id=ndl.outbox_id JOIN sos_events se ON se.id=sno.sos_event_id WHERE se.patient_id=$1 AND sno.channel='sms' AND ndl.status IN ('SUCCESS','DRY_RUN') AND ndl.created_at >= DATE_FORMAT(UTC_DATE(), '%Y-%m-01')", [patientId]);
    if (Number(monthly.rows[0]?.count || 0) >= Number(cfg.notification_sms_monthly_per_patient || 0)) return { allowed: false, reason: "PATIENT_MONTHLY_LIMIT" };
  }
  const global = await query("SELECT COUNT(*) count FROM notification_delivery_logs ndl JOIN sos_notification_outbox sno ON sno.id=ndl.outbox_id WHERE sno.channel='sms' AND ndl.status IN ('SUCCESS','DRY_RUN') AND ndl.created_at >= UTC_DATE()", []);
  if (Number(global.rows[0]?.count || 0) >= Number(cfg.notification_sms_global_daily_limit || 0)) return { allowed: false, reason: "GLOBAL_DAILY_LIMIT" };
  const budget = Number(cfg.notification_sms_global_daily_budget_minor || 0);
  if (budget > 0 && estimatedCost > 0 && (Number(global.rows[0]?.count || 0) + 1) * estimatedCost > budget) return { allowed: false, reason: "GLOBAL_DAILY_BUDGET" };
  return { allowed: true };
}

export function providerConnectionStatus(provider, settings, secrets) {
  if (provider === "disabled") return "DISABLED";
  if (provider === "custom") {
    if (!settings.notification_custom_sms_endpoint || !secrets.custom_api_key?.configured) return "NOT CONFIGURED";
    return settings.notification_custom_sms_dry_run ? "DRY RUN" : "NOT CONFIGURED";
  }
  if (provider === "twilio") {
    if (!secrets.twilio_account_sid?.configured || !secrets.twilio_auth_token?.configured || (!secrets.twilio_from_number?.configured && !secrets.twilio_messaging_service_sid?.configured)) return "NOT CONFIGURED";
    return settings.notification_twilio_dry_run ? "DRY RUN" : "NOT CONFIGURED";
  }
  if (provider === "vonage") {
    if (!secrets.vonage_api_key?.configured || !secrets.vonage_api_secret?.configured) return "NOT CONFIGURED";
    return settings.notification_vonage_dry_run ? "DRY RUN" : "NOT CONFIGURED";
  }
  return "NOT CONFIGURED";
}

function providerStatuses(settings, secrets) {
  return Object.fromEntries(PROVIDERS.map((provider) => [provider, providerConnectionStatus(provider, settings, secrets)]));
}

async function createDryRunOutbox(query, { provider, phone, adminId }) {
  const user = (await query("SELECT id FROM users ORDER BY id LIMIT 1", [])).rows[0];
  if (!user) throw Object.assign(new Error("NOTIFICATION_TEST_USER_NOT_FOUND"), { statusCode: 409 });
  const event = await query("INSERT INTO sos_events(user_id,patient_id,status,source,client_event_id,client_request_id,created_at,activated_at,resolved_at) VALUES($1,$2,'resolved','notification_provider_dry_run',$3,$4,UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP())", [user.id, user.id, `notif-dry-${Date.now()}`, `notif-dry-${adminId}-${Date.now()}`]);
  const eventId = event.insertId;
  await query("INSERT INTO sos_notification_outbox(sos_event_id,recipient_user_id,channel,notification_type,sequence,idempotency_key,status,attempts,retryable,scheduled_at,processing_started_at,processed_at,sent_at,result_code) VALUES($1,$2,'sms','test',0,$3,'SENT',1,FALSE,UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP(),'DRY_RUN')", [eventId, user.id, `notif:test:${eventId}:${provider}`]);
  const outboxId = (await query("SELECT id FROM sos_notification_outbox WHERE idempotency_key=$1", [`notif:test:${eventId}:${provider}`])).rows[0]?.id;
  await query("INSERT INTO notification_delivery_logs(outbox_id,provider,status,error) VALUES($1,$2,'DRY_RUN',NULL)", [outboxId, `${provider}_dry_run`]);
  return { eventId, outboxId, phone: Boolean(phone) };
}

async function encryptNotificationSecret(value) {
  const key = await notificationSecretKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { v: 1, alg: "aes-256-gcm", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64"), masked: maskSecret(value) };
}

export async function decryptNotificationSecret(payload) {
  const key = await notificationSecretKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]).toString("utf8");
}

async function notificationSecretKey() {
  await fs.mkdir(path.dirname(KEY_PATH), { recursive: true, mode: 0o700 });
  await fs.chmod(path.dirname(KEY_PATH), 0o700).catch(() => {});
  try {
    const raw = (await fs.readFile(KEY_PATH, "utf8")).trim();
    const key = Buffer.from(raw, "base64");
    if (key.length === 32) return key;
  } catch {}
  const key = randomBytes(32);
  await fs.writeFile(KEY_PATH, key.toString("base64"), { mode: 0o600 });
  await fs.chmod(KEY_PATH, 0o600).catch(() => {});
  return key;
}

function secretInfo(row) {
  if (!row) return { configured: false, masked: "", updatedAt: null };
  try {
    const payload = JSON.parse(row.setting_value);
    return { configured: true, masked: payload.masked || "••••", updatedAt: row.updated_at || null };
  } catch {
    return { configured: false, masked: "", updatedAt: row.updated_at || null };
  }
}

function maskSecret(value) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 4) return "••••";
  return `••••${text.slice(-4)}`;
}

function isSafeHttpsUrlSyntax(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (["localhost", "0.0.0.0"].includes(host) || host.endsWith(".local")) return false;
    if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function sanitizeForAudit(payload) {
  return { settings: payload.settings || {}, secrets: Object.fromEntries(Object.entries(payload.secrets || {}).map(([key, info]) => [key, { configured: Boolean(info.configured), masked: info.masked || "" }])), status: payload.status || {} };
}

async function audit(query, adminId, action, entityId, metadata, req) {
  await query("INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES($1,$2,'system_settings',$3,$4,$5,$6)", [adminId, action, entityId, JSON.stringify(metadata || {}), clean(req?.ip, 64), clean(req?.headers?.["user-agent"], 512)]);
}

function clean(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max);
}