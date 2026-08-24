-- Additive SOS outbox scheduler/idempotency fields for dry-run worker E2E.
ALTER TABLE sos_notification_outbox
  MODIFY COLUMN status ENUM('PENDING','PROCESSING','SENT','FAILED','CANCELLED','SKIPPED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS channel VARCHAR(32) NOT NULL DEFAULT 'push',
  ADD COLUMN IF NOT EXISTS notification_type VARCHAR(32) NOT NULL DEFAULT 'initial',
  ADD COLUMN IF NOT EXISTS sequence INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(160) NULL,
  ADD COLUMN IF NOT EXISTS scheduled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS processing_started_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS processing_expires_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS processed_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS locked_by VARCHAR(96) NULL,
  ADD COLUMN IF NOT EXISTS result_code VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS last_error_code VARCHAR(64) NULL;

UPDATE sos_notification_outbox
SET idempotency_key = CONCAT('sos:', sos_event_id, ':', recipient_user_id, ':', channel, ':', notification_type, ':', sequence)
WHERE idempotency_key IS NULL OR idempotency_key = '';

ALTER TABLE sos_notification_outbox
  ADD UNIQUE KEY IF NOT EXISTS sos_notification_outbox_idempotency_unique (idempotency_key),
  ADD KEY IF NOT EXISTS sos_notification_outbox_due_idx (status, scheduled_at, processing_expires_at),
  ADD KEY IF NOT EXISTS sos_notification_outbox_event_status_idx (sos_event_id, status, notification_type, sequence);
