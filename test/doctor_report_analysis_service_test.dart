import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/diary_log_entry.dart';
import 'package:glucotrack/models/doctor_report_period.dart';
import 'package:glucotrack/models/sensor_reading.dart';
import 'package:glucotrack/services/doctor_report_analysis_service.dart';

void main() {
  const service = DoctorReportAnalysisService();
  final period = DoctorReportPeriod.custom(
    DateTime(2026, 7, 1),
    DateTime(2026, 7, 1),
    now: DateTime(2026, 7, 2),
  );

  DiaryLogEntry entry({
    required String id,
    required DiaryLogType type,
    double glucose = 0,
    int carbs = 0,
    double insulin = 0,
    String note = '',
  }) =>
      DiaryLogEntry(
        id: id,
        time: DateTime(2026, 7, 1, 12),
        type: type,
        glucoseMmol: glucose,
        carbs: carbs,
        insulinUnits: insulin,
        title: '',
        note: note,
        source: SensorBrand.manual,
      );

  test('excludes zero-valued food, insulin, and note events from glucose', () {
    final result = service.analyze(
      entries: [
        entry(id: 'food', type: DiaryLogType.meal, carbs: 30),
        entry(id: 'insulin', type: DiaryLogType.insulin, insulin: 3),
        entry(id: 'note', type: DiaryLogType.note, note: 'felt well'),
      ],
      period: period,
      targetLowMmol: 3.9,
      targetHighMmol: 10,
    );

    expect(result.summary.glucoseCount, 0);
    expect(result.summary.glucoseAverageMmol, isNull);
    expect(result.days[DateTime(2026, 7, 1)]!.glucoseCount, 0);
  });

  test('uses only real glucose measurements for every report metric', () {
    final result = service.analyze(
      entries: [
        entry(id: 'low', type: DiaryLogType.glucose, glucose: 3.8),
        entry(id: 'in-range', type: DiaryLogType.glucose, glucose: 6),
        entry(id: 'high', type: DiaryLogType.glucose, glucose: 10.1),
        entry(id: 'meal', type: DiaryLogType.meal, carbs: 40),
      ],
      period: period,
      targetLowMmol: 3.9,
      targetHighMmol: 10,
    );
    final day = result.days[DateTime(2026, 7, 1)]!;

    expect(result.summary.glucoseCount, 3);
    expect(result.summary.glucoseAverageMmol, closeTo((3.8 + 6 + 10.1) / 3, 0.0001));
    expect(result.summary.glucoseMinimumMmol, 3.8);
    expect(result.summary.glucoseMaximumMmol, 10.1);
    expect(result.summary.lowPercent, closeTo(100 / 3, 0.0001));
    expect(result.summary.inRangePercent, closeTo(100 / 3, 0.0001));
    expect(result.summary.highPercent, closeTo(100 / 3, 0.0001));
    expect(day.glucoseCount, result.summary.glucoseCount);
  });

  test('counts threshold boundary values as in range', () {
    final result = service.analyze(
      entries: [
        entry(id: 'lower-boundary', type: DiaryLogType.glucose, glucose: 3.9),
        entry(id: 'upper-boundary', type: DiaryLogType.glucose, glucose: 10),
      ],
      period: period,
      targetLowMmol: 3.9,
      targetHighMmol: 10,
    );

    expect(result.summary.inRangePercent, 100);
    expect(result.summary.lowPercent, 0);
    expect(result.summary.highPercent, 0);
  });

  test('includes a valid sensor reading that has no diary mirror', () {
    final result = service.analyze(
      entries: const [],
      sensorReadings: [
        SensorReading(
          time: DateTime(2026, 7, 1, 9),
          glucoseMmol: 7.2,
          brand: SensorBrand.dexcom,
          trend: SensorTrend.steady,
          sourceId: 'sensor-only',
          note: '',
        ),
      ],
      period: period,
      targetLowMmol: 3.9,
      targetHighMmol: 10,
    );

    expect(result.summary.glucoseCount, 1);
    expect(result.summary.glucoseAverageMmol, 7.2);
    expect(result.measurements.single.sourceId, 'sensor-only');
  });

  test('has stable zero-data percentages and repeatable calculations', () {
    final entries = [entry(id: 'reading', type: DiaryLogType.glucose, glucose: 6)];
    final first = service.analyze(
      entries: entries,
      period: period,
      targetLowMmol: 3.9,
      targetHighMmol: 10,
    );
    final second = service.analyze(
      entries: entries,
      period: period,
      targetLowMmol: 3.9,
      targetHighMmol: 10,
    );
    final empty = service.analyze(
      entries: const [],
      period: period,
      targetLowMmol: 3.9,
      targetHighMmol: 10,
    );

    expect(first.summary.glucoseAverageMmol, second.summary.glucoseAverageMmol);
    expect(first.summary.glucoseCount, second.summary.glucoseCount);
    expect(empty.summary.inRangePercent.isFinite, isTrue);
    expect(empty.summary.lowPercent.isFinite, isTrue);
    expect(empty.summary.highPercent.isFinite, isTrue);
  });
}
