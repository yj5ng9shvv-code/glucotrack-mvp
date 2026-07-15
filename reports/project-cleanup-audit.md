# GlukoTrack Project Cleanup Audit

Generated: 2026-07-15T18:47:36.960Z

Phase: **analysis only**. No files were deleted.

## Backup Gate

The user required a full backup before audit. This report assumes the verified backup was created externally before running the audit.

## Git State

- Branch: `main`
- HEAD: `59a8c094069d307ab75143ff674df793d6dbb450`
- Cleanup branch exists: true
- `before-full-cleanup` tag exists: true
- Working tree dirty: true

**BLOCKER:** cleanup/deletion must not start while uncommitted changes exist unless the user explicitly approves how to preserve them.

## Inventory

- Files: 1957
- Directories: 412
- Total file size: 126.26 MB

## Largest Directories

| Directory | Size |
|---|---:|
| `.git` | 87.68 MB |
| `.git/objects` | 87.60 MB |
| `website_source` | 32.28 MB |
| `website_source/app` | 31.91 MB |
| `website_source/app/canvaskit` | 26.18 MB |
| `website_source/app/canvaskit/chromium` | 6.73 MB |
| `.git/objects/70` | 5.56 MB |
| `.git/objects/8f` | 5.29 MB |
| `.git/objects/dd` | 4.51 MB |
| `.git/objects/a5` | 4.19 MB |
| `.git/objects/42` | 3.97 MB |
| `.git/objects/90` | 3.54 MB |
| `.git/objects/ad` | 3.54 MB |
| `.git/objects/40` | 3.45 MB |
| `.git/objects/b9` | 3.45 MB |
| `reports` | 3.42 MB |
| `.git/objects/f4` | 3.09 MB |
| `.git/objects/c8` | 3.04 MB |
| `.git/objects/8e` | 2.39 MB |
| `.git/objects/85` | 2.37 MB |
| `.git/objects/08` | 2.36 MB |
| `.git/objects/a1` | 2.35 MB |
| `.git/objects/b8` | 1.86 MB |
| `.git/objects/be` | 1.76 MB |
| `.git/objects/fd` | 1.61 MB |

## Dependency Snapshot

- pubspec.yaml present: true
- package.json files: `backend/package.json`, `backend_proxy_sample/package.json`, `package.json`
- lock files: `backend/package-lock.json`, `pubspec.lock`

## Cleanup Candidates

These are candidates only. Nothing in this table is approved for deletion until each item is checked against imports, routes, build files, dynamic loading, deployment, and old client compatibility.

| Path | Category | Risk | Size | Reason | Proposed action |
|---|---|---:|---:|---|---|
| `.git/objects/0f/tmp_obj_YWiM8J` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.git/objects/12/tmp_obj_Xtlqeh` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.git/refs/tags/backup-before-deep-cleanup-2026-07-15` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `backend/.env` | SECRET_REVIEW | high | 0.00 MB | Filename matches secret/credential pattern. | candidate: move to env/secure storage only after rotation plan |
| `backend/database_schema.sql` | ARCHIVE_OR_RELEASE_ARTIFACT | high | 0.01 MB | Archive/release/database dump extension found. | review before deletion |
| `backend/phpmyadmin_import.sql` | ARCHIVE_OR_RELEASE_ARTIFACT | high | 0.01 MB | Archive/release/database dump extension found. | review before deletion |
| `backend_proxy_sample/.env` | SECRET_REVIEW | high | 0.00 MB | Filename matches secret/credential pattern. | candidate: move to env/secure storage only after rotation plan |
| `backend_proxy_sample/database_schema.sql` | ARCHIVE_OR_RELEASE_ARTIFACT | high | 0.00 MB | Archive/release/database dump extension found. | review before deletion |
| `BACKUP_VERIFICATION_REPORT.md` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `DATABASE_CLEANUP_CANDIDATES.sql` | ARCHIVE_OR_RELEASE_ARTIFACT | high | 0.00 MB | Archive/release/database dump extension found. | review before deletion |
| `DATABASE_CLEANUP_PLAN.sql` | ARCHIVE_OR_RELEASE_ARTIFACT | high | 0.00 MB | Archive/release/database dump extension found. | review before deletion |
| `DATABASE_CLEANUP_ROLLBACK.sql` | ARCHIVE_OR_RELEASE_ARTIFACT | high | 0.00 MB | Archive/release/database dump extension found. | review before deletion |
| `tools/fix_mojibake_literals.mjs` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.git/objects/0f/6330ea3e6d5184b2e0f7fda0c741c870e0f9c4` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `.git/objects/0f/tmp_obj_YWiM8J` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `.git/refs/codex/turn-diffs/captures/1784141196369/6ecb2996-c1f8-4f5a-a5f2-53a228b73ea5/base` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `.git/refs/codex/turn-diffs/checkpoints/508cdd64183e9819ad0ffdca3d98e9b25e33be2a5cf920c31b1634f3a4f8c47b/f48865260e7a91e6be66945c8282dfdab1da9cbd040e0550f95aee523944fd15/1784140916760/7638af22-5b95-4efb-8aa7-65ef51df137c` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `.git/refs/heads/audit/deep-cleanup-2026-07-15` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `.git/refs/tags/before-deep-cleanup-2026-07-15-17-05` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `.git/refs/heads/chore/full-project-cleanup` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `.git/refs/remotes/origin/main` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `.git/refs/tags/before-full-cleanup` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `android/app/src/debug/AndroidManifest.xml` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `android/app/src/profile/AndroidManifest.xml` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `assets/translations/core.json` | DUPLICATE | medium | 0.09 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `website_source/app/assets/assets/translations/core.json` | DUPLICATE | medium | 0.09 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `backend/DB_SETUP_RU.md` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `backend_proxy_sample/DB_SETUP_RU.md` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `backend/install-db.js` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `backend_proxy_sample/install-db.js` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `backend/nginx-glukotrack-api.conf.example` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `backend_proxy_sample/nginx-glukotrack-api.conf.example` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `ios/Flutter/Debug.xcconfig` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `ios/Flutter/Release.xcconfig` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@2x.png` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-40x40@1x.png` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-40x40@3x.png` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-60x60@2x.png` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage.png` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage@2x.png` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage@3x.png` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `ios/Runner.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `ios/Runner.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `macos/Runner.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `macos/Runner.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `ios/Runner.xcodeproj/project.xcworkspace/xcshareddata/WorkspaceSettings.xcsettings` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `ios/Runner.xcworkspace/xcshareddata/WorkspaceSettings.xcsettings` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `ios/Runner.xcworkspace/contents.xcworkspacedata` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `macos/Runner.xcworkspace/contents.xcworkspacedata` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `macos/Flutter/Flutter-Debug.xcconfig` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `macos/Flutter/Flutter-Release.xcconfig` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `web/manifest.json` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |
| `website_source/app/manifest.json` | DUPLICATE | medium | 0.00 MB | Same byte size and SHA-256 hash as another file. | candidate: keep canonical file only after reference/deploy check |

## Duplicate Content Groups

- 0.00 MB: `.git/objects/0f/6330ea3e6d5184b2e0f7fda0c741c870e0f9c4`, `.git/objects/0f/tmp_obj_YWiM8J`
- 0.00 MB: `.git/refs/codex/turn-diffs/captures/1784141196369/6ecb2996-c1f8-4f5a-a5f2-53a228b73ea5/base`, `.git/refs/codex/turn-diffs/checkpoints/508cdd64183e9819ad0ffdca3d98e9b25e33be2a5cf920c31b1634f3a4f8c47b/f48865260e7a91e6be66945c8282dfdab1da9cbd040e0550f95aee523944fd15/1784140916760/7638af22-5b95-4efb-8aa7-65ef51df137c`
- 0.00 MB: `.git/refs/heads/audit/deep-cleanup-2026-07-15`, `.git/refs/tags/before-deep-cleanup-2026-07-15-17-05`
- 0.00 MB: `.git/refs/heads/chore/full-project-cleanup`, `.git/refs/remotes/origin/main`, `.git/refs/tags/before-full-cleanup`
- 0.00 MB: `android/app/src/debug/AndroidManifest.xml`, `android/app/src/profile/AndroidManifest.xml`
- 0.09 MB: `assets/translations/core.json`, `website_source/app/assets/assets/translations/core.json`
- 0.00 MB: `backend/DB_SETUP_RU.md`, `backend_proxy_sample/DB_SETUP_RU.md`
- 0.00 MB: `backend/install-db.js`, `backend_proxy_sample/install-db.js`
- 0.00 MB: `backend/nginx-glukotrack-api.conf.example`, `backend_proxy_sample/nginx-glukotrack-api.conf.example`
- 0.00 MB: `ios/Flutter/Debug.xcconfig`, `ios/Flutter/Release.xcconfig`
- 0.00 MB: `ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@2x.png`, `ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-40x40@1x.png`
- 0.00 MB: `ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-40x40@3x.png`, `ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-60x60@2x.png`
- 0.00 MB: `ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage.png`, `ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage@2x.png`, `ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage@3x.png`
- 0.00 MB: `ios/Runner.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist`, `ios/Runner.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist`, `macos/Runner.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist`, `macos/Runner.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist`
- 0.00 MB: `ios/Runner.xcodeproj/project.xcworkspace/xcshareddata/WorkspaceSettings.xcsettings`, `ios/Runner.xcworkspace/xcshareddata/WorkspaceSettings.xcsettings`
- 0.00 MB: `ios/Runner.xcworkspace/contents.xcworkspacedata`, `macos/Runner.xcworkspace/contents.xcworkspacedata`
- 0.00 MB: `macos/Flutter/Flutter-Debug.xcconfig`, `macos/Flutter/Flutter-Release.xcconfig`
- 0.00 MB: `web/manifest.json`, `website_source/app/manifest.json`

## Secret Review Findings

Values are intentionally not printed.

| Path | Type | Risk | Evidence | Rotation required |
|---|---|---:|---|---|
| `backend/.env.example` | JWT secret assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/admin.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/create-admin.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/gdpr.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/server.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend_proxy_sample/.env.example` | JWT secret assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend_proxy_sample/server.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |

## Generated Directory Policy

No generated directories matched the configured policy list.

## Next Step

Do not delete anything yet. Review this report, then approve specific cleanup groups. Each approved group should be removed in a separate commit after targeted tests.
