import 'dart:convert';
import 'dart:io';

import '../lib/l10n/auth_action_translations.dart';
import '../lib/l10n/auth_error_translations.dart';
import '../lib/l10n/auth_translations.dart';
import '../lib/l10n/device_translations.dart';
import '../lib/l10n/email_verification_translations.dart';
import '../lib/l10n/network_error_translations.dart';
import '../lib/l10n/password_recovery_translations.dart';
import '../lib/l10n/sos_action_translations.dart';
import '../lib/l10n/ui_key_sources.dart';
import '../lib/l10n/voice_ai_marketing_translations.dart';
import '../lib/l10n/voice_assistant_translations.dart';
import '../lib/l10n/voice_permission_translations.dart';

void main() {
  final backup = File('build/web/assets/assets/translations/core.json');
  final output = File('assets/translations/core.json');
  final source = jsonDecode(backup.readAsStringSync()) as Map<String, dynamic>;

  source.addAll({
    'auth': _authLiteralTranslations(),
    'authAction': authActionTranslations,
    'authError': authErrorTranslations,
    'device': deviceTranslations,
    'emailVerification': emailVerificationTranslations,
    'networkError': networkErrorTranslations,
    'passwordRecovery': passwordRecoveryTranslations,
    'sosAction': sosActionTranslations,
    'uiKeySources': uiKeySources,
    'voiceAiMarketing': voiceAiMarketingTranslations,
    'voiceAssistant': voiceAssistantTranslations,
    'voicePermission': voicePermissionTranslations,
  });

  output.writeAsStringSync(jsonEncode(source));
}

Map<String, Map<String, String>> _authLiteralTranslations() {
  return authTranslations.map((language, values) {
    final entries = <String, String>{};
    for (var index = 0; index < authTranslationKeys.length; index++) {
      entries[authTranslationKeys[index]] = values[index];
    }
    return MapEntry(language, entries);
  });
}
