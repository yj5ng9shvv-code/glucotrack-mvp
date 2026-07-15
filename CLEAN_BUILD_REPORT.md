# Clean Build Report

Date: 2026-07-15
Branch: `release/clean-production-build-2026-07-15`
Baseline commit: `00a50575c4de4dde67c31182a50715989cd2c929`
Safety tag: `before-clean-production-build-2026-07-15-20-57`

## Backups

- Local full project backup: `C:\Backups\FULL_PROJECT_BACKUP_BEFORE_CLEAN_BUILD_2026-07-15_20-57`
- Local backup verification: 1960 files, 132393017 bytes, source and backup counts match.
- Server archive: `/root/glukotrack_backups/CLEAN_DEPLOY_BACKUP_2026-07-15_18-57/SERVER_BACKUP_BEFORE_CLEAN_DEPLOY_2026-07-15_18-57.tar.gz`
- Server archive SHA256: `17ae85acae2add27d81ca19100c5e368a5527c351c165d7b41b5c15f2a7a8948`
- Database dump: `/root/glukotrack_backups/CLEAN_DEPLOY_BACKUP_2026-07-15_18-57/DATABASE_BACKUP_BEFORE_CLEAN_DEPLOY_2026-07-15_18-57.sql.gz`
- Database dump SHA256: `bf68198cdea97985cbbf66c266e26648d9f22729a6f48ac60f860bbc89a71eb8`

## Clean Workspace

- Clean workspace: `C:\tmp\CLEAN_BUILD_WORKSPACE_2026-07-15_20-57`
- Source archive: `C:\tmp\glukotrack_clean_source_2026-07-15_20-57.tar`
- Workspace created from tracked Git content, not from generated runtime directories.
- Removed from the clean workspace before validation only: old tracked `reports` folder and old `website_source\app` bundle.

## Verification

- `flutter pub get`: passed.
- `dart format --set-exit-if-changed lib test`: passed after applying mechanical Dart formatting in the release branch.
- `flutter analyze`: passed, no issues.
- `flutter test`: passed, 614 tests.
- Root `npm test`: passed, including i18n/install audits.
- Backend `npm ci`: passed, 0 vulnerabilities reported by npm install audit summary.
- Backend `npm test`: passed, 40 tests, with test-only dummy DB/JWT env values.
- Web release build: passed.
- Web artifact archive: `C:\tmp\glukotrack_web_release_2026-07-15_2057.zip`, 11168144 bytes.

## Blockers

- Android `flutter build apk --release` failed because release signing env is missing:
  `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
- Android `flutter build appbundle --release` failed for the same reason.
- iOS release build was not attempted because this Windows machine is not macOS.
- Production deploy was not performed because the required Android signing and staging gate are not fully satisfied.

## Notes

- Web build scan found no secrets, no `localhost`, no `127.0.0.1`.
- Flutter generated `sourceMappingURL` comments in `flutter.js` and `flutter_bootstrap.js`, but no source map files are present in the release output.
