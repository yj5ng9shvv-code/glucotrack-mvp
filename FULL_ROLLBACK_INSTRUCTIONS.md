# Full Rollback Instructions

Date: 2026-07-15

No production deploy or database migration was performed in this pass, so rollback is currently not required.

If a future deploy is performed from this release branch and must be rolled back:

1. Stop the active backend process using the server's process manager.
2. Restore server files from:
   `/root/glukotrack_backups/CLEAN_DEPLOY_BACKUP_2026-07-15_18-57/SERVER_BACKUP_BEFORE_CLEAN_DEPLOY_2026-07-15_18-57.tar.gz`
3. If a database migration was later applied, restore from:
   `/root/glukotrack_backups/CLEAN_DEPLOY_BACKUP_2026-07-15_18-57/DATABASE_BACKUP_BEFORE_CLEAN_DEPLOY_2026-07-15_18-57.sql.gz`
4. Restart backend and nginx.
5. Verify:
   - `https://glukotrack.com/`
   - `https://glukotrack.com/app/`
   - `https://glukotrack.com/admin/`
   - `https://glukotrack.com/api/health`

Safety marker:
- Pre-release tag: `before-clean-production-build-2026-07-15-20-57`
