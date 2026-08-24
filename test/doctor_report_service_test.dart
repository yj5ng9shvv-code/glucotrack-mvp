import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/models/daily_doctor_summary.dart';
import 'package:glucotrack/services/doctor_report_service.dart';

void main() {
  test('uses the period summary instead of zero-valued non-glucose entries',
      () {
    final report = const DoctorReportService().buildReport(
      appState: AppState()..languageCode = 'en',
      periodSummary: const DoctorReportPeriodSummary(
        glucoseAverageMmol: 6,
        glucoseMinimumMmol: 6,
        glucoseMaximumMmol: 6,
        glucoseCount: 1,
        inRangePercent: 100,
        lowPercent: 0,
        highPercent: 0,
        insulinTotal: 0,
        carbsTotal: 30,
        daysWithData: 1,
        daysWithoutData: 0,
      ),
    );
    expect(report, contains('Average glucose: 6.0 mmol/L'));
    expect(report, isNot(contains('Average glucose: 3.0 mmol/L')));
  });
}
