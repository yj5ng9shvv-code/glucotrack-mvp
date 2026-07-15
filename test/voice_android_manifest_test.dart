import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Android manifest declares speech recognizer package visibility', () {
    final manifest =
        File('android/app/src/main/AndroidManifest.xml').readAsStringSync();

    expect(
      manifest,
      contains('android.permission.RECORD_AUDIO'),
    );
    expect(
      manifest,
      contains('android.speech.action.RECOGNIZE_SPEECH'),
    );
    expect(
      manifest,
      contains('android.speech.RecognitionService'),
    );
  });

  test('Android manifest declares external browser package visibility', () {
    final manifest =
        File('android/app/src/main/AndroidManifest.xml').readAsStringSync();

    expect(manifest, contains('android.intent.action.VIEW'));
    expect(manifest, contains('android:scheme="https"'));
    expect(manifest, contains('android:scheme="http"'));
  });

  test('Android production application id is not the template package', () {
    final gradle = File('android/app/build.gradle.kts').readAsStringSync();

    expect(gradle, contains('applicationId = "com.glukotrack.app"'));
    expect(gradle, isNot(contains('applicationId = "com.example.glucotrack"')));
  });
}
