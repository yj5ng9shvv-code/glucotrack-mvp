-- Forward-only Family Watch location storage. Authorization remains dependent
-- on existing family_members, family_permissions, and location_grants.
CREATE TABLE IF NOT EXISTS patient_locations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  accuracy DECIMAL(10, 2) NULL,
  battery_level TINYINT UNSIGNED NULL,
  device_id VARCHAR(128) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY patient_locations_patient_created_idx (patient_id, created_at),
  KEY patient_locations_patient_device_created_idx (patient_id, device_id, created_at),
  CONSTRAINT patient_locations_patient_fk
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT patient_locations_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT patient_locations_longitude_check CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT patient_locations_accuracy_check CHECK (accuracy IS NULL OR accuracy >= 0),
  CONSTRAINT patient_locations_battery_check CHECK (battery_level IS NULL OR battery_level <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS location_access_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  caregiver_id BIGINT UNSIGNED NULL,
  action VARCHAR(32) NOT NULL,
  ip VARCHAR(64) NULL,
  device_id VARCHAR(128) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY location_access_logs_patient_created_idx (patient_id, created_at),
  KEY location_access_logs_caregiver_created_idx (caregiver_id, created_at),
  KEY location_access_logs_patient_action_created_idx (patient_id, action, created_at),
  CONSTRAINT location_access_logs_patient_fk
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT location_access_logs_caregiver_fk
    FOREIGN KEY (caregiver_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback is intentionally not automated: this project has a forward-only
-- migration model. A rollback, if ever approved, must preserve audit data and
-- be executed as a separately reviewed migration.
