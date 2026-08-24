import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/glucose_status_translations.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/models/sensor_reading.dart';
import 'package:glucotrack/services/glucose_status_service.dart';

void main() {
  const service = GlucoseStatusService();
  final settings = GlucoseRangeSettings.defaults();
  final now = DateTime(2026, 7, 16, 12);

  test('classifies normal, boundary, warning, critical and stale glucose', () {
    expect(
      service
          .evaluate(glucoseMmol: 6.2, settings: settings, now: now)
          .kind,
      GlucoseStatusKind.normal,
    );
    expect(
      service
          .evaluate(glucoseMmol: 4.0, settings: settings, now: now)
          .kind,
      GlucoseStatusKind.nearLow,
    );
    expect(
      service
          .evaluate(glucoseMmol: 12.0, settings: settings, now: now)
          .kind,
      GlucoseStatusKind.high,
    );
    expect(
      service
          .evaluate(glucoseMmol: 2.8, settings: settings, now: now)
          .kind,
      GlucoseStatusKind.criticalLow,
    );
    expect(
      service
          .evaluate(
            glucoseMmol: 6.2,
            settings: settings,
            now: now,
            measuredAt: now.subtract(const Duration(hours: 3)),
          )
          .kind,
      GlucoseStatusKind.stale,
    );
  });

  test('uses sensor trend first and falls back to time delta', () {
    expect(
      service
          .evaluate(
            glucoseMmol: 7,
            settings: settings,
            now: now,
            sensorTrend: SensorTrend.falling,
          )
          .direction,
      GlucoseDirection.falling,
    );
    expect(
      service
          .evaluate(
            glucoseMmol: 8,
            previousGlucoseMmol: 6,
            measuredAt: now,
            previousMeasuredAt: now.subtract(const Duration(minutes: 30)),
            settings: settings,
            now: now,
          )
          .direction,
      GlucoseDirection.risingFast,
    );
  });

  test('converts glucose units through the shared service', () {
    expect(
      GlucoseStatusService.mmolToDisplay(5, GlucoseUnit.mgDl).round(),
      90,
    );
    expect(
      GlucoseStatusService.displayToMmol(90.091, GlucoseUnit.mgDl),
      closeTo(5, 0.01),
    );
  });

  test('has glucose status translations for all supported languages', () {
    for (final language in AppState.supportedLanguages) {
      final values = glucoseStatusTranslations[language.code];
      expect(values, isNotNull, reason: language.code);
      expect(values!['glucose.status.normal'], isNotEmpty);
      expect(values['glucose.status.criticalHigh'], isNotEmpty);
      expect(values['glucose.lastMeasured'], contains('{time}'));
    }
  });
}
