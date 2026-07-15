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
      'premiumScreenTitle',
      'premiumActiveLabel',
      'subscriptionPlanLabel',
      'subscriptionPaidUntilLabel',
      'monthPrice',
      'yearPrice',
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

  test('premium copy is localized and not mojibake for all 30 languages', () {
    final english = premiumTranslations['en']!;
    final mojibake = RegExp(
      r'в‚¬|Рџ|Рґ|Рµ|Р°|РЅ|Рё|Рѕ|Рє|Р»|Р№|Рћ|РЎ|Р‘|Р—|Р“|Р”',
    );

    for (final language in AppState.supportedLanguages) {
      final translations = premiumTranslations[language.code]!;
      for (final entry in translations.entries) {
        expect(
          entry.value,
          isNot(contains(mojibake)),
          reason: '${language.code}: ${entry.key}',
        );
      }

      if (language.code == 'en') continue;
      for (final key in {
        'freeForeverTitle',
        'premiumIncludesTitle',
        'manageSubscription',
        'changePlanTitle',
        'premiumActiveLabel',
        'subscriptionPaidUntilLabel',
      }) {
        expect(
          translations[key],
          isNot(english[key]),
          reason: '${language.code}: $key must not fall back to English',
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
