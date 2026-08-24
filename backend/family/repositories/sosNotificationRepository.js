const CLAIM_LEASE_SECONDS = 120;
const MAX_TECHNICAL_ATTEMPTS = 5;

function safePart(value, fallback) {
  return String(value ?? fallback).replace(/[^A-Za-z0-9._:-]/g, "_").slice(0, 64) || fallback;
}

function idempotencyKey({ sosEventId, recipientUserId, channel, notificationType, sequence }) {
  return `sos:${sosEventId}:${recipientUserId}:${safePart(channel, "in_app")}:${safePart(notificationType, "initial")}:${Number(sequence) || 0}`;
}

export function createSosNotificationRepository(query) {
  const createNotificationJob = (sosEventId, recipientUserId, options = {}) => {
    const channel = safePart(options.channel, "in_app");
    const notificationType = safePart(options.notificationType, "initial");
    const sequence = Math.max(0, Number(options.sequence) || 0);
    const key = options.idempotencyKey || idempotencyKey({ sosEventId, recipientUserId, channel, notificationType, sequence });
    return query(
      `INSERT INTO sos_notification_outbox(
         sos_event_id, recipient_user_id, channel, notification_type, sequence,
         idempotency_key, status, attempts, retryable, scheduled_at, sent_at
       ) VALUES($1, $2, $3, $4, $5, $6, 'PENDING', 0, TRUE, COALESCE($7, UTC_TIMESTAMP()), NULL)
       ON DUPLICATE KEY UPDATE id = id`,
      [sosEventId, recipientUserId, channel, notificationType, sequence, key, options.scheduledAt ?? null]
    );
  };

  return {
    query,
    createNotificationJob,

    async claimDueJobs({ limit = 100, workerId, leaseSeconds = CLAIM_LEASE_SECONDS, maxAttempts = MAX_TECHNICAL_ATTEMPTS } = {}) {
      const lock = safePart(workerId, `worker-${Date.now()}`);
      await query(
        `UPDATE sos_notification_outbox sno
         JOIN sos_events se ON se.id = sno.sos_event_id
         SET sno.status = 'PROCESSING',
             sno.locked_by = $1,
             sno.processing_started_at = UTC_TIMESTAMP(),
             sno.processing_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL $2 SECOND),
             sno.attempts = sno.attempts + 1,
             sno.last_error_code = NULL
         WHERE sno.status IN ('PENDING','FAILED')
           AND sno.retryable = TRUE
           AND sno.attempts < $3
           AND sno.scheduled_at <= UTC_TIMESTAMP()
           AND (sno.processing_expires_at IS NULL OR sno.processing_expires_at < UTC_TIMESTAMP())
           AND LOWER(se.status) = 'active'
         ORDER BY sno.scheduled_at ASC, sno.id ASC
         LIMIT $4`,
        [lock, leaseSeconds, maxAttempts, limit]
      );
      return this.getClaimedJobs(lock);
    },

    async getClaimedJobs(workerId) {
      return (await query(
        `SELECT sno.id, sno.sos_event_id, sno.recipient_user_id, sno.channel,
                sno.notification_type, sno.sequence, sno.idempotency_key, sno.status,
                sno.attempts, sno.retryable, sno.created_at, sno.scheduled_at,
                sno.sent_at, sno.locked_by, se.patient_id, se.status AS sos_event_status,
                se.created_at AS sos_created_at, se.activated_at AS sos_activated_at
         FROM sos_notification_outbox sno
         JOIN sos_events se ON se.id = sno.sos_event_id
         WHERE sno.locked_by = $1 AND sno.status = 'PROCESSING'
         ORDER BY sno.scheduled_at ASC, sno.id ASC`,
        [workerId]
      )).rows;
    },

    async getPendingJobs({ includeFailed = false, limit = 100 } = {}) {
      const retryCondition = includeFailed
        ? "(sno.status = 'PENDING' OR (sno.status = 'FAILED' AND sno.retryable = TRUE AND sno.attempts < 5))"
        : "sno.status = 'PENDING'";
      return (await query(
        `SELECT sno.id, sno.sos_event_id, sno.recipient_user_id, sno.channel,
                sno.notification_type, sno.sequence, sno.idempotency_key, sno.status,
                sno.attempts, sno.retryable, sno.created_at, sno.scheduled_at,
                sno.sent_at, se.patient_id, se.status AS sos_event_status
         FROM sos_notification_outbox sno
         JOIN sos_events se ON se.id = sno.sos_event_id
         WHERE ${retryCondition}
         ORDER BY sno.scheduled_at ASC, sno.id ASC
         LIMIT $1`,
        [limit]
      )).rows;
    },

    markSent(jobId, { resultCode = "SENT" } = {}) {
      return query(
        `UPDATE sos_notification_outbox
         SET status = 'SENT', retryable = FALSE, sent_at = UTC_TIMESTAMP(), processed_at = UTC_TIMESTAMP(),
             processing_expires_at = NULL, locked_by = NULL, result_code = $2
         WHERE id = $1 AND status = 'PROCESSING'`,
        [jobId, resultCode]
      );
    },

    markFailed(jobId, { retryable = true, errorCode = "DELIVERY_FAILED" } = {}) {
      return query(
        `UPDATE sos_notification_outbox
         SET status = 'FAILED', retryable = $2, processed_at = UTC_TIMESTAMP(),
             processing_expires_at = NULL, locked_by = NULL, last_error_code = $3, result_code = 'FAILED'
         WHERE id = $1 AND status = 'PROCESSING'`,
        [jobId, retryable, safePart(errorCode, "DELIVERY_FAILED")]
      );
    },

    markSkipped(jobId, { reason = "SKIPPED" } = {}) {
      return query(
        `UPDATE sos_notification_outbox
         SET status = 'SKIPPED', retryable = FALSE, processed_at = UTC_TIMESTAMP(),
             processing_expires_at = NULL, locked_by = NULL, result_code = $2
         WHERE id = $1 AND status = 'PROCESSING'`,
        [jobId, safePart(reason, "SKIPPED")]
      );
    },

    cancelPendingForEvent(sosEventId, { reason = "SOS_NOT_ACTIVE" } = {}) {
      return query(
        `UPDATE sos_notification_outbox
         SET status = 'CANCELLED', retryable = FALSE, processed_at = UTC_TIMESTAMP(),
             processing_expires_at = NULL, locked_by = NULL, result_code = $2
         WHERE sos_event_id = $1 AND status IN ('PENDING','FAILED','PROCESSING')`,
        [sosEventId, safePart(reason, "SOS_NOT_ACTIVE")]
      );
    },

    async findActivePushDevices(userId) {
      return (await query(
        `SELECT ad.id, ad.user_id, ad.device_id, ad.platform,
                ad.push_token_encrypted, ad.push_token
         FROM account_devices ad
         JOIN users u ON u.id = ad.user_id
         WHERE ad.user_id = $1
           AND ad.revoked_at IS NULL
           AND ad.push_revoked_at IS NULL
           AND ((ad.push_token_encrypted IS NOT NULL AND ad.push_token_encrypted <> '')
             OR (ad.push_token IS NOT NULL AND ad.push_token <> ''))
         ORDER BY ad.last_seen_at DESC, ad.id DESC`,
        [userId]
      )).rows;
    },

    revokePushToken(deviceId) {
      return query(
        `UPDATE account_devices
         SET push_token_hash = NULL,
             push_token_encrypted = NULL,
             push_token = NULL,
             push_revoked_at = UTC_TIMESTAMP()
         WHERE id = $1 AND revoked_at IS NULL`,
        [deviceId]
      );
    },

    createDeliveryLog(outboxId, provider, status, error = null) {
      return query(
        `INSERT INTO notification_delivery_logs(outbox_id, provider, status, error)
         VALUES($1, $2, $3, $4)`,
        [outboxId, safePart(provider, "dry-run"), safePart(status, "UNKNOWN"), error ? String(error).slice(0, 255) : null]
      );
    }
  };
}
