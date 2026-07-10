import '../models/sensor_reading.dart';
import 'sensor_adapter.dart';
import 'sensor_integration_service.dart';
import 'yuwell_adapter.dart';

export 'sensor_adapter.dart';

class MockSensorAdapter implements SensorAdapter {
  MockSensorAdapter(this.brand);

  final SensorIntegrationService _mockService =
      const SensorIntegrationService();

  @override
  final SensorBrand brand;

  @override
  String get displayName => switch (brand) {
        SensorBrand.freestyleLibre => 'FreeStyle Libre',
        SensorBrand.dexcom => 'Dexcom',
        SensorBrand.medtronicGuardian => 'Medtronic Guardian',
        SensorBrand.accuChek => 'Accu-Chek',
        SensorBrand.contour => 'Contour Next',
        SensorBrand.yuwellAnytime => 'Yuwell Anytime',
        SensorBrand.appleHealth => 'Apple Health',
        SensorBrand.healthConnect => 'Android Health Connect',
        SensorBrand.manual => 'Manual entry',
      };

  @override
  String get authMethod => switch (brand) {
        SensorBrand.freestyleLibre =>
          'LibreView/LibreLinkUp OAuth or backend token',
        SensorBrand.dexcom => 'Dexcom OAuth2',
        SensorBrand.medtronicGuardian => 'CareLink account/backend bridge',
        SensorBrand.accuChek => 'Device import or partner API',
        SensorBrand.contour => 'Device import or partner API',
        SensorBrand.yuwellAnytime => 'Official Yuwell API/SDK credentials',
        SensorBrand.appleHealth => 'iOS HealthKit permission',
        SensorBrand.healthConnect => 'Android Health Connect permission',
        SensorBrand.manual => 'No auth',
      };

  @override
  bool get requiresNativeSdk =>
      brand == SensorBrand.appleHealth || brand == SensorBrand.healthConnect;

  @override
  bool get requiresBackend => switch (brand) {
        SensorBrand.dexcom ||
        SensorBrand.freestyleLibre ||
        SensorBrand.medtronicGuardian =>
          true,
        _ => false,
      };

  @override
  Future<List<SensorReading>> fetchReadings({
    required double currentGlucoseMmol,
  }) {
    return _mockService.syncMockReadings(
      brand: brand,
      currentGlucose: currentGlucoseMmol,
    );
  }
}

class SensorAdapterRegistry {
  const SensorAdapterRegistry({this.yuwellClient});

  final YuwellClient? yuwellClient;

  SensorAdapter adapterFor(SensorBrand brand) =>
      brand == SensorBrand.yuwellAnytime
          ? YuwellAdapter(client: yuwellClient)
          : MockSensorAdapter(brand);

  List<SensorAdapter> get adapters => SensorIntegrationService.supportedBrands
      .map((brand) => adapterFor(brand))
      .toList();
}
