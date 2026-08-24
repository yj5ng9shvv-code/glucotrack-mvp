-- Latest patient heartbeat only. This is intentionally not a location history.
CREATE TABLE IF NOT EXISTS patient_presence (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  last_seen DATETIME NOT NULL,
  online_status BOOLEAN NOT NULL DEFAULT TRUE,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  battery TINYINT UNSIGNED NULL,
  glucose DECIMAL(6,3) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY patient_presence_patient_uq (patient_id),
  KEY patient_presence_last_seen_idx (last_seen),
  CONSTRAINT patient_presence_patient_fk
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
