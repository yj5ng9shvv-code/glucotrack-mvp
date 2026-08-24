import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/app_localizations.dart';
import 'package:glucotrack/models/app_state.dart';

const homeKeys = [
  'currentGlucose',
  'measurementHint',
  'statusNormal',
  'emergencyInfo',
  'emergencySubtitle',
  'homeSectionSos',
  'homeSectionSosSubtitle',
  'homeSectionTools',
  'homeSectionToolsSubtitle',
  'homeSectionAnalytics',
  'homeSectionAnalyticsSubtitle',
  'homeSectionIntegrations',
  'homeSectionIntegrationsSubtitle',
  'homeSectionProfile',
  'homeSectionProfileSubtitle',
  'homeSectionAiDoctor',
  'homeSectionAiDoctorSubtitle',
  'familyControl',
  'sosMode',
  'sosProfile',
  'emergencyCard',
  'calculator',
  'foodCatalog',
  'aiAssistant',
  'foodPhoto',
  'diary',
  'trends',
  'diaryAnalysis',
  'doctorReport',
  'export',
  'cloudSync',
  'sensors',
  'premium',
  'referrals',
  'settings',
  'helpTitle',
  'about.title',
  'navigation.home',
  'navigation.askAi',
  'navigation.profile',
];

const englishOnlyHomeValues = {
  'Current glucose',
  'Enter a new reading and tap Save.',
  'Status: in range',
  'Emergency information',
  'Keep critical medical details ready for emergencies.',
  'Safety',
  'SOS card and trusted contacts',
  'Tools',
  'Daily calculators and AI help',
  'Analytics',
  'Diary, trends, reports, and export',
  'Integrations',
  'Cloud sync and connected sensors',
  'Profile',
  'Subscription, settings, and help',
  'AI doctor',
  'Ask clinical questions in context',
};

const authKeys = [
  'auth.action.login',
  'auth.action.signUp',
  'continueWithGoogle',
  'continueWithApple',
  'auth.name',
  'auth.email',
  'auth.password',
  'auth.passwordHelp',
  'auth.confirmPassword',
  'auth.nameInvalid',
  'auth.emailInvalid',
  'auth.passwordInvalid',
  'auth.passwordMismatch',
  'auth.acceptTerms',
  'auth.accountStoredNotice',
  'auth.registration_hint',
  'auth.login_hint',
  'auth.consent_required',
  'forgotPassword',
  'resetPasswordTitle',
  'resetPasswordHint',
  'resetEmailSent',
  'socialLoginNotConfigured',
];

bool looksCorrupted(String value) {
  return value.contains('Р ') ||
      value.contains('Рџ') ||
      value.contains('РЎ') ||
      value.contains('Р”') ||
      value.contains('Рђ') ||
      value.contains('Рќ') ||
      value.contains('РЋ') ||
      value.contains('Р†') ||
      value.contains('РІР') ||
      value.contains('Ð');
}

void main() {
  test('home screen localization resolves for all 30 languages', () {
    expect(AppState.supportedLanguages, hasLength(30));
    for (final language in AppState.supportedLanguages) {
      final l10n = AppLocalizations(language.code);
      for (final key in homeKeys) {
        final value = l10n.t(key);
        expect(value.trim(), isNotEmpty, reason: '${language.code}: $key');
        expect(value, isNot(key), reason: '${language.code}: missing $key');
        expect(
          looksCorrupted(value),
          isFalse,
          reason: '${language.code}: corrupted $key => $value',
        );
        if (language.code != 'en' && englishOnlyHomeValues.contains(value)) {
          fail('${language.code}: unexpected English fallback $key => $value');
        }
      }
    }
  });

  test('russian home labels use real UTF-8 text', () {
    const l10n = AppLocalizations('ru');

    expect(
      l10n.t('currentGlucose'),
      '\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u0441\u0430\u0445\u0430\u0440',
    );
    expect(
      l10n.t('statusNormal'),
      '\u0421\u0442\u0430\u0442\u0443\u0441: \u0432 \u043D\u043E\u0440\u043C\u0435',
    );
    expect(
      l10n.t('navigation.profile'),
      '\u041F\u0440\u043E\u0444\u0438\u043B\u044C',
    );
  });

  test('auth screen labels do not use mojibake legacy ui.text keys', () {
    expect(AppState.supportedLanguages, hasLength(30));
    for (final language in AppState.supportedLanguages) {
      final l10n = AppLocalizations(language.code);
      for (final key in authKeys) {
        final value = l10n.t(key);
        expect(value.trim(), isNotEmpty, reason: '${language.code}: $key');
        expect(value, isNot(key), reason: '${language.code}: missing $key');
        expect(
          looksCorrupted(value),
          isFalse,
          reason: '${language.code}: corrupted $key => $value',
        );
      }
    }
  });

  test('russian auth labels use real UTF-8 text', () {
    const l10n = AppLocalizations('ru');

    expect(l10n.t('auth.action.login'), '\u0412\u043E\u0439\u0442\u0438');
    expect(l10n.t('auth.password'), '\u041F\u0430\u0440\u043E\u043B\u044C');
    expect(
      l10n.t('auth.passwordHelp'),
      '\u041D\u0435 \u043C\u0435\u043D\u0435\u0435 8 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432',
    );
    expect(
      l10n.t('auth.confirmPassword'),
      '\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u043F\u0430\u0440\u043E\u043B\u044C',
    );
  });
}
