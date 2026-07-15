import '../models/sensor_reading.dart';

class SensorIntegrationService {
  const SensorIntegrationService();

  static const supportedBrands = <SensorBrand>[
    SensorBrand.appleHealth,
    SensorBrand.healthConnect,
  ];

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
}
