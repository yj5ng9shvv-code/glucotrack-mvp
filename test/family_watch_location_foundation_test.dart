import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/family_watch/family_watch_background_runtime.dart';
import 'package:glucotrack/family_watch/family_location_api.dart';
import 'package:glucotrack/family_watch/family_watch_tracking_service.dart';
import 'package:glucotrack/family_watch/location_models.dart';
import 'package:glucotrack/family_watch/location_permission_manager.dart';
import 'package:glucotrack/family_watch/location_source.dart';
import 'package:glucotrack/family_watch/location_sync_coordinator.dart';
import 'package:glucotrack/family_watch/offline_location_queue.dart';
import 'package:glucotrack/family_watch/secure_location_storage.dart';
import 'package:glucotrack/services/device_identity_service.dart';

void main() {
  test('permission denied handling is exposed to the caller', () async {
    final manager = LocationPermissionManager(
        gateway: _PermissionGateway(FamilyLocationPermissionStatus.denied));
    expect(
        await manager.currentStatus(), FamilyLocationPermissionStatus.denied);
    expect(await manager.requestForegroundPermission(),
        FamilyLocationPermissionStatus.denied);
  });

  test('queue adds and removes encrypted-store location updates', () async {
    final queue = OfflineLocationQueue(
        storage: SecureLocationStorage(store: _MemoryStore()));
    final point = _point();
    expect(await queue.add(point), isTrue);
    final pending = await queue.pending();
    expect(pending, hasLength(1));
    await queue.remove(pending.single.id);
    expect(await queue.pending(), isEmpty);
  });

  test('queue prevents duplicate location updates', () async {
    final queue = OfflineLocationQueue(
        storage: SecureLocationStorage(store: _MemoryStore()));
    final point = _point();
    expect(await queue.add(point), isTrue);
    expect(await queue.add(point), isFalse);
    expect(await queue.pending(), hasLength(1));
  });

  test('retryable API error increments retry state without dropping update',
      () async {
    final storage = SecureLocationStorage(store: _MemoryStore());
    final queue = OfflineLocationQueue(storage: storage);
    await queue.add(_point());
    final coordinator = LocationSyncCoordinator(
        queue: queue, storage: storage, sender: _FailingSender());
    expect(await coordinator.flush('token'), LocationSyncResult.retryScheduled);
    expect((await queue.pending()).single.retryCount, 1);
  });

  test('start tracking starts the Android foreground runtime', () async {
    final driver = _BackgroundDriver();
    final service = _trackingService(
      platform: TargetPlatform.android,
      driver: driver,
    );

    expect(await service.startTracking(token: 'token'),
        FamilyWatchTrackingResult.started);
    expect(driver.startCalls, 1);
  });

  test('stop tracking stops runtime and clears encrypted state', () async {
    final driver = _BackgroundDriver();
    final storage = SecureLocationStorage(store: _MemoryStore());
    final service = _trackingService(
      platform: TargetPlatform.android,
      driver: driver,
      storage: storage,
    );
    await service.startTracking(token: 'token');
    await service.stopTracking();

    expect(driver.stopCalls, 1);
    expect((await storage.readTrackingState()).enabled, isFalse);
    expect(await storage.readQueue(), isEmpty);
  });

  test('server revoke stops sync and clears queued coordinates', () async {
    final source = _LocationSource();
    final storage = SecureLocationStorage(store: _MemoryStore());
    final queue = OfflineLocationQueue(storage: storage);
    final coordinator = LocationSyncCoordinator(
      queue: queue,
      storage: storage,
      sender: _RevokedSender(),
    );
    final service = _trackingService(
      platform: TargetPlatform.iOS,
      source: source,
      storage: storage,
      queue: queue,
      coordinator: coordinator,
    );
    expect(await service.startTracking(token: 'token'),
        FamilyWatchTrackingResult.started);

    source.add(_position());
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    expect((await storage.readTrackingState()).enabled, isFalse);
    expect(await queue.pending(), isEmpty);
    await source.dispose();
  });

  test('accepted GPS point enters the offline queue', () async {
    final source = _LocationSource();
    final storage = SecureLocationStorage(store: _MemoryStore());
    final queue = OfflineLocationQueue(storage: storage);
    final service = _trackingService(
      platform: TargetPlatform.iOS,
      source: source,
      storage: storage,
      queue: queue,
      coordinator: LocationSyncCoordinator(
        queue: queue,
        storage: storage,
        sender: _FailingSender(),
      ),
    );
    await service.startTracking(token: 'token');

    source.add(_position());
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    expect(await queue.pending(), hasLength(1));
    await source.dispose();
  });

  test('permission denied blocks tracking before the runtime starts', () async {
    final driver = _BackgroundDriver();
    final manager = LocationPermissionManager(
      gateway: _PermissionGateway(FamilyLocationPermissionStatus.denied),
    );
    final service = _trackingService(
      platform: TargetPlatform.android,
      driver: driver,
      permissionManager: manager,
    );

    expect(await service.startTracking(token: 'token'),
        FamilyWatchTrackingResult.permissionDenied);
    expect(driver.startCalls, isZero);
  });
}

FamilyWatchTrackingService _trackingService({
  TargetPlatform platform = TargetPlatform.iOS,
  _LocationSource? source,
  _BackgroundDriver? driver,
  SecureLocationStorage? storage,
  OfflineLocationQueue? queue,
  LocationSyncCoordinator? coordinator,
  LocationPermissionManager? permissionManager,
}) {
  final resolvedStorage =
      storage ?? SecureLocationStorage(store: _MemoryStore());
  final resolvedQueue = queue ?? OfflineLocationQueue(storage: resolvedStorage);
  return FamilyWatchTrackingService(
    platform: platform,
    locationSource: source ?? _LocationSource(),
    backgroundDriver: driver ?? _BackgroundDriver(),
    storage: resolvedStorage,
    queue: resolvedQueue,
    coordinator: coordinator ??
        LocationSyncCoordinator(
          queue: resolvedQueue,
          storage: resolvedStorage,
          sender: _SuccessSender(),
        ),
    permissionManager: permissionManager ??
        LocationPermissionManager(
          gateway: _PermissionGateway(FamilyLocationPermissionStatus.granted),
        ),
    deviceIdentity: () async => const DeviceIdentity(
      id: 'device-1',
      name: 'test',
      platform: 'test',
      fingerprint: 'fingerprint',
    ),
  );
}

FamilyLocationPoint _point() => FamilyLocationPoint(
      latitude: 52.2,
      longitude: 21.0,
      accuracy: 8,
      batteryLevel: 70,
      deviceId: 'device-1',
      capturedAt: DateTime.utc(2026, 8, 2, 12),
    );

class _PermissionGateway implements LocationPermissionGateway {
  _PermissionGateway(this.value);
  final FamilyLocationPermissionStatus value;
  @override
  Future<FamilyLocationPermissionStatus> requestForeground() async => value;
  @override
  Future<FamilyLocationPermissionStatus> status() async => value;
  @override
  Future<FamilyLocationPermissionStatus> backgroundStatus() async => value;
  @override
  Future<FamilyLocationPermissionStatus> requestBackground() async => value;
  @override
  Future<bool> isIgnoringBatteryOptimizations() async => false;
  @override
  Future<bool> requestIgnoreBatteryOptimizations() async => false;
  @override
  Future<bool> requestNotificationPermission() async => true;
}

class _MemoryStore implements SecureKeyValueStore {
  final Map<String, String> values = {};
  @override
  Future<void> delete(String key) async => values.remove(key);
  @override
  Future<String?> read(String key) async => values[key];
  @override
  Future<void> write(String key, String value) async => values[key] = value;
}

class _FailingSender implements LocationUpdateSender {
  @override
  Future<void> updateLocation(
      {required String token, required FamilyLocationPoint point}) {
    throw const FamilyLocationApiException(503);
  }
}

class _RevokedSender implements LocationUpdateSender {
  @override
  Future<void> updateLocation(
      {required String token, required FamilyLocationPoint point}) {
    throw const FamilyLocationApiException(403);
  }
}

class _SuccessSender implements LocationUpdateSender {
  @override
  Future<void> updateLocation(
      {required String token, required FamilyLocationPoint point}) async {}
}

class _LocationSource implements FamilyWatchLocationSource {
  final _controller = StreamController<FamilyWatchPosition>.broadcast();
  @override
  Future<bool> isLocationServiceEnabled() async => true;
  @override
  Stream<FamilyWatchPosition> positions() => _controller.stream;
  void add(FamilyWatchPosition position) => _controller.add(position);
  Future<void> dispose() => _controller.close();
}

FamilyWatchPosition _position() => FamilyWatchPosition(
      latitude: 52.2,
      longitude: 21.0,
      accuracy: 8,
      capturedAt: DateTime.utc(2026, 8, 2, 12),
    );

class _BackgroundDriver implements FamilyWatchBackgroundDriver {
  int startCalls = 0;
  int stopCalls = 0;
  @override
  Future<void> pause() async {}
  @override
  Future<void> resume() async {}
  @override
  Future<void> start() async => startCalls++;
  @override
  Future<void> stop() async => stopCalls++;
}
