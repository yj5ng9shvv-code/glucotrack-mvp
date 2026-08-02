-- account_devices already owns platform and account-level revoked_at. This
-- migration adds token-specific lifecycle fields without duplicating devices.
ALTER TABLE account_devices
  ADD COLUMN IF NOT EXISTS push_token_hash CHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS push_token_encrypted TEXT NULL,
  ADD COLUMN IF NOT EXISTS last_token_update DATETIME NULL;

-- Migration 030 introduced this column before a registration API existed.
-- No supported code writes it; remove it so raw provider tokens cannot remain
-- in the database after this migration.
ALTER TABLE account_devices
  DROP COLUMN IF EXISTS push_token;

CREATE UNIQUE INDEX IF NOT EXISTS account_devices_push_token_hash_unique
  ON account_devices(push_token_hash);

CREATE INDEX IF NOT EXISTS account_devices_push_token_active_idx
  ON account_devices(user_id, revoked_at, push_revoked_at);
