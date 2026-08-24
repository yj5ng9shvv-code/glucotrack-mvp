import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/models/daily_doctor_summary.dart';
import 'package:glucotrack/models/doctor_report_period.dart';
import 'package:glucotrack/services/doctor_report_pdf_service.dart';

void main() {
  final period = DoctorReportPeriod.custom(
    DateTime(2026, 7, 1),
    DateTime(2026, 7, 1),
    now: DateTime(2026, 7, 2),
  );
  final day = DailyDoctorSummary(
    date: DateTime(2026, 7, 1),
    glucoseAverageMmol: 6.2,
    glucoseMinimumMmol: 5.1,
    glucoseMaximumMmol: 7.3,
    glucoseCount: 2,
    insulinTotal: 1,
    carbsTotal: 20,
    lowEpisodes: 0,
    highEpisodes: 0,
    inRangePercent: 100,
    hasNotes: false,
    hasSensorData: false,
    status: DailyDoctorStatus.inRange,
  );

  test('ships SIL OFL Unicode fonts instead of a system Arial asset', () {
    expect(File('assets/fonts/NotoSans-Variable.ttf').lengthSync(),
        greaterThan(100000));
    expect(File('assets/fonts/NotoSansArabic-Variable.ttf').lengthSync(),
        greaterThan(100000));
    expect(File('assets/fonts/OFL.txt').existsSync(), isTrue);
    expect(File('assets/fonts/Arial.ttf').existsSync(), isFalse);
  });

  test('creates PDFs for Cyrillic, European and RTL locale codes', () async {
    for (final language in ['ru', 'pl', 'de', 'ar']) {
      final bytes = await const DoctorReportPdfService().buildPdf(
        appState: AppState()..languageCode = language,
        period: period,
        dailySummaries: [day],
        generatedAt: DateTime(2026, 7, 2),
      );
      expect(bytes.take(4), [37, 80, 68, 70], reason: language);
    }
  });
}
