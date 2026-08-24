import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/models/daily_doctor_summary.dart';
import 'package:glucotrack/models/doctor_report_period.dart';
import 'package:glucotrack/services/doctor_report_export_service.dart';

void main() {
  const service = DoctorReportExportService();
  final period = DoctorReportPeriod.custom(
    DateTime(2026, 7, 1),
    DateTime(2026, 7, 1),
    now: DateTime(2026, 7, 1),
  );
  final day = DailyDoctorSummary(
    date: DateTime(2026, 7, 1),
    glucoseAverageMmol: 5.5,
    glucoseMinimumMmol: 4.2,
    glucoseMaximumMmol: 7.1,
    glucoseCount: 2,
    insulinTotal: 3,
    carbsTotal: 25,
    lowEpisodes: 0,
    highEpisodes: 0,
    inRangePercent: 100,
    hasNotes: false,
    hasSensorData: false,
    status: DailyDoctorStatus.inRange,
  );

  test('CSV starts with BOM and is one escaped row per day', () {
    final csv = service.csv(
      appState: AppState()..languageCode = 'ru',
      period: period,
      dailySummaries: [day],
    );
    expect(csv.codeUnitAt(0), 0xfeff);
    expect(csv.split('\r\n'), hasLength(2));
    expect(csv, contains('"2026-07-01"'));
  });

  test('uses the required CSV filename', () {
    expect(
      service.fileNameFor(period),
      'GlucoTrack_Doctor_Report_2026-07-01_2026-07-01.csv',
    );
  });

  test('filters CSV and HTML internally to the selected period', () {
    final outside = DailyDoctorSummary(
      date: DateTime(2026, 6, 30),
      glucoseAverageMmol: 12,
      glucoseMinimumMmol: 12,
      glucoseMaximumMmol: 12,
      glucoseCount: 99,
      insulinTotal: 99,
      carbsTotal: 99,
      lowEpisodes: 0,
      highEpisodes: 99,
      inRangePercent: 0,
      hasNotes: false,
      hasSensorData: false,
      status: DailyDoctorStatus.high,
    );
    final state = AppState()..languageCode = 'en';
    final csv = service.csv(
      appState: state,
      period: period,
      dailySummaries: [outside, day],
    );
    final html = service.html(
      appState: state,
      period: period,
      dailySummaries: [outside, day],
    );

    expect(csv, contains('2026-07-01'));
    expect(csv, isNot(contains('2026-06-30')));
    expect(html, contains('2026-07-01'));
    expect(html, isNot(contains('2026-06-30')));
    expect(html, contains('<td>2</td>'));
    expect(html, isNot(contains('<td>99</td>')));
  });
}
