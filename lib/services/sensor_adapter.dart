import '../models/sensor_reading.dart';

abstract class SensorAdapter {
  SensorBrand get brand;
  String get displayName;
  String get authMethod;
  bool get requiresNativeSdk;
  bool get requiresBackend;

  Future<List<SensorReading>> fetchReadings({
    required double currentGlucoseMmol,
  });
}

class SensorIntegrationException implements Exception {
  const SensorIntegrationException(this.message);

  final String message;

  @override
  String toString() => message;
}
