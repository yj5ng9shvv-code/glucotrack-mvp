-- Forward-only Family Security foundation. Existing family_links remains intact.
CREATE TABLE IF NOT EXISTS family_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('active','disabled','expired') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY family_groups_patient_unique (patient_user_id),
  KEY family_groups_status_idx (status),
  CONSTRAINT family_groups_patient_fk FOREIGN KEY (patient_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS family_members (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  family_group_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('patient','caregiver') NOT NULL,
  status ENUM('active','revoked','pending') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY family_members_group_user_unique (family_group_id, user_id),
  KEY family_members_user_status_idx (user_id, status),
  KEY family_members_group_status_idx (family_group_id, status),
  CONSTRAINT family_members_group_fk FOREIGN KEY (family_group_id) REFERENCES family_groups(id) ON DELETE CASCADE,
  CONSTRAINT family_members_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS family_permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  family_member_id BIGINT UNSIGNED NOT NULL,
  can_view_glucose BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_history BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_insulin BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_food BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_location BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_sos BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_reports BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY family_permissions_member_unique (family_member_id),
  CONSTRAINT family_permissions_member_fk FOREIGN KEY (family_member_id) REFERENCES family_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS family_invitations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_user_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(255) NOT NULL,
  invite_code_hash CHAR(64) NOT NULL,
  status ENUM('pending','accepted','expired','revoked') NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY family_invitations_code_unique (invite_code_hash),
  KEY family_invitations_patient_status_idx (patient_user_id, status),
  KEY family_invitations_email_status_idx (email, status),
  CONSTRAINT family_invitations_patient_fk FOREIGN KEY (patient_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS location_grants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_user_id BIGINT UNSIGNED NOT NULL,
  family_member_id BIGINT UNSIGNED NOT NULL,
  status ENUM('active','revoked','expired') NOT NULL DEFAULT 'active',
  expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  UNIQUE KEY location_grants_patient_member_unique (patient_user_id, family_member_id),
  KEY location_grants_member_status_idx (family_member_id, status),
  KEY location_grants_patient_status_idx (patient_user_id, status),
  CONSTRAINT location_grants_patient_fk FOREIGN KEY (patient_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT location_grants_member_fk FOREIGN KEY (family_member_id) REFERENCES family_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
