-- Forward-only Family Watch SOS event storage. This does not replace the
-- public QR SOS profile/scan flow or existing emergency-contact features.
CREATE TABLE IF NOT EXISTS sos_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  status ENUM('ACTIVE', 'CANCELLED', 'RESOLVED') NOT NULL DEFAULT 'ACTIVE',
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  accuracy DECIMAL(10, 2) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at DATETIME NULL,
  resolved_at DATETIME NULL,
  active_patient_id BIGINT UNSIGNED
    AS (CASE WHEN status = 'ACTIVE' THEN patient_id ELSE NULL END) STORED,
  UNIQUE KEY sos_events_one_active_patient_unique (active_patient_id),
  KEY sos_events_patient_status_created_idx (patient_id, status, created_at),
  KEY sos_events_status_created_idx (status, created_at),
  CONSTRAINT sos_events_patient_fk
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT sos_events_latitude_check
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT sos_events_longitude_check
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT sos_events_coordinate_pair_check
    CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CONSTRAINT sos_events_accuracy_check
    CHECK (accuracy IS NULL OR accuracy >= 0),
  CONSTRAINT sos_events_terminal_timestamp_check
    CHECK (
      (status = 'ACTIVE' AND cancelled_at IS NULL AND resolved_at IS NULL)
      OR (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND resolved_at IS NULL)
      OR (status = 'RESOLVED' AND resolved_at IS NOT NULL AND cancelled_at IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
