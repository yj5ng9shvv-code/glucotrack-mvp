import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/services/device_identity_service.dart';
import 'package:glucotrack/services/push_token_manager.dart';

void main() {
  test('received token registers the authenticated device', () async {
    final messaging = _MessagingGateway(initialToken: 'initial-token');
    final api = _PushDeviceApi();
    final manager = _manager(messaging, api);

    await manager.registerDevice(
      accessTokenProvider: () => 'session-token',
    );

    expect(api.registered, hasLength(1));
    expect(api.registered.single.accessToken, 'session-token');
    expect(api.registered.single.deviceId, 'device-12345678');
    expect(api.registered.single.platform, 'android');
    expect(api.registered.single.pushToken, 'initial-token');
  });

  test('a refreshed token replaces the registered provider token', () async {
    final messaging = _MessagingGateway(initialToken: 'first-token');
    final api = _PushDeviceApi();
    final manager = _manager(messaging, api);
    await manager.registerDevice(accessTokenProvider: () => 'session-token');

    messaging.refresh.add('rotated-token');
    await _drainEvents();

    expect(api.registered.map((call) => call.pushToken),
        ['first-token', 'rotated-token']);
  });

  test('logout unregisters the current device and disables refresh uploads',
      () async {
    final messaging = _MessagingGateway(initialToken: 'first-token');
    final api = _PushDeviceApi();
    final manager = _manager(messaging, api);
    await manager.registerDevice(accessTokenProvider: () => 'session-token');

    await manager.unregisterDevice(accessToken: 'session-token');
    messaging.refresh.add('rotated-token');
    await _drainEvents();

    expect(api.unregistered, ['device-12345678']);
    expect(api.registered, hasLength(1));
  });

  test('missing JWT never sends a registration request', () async {
    final messaging = _MessagingGateway(initialToken: 'initial-token');
    final api = _PushDeviceApi();
    final manager = _manager(messaging, api);

    await manager.registerDevice(accessTokenProvider: () => '');

    expect(api.registered, isEmpty);
  });
}

Future<void> _drainEvents() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

PushTokenManager _manager(_MessagingGateway messaging, _PushDeviceApi api) {
  return PushTokenManager(
    messaging: messaging,
    api: api,
    deviceIdentity: () async => const DeviceIdentity(
      id: 'device-12345678',
      name: 'Test phone',
      platform: 'android',
      fingerprint: 'fingerprint',
    ),
  );
}

class _MessagingGateway implements PushMessagingGateway {
  _MessagingGateway({required this.initialToken});

  final String initialToken;
  final refresh = StreamController<String>.broadcast();
  final messages = StreamController<Map<String, dynamic>>.broadcast();

  @override
  Future<String?> getToken() async => initialToken;

  @override
  Future<bool> initialize() async => true;

  @override
  Stream<Map<String, dynamic>> get onMessage => messages.stream;

  @override
  Stream<String> get onTokenRefresh => refresh.stream;
}

class _PushDeviceApi implements PushDeviceApi {
  final registered = <_RegisterCall>[];
  final unregistered = <String>[];

  @override
  Future<void> register({
    required String accessToken,
    required String deviceId,
    required String platform,
    required String pushToken,
  }) async {
    registered.add(_RegisterCall(accessToken, deviceId, platform, pushToken));
  }

  @override
  Future<void> unregister({
    required String accessToken,
    required String deviceId,
  }) async {
    unregistered.add(deviceId);
  }
}

class _RegisterCall {
  const _RegisterCall(
      this.accessToken, this.deviceId, this.platform, this.pushToken);

  final String accessToken;
  final String deviceId;
  final String platform;
  final String pushToken;
}
