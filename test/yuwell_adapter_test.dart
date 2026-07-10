import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/sensor_reading.dart';
import 'package:glucotrack/services/sensor_adapter.dart';
import 'package:glucotrack/services/yuwell_adapter.dart';

class _FakeYuwellClient implements YuwellClient {
  @override
  Future<List<YuwellReadingPayload>> fetchReadings() async => [
        YuwellReadingPayload(
          id: 'reading-1',
          recordedAt: DateTime.utc(2026, 6, 20, 7, 28),
          glucoseMgDl: 158,
          trendCode: 'rising',
        ),
      ];
}

void main() {
  test('converts Yuwell mg/dL readings to mmol/L', () async {
    final adapter = YuwellAdapter(client: _FakeYuwellClient());

    final readings = await adapter.fetchReadings(currentGlucoseMmol: 6.0);

    expect(readings, hasLength(1));
    expect(readings.single.glucoseMmol, 8.8);
    expect(readings.single.brand, SensorBrand.yuwellAnytime);
    expect(readings.single.trend, SensorTrend.rising);
  });

  test('requires an official Yuwell client', () async {
    const adapter = YuwellAdapter();

    expect(
      () => adapter.fetchReadings(currentGlucoseMmol: 6.0),
      throwsA(isA<SensorIntegrationException>()),
    );
  });
}
