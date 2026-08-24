import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/app_localizations.dart';
import 'package:glucotrack/l10n/doctor_report_localization_manifest.dart';
import 'package:glucotrack/models/app_state.dart';

void main() {
  test('every doctor report key is present and non-technical in all locales', () {
    expect(AppState.supportedLanguages, hasLength(30));
    for (final language in AppState.supportedLanguages) {
      final l10n = AppLocalizations(language.code);
      for (final key in doctorReportLocalizationKeys) {
        final value = l10n.t(key).trim();
        expect(value, isNotEmpty, reason: '${language.code}: $key is empty');
        expect(value, isNot(key), reason: '${language.code}: $key is unresolved');
      }
    }
  });
}
