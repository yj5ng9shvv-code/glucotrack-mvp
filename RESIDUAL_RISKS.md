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
2026-07-15 cleanup audit residual risks:

- Server backup was created and verified, but server cleanup candidates still need read-only inventory and user approval.
- Database dump was created and gzip-verified, but restore into an isolated test database was not performed yet.
- Phone storage was not inspected or cleaned because no active device/ADB storage session was available.
- `website_source/app` is a tracked release build; removing it could break deployment unless the deployment pipeline is changed.
- Root phone/debug screenshots and XML are likely removable, but require user approval.
- Localization static audit still reports English fallback/content-quality findings in non-English locales; no mojibake was found.
- Secret review findings require human review and possible rotation plan; no secret values were printed.
