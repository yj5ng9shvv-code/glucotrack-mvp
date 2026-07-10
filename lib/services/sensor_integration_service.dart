import 'dart:math';

import '../models/sensor_reading.dart';

class SensorIntegrationService {
  const SensorIntegrationService();

  static const supportedBrands = <SensorBrand>[
    SensorBrand.appleHealth,
    SensorBrand.healthConnect,
  ];

  Future<List<SensorReading>> syncMockReadings({
    required SensorBrand brand,
    required double currentGlucose,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 650));
    final now = DateTime.now();
    final random = Random(now.millisecondsSinceEpoch);
    final readings = <SensorReading>[];
    var value =
        currentGlucose.isFinite && currentGlucose > 0 ? currentGlucose : 6.2;

    for (var i = 0; i < 24; i++) {
      value = (value + random.nextDouble() * 0.8 - 0.4).clamp(3.2, 13.8);
      final previous = readings.isEmpty ? value : readings.last.glucoseMmol;
      readings.add(
        SensorReading(
          time: now.subtract(Duration(minutes: i * 5)),
          glucoseMmol: double.parse(value.toStringAsFixed(1)),
          brand: brand,
          trend: _trend(value - previous),
          sourceId: '${brand.name}-mock',
          note:
              'Mock sync. Replace this adapter with the official provider API.',
        ),
      );
    }

    return readings;
  }

  SensorReading manualReading({
    required double glucoseMmol,
    required SensorBrand brand,
  }) {
    return SensorReading(
      time: DateTime.now(),
      glucoseMmol: double.parse(glucoseMmol.toStringAsFixed(1)),
      brand: brand,
      trend: SensorTrend.unknown,
      sourceId: '${brand.name}-manual',
      note: 'Manual entry',
    );
  }

  SensorTrend _trend(double delta) {
    if (delta >= 0.5) {
      return SensorTrend.risingFast;
    }
    if (delta >= 0.2) {
      return SensorTrend.rising;
    }
    if (delta <= -0.5) {
      return SensorTrend.fallingFast;
    }
    if (delta <= -0.2) {
      return SensorTrend.falling;
    }
    return SensorTrend.steady;
  }
}
