import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../platform/device_fingerprint.dart';

class DeviceIdentity {
  final String id;
  final String name;
  final String platform;
  final String fingerprint;

  const DeviceIdentity({
    required this.id,
    required this.name,
    required this.platform,
    required this.fingerprint,
  });

  Map<String, String> toJson() => {
        'id': id,
        'name': name,
        'platform': platform,
        'fingerprint': fingerprint,
      };
}

class DeviceIdentityService {
  static const _storageKey = 'accountDeviceId';
  static const _deviceChannel = MethodChannel('glucotrack/device');

  static Future<DeviceIdentity> current() async {
    final preferences = await SharedPreferences.getInstance();
    String? id;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      try {
        id = await _deviceChannel.invokeMethod<String>('getDeviceHash');
      } on PlatformException {
        id = null;
      } on MissingPluginException {
        id = null;
      }
    }
    id ??= preferences.getString(_storageKey);
    if (id == null || id.length < 8) {
      final random = Random.secure();
      final entropy = List.generate(
        16,
        (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0'),
      ).join();
      id = '${DateTime.now().microsecondsSinceEpoch}-$entropy';
      await preferences.setString(_storageKey, id);
    }
    final platform = kIsWeb ? 'web' : defaultTargetPlatform.name.toLowerCase();
    final fingerprintSource = kIsWeb ? browserFingerprintSource() : id;
    return DeviceIdentity(
      id: id,
      name: _deviceName(platform),
      platform: platform,
      fingerprint:
          _stableHash('$platform|${_deviceName(platform)}|$fingerprintSource'),
    );
  }

  static Future<void> acceptServerId(String? id) async {
    if (id == null || id.length < 8) return;
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_storageKey, id);
  }

  static String _stableHash(String value) {
    var hash = 0x811c9dc5;
    for (final byte in value.codeUnits) {
      hash ^= byte;
      hash = (hash * 0x01000193) & 0xffffffff;
    }
    return hash.toRadixString(16).padLeft(8, '0');
  }

  static String _deviceName(String platform) {
    return switch (platform) {
      'android' => 'Android device',
      'ios' => 'iPhone or iPad',
      'macos' => 'Mac',
      'windows' => 'Windows device',
      'linux' => 'Linux device',
      'web' => 'Web browser',
      _ => 'GlucoTrack device',
    };
  }
}
