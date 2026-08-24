import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/models/daily_doctor_summary.dart';
import 'package:glucotrack/models/doctor_report_period.dart';
import 'package:glucotrack/services/doctor_report_pdf_service.dart';

void main() {
  test('uses the required date-based PDF filename', () {
    final filename = const DoctorReportPdfService().fileNameFor(
      DoctorReportPeriod.custom(
        DateTime(2026, 7, 1),
        DateTime(2026, 7, 26),
        now: DateTime(2026, 7, 26),
      ),
    );
    expect(filename, 'GlucoTrack_Doctor_Report_2026-07-01_2026-07-26.pdf');
  });

  test('creates an openable PDF document', () async {
    final bytes = await const DoctorReportPdfService().buildPdf(
      appState: AppState()..languageCode = 'ru',
      period: DoctorReportPeriod.custom(
        DateTime(2026, 7, 1),
        DateTime(2026, 7, 1),
        now: DateTime(2026, 7, 1),
      ),
      dailySummaries: [
        DailyDoctorSummary(
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
        ),
      ],
      generatedAt: DateTime(2026, 7, 2),
    );
    expect(String.fromCharCodes(bytes.take(4)), '%PDF');
    if (const bool.fromEnvironment('WRITE_PDF_SAMPLE')) {
      await File(r'C:\tmp\GlucoTrack_Doctor_Report_2026-07-01_2026-07-01.pdf')
          .writeAsBytes(bytes, flush: true);
    }
  });
}
