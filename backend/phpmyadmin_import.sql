CREATE DATABASE IF NOT EXISTS ODESSA_diabetik_app
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ODESSA_diabetik_app;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INT UNSIGNED NOT NULL PRIMARY KEY,
  description VARCHAR(255) NOT NULL,
  installed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  premium_status VARCHAR(32) NOT NULL DEFAULT 'inactive',
  premium_plan VARCHAR(32) NULL,
  premium_until DATETIME NULL,
  trial_started_at DATETIME NULL,
  trial_ends_at DATETIME NULL,
  trial_used BOOLEAN NOT NULL DEFAULT FALSE,
  subscription_status VARCHAR(32) NOT NULL DEFAULT 'inactive',
  subscription_expires_at DATETIME NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  diabetes_type VARCHAR(32) NULL,
  glucose_unit VARCHAR(16) NULL,
  email_verification_token_hash VARCHAR(64) NULL,
  email_verification_expires_at DATETIME NULL,
  stripe_customer_id VARCHAR(255) NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  stripe_event_created_at DATETIME NULL,
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS account_devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  device_id VARCHAR(128) NOT NULL,
  device_name VARCHAR(120) NOT NULL,
  platform VARCHAR(32) NOT NULL,
  fingerprint_hash VARCHAR(64) NULL,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  UNIQUE KEY account_devices_user_device_unique (user_id, device_id),
  UNIQUE KEY account_devices_user_fingerprint_unique (user_id, fingerprint_hash),
  KEY account_devices_user_active_idx (user_id, revoked_at),
  CONSTRAINT account_devices_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trial_devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  device_hash VARCHAR(128) NOT NULL,
  first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  trial_used BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY trial_devices_user_device_unique (user_id, device_hash),
  KEY trial_devices_hash_idx (device_hash, trial_used),
  CONSTRAINT trial_devices_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS health_snapshots (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  payload JSON NOT NULL,
  schema_version INT UNSIGNED NOT NULL DEFAULT 1,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT health_snapshots_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sync_changes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  revision BIGINT UNSIGNED NOT NULL,
  base_revision BIGINT UNSIGNED NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY sync_changes_user_revision_unique (user_id, revision),
  KEY sync_changes_user_time_idx (user_id, created_at),
  CONSTRAINT sync_changes_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  device_id VARCHAR(128) NOT NULL,
  device_name VARCHAR(120) NOT NULL,
  platform VARCHAR(32) NOT NULL,
  fingerprint_hash VARCHAR(64) NULL,
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  UNIQUE KEY refresh_tokens_user_device_unique (user_id, device_id),
  KEY refresh_tokens_user_active_idx (user_id, revoked_at, expires_at),
  KEY refresh_tokens_expires_idx (expires_at),
  CONSTRAINT refresh_tokens_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS family_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  caregiver_user_id BIGINT UNSIGNED NULL,
  invite_email VARCHAR(255) NOT NULL,
  invite_code VARCHAR(255) NOT NULL UNIQUE,
  permissions JSON NOT NULL,
  status ENUM('pending', 'accepted', 'suspended', 'revoked') NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME NULL,
  UNIQUE KEY family_links_owner_email_unique (owner_user_id, invite_email),
  KEY family_links_caregiver_idx (caregiver_user_id, status),
  CONSTRAINT family_links_owner_fk
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT family_links_caregiver_fk
    FOREIGN KEY (caregiver_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  metadata JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY reports_user_created_idx (user_id, created_at),
  CONSTRAINT reports_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS processed_webhooks (
  event_id VARCHAR(255) NOT NULL PRIMARY KEY,
  processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sos_profiles (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  public_token VARCHAR(64) NOT NULL UNIQUE,
  card JSON NOT NULL,
  pin_hash VARCHAR(255) NULL,
  hide_sensitive BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sos_profiles_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sos_scans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  accuracy_meters DECIMAL(10, 2) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  scanned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY sos_scans_user_time_idx (user_id, scanned_at),
  CONSTRAINT sos_scans_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sos_pin_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  public_token VARCHAR(64) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  user_agent VARCHAR(512) NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_until DATETIME NULL,
  KEY sos_pin_attempts_lookup_idx (public_token, ip_address, attempted_at),
  KEY sos_pin_attempts_lock_idx (public_token, ip_address, locked_until),
  KEY sos_pin_attempts_user_time_idx (user_id, attempted_at),
  CONSTRAINT sos_pin_attempts_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations(version, description)
VALUES(1, 'Initial GlucoTrack MySQL schema with SOS support');
INSERT IGNORE INTO schema_migrations(version, description)
VALUES(8, 'Suspend family access whenever the owner family subscription is inactive');
INSERT IGNORE INTO schema_migrations(version, description)
VALUES(9, 'Authoritative ordered Stripe subscription state');
INSERT IGNORE INTO schema_migrations(version, description)
VALUES(10, 'Versioned conflict-aware health snapshot synchronization');
INSERT IGNORE INTO schema_migrations(version, description)
VALUES(11, 'Refresh-token rotation and persistent session refresh flow');
INSERT IGNORE INTO schema_migrations(version, description)
VALUES(12, 'Refresh tokens now track token version for user-wide revocation');
INSERT IGNORE INTO schema_migrations(version, description)
VALUES(13, 'SOS PIN unlock attempt journal and brute-force lockout');
