import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/app_localizations.dart';
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
      for (final key in {
        'manageSubscription',
        'changePlanTitle',
        'changeToFamilyPlan',
        'changePersonalPlan',
      }) {
        expect(
          AppLocalizations(language.code).t(key),
          isNot(key),
          reason: '${language.code}: $key',
        );
      }
    }
  });

  test('family plan price is explicit for checkout and plan changes', () {
    final fallbackFamilyPrice = premiumTranslations['en']!['familyPrice']!;
    expect(fallbackFamilyPrice, contains(RegExp(r'\d')));
    expect(fallbackFamilyPrice.toLowerCase(), isNot(contains('family price')));

    for (final language in AppState.supportedLanguages) {
      final price = AppLocalizations(language.code).t('familyPrice');
      expect(price, contains(RegExp(r'\d')), reason: language.code);
    }
  });
}
