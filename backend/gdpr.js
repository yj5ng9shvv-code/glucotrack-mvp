import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";

import { pool } from "./db.js";

export const GDPR_REQUEST_TYPES = [
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
];

export const GDPR_STATUSES = [
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
];

const CRITICAL_TYPES = new Set([
  "data_export",
  "data_portability",
  "account_deletion",
  "data_anonymization",
  "data_rectification"
]);

const TERMINAL_STATUSES = new Set(["completed", "cancelled", "expired", "rejected"]);
const EXPORT_DOWNLOAD_LIMIT = 5;

export function registerGdprUserRoutes(app, { asyncHandler }) {
  app.get("/privacy/gdpr/requests", asyncHandler(userGdprRequests));
  app.post("/privacy/gdpr/requests", asyncHandler(userCreateGdprRequest));
  app.get("/privacy/gdpr/requests/:publicId", asyncHandler(userGdprRequestDetails));
  app.post("/privacy/gdpr/requests/:publicId/verify", asyncHandler(userVerifyGdprRequest));
  app.post("/privacy/gdpr/requests/:publicId/reply", asyncHandler(userReplyGdprRequest));
  app.post("/privacy/gdpr/requests/:publicId/cancel", asyncHandler(userCancelGdprRequest));
  app.get("/privacy/gdpr/requests/:publicId/download", asyncHandler(userDownloadGdprExport));
}

export async function adminGdprRequests(req, res) {
  const page = pageParams(req);
  const { where, params } = gdprFilter(req.query);
  const order = gdprSort(req.query?.sort);
  const rows = await pool.query(
    `SELECT g.id,g.public_id,g.user_id,u.email,u.created_at user_created_at,g.request_type,g.status,
       COALESCE(g.subject, g.reason) subject,g.description,g.source,g.locale,g.submitted_at,g.due_at,
       g.assigned_admin_id,a.email assigned_admin_email,g.identity_verified_at,g.created_at,g.updated_at,
       g.completed_at,g.cancelled_at,g.rejected_at,g.rejection_reason
     FROM gdpr_requests g
     LEFT JOIN users u ON u.id = g.user_id
     LEFT JOIN admin_users a ON a.id = g.assigned_admin_id
     ${where}
     ORDER BY ${order} LIMIT ${page.limit} OFFSET ${page.offset}`,
    params
  );
  const total = await pool.query(
    `SELECT COUNT(*) count FROM gdpr_requests g LEFT JOIN users u ON u.id = g.user_id ${where}`,
    params
  );
  res.json({
    rows: rows.rows.map(publicGdprRow),
    total: Number(total.rows[0]?.count ?? 0),
    ...page
  });
}

export async function adminCreateGdprRequest(req, res) {
  const userId = positiveId(req.body?.userId);
  const requestType = enumValue(req.body?.requestType, GDPR_REQUEST_TYPES, null);
  const subject = cleanText(req.body?.subject || req.body?.reason, 255);
  const description = cleanText(req.body?.description || req.body?.reason, 10000);
  const locale = cleanLocale(req.body?.locale);
  if (!userId || !requestType || !subject || !description) {
    return res.status(400).json({ code: "GDPR_REQUEST_INVALID" });
  }
  const dueDays = await settingNumber("gdpr_due_days", 30);
  let insertedId = 0;
  await pool.transaction(async (query) => {
    const inserted = await query(
      `INSERT INTO gdpr_requests(user_id, public_id, request_type, status, reason, subject, description,
        requested_by_admin_id, assigned_admin_id, source, locale, submitted_at, due_at, user_agent)
       VALUES($1, '', $2, 'submitted', $3, $4, $5, $6, $6, 'admin', $7, UTC_TIMESTAMP(),
        DATE_ADD(UTC_TIMESTAMP(), INTERVAL $8 DAY), $9)`,
      [userId, requestType, description, subject, description, req.admin.id, locale, dueDays, cleanText(req.headers["user-agent"], 512)]
    );
    insertedId = inserted.insertId;
    const publicId = publicGdprId(insertedId);
    await query("UPDATE gdpr_requests SET public_id = $1 WHERE id = $2", [publicId, insertedId]);
    await gdprEvent(query, insertedId, "admin", req.admin.id, "created", null, "submitted", description, { source: "admin", requestType });
  });
  await adminAudit(req, "gdpr.request_created", insertedId, { userId, requestType });
  res.status(201).json({ id: String(insertedId), publicId: publicGdprId(insertedId), status: "submitted" });
}

export async function adminGdprRequestDetails(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "GDPR_REQUEST_INVALID" });
  const request = await gdprRequestById(id);
  if (!request) return res.status(404).json({ code: "GDPR_REQUEST_NOT_FOUND" });
  await adminAudit(req, "gdpr.request_read", id);
  res.json(await gdprDetailsPayload(request));
}

export async function adminAssignGdprRequest(req, res) {
  const id = positiveId(req.params.id);
  const adminId = positiveId(req.body?.adminId) || Number(req.admin.id);
  if (!id || !adminId) return res.status(400).json({ code: "GDPR_ASSIGN_INVALID" });
  await pool.transaction(async (query) => {
    await query("UPDATE gdpr_requests SET assigned_admin_id = $1 WHERE id = $2", [adminId, id]);
    await gdprEvent(query, id, "admin", req.admin.id, "assigned", null, null, cleanText(req.body?.comment, 2000), { assignedAdminId: adminId });
  });
  await adminAudit(req, "gdpr.assigned", id, { assignedAdminId: adminId });
  res.json({ ok: true });
}

export async function adminUpdateGdprStatus(req, res) {
  const id = positiveId(req.params.id);
  const status = enumValue(req.body?.status, GDPR_STATUSES, null);
  const comment = cleanText(req.body?.comment, 4000);
  if (!id || !status) return res.status(400).json({ code: "GDPR_STATUS_INVALID" });
  const request = await gdprRequestById(id);
  if (!request) return res.status(404).json({ code: "GDPR_REQUEST_NOT_FOUND" });
  await setGdprStatus(id, request.status, status, "admin", req.admin.id, comment);
  await adminAudit(req, "gdpr.status_changed", id, { oldStatus: request.status, status });
  await notifyUser(request.user_id, "gdpr_status", notificationText(request.locale, status, request.public_id));
  res.json({ ok: true });
}

export async function adminCommentGdprRequest(req, res) {
  const id = positiveId(req.params.id);
  const visibility = enumValue(req.body?.visibility, ["user", "internal"], "internal");
  const comment = cleanText(req.body?.comment, 10000);
  if (!id || !comment) return res.status(400).json({ code: "GDPR_COMMENT_INVALID" });
  const column = visibility === "user" ? "user_visible_comment" : "internal_admin_comment";
  await pool.transaction(async (query) => {
    await query(`UPDATE gdpr_requests SET ${column} = $1 WHERE id = $2`, [comment, id]);
    await gdprEvent(query, id, "admin", req.admin.id, visibility === "user" ? "user_comment" : "internal_comment", null, null, comment, { visibility });
  });
  await adminAudit(req, visibility === "user" ? "gdpr.user_comment" : "gdpr.internal_comment", id);
  res.json({ ok: true });
}

export async function adminVerifyGdprIdentity(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "GDPR_REQUEST_INVALID" });
  const request = await gdprRequestById(id);
  if (!request) return res.status(404).json({ code: "GDPR_REQUEST_NOT_FOUND" });
  await pool.transaction(async (query) => {
    await query("UPDATE gdpr_requests SET identity_verified_at = UTC_TIMESTAMP(), status = 'verified' WHERE id = $1", [id]);
    await gdprEvent(query, id, "admin", req.admin.id, "identity_verified", request.status, "verified", cleanText(req.body?.comment, 2000), { method: "admin_manual" });
  });
  await adminAudit(req, "gdpr.identity_verified", id);
  res.json({ ok: true });
}

export async function adminApproveGdprRequest(req, res) {
  return adminUpdateTypedStatus(req, res, "approved", "gdpr.approved");
}

export async function adminRejectGdprRequest(req, res) {
  const id = positiveId(req.params.id);
  const reason = cleanText(req.body?.reason || req.body?.comment, 1000);
  if (!id || !reason) return res.status(400).json({ code: "GDPR_REJECTION_REASON_REQUIRED" });
  const request = await gdprRequestById(id);
  if (!request) return res.status(404).json({ code: "GDPR_REQUEST_NOT_FOUND" });
  await pool.transaction(async (query) => {
    await query("UPDATE gdpr_requests SET status='rejected', rejected_at=UTC_TIMESTAMP(), rejection_reason=$1 WHERE id=$2", [reason, id]);
    await gdprEvent(query, id, "admin", req.admin.id, "rejected", request.status, "rejected", reason, {});
  });
  await adminAudit(req, "gdpr.rejected", id, { reason });
  await notifyUser(request.user_id, "gdpr_rejected", notificationText(request.locale, "rejected", request.public_id));
  res.json({ ok: true });
}

export async function adminCompleteGdprRequest(req, res) {
  return adminUpdateTypedStatus(req, res, "completed", "gdpr.completed");
}

export async function adminGenerateGdprExport(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "GDPR_REQUEST_INVALID" });
  const request = await gdprRequestById(id);
  if (!request?.user_id) return res.status(404).json({ code: "GDPR_REQUEST_NOT_FOUND" });
  if (CRITICAL_TYPES.has(request.request_type) && !request.identity_verified_at) {
    return res.status(409).json({ code: "GDPR_IDENTITY_VERIFICATION_REQUIRED" });
  }
  const retentionDays = await settingNumber("gdpr_export_retention_days", 7);
  let jobId = 0;
  await pool.transaction(async (query) => {
    const job = await query("INSERT INTO gdpr_export_jobs(request_id,status,progress,started_at) VALUES($1,'running',5,UTC_TIMESTAMP())", [id]);
    jobId = job.insertId;
    await gdprEvent(query, id, "admin", req.admin.id, "export_started", request.status, request.status, "", { jobId });
  });
  try {
    const archive = await createUserExportArchive(request, retentionDays);
    await pool.transaction(async (query) => {
      await query(
        `UPDATE gdpr_export_jobs SET status='completed', progress=100, completed_at=UTC_TIMESTAMP(),
         archive_path=$1, expires_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL $2 DAY) WHERE id=$3`,
        [archive.path, retentionDays, jobId]
      );
      await query(
        `INSERT INTO gdpr_request_files(request_id,file_type,original_name,stored_name,storage_path,mime_type,size_bytes,checksum,expires_at)
         VALUES($1,'export',$2,$3,$4,'application/zip',$5,$6,DATE_ADD(UTC_TIMESTAMP(), INTERVAL $7 DAY))`,
        [id, `${request.public_id}.zip`, path.basename(archive.path), archive.path, archive.size, archive.checksum, retentionDays]
      );
      await gdprEvent(query, id, "admin", req.admin.id, "export_completed", request.status, request.status, "", { jobId, size: archive.size, expiresInDays: retentionDays });
    });
    await adminAudit(req, "gdpr.export_generated", id, { jobId });
    await notifyUser(request.user_id, "gdpr_export_ready", notificationText(request.locale, "export_ready", request.public_id));
    res.status(201).json({ ok: true, jobId: String(jobId), expiresInDays: retentionDays });
  } catch (error) {
    await pool.query("UPDATE gdpr_export_jobs SET status='failed', failed_at=UTC_TIMESTAMP(), error_message=$1 WHERE id=$2", [cleanText(error.message, 1000), jobId]);
    throw error;
  }
}

export async function adminAnonymizeGdprRequest(req, res) {
  const id = positiveId(req.params.id);
  const request = id ? await gdprRequestById(id) : null;
  if (!request?.user_id) return res.status(404).json({ code: "GDPR_REQUEST_NOT_FOUND" });
  if (!request.identity_verified_at) return res.status(409).json({ code: "GDPR_IDENTITY_VERIFICATION_REQUIRED" });
  await anonymizeUserData(request.user_id, id, req.admin.id);
  await setGdprStatus(id, request.status, "completed", "admin", req.admin.id, cleanText(req.body?.comment, 2000) || "Anonymization completed");
  await adminAudit(req, "gdpr.anonymized", id, { userId: request.user_id });
  res.json({ ok: true });
}

export async function adminDeleteGdprAccount(req, res) {
  const id = positiveId(req.params.id);
  const request = id ? await gdprRequestById(id) : null;
  if (!request?.user_id) return res.status(404).json({ code: "GDPR_REQUEST_NOT_FOUND" });
  if (!request.identity_verified_at) return res.status(409).json({ code: "GDPR_IDENTITY_VERIFICATION_REQUIRED" });
  await anonymizeUserData(request.user_id, id, req.admin.id, { deleteAccount: true });
  await setGdprStatus(id, request.status, "completed", "admin", req.admin.id, cleanText(req.body?.comment, 2000) || "Account deletion/anonymization completed");
  await adminAudit(req, "gdpr.account_deleted", id, { userId: request.user_id });
  res.json({ ok: true });
}

export async function adminGdprAudit(req, res) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ code: "GDPR_REQUEST_INVALID" });
  const events = await pool.query(
    "SELECT id,actor_type,actor_id,event_type,old_status,new_status,comment,metadata_json,created_at FROM gdpr_request_events WHERE request_id=$1 ORDER BY created_at,id",
    [id]
  );
  await adminAudit(req, "gdpr.audit_read", id);
  res.json({ rows: events.rows });
}

export async function cleanupExpiredGdprExports() {
  const files = await pool.query(
    "SELECT id,request_id,storage_path FROM gdpr_request_files WHERE file_type='export' AND deleted_at IS NULL AND expires_at IS NOT NULL AND expires_at < UTC_TIMESTAMP() LIMIT 100"
  );
  for (const file of files.rows) {
    try {
      await unlink(file.storage_path);
    } catch {
      // Missing files are still marked deleted to stop future download attempts.
    }
    await pool.transaction(async (query) => {
      await query("UPDATE gdpr_request_files SET deleted_at=UTC_TIMESTAMP() WHERE id=$1", [file.id]);
      await gdprEvent(query, file.request_id, "system", null, "export_deleted", null, null, "", { fileId: file.id });
    });
  }
  const draftDays = await settingNumber("gdpr_draft_retention_days", 14);
  await pool.query(
    "UPDATE gdpr_requests SET status='expired' WHERE status='draft' AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL $1 DAY)",
    [draftDays]
  );
  return { deletedFiles: files.rowCount };
}

async function userGdprRequests(req, res) {
  const rows = await pool.query(
    `SELECT id,public_id,request_type,status,subject,submitted_at,due_at,created_at,completed_at,cancelled_at,rejected_at
     FROM gdpr_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
    [req.user.id]
  );
  res.json({ rows: rows.rows.map(publicUserGdprRow) });
}

async function userCreateGdprRequest(req, res) {
  const requestType = enumValue(req.body?.requestType, GDPR_REQUEST_TYPES, null);
  const subject = cleanText(req.body?.subject, 255);
  const description = cleanText(req.body?.description, 10000);
  const locale = cleanLocale(req.body?.locale);
  const acknowledged = Boolean(req.body?.acknowledged);
  if (!requestType || !subject || !description || !acknowledged) {
    return res.status(400).json({ code: "GDPR_REQUEST_INVALID" });
  }
  const dueDays = await settingNumber("gdpr_due_days", 30);
  let insertedId = 0;
  await pool.transaction(async (query) => {
    const inserted = await query(
      `INSERT INTO gdpr_requests(user_id, public_id, request_type, status, reason, subject, description,
        source, locale, submitted_at, due_at, ip_address_hash, user_agent)
       VALUES($1,'',$2,$3,$4,$5,$6,'app',$7,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(), INTERVAL $8 DAY),$9,$10)`,
      [
        req.user.id,
        requestType,
        CRITICAL_TYPES.has(requestType) ? "identity_verification_required" : "submitted",
        description,
        subject,
        description,
        locale,
        dueDays,
        hashSafe(requestIp(req)),
        cleanText(req.headers["user-agent"], 512)
      ]
    );
    insertedId = inserted.insertId;
    const publicId = publicGdprId(insertedId);
    await query("UPDATE gdpr_requests SET public_id=$1 WHERE id=$2", [publicId, insertedId]);
    await gdprEvent(query, insertedId, "user", req.user.id, "created", null, CRITICAL_TYPES.has(requestType) ? "identity_verification_required" : "submitted", description, { requestType });
  });
  await notifyUser(req.user.id, "gdpr_created", notificationText(locale, "created", publicGdprId(insertedId)));
  res.status(201).json({ publicId: publicGdprId(insertedId), status: CRITICAL_TYPES.has(requestType) ? "identity_verification_required" : "submitted", dueDays });
}

async function userGdprRequestDetails(req, res) {
  const request = await gdprRequestByPublicId(req.params.publicId, req.user.id);
  if (!request) return res.status(404).json({ code: "GDPR_REQUEST_NOT_FOUND" });
  res.json(await gdprDetailsPayload(request, { userView: true }));
}

async function userVerifyGdprRequest(req, res) {
  const request = await gdprRequestByPublicId(req.params.publicId, req.user.id);
  if (!request) return res.status(404).json({ code: "GDPR_REQUEST_NOT_FOUND" });
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const user = await pool.query("SELECT password_hash FROM users WHERE id=$1", [req.user.id]);
  if (!user.rowCount || !user.rows[0].password_hash || !(await bcrypt.compare(password, user.rows[0].password_hash))) {
    return res.status(403).json({ code: "GDPR_PASSWORD_VERIFICATION_FAILED" });
  }
  await pool.transaction(async (query) => {
    await query("UPDATE gdpr_requests SET identity_verified_at=UTC_TIMESTAMP(), status='verified' WHERE id=$1", [request.id]);
    await gdprEvent(query, request.id, "user", req.user.id, "identity_verified", request.status, "verified", "", { method: "password" });
  });
  res.json({ ok: true, status: "verified" });
}

async function userReplyGdprRequest(req, res) {
  const request = await gdprRequestByPublicId(req.params.publicId, req.user.id);
  const comment = cleanText(req.body?.comment, 10000);
  if (!request || !comment) return res.status(400).json({ code: "GDPR_REPLY_INVALID" });
  await pool.transaction(async (query) => {
    await query("UPDATE gdpr_requests SET user_comment=$1, status=CASE WHEN status='waiting_for_user' THEN 'in_review' ELSE status END WHERE id=$2", [comment, request.id]);
    await gdprEvent(query, request.id, "user", req.user.id, "user_reply", request.status, request.status === "waiting_for_user" ? "in_review" : request.status, comment, {});
  });
  res.json({ ok: true });
}

async function userCancelGdprRequest(req, res) {
  const request = await gdprRequestByPublicId(req.params.publicId, req.user.id);
  if (!request) return res.status(404).json({ code: "GDPR_REQUEST_NOT_FOUND" });
  if (!["draft", "submitted", "identity_verification_required", "verified", "waiting_for_user"].includes(request.status)) {
    return res.status(409).json({ code: "GDPR_CANCEL_NOT_ALLOWED" });
  }
  await pool.transaction(async (query) => {
    await query("UPDATE gdpr_requests SET status='cancelled', cancelled_at=UTC_TIMESTAMP() WHERE id=$1", [request.id]);
    await gdprEvent(query, request.id, "user", req.user.id, "cancelled", request.status, "cancelled", cleanText(req.body?.comment, 1000), {});
  });
  res.json({ ok: true });
}

async function userDownloadGdprExport(req, res) {
  const request = await gdprRequestByPublicId(req.params.publicId, req.user.id);
  if (!request) return res.status(404).json({ code: "GDPR_REQUEST_NOT_FOUND" });
  const file = await pool.query(
    `SELECT * FROM gdpr_request_files
     WHERE request_id=$1 AND file_type='export' AND deleted_at IS NULL
       AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())
       AND download_count < $2
     ORDER BY created_at DESC LIMIT 1`,
    [request.id, EXPORT_DOWNLOAD_LIMIT]
  );
  if (!file.rowCount) return res.status(404).json({ code: "GDPR_EXPORT_NOT_AVAILABLE" });
  const selected = file.rows[0];
  const bytes = await readFile(selected.storage_path);
  await pool.transaction(async (query) => {
    await query("UPDATE gdpr_request_files SET download_count=download_count+1 WHERE id=$1", [selected.id]);
    await gdprEvent(query, request.id, "user", req.user.id, "export_downloaded", request.status, request.status, "", { fileId: selected.id });
  });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${request.public_id}.zip"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(bytes);
}

async function adminUpdateTypedStatus(req, res, status, auditAction) {
  const id = positiveId(req.params.id);
  const request = id ? await gdprRequestById(id) : null;
  if (!request) return res.status(404).json({ code: "GDPR_REQUEST_NOT_FOUND" });
  await setGdprStatus(id, request.status, status, "admin", req.admin.id, cleanText(req.body?.comment, 2000));
  await adminAudit(req, auditAction, id);
  res.json({ ok: true });
}

async function setGdprStatus(id, oldStatus, newStatus, actorType, actorId, comment) {
  await pool.transaction(async (query) => {
    await query(
      `UPDATE gdpr_requests
       SET status=$1,
           completed_at=CASE WHEN $1='completed' THEN UTC_TIMESTAMP() ELSE completed_at END,
           cancelled_at=CASE WHEN $1='cancelled' THEN UTC_TIMESTAMP() ELSE cancelled_at END,
           rejected_at=CASE WHEN $1='rejected' THEN UTC_TIMESTAMP() ELSE rejected_at END
       WHERE id=$2`,
      [newStatus, id]
    );
    await gdprEvent(query, id, actorType, actorId, "status_changed", oldStatus, newStatus, comment, {});
  });
}

async function createUserExportArchive(request, retentionDays) {
  const exportDir = process.env.GDPR_EXPORT_DIR || path.resolve(process.cwd(), "storage", "gdpr_exports");
  await mkdir(exportDir, { recursive: true });
  const payload = await exportPayload(request.user_id, request.public_id);
  const files = [
    ["README.txt", Buffer.from(exportReadme(request, retentionDays), "utf8")],
    ["profile.json", jsonBuffer(payload.profile)],
    ["settings.json", jsonBuffer(payload.settings)],
    ["consents.json", jsonBuffer(payload.consents)],
    ["devices.json", jsonBuffer(payload.devices)],
    ["sos_card.json", jsonBuffer(payload.sosCard)],
    ["support.json", jsonBuffer(payload.support)],
    ["gdpr_requests.json", jsonBuffer(payload.gdprRequests)],
    ["glucose.csv", csvBuffer(payload.glucose)],
    ["insulin.csv", csvBuffer(payload.insulin)],
    ["food.csv", csvBuffer(payload.food)],
    ["diary.csv", csvBuffer([...payload.glucose, ...payload.insulin, ...payload.food])],
    ["subscriptions.csv", csvBuffer(payload.subscriptions)]
  ];
  const zip = createZip(files);
  const storedName = `${randomBytes(18).toString("hex")}.zip`;
  const archivePath = path.join(exportDir, storedName);
  await writeFile(archivePath, zip, { mode: 0o600 });
  const file = await stat(archivePath);
  return {
    path: archivePath,
    size: file.size,
    checksum: createHash("sha256").update(zip).digest("hex")
  };
}

async function exportPayload(userId, publicId) {
  const [
    profile,
    settings,
    devices,
    sosCard,
    glucose,
    insulin,
    food,
    subscriptions,
    support,
    gdprRequests
  ] = await Promise.all([
    pool.query(
      `SELECT id,email,full_name,preferred_locale,premium_status,premium_plan,premium_until,
        subscription_status,subscription_expires_at,email_verified,diabetes_type,glucose_unit,created_at
       FROM users WHERE id=$1`,
      [userId]
    ),
    pool.query("SELECT settings_json, updated_at FROM user_settings WHERE user_id=$1", [userId]).catch(() => ({ rows: [] })),
    pool.query("SELECT device_id,device_name,platform,last_seen_at,created_at,revoked_at FROM account_devices WHERE user_id=$1", [userId]),
    pool.query("SELECT card,hide_sensitive,updated_at FROM sos_profiles WHERE user_id=$1", [userId]).catch(() => ({ rows: [] })),
    pool.query("SELECT measured_at,glucose_mmol,glucose_mgdl,context,note,created_at FROM glucose_logs WHERE user_id=$1 ORDER BY measured_at", [userId]).catch(() => ({ rows: [] })),
    pool.query("SELECT administered_at,units,insulin_type,metadata,created_at FROM insulin_logs WHERE user_id=$1 ORDER BY administered_at", [userId]).catch(() => ({ rows: [] })),
    pool.query("SELECT consumed_at,food_name,carbs_g,metadata,created_at FROM food_logs WHERE user_id=$1 ORDER BY consumed_at", [userId]).catch(() => ({ rows: [] })),
    pool.query("SELECT provider,plan,status,expires_at,created_at,updated_at FROM subscriptions WHERE user_id=$1 ORDER BY updated_at", [userId]).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT t.id,t.subject,t.status,t.priority,t.created_at,t.updated_at,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('body', m.body, 'createdAt', m.created_at)) FROM support_messages m WHERE m.ticket_id=t.id) messages
       FROM support_tickets t WHERE t.user_id=$1`,
      [userId]
    ).catch(() => ({ rows: [] })),
    pool.query("SELECT public_id,request_type,status,subject,description,submitted_at,due_at,completed_at FROM gdpr_requests WHERE user_id=$1 OR public_id=$2", [userId, publicId]).catch(() => ({ rows: [] }))
  ]);
  return {
    profile: profile.rows[0] ?? {},
    settings: settings.rows,
    consents: [],
    devices: devices.rows,
    sosCard: sosCard.rows[0] ?? null,
    glucose: glucose.rows,
    insulin: insulin.rows,
    food: food.rows,
    subscriptions: subscriptions.rows,
    support: support.rows,
    gdprRequests: gdprRequests.rows
  };
}

async function anonymizeUserData(userId, requestId, adminId, { deleteAccount = false } = {}) {
  const anonymizedEmail = `deleted-user-${userId}-${randomBytes(4).toString("hex")}@anonymous.glukotrack.local`;
  await pool.transaction(async (query) => {
    await query(
      `UPDATE users SET email=$1, full_name='Deleted user', password_hash=NULL, email_verified=FALSE,
        token_version=token_version+1, admin_blocked_at=UTC_TIMESTAMP(), admin_block_reason=$2,
        stripe_customer_id=NULL, email_verification_token_hash=NULL, password_reset_token_hash=NULL
       WHERE id=$3`,
      [anonymizedEmail, deleteAccount ? "GDPR account deletion" : "GDPR anonymization", userId]
    );
    await query("UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP() WHERE user_id=$1 AND revoked_at IS NULL", [userId]).catch(() => {});
    await query("UPDATE account_devices SET revoked_at=UTC_TIMESTAMP() WHERE user_id=$1 AND revoked_at IS NULL", [userId]).catch(() => {});
    await query("UPDATE family_links SET status='revoked' WHERE owner_user_id=$1 OR caregiver_user_id=$1", [userId]).catch(() => {});
    await query("UPDATE sos_profiles SET public_token=NULL, card=JSON_OBJECT(), hide_sensitive=TRUE WHERE user_id=$1", [userId]).catch(() => {});
    await query(
      `INSERT INTO gdpr_data_actions(request_id,action_type,entity_type,entity_id,action_result,details_json,executed_by)
       VALUES($1,$2,'user',$3,'completed',$4,$5)`,
      [requestId, deleteAccount ? "delete_account" : "anonymize", userId, { anonymizedEmail }, adminId]
    );
    await gdprEvent(query, requestId, "admin", adminId, deleteAccount ? "account_deleted" : "anonymized", null, "completed", "", { userId });
  });
}

async function gdprDetailsPayload(request, { userView = false } = {}) {
  const [events, files, jobs, actions] = await Promise.all([
    pool.query(
      "SELECT id,actor_type,actor_id,event_type,old_status,new_status,comment,metadata_json,created_at FROM gdpr_request_events WHERE request_id=$1 ORDER BY created_at,id",
      [request.id]
    ),
    pool.query("SELECT id,file_type,original_name,mime_type,size_bytes,checksum,expires_at,download_count,created_at,deleted_at FROM gdpr_request_files WHERE request_id=$1 ORDER BY created_at DESC", [request.id]),
    pool.query("SELECT id,status,progress,started_at,completed_at,failed_at,error_message,expires_at,created_at,updated_at FROM gdpr_export_jobs WHERE request_id=$1 ORDER BY created_at DESC", [request.id]),
    userView ? Promise.resolve({ rows: [] }) : pool.query("SELECT id,action_type,entity_type,entity_id,action_result,details_json,executed_by,executed_at FROM gdpr_data_actions WHERE request_id=$1 ORDER BY executed_at DESC", [request.id])
  ]);
  return {
    request: userView ? publicUserGdprRow(request) : publicGdprRow(request),
    events: userView ? events.rows.filter((event) => event.event_type !== "internal_comment") : events.rows,
    files: files.rows,
    exportJobs: jobs.rows,
    actions: actions.rows
  };
}

async function gdprRequestById(id) {
  const result = await pool.query(
    `SELECT g.*,u.email,u.full_name,u.created_at user_created_at,a.email assigned_admin_email
     FROM gdpr_requests g
     LEFT JOIN users u ON u.id=g.user_id
     LEFT JOIN admin_users a ON a.id=g.assigned_admin_id
     WHERE g.id=$1`,
    [id]
  );
  return result.rows[0] ?? null;
}

async function gdprRequestByPublicId(publicId, userId) {
  const result = await pool.query(
    `SELECT g.*,u.email,u.full_name,u.created_at user_created_at,a.email assigned_admin_email
     FROM gdpr_requests g
     LEFT JOIN users u ON u.id=g.user_id
     LEFT JOIN admin_users a ON a.id=g.assigned_admin_id
     WHERE g.public_id=$1 AND g.user_id=$2`,
    [cleanText(publicId, 32), userId]
  );
  return result.rows[0] ?? null;
}

async function gdprEvent(query, requestId, actorType, actorId, eventType, oldStatus, newStatus, comment = "", metadata = {}) {
  await query(
    `INSERT INTO gdpr_request_events(request_id,actor_type,actor_id,event_type,old_status,new_status,comment,metadata_json)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [requestId, actorType, actorId == null ? null : String(actorId), eventType, oldStatus, newStatus, comment || null, metadata]
  );
}

async function notifyUser(userId, type, { title, body }) {
  if (!userId) return;
  await pool.query(
    "INSERT INTO notifications(user_id,type,title,body,metadata) VALUES($1,$2,$3,$4,$5)",
    [userId, type, title, body, { source: "gdpr" }]
  ).catch(() => {});
}

function notificationText(locale, status, publicId) {
  const ru = locale === "ru" || locale === "uk";
  const statusText = ru ? statusRu(status) : status;
  return ru
    ? { title: "GDPR-запрос", body: `Запрос ${publicId}: ${statusText}` }
    : { title: "GDPR request", body: `Request ${publicId}: ${statusText}` };
}

function statusRu(status) {
  return {
    created: "создан",
    export_ready: "экспорт готов",
    rejected: "отклонен",
    completed: "выполнен",
    approved: "одобрен",
    in_progress: "в обработке",
    waiting_for_user: "ожидает ответа пользователя"
  }[status] || status;
}

async function settingNumber(key, fallback) {
  const result = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key=$1", [key]).catch(() => ({ rows: [] }));
  const value = Number.parseInt(result.rows[0]?.setting_value, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function adminAudit(req, action, entityId, metadata = {}) {
  await pool.query(
    `INSERT INTO admin_audit_logs(admin_user_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
     VALUES($1,$2,'gdpr_request',$3,$4,$5,$6)`,
    [req.admin?.id ?? null, action, entityId == null ? null : String(entityId), metadata, requestIp(req), cleanText(req.headers["user-agent"], 512)]
  ).catch(() => {});
}

function gdprFilter(query) {
  const clauses = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    clauses.push(sql.replace("?", `$${params.length}`));
  };
  const q = cleanText(query?.q, 128);
  if (q) {
    const term = `%${q}%`;
    params.push(term, term, term);
    clauses.push(`(u.email LIKE $${params.length - 2} OR g.public_id LIKE $${params.length - 1} OR CAST(g.user_id AS CHAR) LIKE $${params.length})`);
  }
  const type = enumValue(query?.type, GDPR_REQUEST_TYPES, null);
  if (type) add("g.request_type = ?", type);
  const status = enumValue(query?.status, GDPR_STATUSES, null);
  if (status) add("g.status = ?", status);
  const assigned = positiveId(query?.assignedAdminId);
  if (assigned) add("g.assigned_admin_id = ?", assigned);
  const due = enumValue(query?.due, ["overdue", "soon", "open"], null);
  if (due === "overdue") clauses.push("g.due_at IS NOT NULL AND g.due_at < UTC_TIMESTAMP() AND g.status NOT IN ('completed','cancelled','rejected','expired')");
  if (due === "soon") clauses.push("g.due_at BETWEEN UTC_TIMESTAMP() AND DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY) AND g.status NOT IN ('completed','cancelled','rejected','expired')");
  if (due === "open") clauses.push("g.status NOT IN ('completed','cancelled','rejected','expired')");
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

function gdprSort(value) {
  return {
    due: "g.due_at ASC, g.created_at DESC",
    status: "g.status ASC, g.created_at DESC",
    type: "g.request_type ASC, g.created_at DESC",
    user: "u.email ASC, g.created_at DESC"
  }[cleanText(value, 32)] || "g.created_at DESC";
}

function publicGdprRow(row) {
  const dueRisk = dueRiskState(row.due_at, row.status);
  return {
    id: String(row.id),
    publicId: row.public_id || publicGdprId(row.id),
    userId: row.user_id == null ? null : String(row.user_id),
    user_id: row.user_id == null ? null : String(row.user_id),
    email: row.email ?? null,
    userCreatedAt: row.user_created_at ?? null,
    requestType: row.request_type,
    request_type: row.request_type,
    status: row.status,
    subject: row.subject ?? row.reason ?? "",
    description: row.description ?? row.reason ?? "",
    source: row.source,
    locale: row.locale,
    submittedAt: row.submitted_at,
    dueAt: row.due_at,
    assignedAdminId: row.assigned_admin_id == null ? null : String(row.assigned_admin_id),
    assignedAdminEmail: row.assigned_admin_email ?? null,
    identityVerifiedAt: row.identity_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    rejectedAt: row.rejected_at,
    rejectionReason: row.rejection_reason,
    dueRisk,
    daysRemaining: dueRisk.daysRemaining
  };
}

function publicUserGdprRow(row) {
  const item = publicGdprRow(row);
  delete item.description;
  return item;
}

function dueRiskState(dueAt, status) {
  if (!dueAt || TERMINAL_STATUSES.has(status)) return { level: "none", label: "", daysRemaining: null };
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  const days = Math.ceil((due - now) / 86400000);
  if (days < 0) return { level: "red", label: `overdue ${Math.abs(days)}d`, daysRemaining: days };
  if (days <= 7) return { level: "yellow", label: `${days}d left`, daysRemaining: days };
  return { level: "green", label: `${days}d left`, daysRemaining: days };
}

function publicGdprId(id) {
  const year = new Date().getUTCFullYear();
  return `GDPR-${year}-${String(id).padStart(6, "0")}`;
}

function pageParams(req) {
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 25, 1), 100);
  const page = Math.max(Number.parseInt(req.query?.page, 10) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
}

function enumValue(value, allowed, fallback) {
  const normalized = cleanText(value, 64);
  return allowed.includes(normalized) ? normalized : fallback;
}

function positiveId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanLocale(value) {
  return cleanText(value, 16).toLowerCase().replace(/[^a-z-]/g, "") || "en";
}

function requestIp(req) {
  return cleanText(req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "", 128);
}

function hashSafe(value) {
  return value ? createHash("sha256").update(String(value)).digest("hex") : null;
}

function jsonBuffer(value) {
  return Buffer.from(`${JSON.stringify(value ?? null, null, 2)}\n`, "utf8");
}

function csvBuffer(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const columns = [...new Set(list.flatMap((row) => Object.keys(row ?? {})))];
  const lines = [columns.join(",")];
  for (const row of list) {
    lines.push(columns.map((column) => csvCell(row?.[column])).join(","));
  }
  return Buffer.from(`${lines.join("\n")}\n`, "utf8");
}

function csvCell(value) {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportReadme(request, retentionDays) {
  return [
    "GlukoTrack GDPR data export",
    `Request: ${request.public_id}`,
    `Created: ${new Date().toISOString()}`,
    `This archive is available for ${retentionDays} days.`,
    "It does not include passwords, password hashes, tokens, internal admin comments or secrets."
  ].join("\n");
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, data] of files) {
    const nameBuffer = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  return crc >>> 0;
});
