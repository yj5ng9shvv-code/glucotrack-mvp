import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/models/diary_log_entry.dart';
import 'package:glucotrack/models/doctor_report_period.dart';
import 'package:glucotrack/models/sensor_reading.dart';
import 'package:glucotrack/services/doctor_report_analysis_service.dart';
import 'package:glucotrack/services/doctor_report_export_service.dart';
import 'package:glucotrack/services/doctor_report_repository.dart';
import 'package:glucotrack/services/doctor_report_service.dart';

void main() {
  final period = DoctorReportPeriod.custom(
    DateTime(2026, 7, 1),
    DateTime(2026, 7, 2),
    now: DateTime(2026, 7, 3),
  );

  DiaryLogEntry diary({
    required String id,
    required DateTime time,
    required double glucose,
    SensorBrand source = SensorBrand.manual,
  }) =>
      DiaryLogEntry(
        id: id,
        time: time,
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
    required DateTime time,
    required double glucose,
  }) =>
      SensorReading(
        time: time,
        glucoseMmol: glucose,
        brand: SensorBrand.dexcom,
        trend: SensorTrend.steady,
        sourceId: id,
        note: '',
      );

  test('period repository, analysis, screen export data and text report agree', () {
    final mirrorTime = DateTime(2026, 7, 2, 9);
    final source = const DoctorReportRepository().loadFromCollections(
      diaryEntries: [
        diary(id: 'manual', time: DateTime(2026, 7, 1, 8), glucose: 5.6),
        diary(
          id: 'sensor-${mirrorTime.microsecondsSinceEpoch}',
          time: mirrorTime,
          glucose: 7.1,
          source: SensorBrand.dexcom,
        ),
        diary(id: 'outside', time: DateTime(2026, 7, 3), glucose: 15),
      ],
      sensorReadings: [
        sensor(id: 'sync-1', time: mirrorTime, glucose: 7.1),
        sensor(id: 'outside-sensor', time: DateTime(2026, 7, 3), glucose: 15),
      ],
      period: period,
    );
    final analysis = const DoctorReportAnalysisService().analyze(
      entries: source.diaryEntries,
      sensorReadings: source.sensorReadings,
      period: period,
      targetLowMmol: 3.9,
      targetHighMmol: 10,
    );
    final state = AppState()..languageCode = 'en';
    final csv = const DoctorReportExportService().csv(
      appState: state,
      period: period,
      dailySummaries: analysis.days.values,
    );
    final html = const DoctorReportExportService().html(
      appState: state,
      period: period,
      dailySummaries: analysis.days.values,
    );
    final text = const DoctorReportService().buildReport(
      appState: state,
      periodSummary: analysis.summary,
    );

    expect(analysis.summary.glucoseCount, 2);
    expect(analysis.days.length, 2);
    expect(csv.split('\r\n'), hasLength(3));
    expect(csv, isNot(contains('2026-07-03')));
    expect(html, isNot(contains('2026-07-03')));
    expect(html, contains('<td>2</td>'));
    expect(text, contains('Records: 2'));
  });

  test('analysis retains all valid records at 10, 100 and 1000 record volumes', () {
    for (final count in [10, 100, 1000]) {
      final source = const DoctorReportRepository().loadFromCollections(
        diaryEntries: List.generate(
          count,
          (index) => diary(
            id: 'record-$count-$index',
            time: DateTime(2026, 7, 1).add(Duration(minutes: index)),
            glucose: 6,
          ),
        ),
        sensorReadings: const [],
        period: period,
      );
      final analysis = const DoctorReportAnalysisService().analyze(
        entries: source.diaryEntries,
        sensorReadings: source.sensorReadings,
        period: period,
        targetLowMmol: 3.9,
        targetHighMmol: 10,
      );

      expect(analysis.summary.glucoseCount, count, reason: '$count records');
      expect(analysis.summary.inRangePercent, 100, reason: '$count records');
    }
  });
}
