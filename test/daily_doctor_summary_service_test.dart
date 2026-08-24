import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/models/daily_doctor_summary.dart';
import 'package:glucotrack/models/diary_log_entry.dart';
import 'package:glucotrack/models/sensor_reading.dart';
import 'package:glucotrack/services/daily_doctor_summary_service.dart';

void main() {
  const service = DailyDoctorSummaryService();
  final day = DateTime(2026, 7, 26);

  DailyDoctorSummary summarize(List<DiaryLogEntry> entries) =>
      service.summarizeDay(
        entries,
        day,
        targetLowMmol: 3.9,
        targetHighMmol: 10,
      );

  test('empty day has no glucose values or technical values', () {
    final summary = summarize([]);
    expect(summary.hasData, isFalse);
    expect(summary.glucoseAverageMmol, isNull);
    expect(summary.inRangePercent, 0);
    expect(summary.status, DailyDoctorStatus.noData);
  });

  test('calculates glucose statistics and day status', () {
    final summary = summarize([
      entry('one', day.add(const Duration(hours: 8)), glucose: 3.5),
      entry('two', day.add(const Duration(hours: 12)), glucose: 6),
      entry('three', day.add(const Duration(hours: 18)), glucose: 11),
    ]);
    expect(summary.glucoseCount, 3);
    expect(summary.glucoseAverageMmol, 20.5 / 3);
    expect(summary.glucoseMinimumMmol, 3.5);
    expect(summary.glucoseMaximumMmol, 11);
    expect(summary.lowEpisodes, 1);
    expect(summary.highEpisodes, 1);
    expect(summary.inRangePercent, closeTo(100 / 3, 1e-12));
    expect(summary.status, DailyDoctorStatus.mixed);
  });

  test('separately aggregates insulin, carbs, notes, and sensor data', () {
    final summary = summarize([
      entry('insulin', day, insulin: 3.5),
      entry('carbs', day, carbs: 42),
      entry('note', day, note: 'evening'),
      entry('sensor', day, glucose: 6, source: SensorBrand.dexcom),
    ]);
    expect(summary.insulinTotal, 3.5);
    expect(summary.carbsTotal, 42);
    expect(summary.hasNotes, isTrue);
    expect(summary.hasSensorData, isTrue);
    expect(summary.hasData, isTrue);
  });

  test('only insulin is data but not a glucose measurement', () {
    final summary = summarize([entry('insulin-only', day, insulin: 4)]);
    expect(summary.hasData, isTrue);
    expect(summary.glucoseCount, 0);
    expect(summary.insulinTotal, 4);
    expect(summary.carbsTotal, 0);
  });

  test('only carbs are data but not a glucose measurement', () {
    final summary = summarize([entry('carbs-only', day, carbs: 25)]);
    expect(summary.hasData, isTrue);
    expect(summary.glucoseCount, 0);
    expect(summary.insulinTotal, 0);
    expect(summary.carbsTotal, 25);
  });

  test('does not double count IDs and ignores invalid values', () {
    final summary = summarize([
      entry('duplicate', day, glucose: 6, insulin: 2, carbs: 10),
      entry('duplicate', day, glucose: 11, insulin: 9, carbs: 99),
      entry('invalid', day,
          glucose: double.nan, insulin: double.infinity, carbs: -1),
    ]);
    expect(summary.glucoseCount, 1);
    expect(summary.insulinTotal, 2);
    expect(summary.carbsTotal, 10);
  });

  test('keeps local days separate around midnight', () {
    final summary = summarize([
      entry('before', day.subtract(const Duration(minutes: 1)), glucose: 5),
      entry('start', day, glucose: 6),
      entry('end', day.add(const Duration(hours: 23, minutes: 59)), glucose: 7),
      entry('after', day.add(const Duration(days: 1)), glucose: 8),
    ]);
    expect(summary.glucoseCount, 2);
    expect(summary.glucoseAverageMmol, 6.5);
  });

  test('converts canonical mmol values for mg/dL display', () {
    final summary = summarize([entry('reading', day, glucose: 5)]);
    expect(summary.glucoseFor(GlucoseUnit.mgDl, summary.glucoseAverageMmol),
        closeTo(90.091, 0.001));
    expect(
        summary.glucoseFor(GlucoseUnit.mmolL, summary.glucoseAverageMmol), 5);
  });

  test('period summary weights averages by measurement count', () {
    final summaries = service.summarizeRange(
      [
        entry('one', DateTime(2026, 7, 25, 8), glucose: 2),
        entry('two', DateTime(2026, 7, 25, 12), glucose: 2),
        entry('three', DateTime(2026, 7, 25, 18), glucose: 2),
        entry('four', DateTime(2026, 7, 26, 8),
            glucose: 10, insulin: 3, carbs: 20),
      ],
      DateTime(2026, 7, 25),
      DateTime(2026, 7, 27),
      targetLowMmol: 3.9,
      targetHighMmol: 10,
    );
    final summary = service.summarizePeriod(summaries.values);
    expect(summary.glucoseAverageMmol, 4);
    expect(summary.glucoseMinimumMmol, 2);
    expect(summary.glucoseMaximumMmol, 10);
    expect(summary.glucoseCount, 4);
    expect(summary.lowPercent, 75);
    expect(summary.inRangePercent, 25);
    expect(summary.highPercent, 0);
    expect(summary.insulinTotal, 3);
    expect(summary.carbsTotal, 20);
    expect(summary.daysWithData, 2);
    expect(summary.daysWithoutData, 1);
  });
}

DiaryLogEntry entry(
  String id,
  DateTime time, {
  double glucose = 0,
  double insulin = 0,
  int carbs = 0,
  String note = '',
  SensorBrand source = SensorBrand.manual,
}) =>
    DiaryLogEntry(
      id: id,
      time: time,
      type: DiaryLogType.glucose,
      glucoseMmol: glucose,
      carbs: carbs,
      insulinUnits: insulin,
      title: '',
      note: note,
      source: source,
    );
