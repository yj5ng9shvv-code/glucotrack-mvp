import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/food_catalog_translations.dart';
import 'package:glucotrack/l10n/food_scanner_translations.dart';
import 'package:glucotrack/models/app_state.dart';

void main() {
  const mojibakeMarkers = ['вЂ', 'Г¤', 'Г©', 'Гі', 'Р¤', 'Рѕ', 'О¦'];

  void expectCompleteLocalizedMap(
    Map<String, Map<String, String>> translations,
    String module,
  ) {
    final english = translations['en']!;

    for (final language in AppState.supportedLanguages) {
      final values = translations[language.code];
      expect(values, isNotNull, reason: '$module: missing ${language.code}');
      expect(
        values!.keys.toSet(),
        english.keys.toSet(),
        reason: '$module: ${language.code} has missing or extra keys',
      );

      for (final entry in values.entries) {
        expect(entry.value.trim(), isNotEmpty,
            reason: '$module: ${language.code}.${entry.key} is empty');
        for (final marker in mojibakeMarkers) {
          expect(entry.value.contains(marker), isFalse,
              reason: '$module: ${language.code}.${entry.key} contains $marker');
        }
      }
    }
  }

  test('Food photo translation maps are complete and UTF-8 safe', () {
    expectCompleteLocalizedMap(foodScannerTranslations, 'food_scanner');
  });

  test('Food catalog translation maps are complete and UTF-8 safe', () {
    expectCompleteLocalizedMap(foodCatalogTranslations, 'food_catalog');
  });

  test('Food photo and catalog do not fall back to English', () {
    const scannerKeys = [
      'foodPhoto',
      'takePhoto',
      'gallery',
      'recognizeFood',
      'foodPhotoHelp',
      'foodPhotoDisclaimer',
    ];
    const catalogKeys = [
      'foodCatalog',
      'searchProducts',
      'food.buckwheat',
      'food.chickenBreast',
      'food.cucumber',
      'food.apple',
      'food.whiteRice',
      'food.sweetSoda',
    ];

    for (final language in AppState.supportedLanguages.where((it) => it.code != 'en')) {
      for (final key in scannerKeys) {
        expect(foodScannerTranslations[language.code]![key],
            isNot(foodScannerTranslations['en']![key]),
            reason: 'food_scanner: ${language.code}.$key stayed English');
      }
      for (final key in catalogKeys) {
        expect(foodCatalogTranslations[language.code]![key],
            isNot(foodCatalogTranslations['en']![key]),
            reason: 'food_catalog: ${language.code}.$key stayed English');
      }
    }
  });
}
