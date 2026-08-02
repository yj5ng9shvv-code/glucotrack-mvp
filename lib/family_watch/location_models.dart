class FamilyLocationPoint {
  final double latitude;
  final double longitude;
  final double? accuracy;
  final int? batteryLevel;
  final String deviceId;
  final DateTime capturedAt;

  const FamilyLocationPoint({
    required this.latitude,
    required this.longitude,
    required this.deviceId,
    required this.capturedAt,
    this.accuracy,
    this.batteryLevel,
  });

  Map<String, dynamic> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
        if (accuracy != null) 'accuracy': accuracy,
        if (batteryLevel != null) 'battery_level': batteryLevel,
        'device_id': deviceId,
      };

  Map<String, dynamic> toStoredJson() => {
        ...toJson(),
        'captured_at': capturedAt.toUtc().toIso8601String(),
      };

  factory FamilyLocationPoint.fromStoredJson(Map<String, dynamic> json) {
    return FamilyLocationPoint(
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      accuracy: (json['accuracy'] as num?)?.toDouble(),
      batteryLevel: (json['battery_level'] as num?)?.toInt(),
      deviceId: json['device_id']?.toString() ?? '',
      capturedAt: DateTime.parse(json['captured_at']?.toString() ?? '').toUtc(),
    );
  }
}

class QueuedLocationUpdate {
  final String id;
  final FamilyLocationPoint point;
  final int retryCount;

  const QueuedLocationUpdate({
    required this.id,
    required this.point,
    this.retryCount = 0,
  });

  String get deduplicationKey =>
      '${point.deviceId}:${point.capturedAt.millisecondsSinceEpoch}:${point.latitude.toStringAsFixed(6)}:${point.longitude.toStringAsFixed(6)}';

  QueuedLocationUpdate retry() => QueuedLocationUpdate(
        id: id,
        point: point,
        retryCount: retryCount + 1,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'point': point.toStoredJson(),
        'retry_count': retryCount,
      };

  factory QueuedLocationUpdate.fromJson(Map<String, dynamic> json) {
    return QueuedLocationUpdate(
      id: json['id']?.toString() ?? '',
      point: FamilyLocationPoint.fromStoredJson(
        Map<String, dynamic>.from(json['point'] as Map),
      ),
      retryCount: (json['retry_count'] as num?)?.toInt() ?? 0,
    );
  }
}

class LocationSyncState {
  final String? deviceId;
  final DateTime? lastUploadedAt;

  const LocationSyncState({this.deviceId, this.lastUploadedAt});

  Map<String, dynamic> toJson() => {
        if (deviceId != null) 'device_id': deviceId,
        if (lastUploadedAt != null)
          'last_uploaded_at': lastUploadedAt!.toUtc().toIso8601String(),
      };

  factory LocationSyncState.fromJson(Map<String, dynamic> json) =>
      LocationSyncState(
        deviceId: json['device_id']?.toString(),
        lastUploadedAt:
            DateTime.tryParse(json['last_uploaded_at']?.toString() ?? '')
                ?.toUtc(),
      );
}

class FamilyWatchTrackingState {
  final bool enabled;
  final bool paused;
  final String? deviceId;
  final String? sessionToken;

  const FamilyWatchTrackingState({
    this.enabled = false,
    this.paused = false,
    this.deviceId,
    this.sessionToken,
  });

  FamilyWatchTrackingState copyWith({
    bool? enabled,
    bool? paused,
    String? deviceId,
    String? sessionToken,
  }) =>
      FamilyWatchTrackingState(
        enabled: enabled ?? this.enabled,
        paused: paused ?? this.paused,
        deviceId: deviceId ?? this.deviceId,
        sessionToken: sessionToken ?? this.sessionToken,
      );

  Map<String, dynamic> toJson() => {
        'enabled': enabled,
        'paused': paused,
        if (deviceId != null) 'device_id': deviceId,
        if (sessionToken != null) 'session_token': sessionToken,
      };

  factory FamilyWatchTrackingState.fromJson(Map<String, dynamic> json) =>
      FamilyWatchTrackingState(
        enabled: json['enabled'] == true,
        paused: json['paused'] == true,
        deviceId: json['device_id']?.toString(),
        sessionToken: json['session_token']?.toString(),
      );
}
