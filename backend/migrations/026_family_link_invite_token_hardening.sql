-- Backward-compatible legacy family_links invite hardening.
-- Existing raw codes are hashed before the raw value is cleared, so outstanding
-- invitations continue to be accepted by their original raw code.
ALTER TABLE family_links ADD COLUMN IF NOT EXISTS invite_code_hash CHAR(64) NULL AFTER invite_code;

UPDATE family_links
SET invite_code_hash = SHA2(invite_code, 256)
WHERE invite_code IS NOT NULL AND invite_code_hash IS NULL;

ALTER TABLE family_links MODIFY invite_code VARCHAR(255) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS family_links_invite_code_hash_unique ON family_links(invite_code_hash);

CREATE TABLE IF NOT EXISTS family_invite_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invite_code_hash CHAR(64) NOT NULL,
  attempted_email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY family_invite_attempts_ip_time_idx (ip_address, attempted_at),
  KEY family_invite_attempts_code_time_idx (invite_code_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Raw values are no longer needed for acceptance and must not remain at rest.
UPDATE family_links SET invite_code = NULL WHERE invite_code_hash IS NOT NULL;
