# Build And Test Results

Date: 2026-07-15

## Passed

- `npm ci` in `backend`: passed.
- `npm test` in `backend`: passed, 40 tests.
- `flutter pub get`: passed.
- `flutter analyze`: passed, no issues.
- `flutter test`: passed, 614 tests.
- `flutter build web --release --base-href /app/ --dart-define=API_BASE_URL=https://glukotrack.com/api`: passed, built `build/web`.
- `node tools/project_cleanup_audit.mjs`: passed, updated cleanup reports.
- `node tools/localization_audit.mjs`: passed, produced localization audit reports.

## Failed or blocked

- Root `npm test`: failed in `npm run i18n:check`.
  - Main failures: `profile_extra_translations` locale keys differ from English; hardcoded local UI dictionaries remain in several screens; manual locale equality checks remain.
  - This is a real localization architecture issue, not hidden.

- `dart format --set-exit-if-changed .`: did not complete in a reasonable time and was stopped.
- `dart format --set-exit-if-changed lib test tool`: also did not complete in a reasonable time and was stopped.
  - Follow-up: run with narrower file batches to find the specific file or environment issue.

- `flutter build apk --release`: blocked by missing release signing environment:
  - `ANDROID_KEYSTORE_PATH`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`

- `flutter build appbundle --release`: not run because it uses the same release signing gate as APK and would fail for the same missing environment.

## Not run in this Windows environment

- iOS build.
- macOS build.
- Production server smoke test.
- Production database migration/rollback test.

## Cleanup after verification

The following generated artifacts were removed after tests/builds:

- `backend/node_modules`
- `.dart_tool`
- `build`
- `android/.gradle`
2026-07-15 cleanup audit pass:

- Local backup verification: passed, 1951 source files and 1951 backup files, byte count matched.
- `npm test`: passed.
- Public API health: passed, HTTP 200.
- `node tools/project_cleanup_audit.mjs`: passed and generated reports.
- `node tools/localization_audit.mjs`: passed and generated reports; content-quality findings remain.

Not run in this pass:
- Full Flutter build matrix.
- Android APK/appbundle release builds.
- Server/backend integration tests on production host.
- DB restore test.
- Phone/ADB storage smoke test.

Reason:
- This pass stopped before destructive cleanup because server/DB backups were blocked by rejected SSH credentials and user approval is still required for local deletion candidates.
