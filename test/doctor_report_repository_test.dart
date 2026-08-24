import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/diary_log_entry.dart';
import 'package:glucotrack/models/doctor_report_period.dart';
import 'package:glucotrack/models/sensor_reading.dart';
import 'package:glucotrack/services/doctor_report_analysis_service.dart';
import 'package:glucotrack/services/doctor_report_repository.dart';

void main() {
  const repository = DoctorReportRepository();
  const analysisService = DoctorReportAnalysisService();
  final period = DoctorReportPeriod.custom(
    DateTime(2026, 7, 1),
    DateTime(2026, 7, 31),
    now: DateTime(2026, 8, 1),
  );

  DiaryLogEntry entry(int index, DateTime time) => DiaryLogEntry(
        id: 'entry-$index',
        time: time,
        type: DiaryLogType.glucose,
        glucoseMmol: 5 + (index % 5),
        carbs: 0,
        insulinUnits: 0,
        title: '',
        note: '',
        source: SensorBrand.manual,
      );

  test('returns every record in the selected period without a UI cache cap', () {
    final entries = List.generate(
      1500,
      (index) => entry(index, DateTime(2026, 7, 1).add(Duration(minutes: index))),
    );
    final data = repository.loadFromCollections(
      diaryEntries: [
        entry(9999, DateTime(2026, 6, 30, 23, 59)),
        ...entries,
        entry(10000, DateTime(2026, 8, 1)),
      ],
      sensorReadings: const [],
      period: period,
    );

    expect(data.diaryEntries, hasLength(1500));
    final analysis = analysisService.analyze(
      entries: data.diaryEntries,
      sensorReadings: data.sensorReadings,
      period: period,
      targetLowMmol: 3.9,
      targetHighMmol: 10,
    );
    expect(analysis.summary.glucoseCount, 1500);
  });

  test('filters sensor data by the same inclusive calendar boundaries', () {
    final data = repository.loadFromCollections(
      diaryEntries: const [],
      sensorReadings: [
        SensorReading(
          time: DateTime(2026, 7, 1),
          glucoseMmol: 6,
          brand: SensorBrand.dexcom,
          trend: SensorTrend.steady,
          sourceId: 'first',
          note: '',
        ),
        SensorReading(
          time: DateTime(2026, 7, 31, 23, 59),
          glucoseMmol: 7,
          brand: SensorBrand.dexcom,
          trend: SensorTrend.steady,
          sourceId: 'last',
          note: '',
        ),
        SensorReading(
          time: DateTime(2026, 8, 1),
          glucoseMmol: 8,
          brand: SensorBrand.dexcom,
          trend: SensorTrend.steady,
          sourceId: 'after',
          note: '',
        ),
      ],
      period: period,
    );

    expect(data.sensorReadings.map((reading) => reading.sourceId), ['first', 'last']);
  });
}
