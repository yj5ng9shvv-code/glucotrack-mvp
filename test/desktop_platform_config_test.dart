import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Windows desktop runner is configured for GlukoTrack', () {
    expect(Directory('windows').existsSync(), isTrue);
    final mainCpp = File('windows/runner/main.cpp').readAsStringSync();
    final resources = File('windows/runner/Runner.rc').readAsStringSync();

    expect(mainCpp, contains('L"GlukoTrack"'));
    expect(resources, contains('"FileDescription", "GlukoTrack"'));
    expect(resources, contains('"ProductName", "GlukoTrack"'));
  });

  test('macOS desktop runner has production identity and network access', () {
    expect(Directory('macos').existsSync(), isTrue);
    final appInfo = File('macos/Runner/Configs/AppInfo.xcconfig').readAsStringSync();
    final releaseEntitlements =
        File('macos/Runner/Release.entitlements').readAsStringSync();

    expect(appInfo, contains('PRODUCT_NAME = GlukoTrack'));
    expect(appInfo, contains('PRODUCT_BUNDLE_IDENTIFIER = com.glukotrack.app'));
    expect(
      releaseEntitlements,
      contains('com.apple.security.network.client'),
    );
  });
}
