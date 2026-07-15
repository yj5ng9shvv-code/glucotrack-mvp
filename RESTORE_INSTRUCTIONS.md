# GlukoTrack Restore Instructions

Generated: 2026-07-15 20:30 Europe/Warsaw

## Local Project Restore

1. Stop all local dev servers and build processes.
2. Move current workspace aside, for example:
   `C:\GLUKOTRACK\glucotrack_mvp_broken_YYYY-MM-DD_HH-MM`
3. Copy backup back into place:
   `C:\Backups\GLUKOTRACK_FULL_BACKUP_BEFORE_CLEANUP_2026-07-15_20-27`
   to
   `C:\GLUKOTRACK\glucotrack_mvp`
4. Run:
   `flutter pub get`
   `npm test`
   `flutter analyze`
   `flutter test`

## Git Restore

- Current clean code baseline before this audit: `6abca8d complete localization pass`.
- Existing cleanup-related tags found:
  - `backup-before-deep-cleanup-2026-07-15`
  - `before-deep-cleanup-2026-07-15-17-05`
  - `before-full-cleanup`

## Server Restore

Server archive created on production host:

```text
/root/glukotrack_backups/GLUKOTRACK_SERVER_DB_BACKUP_2026-07-15_18-38/SERVER_BACKUP_BEFORE_CLEANUP_2026-07-15_18-38.tar.gz
```

Integrity:

```text
sha256 17ae85acae2add27d81ca19100c5e368a5527c351c165d7b41b5c15f2a7a8948
```

Restore outline:

1. Stop affected services.
2. Move current production folder/configs aside.
3. Extract the archive from `/` with paths preserved.
4. Restore file ownership/permissions if needed.
5. Restart nginx/backend services.
6. Verify `/api/health`, site, `/app/`, `/admin`, and login.

## Database Restore

Database dump created on production host:

```text
/root/glukotrack_backups/GLUKOTRACK_SERVER_DB_BACKUP_2026-07-15_18-38/GLUKOTRACK_DB_BEFORE_CLEANUP_2026-07-15_18-38.sql.gz
```

Integrity:

```text
sha256 32436f5156858acfad6c1c6fe00f3cade0ad9df9884d5ad2cfcc2ec916c8d7b0
```

Restore outline:

1. Create an empty restore database.
2. Import with `zcat ...sql.gz | mariadb restored_database`.
3. Verify table count and application health against the restored copy.
4. Only after restore proof, use it as rollback source for any future cleanup.
