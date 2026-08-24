import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/diary_log_entry.dart';
import 'package:glucotrack/models/doctor_report_measurement.dart';
import 'package:glucotrack/models/sensor_reading.dart';
import 'package:glucotrack/services/doctor_report_data_normalizer.dart';

void main() {
  const normalizer = DoctorReportDataNormalizer();
  final timestamp = DateTime(2026, 7, 1, 8, 30);

  DiaryLogEntry diary({
    required String id,
    required double glucose,
    SensorBrand source = SensorBrand.manual,
  }) =>
      DiaryLogEntry(
        id: id,
        time: timestamp,
        type: DiaryLogType.glucose,
        glucoseMmol: glucose,
        carbs: 0,
        insulinUnits: 0,
        title: '',
        note: '',
        source: source,
      );

  SensorReading sensor({
    required String id,
    required double glucose,
    SensorBrand brand = SensorBrand.dexcom,
  }) =>
      SensorReading(
        time: timestamp,
        glucoseMmol: glucose,
        brand: brand,
        trend: SensorTrend.steady,
        sourceId: id,
        note: 'synced',
      );

  test('normalizes manual diary and synced sensor measurements', () {
    final result = normalizer.normalize(
      diaryEntries: [diary(id: 'manual-1', glucose: 5.8)],
      sensorReadings: [sensor(id: 'sensor-1', glucose: 7.2)],
    );

    expect(result.measurements, hasLength(2));
    expect(
      result.measurements.map((item) => item.sourceType),
      containsAll([
        DoctorReportMeasurementSourceType.manual,
        DoctorReportMeasurementSourceType.sensor,
      ]),
    );
    expect(result.measurements[1].sourceId, 'sensor-1');
    expect(result.measurements[1].metadata['origin'], 'sensor');
    expect(
      result.entries.where((entry) => entry.glucoseMmol > 0),
      hasLength(2),
    );
  });

  test('deduplicates a synchronised sensor reading mirrored in diary', () {
    final result = normalizer.normalize(
      diaryEntries: [
        diary(id: 'sensor-local-copy', glucose: 7.2, source: SensorBrand.dexcom),
      ],
      sensorReadings: [sensor(id: 'vendor-991', glucose: 7.2)],
    );

    expect(result.measurements, hasLength(1));
    expect(
      result.entries.where((entry) => entry.glucoseMmol > 0).single.glucoseMmol,
      7.2,
    );
    expect(result.entries, hasLength(1));
  });

  test('keeps sensor readings from different sources and rejects invalid values', () {
    final result = normalizer.normalize(
      diaryEntries: [diary(id: 'invalid', glucose: 0)],
      sensorReadings: [
        sensor(id: 'dexcom-1', glucose: 6.4),
        sensor(id: 'libre-1', glucose: 6.4, brand: SensorBrand.freestyleLibre),
        sensor(id: 'invalid-sensor', glucose: 0),
      ],
    );

    expect(result.measurements, hasLength(2));
    expect(result.measurements.map((item) => item.brand), containsAll([
      SensorBrand.dexcom,
      SensorBrand.freestyleLibre,
    ]));
  });
}
