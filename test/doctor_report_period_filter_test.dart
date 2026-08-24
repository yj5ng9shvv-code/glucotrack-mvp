import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/daily_doctor_summary.dart';
import 'package:glucotrack/models/doctor_report_period.dart';
import 'package:glucotrack/services/doctor_report_period_filter.dart';

void main() {
  test('keeps only one summary per day within inclusive range', () {
    final period = DoctorReportPeriod.custom(
      DateTime(2026, 7, 1),
      DateTime(2026, 7, 2),
      now: DateTime(2026, 7, 3),
    );
    DailyDoctorSummary summary(DateTime day, int count) => DailyDoctorSummary(
          date: day,
          glucoseAverageMmol: 6,
          glucoseMinimumMmol: 6,
          glucoseMaximumMmol: 6,
          glucoseCount: count,
          insulinTotal: 0,
          carbsTotal: 0,
          lowEpisodes: 0,
          highEpisodes: 0,
          inRangePercent: 100,
          hasNotes: false,
          hasSensorData: false,
          status: DailyDoctorStatus.inRange,
        );

    final result = const DoctorReportPeriodFilter().daily(
      [
        summary(DateTime(2026, 6, 30), 1),
        summary(DateTime(2026, 7, 1), 2),
        summary(DateTime(2026, 7, 1, 12), 99),
        summary(DateTime(2026, 7, 2, 23, 59), 3),
        summary(DateTime(2026, 7, 3), 4),
      ],
      period,
    );

    expect(result.map((item) => item.glucoseCount), [2, 3]);
  });
}
