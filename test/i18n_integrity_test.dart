import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/app_localizations.dart';
import 'package:glucotrack/l10n/translation_loader.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/models/diary_entry.dart';
import 'package:glucotrack/services/diary_analysis_service.dart';
import 'package:glucotrack/services/doctor_report_service.dart';
import 'package:glucotrack/services/sos_public_service.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final sourceFiles = Directory('lib')
      .listSync(recursive: true)
      .whereType<File>()
      .where((file) => file.path.endsWith('.dart'))
      .where(
        (file) => !file.path.contains(
          '${Platform.pathSeparator}l10n${Platform.pathSeparator}',
        ),
      )
      .toList();

  test('every referenced translation key resolves in all 30 locales', () async {
    await loadCoreTranslations();

    final keyPattern = RegExp(
      r'''(?:\.t|Localized(?:Selectable)?Text)\(\s*['"]([^'"]+)['"]''',
    );
    final keys = <String>{};
    for (final file in sourceFiles) {
      for (final match in keyPattern.allMatches(file.readAsStringSync())) {
        final key = match.group(1)!;
        if (!key.contains(r'$')) keys.add(key);
      }
    }

    expect(AppState.supportedLanguages, hasLength(30));
    for (final language in AppState.supportedLanguages) {
      final l10n = AppLocalizations(language.code);
      for (final key in keys) {
        final value = l10n.t(key);
        expect(value.trim(), isNotEmpty, reason: '${language.code}: $key');
        expect(value, isNot(key), reason: '${language.code}: missing $key');
      }
    }
  });

  test('Flutter UI has no direct static text literals', () {
    final patterns = <RegExp>[
      RegExp(
        r'''(?<!Localized)(?<!Selectable)Text\(\s*['"](?!\$)''',
        multiLine: true,
      ),
      RegExp(
        r'''\b(?:labelText|hintText|helperText|tooltip|semanticLabel)[ \t]*:[ \t]*['"]''',
        multiLine: true,
      ),
    ];
    final violations = <String>[];
    for (final file in sourceFiles) {
      final source = file.readAsStringSync();
      for (final pattern in patterns) {
        if (pattern.hasMatch(source)) {
          violations.add(file.path);
          break;
        }
      }
    }
    expect(violations, isEmpty, reason: violations.join('\n'));
  });

  test('family access Russian labels are readable UTF-8', () async {
    await loadCoreTranslations();
    const l10n = AppLocalizations('ru');
    const keys = [
      'family.title',
      'family.description',
      'family.invite',
      'family.accept',
      'family.emailLabel',
      'family.inviteCodeLabel',
      'family.currentGlucose',
      'family.historyDiary',
      'family.emergencySos',
      'family.createInvitation',
      'family.acceptAccess',
      'family.visibleTo',
      'family.copyCode',
      'family.revokeAccess',
      'family.monitoredPeople',
    ];
    const mojibakeMarkers = ['Рљ', 'Рџ', 'Р”', 'РЎ', 'Рё', 'СЊ', 'С…', 'вЂ'];

    expect(l10n.t('family.title'), 'Контроль близких');
    for (final key in keys) {
      final value = l10n.t(key);
      expect(value, isNot(key), reason: key);
      for (final marker in mojibakeMarkers) {
        expect(value.contains(marker), isFalse, reason: '$key -> $value');
      }
    }
  });

  test('family access labels follow the selected language', () async {
    await loadCoreTranslations();
    const keys = [
      'family.title',
      'family.description',
      'family.invite',
      'family.accept',
      'family.emailLabel',
      'family.inviteCodeLabel',
      'family.currentGlucose',
      'family.historyDiary',
      'family.emergencySos',
      'family.createInvitation',
      'family.acceptAccess',
      'family.visibleTo',
      'family.copyCode',
      'family.revokeAccess',
      'family.monitoredPeople',
    ];
    const english = AppLocalizations('en');
    const russian = AppLocalizations('ru');

    for (final language in AppState.supportedLanguages) {
      final l10n = AppLocalizations(language.code);
      for (final key in keys) {
        final value = l10n.t(key);
        expect(value, isNot(key), reason: '${language.code}: $key');
        if (language.code != 'en') {
          expect(
            value,
            isNot(english.t(key)),
            reason: '${language.code}: $key stayed English',
          );
        }
        if (language.code != 'ru') {
          expect(
            value,
            isNot(russian.t(key)),
            reason: '${language.code}: $key stayed Russian',
          );
        }
      }
    }
  });

  test('SOS screens labels follow the selected language', () async {
    await loadCoreTranslations();
    const keys = [
      'sos.cardTitle',
      'sos.medicalInformation',
      'sos.holdToActivate',
      'sos.myLocation',
      'sos.sendLocation',
      'sos.callContact',
      'sos.openMap',
      'sos.showQr',
      'sos.medicalCard',
      'sos.locationReady',
      'sos.accuracy',
      'sos.updatedAt',
      'sos.lockScreenInfo',
      'sos.lastUpdated',
      'sos.noData',
      'sos.blood_type',
      'sos.insulin',
      'sos.allergyStatus',
      'sos.yes',
      'sos.no',
      'sos.medications',
      'sos.patient_card',
      'sos.public_card_notice',
      'sos.hide_sensitive_data',
      'sos.enable_monitoring',
      'sos.auto_call_delay',
      'sos.open_card_qr',
      'sos.full_access',
      'sos.send_sms_question',
      'sos.create_sms',
      'sos.send_sms_location',
    ];
    const english = AppLocalizations('en');
    const russian = AppLocalizations('ru');
    const localeNeutralKeys = {
      'sos.insulin',
      'sos.showQr',
      'sos.yes',
      'sos.no',
      'sos.medications',
    };

    for (final language in AppState.supportedLanguages) {
      final l10n = AppLocalizations(language.code);
      for (final key in keys) {
        final value = l10n.t(key);
        expect(value, isNot(key), reason: '${language.code}: $key');
        if (language.code != 'en' && !localeNeutralKeys.contains(key)) {
          expect(
            value,
            isNot(english.t(key)),
            reason: '${language.code}: $key stayed English',
          );
        }
        if (language.code != 'ru' && !localeNeutralKeys.contains(key)) {
          expect(
            value,
            isNot(russian.t(key)),
            reason: '${language.code}: $key stayed Russian',
          );
        }
      }
    }
    expect(
      const AppLocalizations('hu').t('sos.lockScreenInfo'),
      contains('Az Android'),
    );
    expect(
      const AppLocalizations('hu').t('sos.lockScreenInfo'),
      isNot(contains('Android показывает')),
    );
  });

  test('Profile labels follow every selected language', () async {
    await loadCoreTranslations();
    const keys = [
      'profile.title',
      'profile.yourProfile',
      'profile.camera',
      'profile.gallery',
      'profile.remove',
      'profile.userData',
      'profile.name',
      'profile.email',
      'profile.phone',
      'profile.age',
      'profile.weightKg',
      'profile.heightCm',
      'profile.medicalSettings',
      'profile.glucoseUnits',
      'profile.glucoseUnitAuto',
      'profile.glucoseUnitMmol',
      'profile.glucoseUnitMgdl',
      'profile.diabetesType',
      'profile.diabetesType1',
      'profile.diabetesType2',
      'profile.diabetesGestational',
      'profile.targetGlucose',
      'profile.carbRatioLong',
      'profile.correctionFactor',
      'profile.allergy',
      'profile.allergyStatusYes',
      'profile.allergyStatusNo',
      'profile.allergyDetails',
      'profile.languageSection',
      'profile.appLanguage',
      'profile.selectedLanguage',
      'profile.sosProfileTitle',
      'profile.sosProfileSubtitle',
      'profile.emergencyCardTitle',
      'profile.emergencyCardSubtitle',
      'profile.sensorsTitle',
      'profile.sensorsSubtitle',
      'profile.saveSettings',
      'profile.saving',
      'profile.settingsSaved',
      'profile.logout',
      'profile.privacyNote',
    ];
    for (final language in AppState.supportedLanguages) {
      final l10n = AppLocalizations(language.code);
      for (final key in keys) {
        final value =
            l10n.t(key).replaceAll('{language}', language.label).trim();
        expect(value, isNotEmpty, reason: '${language.code}: $key');
        expect(value, isNot(key), reason: '${language.code}: $key');
        expect(
          value.contains('ui.text.'),
          isFalse,
          reason: '${language.code}: $key unresolved legacy key',
        );
      }
    }

    final profileSource = File(
      'lib/screens/profile_screen.dart',
    ).readAsStringSync();
    final allergySource = File(
      'lib/widgets/allergy_input_card.dart',
    ).readAsStringSync();
    expect(profileSource.contains('ui.text.'), isFalse);
    for (final oldKey in [
      "l10n.t('profile')",
      "l10n.t('yourProfile')",
      "l10n.t('userData')",
      "l10n.t('medicalSettings')",
      "l10n.t('diabetesType')",
      "l10n.t('targetGlucose')",
      "l10n.t('carbRatioLong')",
      "l10n.t('correctionFactor')",
      "l10n.t('language')",
      "l10n.t('appLanguage')",
      "l10n.t('selectedLanguage')",
      "l10n.t('saveSettings')",
      "l10n.t('saving')",
      "l10n.t('settingsSaved')",
      "l10n.t('privacyNote')",
    ]) {
      expect(profileSource.contains(oldKey), isFalse, reason: oldKey);
    }
    expect(allergySource.contains("l10n.t('sos.allergy"), isFalse);
    expect(allergySource.contains("l10n.t('sos.yes"), isFalse);
    expect(allergySource.contains("l10n.t('sos.no"), isFalse);
  });

  test('public SOS payload sends complete labels for every language', () async {
    await loadCoreTranslations();
    const expectedLabelKeys = {
      'patient',
      'diabetes',
      'diabetesType',
      'type1',
      'type2',
      'gestational',
      'treatment',
      'bloodType',
      'languages',
      'call112',
      'callRelative',
      'callRelativeWithName',
      'sendSms',
      'geoConsent',
      'sensitiveHidden',
      'pinPrompt',
      'open',
      'disclaimer',
      'name',
      'currentGlucose',
      'lastUpdated',
      'noData',
      'age',
      'diagnoses',
      'insulin',
      'allergies',
      'allergyStatus',
      'allergyDetails',
      'medications',
      'doctor',
      'otherContacts',
      'checking',
      'success',
      'error',
      'instruction',
    };

    for (final language in AppState.supportedLanguages) {
      SharedPreferences.setMockInitialValues({});
      Map<String, dynamic>? requestBody;
      final service = SosPublicService(
        client: MockClient((request) async {
          expect(request.url.path, endsWith('/sos/profile'));
          requestBody = jsonDecode(request.body) as Map<String, dynamic>;
          return http.Response(
            jsonEncode({'token': 'token-${language.code}'}),
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
      );
      final state = AppState()
        ..languageCode = language.code
        ..fullName = 'Patient'
        ..diabetesType = DiabetesType.type2
        ..glucoseMmol = 7.8
        ..emergencyInstructions = '';
      await state.useDeviceManagementToken('test-token');

      final token = await service.publish(state);

      expect(token, 'token-${language.code}');
      final card = requestBody?['card'] as Map<String, dynamic>?;
      expect(card, isNotNull, reason: language.code);
      expect(card!['languageCode'], language.code);
      final labels = card['labels'] as Map<String, dynamic>?;
      expect(labels, isNotNull, reason: language.code);
      expect(labels!.keys.toSet(), expectedLabelKeys, reason: language.code);
      for (final entry in labels.entries) {
        final value = entry.value;
        expect(value, isA<String>(), reason: '${language.code}.${entry.key}');
        expect(
          (value as String).trim(),
          isNotEmpty,
          reason: '${language.code}.${entry.key}',
        );
        expect(
          value,
          isNot(entry.key),
          reason: '${language.code}.${entry.key}',
        );
      }
    }
  });

  test('AI assistant labels follow the selected language', () async {
    await loadCoreTranslations();
    const keys = [
      'aiAssistant',
      'medicalDisclaimer',
      'enterQuestion',
      'typing',
      'aiGreeting',
      'quickProduct',
      'quickGlucose',
      'quickInsulin',
      'quickDoctor',
      'aiPromptCanIEatThis',
      'aiPromptAnalyzeGlucose',
      'aiPromptExplainInsulin',
      'aiPromptDoctorQuestions',
      'aiContext',
      'modeCloud',
      'modeLocal',
    ];
    const english = AppLocalizations('en');

    for (final language in AppState.supportedLanguages) {
      final l10n = AppLocalizations(language.code);
      for (final key in keys) {
        final value = l10n.t(key);
        expect(value, isNot(key), reason: '${language.code}: $key');
        expect(value.trim(), isNotEmpty, reason: '${language.code}: $key');
        if (language.code != 'en') {
          expect(
            value,
            isNot(english.t(key)),
            reason: '${language.code}: $key stayed English',
          );
        }
      }

      final contextLine = l10n
          .t('aiContext')
          .replaceAll('{currentGlucose}', '125 mg/dL')
          .replaceAll('{targetGlucose}', '100 mg/dL');
      expect(
        contextLine.contains('{currentGlucose}'),
        isFalse,
        reason: language.code,
      );
      expect(
        contextLine.contains('{targetGlucose}'),
        isFalse,
        reason: language.code,
      );
      expect(contextLine.contains('125 mg/dL'), isTrue, reason: language.code);
      expect(contextLine.contains('100 mg/dL'), isTrue, reason: language.code);
    }
  });

  test(
    'critical doctor report and cloud sync labels follow every language',
    () async {
      await loadCoreTranslations();
      const keys = [
        'cloudSync',
        'cloudSyncEnable',
        'cloudSyncPush',
        'cloudSyncPull',
        'cloudSyncStatus',
        'cloudSyncReady',
        'cloudSyncUnavailable',
        'cloudSyncLastSync',
        'cloudSyncPrivacyNotice',
        'doctorReport',
        'doctorReportHistory',
        'doctorReportEmptyHistory',
        'saveReportToAccount',
        'reportSavedToServer',
        'summary',
        'profile',
        'diabetesType',
        'diabetesType1',
        'diabetesType2',
        'diabetesGestational',
        'targetGlucose',
        'carbRatio',
        'correctionFactor',
        'diaryAnalysis',
        'averageGlucose',
        'minimum',
        'maximum',
        'inRange',
        'low',
        'highValues',
        'records',
        'carbs',
        'activeInsulin',
        'copyReport',
        'reportCopied',
        'reportDisclaimer',
        'noData',
        'close',
        'diary',
        'sensors',
      ];
      const english = AppLocalizations('en');
      const hungarianMustDiffer = {
        'cloudSync',
        'cloudSyncEnable',
        'cloudSyncPush',
        'cloudSyncPull',
        'cloudSyncStatus',
        'cloudSyncPrivacyNotice',
        'doctorReport',
        'diabetesType',
        'diabetesType2',
        'targetGlucose',
        'carbRatio',
        'diaryAnalysis',
        'averageGlucose',
        'highValues',
        'copyReport',
        'reportDisclaimer',
      };

      for (final language in AppState.supportedLanguages) {
        final l10n = AppLocalizations(language.code);
        for (final key in keys) {
          final value = l10n.t(key);
          expect(value, isNot(key), reason: '${language.code}: $key');
          expect(value.trim(), isNotEmpty, reason: '${language.code}: $key');
          if (language.code == 'hu' && hungarianMustDiffer.contains(key)) {
            expect(
              value,
              isNot(english.t(key)),
              reason: 'hu: $key stayed English',
            );
          }
        }
      }
    },
  );

  test('doctor report generation uses selected language', () async {
    SharedPreferences.setMockInitialValues({});
    await initializeDateFormatting('hu');
    final state = AppState()..languageCode = 'hu';
    state.diabetesType = DiabetesType.type2;
    state.targetGlucose = 6.2;
    state.insulinToCarbRatio = 12;
    state.correctionFactor = 2;

    final entries = [
      DiaryEntry(
        time: DateTime(2026, 7, 9, 14, 30),
        glucoseMmol: 7.8,
        type: DiaryEntryType.afterMeal,
        carbs: 45,
        insulinUnits: 6,
        note: '',
      ),
    ];
    final analysis = const DiaryAnalysisService().analyze(entries);
    final report = const DoctorReportService().buildReport(
      appState: state,
      analysis: analysis,
      entries: entries,
    );

    expect(report, contains('Orvosi jelentés'));
    expect(report, contains('Cukorbetegség típusa'));
    expect(report, contains('2-es típusú cukorbetegség'));
    expect(report, contains('Átlagos glükóz'));
    expect(report, contains('Minimum'));
    expect(report, contains('Maximum'));
    expect(report, isNot(contains('Doctor report')));
    expect(report, isNot(contains('Diabetes type')));
    expect(report, isNot(contains('Type 2 diabetes')));
    expect(report, isNot(contains('- Min:')));
    expect(report, isNot(contains('- Max:')));
  });

  test('critical localization files do not use legacy ui.text keys', () {
    final files = [
      File('lib/screens/cloud_sync_screen.dart'),
      File('lib/screens/doctor_report_screen.dart'),
      File('lib/services/doctor_report_service.dart'),
    ];
    for (final file in files) {
      final source = file.readAsStringSync();
      expect(source.contains('ui.text.'), isFalse, reason: file.path);
      expect(source.contains('LocalizedText('), isFalse, reason: file.path);
      expect(
        source.contains('LocalizedSelectableText('),
        isFalse,
        reason: file.path,
      );
    }
  });

  test(
    'server snapshot does not overwrite locally selected language',
    () async {
      SharedPreferences.setMockInitialValues({'languageCode': 'pl'});
      final state = AppState();

      await state.applyServerSnapshot({
        'profile': {'languageCode': 'en'},
      });

      expect(state.languageCode, 'pl');
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('languageCode'), 'pl');
    },
  );
}
