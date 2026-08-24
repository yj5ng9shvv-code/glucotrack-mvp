-- Rollback for 037_sos_outbox_worker_e2e.sql. Use only after stopping SOS worker.
ALTER TABLE sos_notification_outbox
  DROP KEY IF EXISTS sos_notification_outbox_idempotency_unique,
  DROP KEY IF EXISTS sos_notification_outbox_due_idx,
  DROP KEY IF EXISTS sos_notification_outbox_event_status_idx;

ALTER TABLE sos_notification_outbox
  DROP COLUMN IF EXISTS channel,
  DROP COLUMN IF EXISTS notification_type,
  DROP COLUMN IF EXISTS sequence,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS scheduled_at,
  DROP COLUMN IF EXISTS processing_started_at,
  DROP COLUMN IF EXISTS processing_expires_at,
  DROP COLUMN IF EXISTS processed_at,
  DROP COLUMN IF EXISTS locked_by,
  DROP COLUMN IF EXISTS result_code,
  DROP COLUMN IF EXISTS last_error_code;

ALTER TABLE sos_notification_outbox
  MODIFY COLUMN status ENUM('PENDING','SENT','FAILED') NOT NULL DEFAULT 'PENDING';
