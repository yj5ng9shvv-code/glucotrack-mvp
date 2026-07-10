import '../models/sensor_reading.dart';
import 'sensor_adapter.dart';

abstract class YuwellClient {
  Future<List<YuwellReadingPayload>> fetchReadings();
}

class YuwellReadingPayload {
  const YuwellReadingPayload({
    required this.id,
    required this.recordedAt,
    required this.glucoseMgDl,
    this.trendCode,
  });

  final String id;
  final DateTime recordedAt;
  final double glucoseMgDl;
  final String? trendCode;
}

class YuwellAdapter implements SensorAdapter {
  const YuwellAdapter({this.client});

  final YuwellClient? client;

  @override
  SensorBrand get brand => SensorBrand.yuwellAnytime;

  @override
  String get displayName => 'Yuwell Anytime';

  @override
  String get authMethod => 'Official Yuwell API/SDK credentials';

  @override
  bool get requiresNativeSdk => false;

  @override
  bool get requiresBackend => true;

  @override
  Future<List<SensorReading>> fetchReadings({
    required double currentGlucoseMmol,
  }) async {
    final api = client;
    if (api == null) {
      throw const SensorIntegrationException(
        'Yuwell integration is not configured. Add an official Yuwell '
        'API/SDK client and credentials before syncing.',
      );
    }

    final payloads = await api.fetchReadings();
    final readings = payloads
        .where((payload) =>
            payload.glucoseMgDl.isFinite &&
            payload.glucoseMgDl >= 20 &&
            payload.glucoseMgDl <= 600)
        .map(
          (payload) => SensorReading(
            time: payload.recordedAt,
            glucoseMmol:
                double.parse((payload.glucoseMgDl / 18.0).toStringAsFixed(1)),
            brand: SensorBrand.yuwellAnytime,
            trend: _trend(payload.trendCode),
            sourceId: 'yuwell-${payload.id}',
            note: 'Synced from Yuwell Anytime using the official provider.',
          ),
        )
        .toList()
      ..sort((a, b) => b.time.compareTo(a.time));
    return readings;
  }

  SensorTrend _trend(String? value) {
    return switch (value?.trim().toLowerCase()) {
      'doubleup' || 'risingfast' || '^^' => SensorTrend.risingFast,
      'up' || 'rising' || '^' => SensorTrend.rising,
      'steady' || 'flat' || '->' => SensorTrend.steady,
      'down' || 'falling' || 'v' => SensorTrend.falling,
      'doubledown' || 'fallingfast' || 'vv' => SensorTrend.fallingFast,
      _ => SensorTrend.unknown,
    };
  }
}
