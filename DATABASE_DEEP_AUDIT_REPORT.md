# Database Deep Audit Report

Date: 2026-07-15

## Files checked

- `backend/database_schema.sql`
- `backend/phpmyadmin_import.sql`
- `backend/install-db.js`
- `backend/db.js`
- `backend_proxy_sample/database_schema.sql`
- `backend_proxy_sample/install-db.js`
- `backend_proxy_sample/db.js`

## Findings

- Database assets are present and intentionally kept.
- No destructive SQL was run against production.
- Live production schema was not inspected in this pass.
- Rollback and migration testing on a database copy was not performed because no disposable database connection was configured for this local audit.

## Cleanup candidates

No SQL cleanup is approved automatically.

Potential candidates requiring manual DBA review:

- Duplicate/sample schema in `backend_proxy_sample/database_schema.sql`.
- Historical import file `backend/phpmyadmin_import.sql`.

## Required environment for deeper DB verification

1. A disposable MySQL/MariaDB database cloned from production schema.
2. Non-production credentials.
3. Explicit permission to run schema validation and rollback tests.
4. A current production schema dump for diff-only comparison.

## Risk

Deleting SQL files without deployment/DB ownership review can remove the only local recovery or install path.
2026-07-15 database audit pass:

Verified through public health endpoint:
- API health returned HTTP 200.
- Database reported ready.
- Database name: ODESSA_glukotrack.
- Schema version: 20.

Blocked:
- Restore into an isolated test database, orphan scan, index scan, and cleanup SQL generation were not performed yet.

Backup created on server:

```text
/root/glukotrack_backups/GLUKOTRACK_SERVER_DB_BACKUP_2026-07-15_18-38/GLUKOTRACK_DB_BEFORE_CLEANUP_2026-07-15_18-38.sql.gz
```

Verification:
- gzip integrity test: passed.
- Size: 6,410,234 bytes.
- `CREATE TABLE` statements found: 75.
- SHA256: `32436f5156858acfad6c1c6fe00f3cade0ad9df9884d5ad2cfcc2ec916c8d7b0`.

No database rows, tables, or schemas were modified.
