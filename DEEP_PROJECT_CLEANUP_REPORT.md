# Deep Project Cleanup Report

Date: 2026-07-15
Project: GlukoTrack
Workspace: `C:\GLUKOTRACK\glucotrack_mvp`

## Backup and checkpoint

Full physical backup created before this pass:

- `C:\Backups\FULL_PROJECT_BACKUP_BEFORE_DEEP_CLEANUP_2026-07-15_17-05`
- Robocopy code: `1`
- Backup files: `2091`
- Backup bytes: `144016887`
- `.git` present: yes
- `pubspec.yaml` present: yes

Git checkpoint:

- Base commit: `463f96ed85187e61fe67f60bb86e397958638a21`
- Control branch: `audit/deep-cleanup-2026-07-15`
- Control tag: `before-deep-cleanup-2026-07-15-17-05`

## Inventory

After this pass and after removing regenerated artifacts:

- Files including `.git`: `1916`
- Bytes including `.git`: `143473579`
- Files excluding `.git`: `480`
- Bytes excluding `.git`: `52210258`

Cleanup audit output:

- Files scanned: `1921`
- Directories: `413`
- Cleanup candidates: `64`
- Duplicate groups: `19`
- Secret-review findings: `7`

## Removed in this pass

Only generated verification artifacts were deleted:

- `backend/node_modules`
- `.dart_tool`
- `build`
- `android/.gradle`

No SQL, migrations, `.env`, platform manifests, signing files, production configs, website deployment snapshots, user data, or source modules were deleted automatically.

## Verified

Passed:

- Backend `npm ci`
- Backend `npm test`: 40 tests passed
- `flutter pub get`
- `flutter analyze`: no issues
- Full `flutter test`: 614 tests passed
- Flutter web release build for `/app/`
- Project cleanup audit script
- Localization audit script

Failed or blocked:

- Root `npm test` failed on strict i18n policy.
- `dart format --set-exit-if-changed` did not complete and was stopped.
- Android release APK build is blocked by missing release signing env vars.
- Android appbundle release was not run because the same signing gate applies.

Not verified:

- iOS build, macOS build, production server, production database and destructive migration rollback.

## Errors found

The strict root i18n check still finds localization architecture debt:

- `profile_extra_translations.dart` locale key coverage differs from English.
- `about_screen.dart`, `notifications_screen.dart`, `referral_screen.dart` still contain local UI dictionaries.
- Some app code still checks locale manually instead of resolving through the shared localization layer.

Flutter runtime localization tests pass, but the strict policy failure means the localization cleanup is not complete.

## Manual review required

Do not delete automatically:

- `.env` files and any secret-bearing configs.
- SQL schema/import files.
- `website_source/app` until deployment ownership is confirmed.
- `backend_proxy_sample` until owner confirms it is obsolete.
- root screenshots/phone XML evidence files.
- platform template duplicates in iOS/macOS/Windows.

## Reports created

- `PROJECT_ARCHITECTURE_MAP.md`
- `BACKUP_VERIFICATION_REPORT.md`
- `DELETED_FILES_MANIFEST.txt`
- `MODIFIED_FILES_MANIFEST.txt`
- `MANUAL_REVIEW_CANDIDATES.md`
- `DATABASE_DEEP_AUDIT_REPORT.md`
- `DATABASE_CLEANUP_CANDIDATES.sql`
- `DATABASE_CLEANUP_ROLLBACK.sql`
- `BUILD_AND_TEST_RESULTS.md`
- `RESIDUAL_RISKS.md`
- `reports/project-cleanup-audit.md`
- `reports/localization-static-audit.md`

## Rollback

Git rollback to the checkpoint:

```powershell
git reset --hard 463f96ed85187e61fe67f60bb86e397958638a21
```

Physical rollback:

1. Stop any running app/backend processes.
2. Copy `C:\Backups\FULL_PROJECT_BACKUP_BEFORE_DEEP_CLEANUP_2026-07-15_17-05` back over `C:\GLUKOTRACK\glucotrack_mvp`.
3. Run `flutter pub get`.
4. Run `cd backend && npm ci` if backend dependencies are needed.

## Result

This pass completed a safe audit and report expansion across mobile, web, desktop project files, website, admin panel, backend, API and database assets. Safe generated artifacts were removed. Risky cleanup is intentionally left for manual approval.
