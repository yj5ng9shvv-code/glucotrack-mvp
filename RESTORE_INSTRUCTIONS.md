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

Not available from this pass because SSH credentials were rejected and no new server archive was created.

## Database Restore

Not available from this pass because no verified DB dump was created.
