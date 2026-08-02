import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'location_models.dart';

abstract class SecureKeyValueStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class FlutterSecureKeyValueStore implements SecureKeyValueStore {
  FlutterSecureKeyValueStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

class SecureLocationStorage {
  SecureLocationStorage({SecureKeyValueStore? store})
      : _store = store ?? FlutterSecureKeyValueStore();

  static const _syncStateKey = 'family_watch.location.sync_state.v1';
  static const _queueKey = 'family_watch.location.queue.v1';
  final SecureKeyValueStore _store;

  Future<LocationSyncState> readSyncState() async {
    final raw = await _store.read(_syncStateKey);
    if (raw == null || raw.isEmpty) return const LocationSyncState();
    try {
      return LocationSyncState.fromJson(
          Map<String, dynamic>.from(jsonDecode(raw) as Map));
    } catch (_) {
      return const LocationSyncState();
    }
  }

  Future<void> saveSyncState(LocationSyncState state) =>
      _store.write(_syncStateKey, jsonEncode(state.toJson()));

  Future<List<QueuedLocationUpdate>> readQueue() async {
    final raw = await _store.read(_queueKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      return (jsonDecode(raw) as List)
          .whereType<Map>()
          .map((item) =>
              QueuedLocationUpdate.fromJson(Map<String, dynamic>.from(item)))
          .where((item) => item.id.isNotEmpty && item.point.deviceId.isNotEmpty)
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> saveQueue(List<QueuedLocationUpdate> queue) => _store.write(
      _queueKey, jsonEncode(queue.map((item) => item.toJson()).toList()));

  Future<void> clear() async {
    await _store.delete(_syncStateKey);
    await _store.delete(_queueKey);
  }
}
