# Deep Project Cleanup Report

Date: 2026-07-15
Project: GlukoTrack
Workspace: `C:\GLUKOTRACK\glucotrack_mvp`

## 1. Backup gate

Before cleanup, a full project backup was created and verified:

- Backup: `C:\Backups\PROJECT_FULL_BACKUP_BEFORE_CLEANUP_2026-07-15_16-15`
- Verification: required project directories and `pubspec.yaml` are present.
- Robocopy result: 5673 files copied, 209024208 bytes, no required project folders missing.

Git checkpoint before cleanup:

- Commit: `17d7eaed72f8186c4b2a7fdbf2fa662b87da9e7f`
- Message: `backup before deep cleanup audit`
- Tag: `backup-before-deep-cleanup-2026-07-15`

## 2. What was removed

Only generated, ignored, or local-only files were removed. Risky candidates were not deleted.

| Path | Category | Size | Reason | Restore |
|---|---:|---:|---|---|
| `backend/node_modules` | generated dependencies | 32303366 bytes | Ignored by `**/node_modules/`, not tracked, restored by `npm ci`. | `cd backend && npm ci` |
| `android/.gradle` | generated build cache | 28728829 bytes | Ignored by Android gitignore, not tracked. | Android/Flutter build regenerates it. |
| `.idea` | local IDE metadata | 3818 bytes | Ignored, not tracked, local editor settings only. | IDE regenerates it. |
| `analyze.log` | temporary log | 0 bytes | Ignored, empty analyzer log. | Not needed. |
| `.dart_tool` | generated Flutter metadata | 45507 bytes | Recreated by Flutter checks, ignored, not tracked. | `flutter pub get` |
| `build` | generated build/test output | 58833362 bytes | Recreated by Flutter tests, ignored, not tracked. | Flutter build/test regenerates it. |

Final absence check passed for:

- `backend/node_modules`
- `.dart_tool`
- `build`
- `android/.gradle`
- `.idea`
- `analyze.log`

## 3. Current inventory

After cleanup:

- Files including `.git`: 1888
- Size including `.git`: 143441356 bytes
- Files excluding `.git`: 469
- Size excluding `.git`: 52200431 bytes

Final audit:

- Files scanned by audit: 1893
- Directories: 408
- Cleanup candidates left for review: 60
- Duplicate groups: 19
- Secret-review findings: 7

Detailed audit files:

- `reports/project-cleanup-audit.md`
- `reports/project-cleanup-audit.json`
- `reports/project-cleanup-deleted-files.csv`

## 4. Verification

Backend:

- `npm ci`: passed.
- `npm test`: passed, 40 tests.

Flutter:

- `flutter pub get`: passed.
- `flutter analyze`: passed, no issues.
- `flutter test test\premium_localizations_test.dart`: passed, 2 tests.
- Full `flutter test`: passed, 614 tests.

The full test run included localization checks for the home screen, auth screen, runtime routes, patient card, SOS profile, public SOS labels, voice messages, and premium subscription copy.

## 5. Fixes made during verification

These changes were required because tests exposed real regressions:

- `android/app/build.gradle.kts`: production `applicationId` changed from template package to `com.glukotrack.app`.
- `lib/l10n/navigation_translations.dart`: Italian bottom navigation `Home` changed to `Inizio`.
- `lib/l10n/premium_translations.dart`: Russian family plan price changed from text placeholder to `€9.99 / месяц`.
- `test/widget_test.dart`: tests now force English locale and use English auth labels, preventing machine-locale dependent failures.

Encoding note: while fixing the Russian family price, one attempted edit corrupted the file in-memory through a bad console encoding path. The file was restored byte-for-byte from the checkpoint and the one-line change was reapplied. The final diff for `premium_translations.dart` contains only the intended UTF-8 Russian price line.

## 6. Left untouched on purpose

These were not deleted automatically:

- `.git`: repository history and tags.
- `website_source/app`: tracked production web output/source snapshot; needs deployment ownership decision before cleanup.
- `backend/.env` and `backend_proxy_sample/.env`: local secret configs; no values printed, no deletion without rotation/ops plan.
- SQL files such as `backend/database_schema.sql` and `backend/phpmyadmin_import.sql`: database schema/import assets, high risk to remove.
- `reports`: audit/security/history reports.
- duplicate iOS/macOS asset/config files: many are legitimate platform templates.
- screenshots/phone images: possible evidence/debug artifacts, review manually before deletion.

## 7. Risk candidates requiring approval

The audit still lists candidates, but they need manual confirmation before deletion:

- High risk: `.env` files and SQL schema/import files.
- Medium risk: tracked duplicate files in `website_source`, iOS/macOS templates, screenshots, and helper tools.
- Low risk but not auto-deleted: empty `android/build` directory candidate from audit output.

No destructive cleanup was performed on these items.

## 8. Result

The project is backed up, checkpointed, cleaned of safe generated artifacts, audited again, and verified by backend and Flutter test suites. Remaining cleanup requires explicit approval per item because it can affect deployment, database recovery, secrets, or platform builds.
