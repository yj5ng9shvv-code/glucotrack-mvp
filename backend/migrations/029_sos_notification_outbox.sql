-- Durable delivery queue for Family SOS notifications. This table does not
-- replace existing in-app notifications or public QR SOS flows.
CREATE TABLE IF NOT EXISTS sos_notification_outbox (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sos_event_id BIGINT UNSIGNED NOT NULL,
  recipient_user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  UNIQUE KEY sos_notification_outbox_event_recipient_unique
    (sos_event_id, recipient_user_id),
  KEY sos_notification_outbox_status_created_idx (status, created_at),
  KEY sos_notification_outbox_recipient_status_idx
    (recipient_user_id, status, created_at),
  CONSTRAINT sos_notification_outbox_event_fk
    FOREIGN KEY (sos_event_id) REFERENCES sos_events(id) ON DELETE CASCADE,
  CONSTRAINT sos_notification_outbox_recipient_fk
    FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT sos_notification_outbox_attempts_check CHECK (attempts >= 0),
  CONSTRAINT sos_notification_outbox_sent_at_check
    CHECK ((status = 'SENT' AND sent_at IS NOT NULL) OR (status <> 'SENT'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
