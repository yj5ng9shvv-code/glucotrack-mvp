-- Push-token lifecycle is attached to existing account device identity rather
-- than creating a second device table.
ALTER TABLE account_devices
  ADD COLUMN IF NOT EXISTS push_token VARCHAR(4096) NULL,
  ADD COLUMN IF NOT EXISTS push_token_updated_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS push_revoked_at DATETIME NULL;

ALTER TABLE sos_notification_outbox
  ADD COLUMN IF NOT EXISTS retryable BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  outbox_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  error VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY notification_delivery_logs_outbox_created_idx (outbox_id, created_at),
  CONSTRAINT notification_delivery_logs_outbox_fk
    FOREIGN KEY (outbox_id) REFERENCES sos_notification_outbox(id)
      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
