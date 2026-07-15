import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/sensor_reading.dart';
import 'package:glucotrack/services/sensor_adapters.dart';

void main() {
  test('unsupported sensor adapter does not return mocked data', () async {
    final adapter = const SensorAdapterRegistry().adapterFor(
      SensorBrand.dexcom,
    );

    await expectLater(
      () => adapter.fetchReadings(currentGlucoseMmol: 6.1),
      throwsA(
        isA<SensorIntegrationException>().having(
          (error) => error.message,
          'message',
          contains('not implemented'),
        ),
      ),
    );
  });
}
