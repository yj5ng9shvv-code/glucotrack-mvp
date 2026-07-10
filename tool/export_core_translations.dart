import 'dart:convert';
import 'dart:io';

import '../lib/l10n/ai_doctor_translations.dart';
import '../lib/l10n/auth_action_translations.dart';
import '../lib/l10n/auth_error_translations.dart';
import '../lib/l10n/auth_translations.dart';
import '../lib/l10n/compact_translations.dart';
import '../lib/l10n/device_translations.dart';
import '../lib/l10n/email_verification_translations.dart';
import '../lib/l10n/full_translations.dart';
import '../lib/l10n/home_section_translations.dart';
import '../lib/l10n/literal_translations.dart';
import '../lib/l10n/marketing_translations.dart';
import '../lib/l10n/network_error_translations.dart';
import '../lib/l10n/password_recovery_translations.dart';
import '../lib/l10n/premium_translations.dart';
import '../lib/l10n/sos_action_translations.dart';
import '../lib/l10n/ui_key_sources.dart';
import '../lib/l10n/voice_ai_marketing_translations.dart';
import '../lib/l10n/voice_assistant_translations.dart';
import '../lib/l10n/voice_permission_translations.dart';

void main() {
  final output = File('assets/translations/core.json');
  output.parent.createSync(recursive: true);
  output.writeAsStringSync(jsonEncode({
    'aiDoctor': aiDoctorTranslations,
    'auth': _authLiteralTranslations(),
    'authAction': authActionTranslations,
    'authError': authErrorTranslations,
    'compact': compactTranslations,
    'device': deviceTranslations,
    'emailVerification': emailVerificationTranslations,
    'full': fullTranslations,
    'homeSection': homeSectionTranslations,
    'literal': literalTranslations,
    'marketing': marketingTranslations,
    'networkError': networkErrorTranslations,
    'passwordRecovery': passwordRecoveryTranslations,
    'premium': premiumTranslations,
    'sosAction': sosActionTranslations,
    'uiKeySources': uiKeySources,
    'voiceAiMarketing': voiceAiMarketingTranslations,
    'voiceAssistant': voiceAssistantTranslations,
    'voicePermission': voicePermissionTranslations,
  }));
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
