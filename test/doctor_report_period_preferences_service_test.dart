import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/doctor_report_period.dart';
import 'package:glucotrack/services/doctor_report_period_preferences_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  const service = DoctorReportPeriodPreferencesService();
  final now = DateTime(2026, 7, 26, 12);

  test('restores the applied custom doctor-report period after restart', () async {
    SharedPreferences.setMockInitialValues({});
    final expected = DoctorReportPeriod.custom(
      DateTime(2026, 6, 1),
      DateTime(2026, 6, 30),
      now: now,
    );

    await service.save(expected);
    final restored = await service.load(now: now);

    expect(restored.startDate, expected.startDate);
    expect(restored.endDate, expected.endDate);
  });

  test('uses the last-30-days default when no saved period exists', () async {
    SharedPreferences.setMockInitialValues({});

    final restored = await service.load(now: now);

    expect(restored.startDate, DateTime(2026, 6, 27));
    expect(restored.endDate, DateTime(2026, 7, 26));
  });

  test('discards a malformed or invalid saved period', () async {
    SharedPreferences.setMockInitialValues({
      'doctorReportPeriodStart': 'not-a-date',
      'doctorReportPeriodEnd': '2026-12-01T00:00:00.000',
    });

    final restored = await service.load(now: now);

    expect(restored.startDate, DateTime(2026, 6, 27));
    expect(restored.endDate, DateTime(2026, 7, 26));
  });
}
