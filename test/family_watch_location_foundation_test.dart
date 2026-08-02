import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/family_watch/family_location_api.dart';
import 'package:glucotrack/family_watch/location_models.dart';
import 'package:glucotrack/family_watch/location_permission_manager.dart';
import 'package:glucotrack/family_watch/location_sync_coordinator.dart';
import 'package:glucotrack/family_watch/offline_location_queue.dart';
import 'package:glucotrack/family_watch/secure_location_storage.dart';

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
