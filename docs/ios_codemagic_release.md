# GlukoTrack iOS unsigned check through Codemagic

This stage is only an unsigned iOS compilation check. It does not require Apple
Developer Program membership, App Store Connect, certificates, provisioning
profiles, TestFlight, or a signed `.ipa`.

The goal is to prove that the Flutter project compiles on cloud macOS/Xcode:

```bash
flutter clean
flutter pub get
flutter analyze
flutter test
flutter build ios --release --no-codesign
```

## Current iOS project facts

- iOS project folder: `ios/`
- Xcode workspace: `ios/Runner.xcworkspace`
- Main target: `Runner`
- Test target: `RunnerTests`
- Default Bundle ID in the generated project: `com.example.glucotrack`
- App display name: `GlukoTrack`
- iOS deployment target: `13.0`
- Version source: Flutter `pubspec.yaml` (`0.1.1+2`)
- No Firebase iOS config file is present in this repository.
- No Apple Developer signing files are committed to this repository.

## iOS permissions currently declared

The app declares only permissions matching current features:

- `NSCameraUsageDescription`: food/profile image capture.
- `NSPhotoLibraryUsageDescription`: choosing food/profile images.
- `NSMicrophoneUsageDescription`: voice requests and diary voice entries.
- `NSSpeechRecognitionUsageDescription`: converting voice to text.
- `NSLocationWhenInUseUsageDescription`: SOS location sharing/opening current
  location when the user requests it.

No background location, Bluetooth, HealthKit, Face ID, calendar, contacts,
Critical Alerts, widgets, Live Activities, App Groups, or push entitlements were
enabled because this unsigned check does not add platform capabilities that are
not implemented yet.

## Native iOS method channels

`ios/Runner/AppDelegate.swift` implements:

- `glucotrack/emergency.getCurrentLocation` through `CoreLocation`.
- `glucotrack/voice.listen` through `Speech` and `AVFoundation`.
- `glucotrack/voice.openAppSettings` through
  `UIApplication.openSettingsURLString`.

This keeps the existing Flutter API intact and avoids Android-only native
method calls failing on iOS.

## Codemagic workflow

### `ios_unsigned_check`

Runs on Codemagic macOS and checks whether the project compiles for iOS without
code signing:

```bash
flutter clean
flutter pub get
cd ios && pod install --repo-update
flutter analyze
flutter test
flutter build ios --release --no-codesign
```

This workflow does not upload anything to TestFlight and does not publish to the
App Store. Its output is an unsigned `Runner.app` artifact and build logs.

## Owner steps for this unsigned check

1. Push this project to GitHub, GitLab, or Bitbucket.
2. Open Codemagic.
3. Connect the repository.
4. Select this repository.
5. Choose workflow `ios_unsigned_check`.
6. Start the build manually.
7. Open the build log.
8. If it fails, copy the failing log section and fix the project.
9. Repeat until the workflow is green.

No Apple Developer account is needed for this unsigned check.

## What cannot be verified from Windows

The following require Codemagic macOS:

- `pod install` against the real macOS CocoaPods environment.
- `flutter build ios --release --no-codesign`.
- Xcode/iOS compiler errors.

The following are intentionally out of scope for this stage:

- Signed `.ipa`.
- TestFlight upload.
- App Store Connect.
- Install on a physical iPhone.
- Runtime verification on iPhone.

Those require Apple Developer Program and a signed build, which is a later
stage.
