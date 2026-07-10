import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/premium_translations.dart';
import 'package:glucotrack/models/app_state.dart';

void main() {
  test('premium subscription copy exists for every supported language', () {
    const requiredKeys = {
      'premiumDescription',
      'personalMonthlyPlan',
      'personalYearlyPlan',
      'personalPlanDescription',
      'yearlyPlanDescription',
      'familyPlan',
      'familyPrice',
      'familyPlanDescription',
      'connectedDevices',
      'deviceUsage',
      'thisDevice',
      'deviceLastActive',
      'removeDevice',
    };

    for (final language in AppState.supportedLanguages) {
      final translations = premiumTranslations[language.code];
      expect(translations, isNotNull, reason: language.code);
      expect(
        translations!.keys,
        containsAll(requiredKeys),
        reason: language.code,
      );
    }
  });
}
