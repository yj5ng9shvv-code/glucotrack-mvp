import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/app_localizations.dart';
import 'package:glucotrack/l10n/auth_about_translations.dart';
import 'package:glucotrack/l10n/gdpr_translations.dart';
import 'package:glucotrack/l10n/common_translations.dart';
import 'package:glucotrack/l10n/ui_translations.dart';
import 'package:glucotrack/l10n/journal_override_translations.dart';
import 'package:glucotrack/l10n/glucose_override_translations.dart';
import 'package:glucotrack/l10n/referral_translations.dart';
import 'package:glucotrack/l10n/profile_override_translations.dart';
import 'package:glucotrack/l10n/sos_override_translations.dart';
import 'package:glucotrack/l10n/patient_card_override_translations.dart';
import 'package:glucotrack/l10n/notification_translations.dart';
import 'package:glucotrack/l10n/insulin_calculator_translations.dart';
import 'package:glucotrack/l10n/translation_loader.dart';
import 'package:glucotrack/models/app_state.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('writes runtime English-fallback candidates for all referenced keys', () async {
    await loadCoreTranslations();
    final keyPattern = RegExp(
      r'''(?:\.t|Localized(?:Selectable)?Text)\(\s*['"]([^'"]+)['"]''',
    );
    final keys = <String>{};
    for (final file in Directory('lib').listSync(recursive: true).whereType<File>()) {
      if (!file.path.endsWith('.dart') || file.path.contains('${Platform.pathSeparator}l10n${Platform.pathSeparator}')) {
        continue;
      }
      for (final match in keyPattern.allMatches(file.readAsStringSync())) {
        final key = match.group(1)!;
        if (!key.contains(r'$')) keys.add(key);
      }
    }

    const neutralValues = {'kcal', 'g', 'mg/dL', 'mmol/L'};
    final english = const AppLocalizations('en');
    final candidates = <String, List<String>>{};
    for (final language in AppState.supportedLanguages.where((it) => it.code != 'en')) {
      final localized = AppLocalizations(language.code);
      final matches = <String>[];
      for (final key in keys) {
        final value = localized.t(key);
        if (authAboutTranslations[language.code]?.containsKey(key) ?? false) {
          continue;
        }
        if (gdprTranslations[language.code]?.containsKey(key) ?? false) {
          continue;
        }
        if (commonTranslations[language.code]?.containsKey(key) ?? false) {
          continue;
        }
        if (uiTranslations[language.code]?.containsKey(key) ?? false) {
          continue;
        }
        if (journalOverrideTranslations[language.code]?.containsKey(key) ?? false) {
          continue;
        }
        if (glucoseOverrideTranslations[language.code]?.containsKey(key) ?? false) {
          continue;
        }
        if (referralTranslations[language.code]?.containsKey(key) ?? false) {
          continue;
        }
        if (profileOverrideTranslations[language.code]?.containsKey(key) ?? false) {
          continue;
        }
        if (sosOverrideTranslations[language.code]?.containsKey(key) ?? false) {
          continue;
        }
        if (patientCardOverrideTranslations[language.code]?.containsKey(key) ?? false) {
          continue;
        }
        if (notificationTranslations[language.code]?.containsKey(key) ?? false) {
          continue;
        }
        if (insulinCalculatorTranslations[language.code]?.containsKey(key) ?? false) {
          continue;
        }
        if (value == english.t(key) && !neutralValues.contains(value)) {
          matches.add(key);
        }
      }
      candidates[language.code] = matches..sort();
    }

    final report = const JsonEncoder.withIndent('  ').convert({
      'referencedKeys': keys.length,
      'englishFallbackCandidates': candidates,
    });
    File('reports/localization-runtime-fallback-audit.json')
      ..createSync(recursive: true)
      ..writeAsStringSync(report);

    expect(
      candidates.values.expand((it) => it),
      isEmpty,
      reason: 'English fallback candidates are listed in '
          'reports/localization-runtime-fallback-audit.json',
    );
  });
}
