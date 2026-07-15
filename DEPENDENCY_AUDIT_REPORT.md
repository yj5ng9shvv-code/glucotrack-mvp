# Dependency Audit Report

Date: 2026-07-15

## Flutter

- `flutter pub get` completed successfully.
- Pub reported 20 packages with newer versions incompatible with current constraints.
- No dependency upgrade was performed in this release pass to avoid widening scope.

## Node / Backend

- `npm ci --cache C:\tmp\npm-cache-clean-build` completed successfully in the clean backend workspace.
- Installed 148 packages.
- npm reported 0 vulnerabilities in the install summary.
- Backend tests passed after providing required test-only environment variables.

## Root Project Tests

- `npm test` completed successfully.
- Covered localization integrity and install audit checks.

## Residual Dependency Risks

- Several Flutter packages are behind latest versions; this is not a release blocker, but should be handled in a separate dependency update pass with regression testing.
- Node package lock includes transitive encoding libraries from standard packages; no project code usage of unsafe `utf8_decode`, `utf8_encode`, PHP `iconv`, `mb_convert_encoding`, Flutter `latin1.decode`, or `String.fromCharCodes` was found in the scanned app/backend source.
