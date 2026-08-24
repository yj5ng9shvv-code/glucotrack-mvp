import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/family_watch_localization.dart';
import 'package:glucotrack/models/app_state.dart';

void main() {
  test('Family Watch has a non-empty independent value for every app locale and key', () {
    for (final language in AppState.supportedLanguages) {
      final copy = FamilyWatchLocalization.forLanguage(language.code);
      for (final key in FamilyWatchLocalization.keys) {
        final value = copy.t(key);
        expect(value.trim(), isNotEmpty, reason: '${language.code}: $key');
        expect(value, isNot(key), reason: '${language.code}: $key must not fall back to the key');
      }
    }
  });

  test('Family Watch catalogue is isolated from legacy family namespace', () {
    expect(FamilyWatchLocalization.keys.every((key) => key.startsWith('familyWatch.')), isTrue);
    expect(AppState.supportedLanguages.map((language) => language.code).toSet(),
        FamilyWatchLocalization.availableLanguages);
  });
}
