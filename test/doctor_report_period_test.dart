import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/doctor_report_period.dart';

void main() {
  test('last seven days uses inclusive local dates', () {
    final period = DoctorReportPeriod.fromPreset(
        DoctorReportPeriodPreset.last7Days,
        now: DateTime(2026, 3, 1, 23));
    expect(period.startDate, DateTime(2026, 2, 23));
    expect(period.endDate, DateTime(2026, 3, 1));
  });

  test('previous month crosses a year boundary', () {
    final period = DoctorReportPeriod.fromPreset(
        DoctorReportPeriodPreset.previousMonth,
        now: DateTime(2026, 1, 20));
    expect(period.startDate, DateTime(2025, 12));
    expect(period.endDate, DateTime(2025, 12, 31));
  });

  test('allows 90 days and rejects longer ranges', () {
    expect(
        DoctorReportPeriod.custom(DateTime(2026, 1, 1), DateTime(2026, 3, 31))
            .isValid,
        isTrue);
    expect(
        DoctorReportPeriod.custom(DateTime(2026, 1, 1), DateTime(2026, 4, 1))
            .validationError,
        'periodTooLong');
  });
}
