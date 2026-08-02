export function createSosNotificationRepository(query) {
  return {
    createNotificationJob(sosEventId, recipientUserId) {
      return query(
        `INSERT INTO sos_notification_outbox(
           sos_event_id, recipient_user_id, status, attempts, sent_at
         ) VALUES($1, $2, 'PENDING', 0, NULL)
         ON DUPLICATE KEY UPDATE id = id`,
        [sosEventId, recipientUserId]
      );
    },

    async getPendingJobs({ includeFailed = false, limit = 100 } = {}) {
      const retryCondition = includeFailed
        ? "(sno.status = 'PENDING' OR (sno.status = 'FAILED' AND sno.retryable = TRUE AND sno.attempts < 5))"
        : "sno.status = 'PENDING'";
      return (await query(
        `SELECT sno.id, sno.sos_event_id, sno.recipient_user_id, sno.status,
                sno.attempts, sno.retryable, sno.created_at, sno.sent_at,
                se.patient_id, se.status AS sos_event_status
         FROM sos_notification_outbox sno
         JOIN sos_events se ON se.id = sno.sos_event_id
         WHERE ${retryCondition}
         ORDER BY sno.created_at ASC, sno.id ASC
         LIMIT $1`,
        [limit]
      )).rows;
    },

    markSent(jobId) {
      return query(
        `UPDATE sos_notification_outbox
         SET status = 'SENT', attempts = attempts + 1, retryable = FALSE,
             sent_at = UTC_TIMESTAMP()
         WHERE id = $1 AND status IN ('PENDING', 'FAILED')`,
        [jobId]
      );
    },

    markFailed(jobId, { retryable = true } = {}) {
      return query(
        `UPDATE sos_notification_outbox
         SET status = 'FAILED', attempts = attempts + 1, retryable = $2
         WHERE id = $1 AND status IN ('PENDING', 'FAILED')`,
        [jobId, retryable]
      );
    },

    async findActivePushDevices(userId) {
      return (await query(
        `SELECT ad.id, ad.user_id, ad.device_id, ad.platform, ad.push_token
         FROM account_devices ad
         JOIN users u ON u.id = ad.user_id
         WHERE ad.user_id = $1
           AND ad.revoked_at IS NULL
           AND ad.push_revoked_at IS NULL
           AND ad.push_token IS NOT NULL
           AND ad.push_token <> ''
         ORDER BY ad.last_seen_at DESC, ad.id DESC`,
        [userId]
      )).rows;
    },

    revokePushToken(deviceId) {
      return query(
        `UPDATE account_devices
         SET push_token = NULL, push_revoked_at = UTC_TIMESTAMP()
         WHERE id = $1 AND revoked_at IS NULL`,
        [deviceId]
      );
    },

    createDeliveryLog(outboxId, provider, status, error = null) {
      return query(
        `INSERT INTO notification_delivery_logs(outbox_id, provider, status, error)
         VALUES($1, $2, $3, $4)`,
        [outboxId, provider, status, error]
      );
    }
  };
}
