-- Family Access v2: separate relationships and permission boundary.
-- The same idempotent definitions are installed by db.js for managed deployments.
CREATE TABLE IF NOT EXISTS family_access_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_user_id BIGINT UNSIGNED NOT NULL,
  subject_user_id BIGINT UNSIGNED NULL,
  family_member_id BIGINT UNSIGNED NULL,
  action VARCHAR(64) NOT NULL,
  details JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY family_access_audit_actor_idx (actor_user_id, created_at),
  KEY family_access_audit_subject_idx (subject_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
