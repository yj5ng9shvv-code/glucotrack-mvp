# GlukoTrack Local Project Cleanup Report

Generated: 2026-07-15 20:30 Europe/Warsaw

Mode: analysis only. No files were deleted.

## Backup

- Backup path: `C:\Backups\GLUKOTRACK_FULL_BACKUP_BEFORE_CLEANUP_2026-07-15_20-27`
- Source files: 1951
- Backup files: 1951
- Source bytes: 143,957,414
- Backup bytes: 143,957,414
- Key paths checked: `.git`, `lib`, `android`, `ios`, `web`, `windows`, `macos`, `backend`, `pubspec.yaml`, `package.json`
- Missing key paths: none

## Git State

- Branch: `main`
- HEAD before report edits: `6abca8d complete localization pass`
- Untracked files before audit scripts: none.
- Audit scripts modified report files only: `reports/*` and `docs/localization-screen-inventory.md`.

## Local Inventory

- Total project size at backup: 137.29 MB excluding filesystem metadata.
- Largest directories:
  - `.git`: 87.37 MB
  - `website_source`: 32.28 MB
  - `website_source/app`: 31.91 MB
  - `reports`: 3.33 MB
  - `lib`: 1.26 MB
  - `backend`: 0.55 MB

## Cleanup Candidates Requiring Approval

| Group | Size | Risk | Reason | Recommendation |
|---|---:|---:|---|---|
| Root phone/debug screenshots and XML: `phone_*`, `glucotrack_*.png`, `current_phone_screen.png`, `phone_window*.xml` | 11.32 MB | low/medium | Diagnostic artifacts from manual phone/browser checks. | Approve removal if no longer needed for evidence. |
| `android/build` | 0.12 MB | low | Generated Gradle report, not tracked. | Approve removal and keep ignored. |
| `reports/*` historical audit reports | 3.33 MB | medium | Audit output, not runtime code. | Keep latest reports; archive or remove older reports only after confirmation. |
| `website_source/app` | 31.91 MB | high | Tracked Flutter web release build used by site/deploy. | Do not remove unless deployment flow is changed and rebuilt. |
| `backend_proxy_sample` | 0.05 MB | medium/high | Duplicate sample backend files. | Review before removal; may be documentation/example package. |
| SQL schema/import files | <0.05 MB | high | May be migration/bootstrap material. | Do not delete without DB restore proof. |
| `.env` files | tiny | high | Local secrets/config; ignored by git. | Do not delete unless replacement secrets are verified. Never commit. |

## Audit Tool Output

- `node tools/project_cleanup_audit.mjs`: 1956 files, 414 directories, 65 candidates, 20 duplicate groups, 7 secret-review findings.
- `node tools/localization_audit.mjs`: 30 locales, 547 key union, 7837 localization content findings, 0 mojibake findings. This is a content-quality queue, not a runtime failure.

## Deletion Status

No local files were deleted in this pass.
