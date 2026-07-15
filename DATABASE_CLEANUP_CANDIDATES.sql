-- Database cleanup candidates for manual review only.
-- No statement in this file was executed.
-- Do not run on production without DBA approval and a verified backup.

-- Candidate group 1:
-- Review backend_proxy_sample/database_schema.sql.
-- If backend_proxy_sample is confirmed obsolete, remove the file from source control;
-- this is a repository cleanup action, not a SQL action.

-- Candidate group 2:
-- Review backend/phpmyadmin_import.sql.
-- If it is a historical import snapshot and not used for deployment or recovery,
-- archive it outside the repo before deletion.

-- No DROP, DELETE, TRUNCATE, ALTER, or UPDATE statements are proposed here.
