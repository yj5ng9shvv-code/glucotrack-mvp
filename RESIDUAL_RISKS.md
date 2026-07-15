# Residual Risks

Date: 2026-07-15

## Localization

Root `npm test` currently fails on strict localization policy.

Risk:
- Some screens still keep local dictionaries or manual locale checks.
- Some locale maps do not have identical key coverage.
- Future language switches can regress outside the tested core routes.

Required fix:
- Move `about_screen.dart`, `notifications_screen.dart`, `referral_screen.dart` and home notification tooltip strings into central `lib/l10n` maps.
- Add missing GDPR/profile extra keys for all 30 locales.
- Rerun `npm test`, `flutter analyze`, and `flutter test`.

## Android release signing

Release APK/AAB cannot be verified without signing secrets.

Required environment:
- `ANDROID_KEYSTORE_PATH`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

## iOS/macOS

Not verified on this Windows host.

Required environment:
- macOS with Xcode and Flutter desktop/iOS tooling.

## Production backend and database

Local backend unit tests passed, but production server and live DB were not touched.

Required environment:
- Staging server or explicit production access window.
- Disposable DB clone for migration/rollback verification.

## Generated web app snapshot

`website_source/app` is tracked and large. It should not be removed until deployment ownership is clarified.

Risk:
- Removing it may break current hosting if production serves this directory directly.
