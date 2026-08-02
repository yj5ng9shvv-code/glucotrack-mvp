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
      const statuses = includeFailed ? "('PENDING', 'FAILED')" : "('PENDING')";
      return (await query(
        `SELECT id, sos_event_id, recipient_user_id, status, attempts,
                created_at, sent_at
         FROM sos_notification_outbox
         WHERE status IN ${statuses}
         ORDER BY created_at ASC, id ASC
         LIMIT $1`,
        [limit]
      )).rows;
    },

    markSent(jobId) {
      return query(
        `UPDATE sos_notification_outbox
         SET status = 'SENT', attempts = attempts + 1, sent_at = UTC_TIMESTAMP()
         WHERE id = $1 AND status IN ('PENDING', 'FAILED')`,
        [jobId]
      );
    },

    markFailed(jobId) {
      return query(
        `UPDATE sos_notification_outbox
         SET status = 'FAILED', attempts = attempts + 1
         WHERE id = $1 AND status IN ('PENDING', 'FAILED')`,
        [jobId]
      );
    }
  };
}
