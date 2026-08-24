-- SOS movement history only; normal Family Location keeps one current point.
CREATE TABLE IF NOT EXISTS patient_locations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  family_id BIGINT UNSIGNED NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  accuracy DECIMAL(10,2) NULL,
  battery_level TINYINT UNSIGNED NULL,
  captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sos_session_id BIGINT UNSIGNED NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'sos',
  KEY patient_locations_patient_time_idx (patient_id, captured_at),
  KEY patient_locations_sos_time_idx (sos_session_id, captured_at),
  CONSTRAINT patient_locations_patient_fk
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT patient_locations_sos_fk
    FOREIGN KEY (sos_session_id) REFERENCES sos_events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
