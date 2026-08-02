import 'dart:async';

import 'package:flutter/foundation.dart';

import '../services/device_identity_service.dart';
import 'family_location_api.dart';
import 'family_watch_background_runtime.dart';
import 'location_models.dart';
import 'location_permission_manager.dart';
import 'location_source.dart';
import 'location_sync_coordinator.dart';
import 'offline_location_queue.dart';
import 'secure_location_storage.dart';

enum FamilyWatchTrackingResult {
  started,
  paused,
  stopped,
  permissionDenied,
  backgroundPermissionDenied,
  notificationPermissionDenied,
  locationServiceDisabled,
  unavailable,
}

class FamilyWatchTrackingService {
  FamilyWatchTrackingService({
    LocationPermissionManager? permissionManager,
    FamilyWatchLocationSource? locationSource,
    FamilyWatchBackgroundDriver? backgroundDriver,
    SecureLocationStorage? storage,
    OfflineLocationQueue? queue,
    LocationSyncCoordinator? coordinator,
    Future<DeviceIdentity> Function()? deviceIdentity,
    TargetPlatform? platform,
  })  : _permissionManager = permissionManager ?? LocationPermissionManager(),
        _locationSource =
            locationSource ?? const GeolocatorFamilyWatchLocationSource(),
        _backgroundDriver =
            backgroundDriver ?? FlutterFamilyWatchBackgroundDriver(),
        _deviceIdentity = deviceIdentity ?? DeviceIdentityService.current,
        _platform = platform ?? defaultTargetPlatform {
    _storage = storage ?? SecureLocationStorage();
    _queue = queue ?? OfflineLocationQueue(storage: _storage);
    _coordinator = coordinator ??
        LocationSyncCoordinator(
          queue: _queue,
          storage: _storage,
          sender: FamilyLocationApi(),
        );
  }

  final LocationPermissionManager _permissionManager;
  final FamilyWatchLocationSource _locationSource;
  final FamilyWatchBackgroundDriver _backgroundDriver;
  late final SecureLocationStorage _storage;
  late final OfflineLocationQueue _queue;
  late final LocationSyncCoordinator _coordinator;
  final Future<DeviceIdentity> Function() _deviceIdentity;
  final TargetPlatform _platform;
  StreamSubscription<FamilyWatchPosition>? _iosSubscription;

  Future<FamilyWatchTrackingResult> startTracking({
    required String token,
  }) async {
    if (kIsWeb || token.isEmpty) return FamilyWatchTrackingResult.unavailable;
    var permission = await _permissionManager.currentStatus();
    if (permission != FamilyLocationPermissionStatus.granted) {
      permission = await _permissionManager.requestForegroundPermission();
    }
    if (permission != FamilyLocationPermissionStatus.granted) {
      return FamilyWatchTrackingResult.permissionDenied;
    }
    if (!await _locationSource.isLocationServiceEnabled()) {
      return FamilyWatchTrackingResult.locationServiceDisabled;
    }
    final backgroundPermission =
        await _permissionManager.requestBackgroundPermission();
    if (backgroundPermission != FamilyLocationPermissionStatus.granted) {
      return FamilyWatchTrackingResult.backgroundPermissionDenied;
    }
    if (_platform == TargetPlatform.android &&
        !await _permissionManager.requestNotificationPermission()) {
      return FamilyWatchTrackingResult.notificationPermissionDenied;
    }

    final device = await _deviceIdentity();
    await _storage.saveTrackingState(FamilyWatchTrackingState(
      enabled: true,
      deviceId: device.id,
      sessionToken: token,
    ));
    if (_platform == TargetPlatform.android) {
      await _backgroundDriver.start();
    } else if (_platform == TargetPlatform.iOS) {
      await _startIosStream(token, device.id);
    } else {
      return FamilyWatchTrackingResult.unavailable;
    }
    return FamilyWatchTrackingResult.started;
  }

  Future<FamilyWatchTrackingResult> pauseTracking() async {
    final state = await _storage.readTrackingState();
    if (!state.enabled) return FamilyWatchTrackingResult.stopped;
    await _storage.saveTrackingState(state.copyWith(paused: true));
    await _iosSubscription?.cancel();
    _iosSubscription = null;
    if (!kIsWeb && _platform == TargetPlatform.android) {
      await _backgroundDriver.pause();
    }
    return FamilyWatchTrackingResult.paused;
  }

  Future<FamilyWatchTrackingResult> resumeTracking() async {
    final state = await _storage.readTrackingState();
    if (!state.enabled ||
        state.sessionToken == null ||
        state.deviceId == null) {
      return FamilyWatchTrackingResult.unavailable;
    }
    if (await _permissionManager.backgroundStatus() !=
        FamilyLocationPermissionStatus.granted) {
      return FamilyWatchTrackingResult.backgroundPermissionDenied;
    }
    await _storage.saveTrackingState(state.copyWith(paused: false));
    if (!kIsWeb && _platform == TargetPlatform.android) {
      await _backgroundDriver.resume();
    } else if (_platform == TargetPlatform.iOS) {
      await _startIosStream(state.sessionToken!, state.deviceId!);
    }
    return FamilyWatchTrackingResult.started;
  }

  Future<void> stopTracking() async => _stop(clearLocationData: true);

  Future<void> stopForLogout() async => _stop(clearLocationData: true);

  Future<void> _stop({required bool clearLocationData}) async {
    final state = await _storage.readTrackingState();
    await _iosSubscription?.cancel();
    _iosSubscription = null;
    if (state.enabled && !kIsWeb && _platform == TargetPlatform.android) {
      await _backgroundDriver.stop();
    }
    if (clearLocationData) {
      await _storage.clear();
    } else {
      await _storage.clearTrackingState();
    }
  }

  Future<void> _startIosStream(String token, String deviceId) async {
    await _iosSubscription?.cancel();
    _iosSubscription = _locationSource.positions().listen((position) async {
      if (!_validCoordinates(position.latitude, position.longitude)) return;
      await _queue.add(FamilyLocationPoint(
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        deviceId: deviceId,
        capturedAt: position.capturedAt,
      ));
      if (await _coordinator.flush(token) == LocationSyncResult.stopped) {
        await _stop(clearLocationData: true);
      }
    });
  }

  bool _validCoordinates(double latitude, double longitude) =>
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180;
}
