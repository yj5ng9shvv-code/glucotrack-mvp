import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator_android/geolocator_android.dart';
import 'package:geolocator_apple/geolocator_apple.dart';
import 'package:geolocator_platform_interface/geolocator_platform_interface.dart';

class FamilyWatchPosition {
  const FamilyWatchPosition({
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    required this.capturedAt,
  });

  final double latitude;
  final double longitude;
  final double accuracy;
  final DateTime capturedAt;
}

abstract class FamilyWatchLocationSource {
  Future<bool> isLocationServiceEnabled();
  Stream<FamilyWatchPosition> positions();
}

class GeolocatorFamilyWatchLocationSource implements FamilyWatchLocationSource {
  const GeolocatorFamilyWatchLocationSource();

  @override
  Future<bool> isLocationServiceEnabled() =>
      GeolocatorPlatform.instance.isLocationServiceEnabled();

  @override
  Stream<FamilyWatchPosition> positions() => GeolocatorPlatform.instance
      .getPositionStream(locationSettings: _settings())
      .map(
        (position) => FamilyWatchPosition(
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
          capturedAt: position.timestamp.toUtc(),
        ),
      );

  LocationSettings _settings() {
    if (defaultTargetPlatform == TargetPlatform.android) {
      return AndroidSettings(
        accuracy: LocationAccuracy.medium,
        distanceFilter: 75,
        intervalDuration: const Duration(minutes: 2),
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: 'Family Watch location sharing',
          notificationText:
              'Your location is being shared with approved family.',
          notificationChannelName: 'Family Watch location sharing',
          enableWakeLock: true,
          setOngoing: true,
        ),
      );
    }
    return AppleSettings(
      accuracy: LocationAccuracy.medium,
      distanceFilter: 75,
      activityType: ActivityType.fitness,
      pauseLocationUpdatesAutomatically: true,
      allowBackgroundLocationUpdates: true,
      showBackgroundLocationIndicator: true,
    );
  }
}
