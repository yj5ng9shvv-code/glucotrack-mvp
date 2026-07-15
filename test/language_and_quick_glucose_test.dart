import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/l10n/app_localizations.dart';
import 'package:glucotrack/services/auth_service.dart';

void main() {
  test('all requested application languages are available', () {
    final codes =
        AppState.supportedLanguages.map((language) => language.code).toSet();

    expect(codes, hasLength(30));
    expect(
      codes,
      containsAll({
        'en',
        'de',
        'fr',
        'es',
        'it',
        'pl',
        'uk',
        'ru',
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
      }),
    );
  });

  test('every language has localized home and measurement strings', () {
    const requiredKeys = [
      'measurementHint',
      'saveMeasurement',
      'invalidGlucose',
      'measurementSaved',
      'emergencyInfo',
      'familyControl',
      'sosMode',
      'emergencyCard',
      'diary',
      'cloudSync',
    ];

    for (final language in AppState.supportedLanguages) {
      final l10n = AppLocalizations(language.code);
      for (final key in requiredKeys) {
        expect(
          l10n.t(key),
          isNot(anyOf(isEmpty, key)),
          reason: '${language.code} is missing $key',
        );
      }
    }
  });

  test('quick mg/dL measurement is converted and stored in diary', () async {
    SharedPreferences.setMockInitialValues({});
    final state = AppState(authService: _OfflineAuthService());
    await state.load();
    state.glucoseUnitPreference = GlucoseUnitPreference.mgDl;

    await state.recordGlucoseMeasurement(126);

    expect(state.glucoseMmol, closeTo(6.99, 0.01));
    expect(state.diaryEntries.first.glucoseMmol, closeTo(6.99, 0.01));
    expect(state.diaryEntries.first.type.name, 'glucose');
  });

  test('selected original language is persisted and restored', () async {
    SharedPreferences.setMockInitialValues({});
    final state = AppState(authService: _OfflineAuthService());
    await state.load();
    await state.setLanguage('hr');

    final restored = AppState(authService: _OfflineAuthService());
    await restored.load();

    expect(restored.languageCode, 'hr');
    expect(restored.locale.languageCode, 'hr');
  });

  test('legacy regional language code is normalized on restore', () async {
    SharedPreferences.setMockInitialValues({'languageCode': 'en_GB'});
    final state = AppState(authService: _OfflineAuthService());
    await state.load();

    expect(state.languageCode, 'en');
    expect(AppLocalizations(state.languageCode).t('measurementHint'),
        isNot('measurementHint'));
    expect(AppLocalizations(state.languageCode).t('emergencyInfo'),
        isNot('emergencyInfo'));
  });

  test('broken machine-translation markers never reach the UI', () {
    const serbian = AppLocalizations('sr');

    expect(serbian.t('aiAssistant'), isNot(contains('ЗКСКПХ')));
    expect(serbian.t('emergencySubtitle'), isNot(contains('ЗКСКПХ')));
    expect(serbian.literal('GlukoTrack'), isNot(contains('ЗКСКПХ')));
  });
}

class _OfflineAuthService extends AuthService {
  @override
  Future<AuthSession?> restoreSession(
    String token, {
    String? refreshToken,
  }) async =>
      null;
}
