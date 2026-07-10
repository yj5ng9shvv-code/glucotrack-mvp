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
}
