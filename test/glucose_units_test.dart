import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/app_state.dart';

void main() {
  test('converts mmol/L to mg/dL and back', () {
    final state = AppState()
      ..glucoseUnitPreference = GlucoseUnitPreference.mgDl;

    expect(state.glucoseToDisplay(5.5).round(), 99);
    expect(state.glucoseFromDisplay(99).toStringAsFixed(1), '5.5');
    expect(state.formatGlucose(5.5), '99 mg/dL');
  });

  test('auto unit uses mg/dL for English and mmol/L otherwise', () {
    final state = AppState()
      ..glucoseUnitPreference = GlucoseUnitPreference.auto
      ..languageCode = 'en';

    expect(state.glucoseUnit, GlucoseUnit.mgDl);

    state.languageCode = 'ru';
    expect(state.glucoseUnit, GlucoseUnit.mmolL);
  });
}
