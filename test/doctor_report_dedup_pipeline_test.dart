import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/models/diary_log_entry.dart';
import 'package:glucotrack/models/doctor_report_period.dart';
import 'package:glucotrack/models/sensor_reading.dart';
import 'package:glucotrack/services/doctor_report_analysis_service.dart';
import 'package:glucotrack/services/doctor_report_export_service.dart';
import 'package:glucotrack/services/doctor_report_service.dart';

void main() {
  final period = DoctorReportPeriod.custom(
    DateTime(2026, 7, 1),
    DateTime(2026, 7, 1),
    now: DateTime(2026, 7, 2),
  );

  test(
      'one mirrored sensor measurement stays one record in every report output',
      () {
    final timestamp = DateTime(2026, 7, 1, 8, 30);
    final analysis = const DoctorReportAnalysisService().analyze(
      entries: [
        DiaryLogEntry(
          id: 'sensor-${timestamp.microsecondsSinceEpoch}',
          time: timestamp,
          type: DiaryLogType.glucose,
          glucoseMmol: 6.4,
          carbs: 0,
          insulinUnits: 0,
          title: 'Sensor glucose',
          note: '',
          source: SensorBrand.dexcom,
        ),
      ],
      sensorReadings: [
        SensorReading(
          time: timestamp,
          glucoseMmol: 6.4,
          brand: SensorBrand.dexcom,
          trend: SensorTrend.steady,
          sourceId: 'dexcom-42',
          note: '',
        ),
      ],
      period: period,
      targetLowMmol: 3.9,
      targetHighMmol: 10,
    );
    final state = AppState()..languageCode = 'en';
    final daily = analysis.days.values.single;
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
    expect(analysis.measurements, hasLength(1));
    expect(
        analysis.entries.where((entry) => entry.glucoseMmol > 0), hasLength(1));
    expect(daily.glucoseCount, 1);
    expect(analysis.summary.glucoseCount, 1);
    expect(csv, contains('"1","100%"'));
    expect(html, contains('<td>1</td>'));
  });

  test('does not collapse distinct manual measurements without ids', () {
    final timestamp = DateTime(2026, 7, 1, 8, 30);
    final analysis = const DoctorReportAnalysisService().analyze(
      entries: List.generate(
        2,
        (_) => DiaryLogEntry(
          id: '',
          time: timestamp,
          type: DiaryLogType.glucose,
          glucoseMmol: 6.4,
          carbs: 0,
          insulinUnits: 0,
          title: '',
          note: '',
          source: SensorBrand.manual,
        ),
      ),
      period: period,
      targetLowMmol: 3.9,
      targetHighMmol: 10,
    );

    expect(analysis.summary.glucoseCount, 2);
  });
}
