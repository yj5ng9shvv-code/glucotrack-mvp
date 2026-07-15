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

-- Blocker:
-- SSH/database access was rejected, so no dump or table audit was performed.
