import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/family_watch_localization.dart';
import 'package:glucotrack/models/app_state.dart';

void main() {
  test('every Family Watch key has a non-empty locale-owned value', () {
    for (final language in AppState.supportedLanguages) {
      final copy = FamilyWatchLocalization.forLanguage(language.code);
      for (final key in FamilyWatchLocalization.keys) {
        final value = copy.t(key);
        expect(value, isNot(startsWith('[MISSING TRANSLATION:')),
            reason: '${language.code}/$key is missing');
        expect(value.trim(), isNotEmpty, reason: '${language.code}/$key is empty');
        expect(copy.hasLocaleValue(key), isTrue,
            reason: '${language.code}/$key must be resolved from its own catalogue');
      }
    }
  });
}
