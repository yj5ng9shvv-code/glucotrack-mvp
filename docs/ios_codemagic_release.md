# GlukoTrack iOS unsigned check through Codemagic

This stage is an unsigned iOS compilation and IPA packaging check. It does not
require Apple Developer Program membership, App Store Connect, certificates,
provisioning profiles, TestFlight, or an Apple-signed `.ipa`.

The goal is to prove that the Flutter project compiles on cloud macOS/Xcode:

```bash
flutter clean
flutter pub get
flutter analyze
flutter test
flutter build ios --release --no-codesign
# Then package build/ios/iphoneos/Runner.app as:
# build/ios/ipa/GlukoTrack.ipa
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

Runs on Codemagic macOS, checks whether the project compiles for iOS without
code signing, and packages the resulting app into an IPA archive that Sideloadly
can open directly:

```bash
flutter clean
flutter pub get
cd ios && pod install --repo-update
flutter analyze
flutter test
flutter build ios --release --no-codesign
mkdir -p build/ios/ipa_payload/Payload build/ios/ipa
cp -R build/ios/iphoneos/Runner.app build/ios/ipa_payload/Payload/Runner.app
cd build/ios/ipa_payload
zip -qry ../ipa/GlukoTrack.ipa Payload
```

This workflow does not upload anything to TestFlight and does not publish to the
App Store. Its primary output is `build/ios/ipa/GlukoTrack.ipa`, an unsigned IPA
with this structure:

```text
Payload/
  Runner.app/
```

Codemagic also validates the archive before publishing it as an artifact, so a
build will fail if the IPA is missing `Payload/Runner.app/Info.plist` or the
`Payload/Runner.app/Runner` executable. Codemagic should no longer publish only
`Runner.app.zip`.

## Owner steps for this unsigned check

1. Push this project to GitHub, GitLab, or Bitbucket.
2. Open Codemagic.
3. Connect the repository.
4. Select this repository.
5. Choose workflow `ios_unsigned_check`.
6. Start the build manually.
7. Open the build log.
8. Download the `GlukoTrack.ipa` artifact.
9. Open `GlukoTrack.ipa` in Sideloadly directly.
10. Install it to a real iPhone with the Apple ID/signing settings used by
    Sideloadly.
11. Confirm that the app launches on the phone.
12. If the build or install fails, copy the failing log section and fix the
    project.
13. Repeat until the workflow is green and the IPA installs.

No Apple Developer account is needed for this unsigned build check itself.
Sideloadly still needs its normal Apple ID based signing flow when installing
the unsigned IPA onto a physical device.

## What cannot be verified from Windows

The following require Codemagic macOS:

- `pod install` against the real macOS CocoaPods environment.
- `flutter build ios --release --no-codesign`.
- Xcode/iOS compiler errors.
- Creating and validating the final unsigned `GlukoTrack.ipa` artifact from
  `Runner.app`.

The following cannot be completed from this Windows workspace and must be
verified after the Codemagic artifact is downloaded:

- Opening `GlukoTrack.ipa` in Sideloadly.
- Installing on a physical iPhone through Sideloadly.
- Runtime launch verification on iPhone.

The following remain out of scope for this unsigned workflow:

- TestFlight upload.
- App Store Connect.
- App Store signed distribution IPA.
