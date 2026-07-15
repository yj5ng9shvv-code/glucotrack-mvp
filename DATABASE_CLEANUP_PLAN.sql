-- GlukoTrack database cleanup plan
-- Generated: 2026-07-15 20:30 Europe/Warsaw
-- Mode: PLAN ONLY. Do not execute against production.

-- No destructive SQL is approved in this pass.
-- Required before any DELETE/TRUNCATE/DROP:
-- 1. Create full production dump.
-- 2. Verify dump is non-empty and contains all tables.
-- 3. Restore dump into an isolated test database.
-- 4. Run application smoke tests against restored copy.
-- 5. Produce table-by-table cleanup candidates with rollback SQL.

-- Backup now exists:
-- /root/glukotrack_backups/GLUKOTRACK_SERVER_DB_BACKUP_2026-07-15_18-38/GLUKOTRACK_DB_BEFORE_CLEANUP_2026-07-15_18-38.sql.gz
-- gzip test passed; 75 CREATE TABLE statements found.

-- Remaining blocker:
-- Restore test and table-by-table cleanup candidate review have not been performed.
