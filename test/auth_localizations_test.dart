import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/auth_translations.dart';

void main() {
  test('registration strings cover every supported language', () {
    const supportedLanguages = <String>{
      'en',
      'ru',
      'uk',
      'de',
      'fr',
      'es',
      'it',
      'pl',
      'pt',
      'nl',
      'ro',
      'cs',
      'sk',
      'hu',
      'sv',
      'da',
      'fi',
      'no',
      'el',
      'tr',
      'bg',
      'hr',
      'sl',
      'lt',
      'lv',
      'et',
      'sr',
      'sq',
      'mk',
      'is',
    };

    expect(authTranslations.keys.toSet(), supportedLanguages);
    for (final entry in authTranslations.entries) {
      expect(
        entry.value.length,
        authTranslationKeys.length,
        reason: 'Incomplete registration localization: ${entry.key}',
      );
      expect(
        entry.value.every((translation) => translation.trim().isNotEmpty),
        isTrue,
        reason: 'Empty registration localization: ${entry.key}',
      );
    }
  });
}
