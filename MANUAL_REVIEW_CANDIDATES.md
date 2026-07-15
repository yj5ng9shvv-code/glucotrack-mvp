# Manual Review Candidates

Date: 2026-07-15

Nothing in this file is approved for deletion automatically.

## High risk

- `backend/.env`
- `backend_proxy_sample/.env`
- `backend/database_schema.sql`
- `backend/phpmyadmin_import.sql`
- `backend_proxy_sample/database_schema.sql`
- Android/iOS/macOS manifests, entitlements and signing-related files.
- CI/CD and deploy configs: `codemagic.yaml`, `deploy/*`, nginx examples.

Reason: secrets, database recovery/schema, platform identity, deployment and production behavior can depend on these files.

## Medium risk

- `website_source/app`

Reason: it is a tracked Flutter web deployment artifact. It looks generated, but it may be the source of the current production `/app/` deployment. Delete only after deployment pipeline is changed to build it reliably.

- `backend_proxy_sample`

Reason: duplicates part of backend setup but may be documentation/sample deployment material. Needs owner decision.

- Root screenshots and phone XML files.

Reason: likely debug/evidence artifacts, but may document device/runtime testing. Delete only after confirming no audit or release process uses them.

- Platform duplicate template files under `ios`, `macos`, and `windows`.

Reason: many duplicate-looking files are normal Flutter platform templates.

## Localization debt

Root `npm test` fails because strict `tool/i18n-check.mjs` finds:

- Missing GDPR keys in many `profile_extra_translations` locale maps.
- Local hardcoded dictionaries in `about_screen.dart`, `notifications_screen.dart`, `referral_screen.dart`.
- Manual locale checks in `home_screen.dart` and `notifications_screen.dart`.

Flutter runtime tests still pass, but this should be fixed by moving those strings into central `lib/l10n` maps for all 30 languages.
