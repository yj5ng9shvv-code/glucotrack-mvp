import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:glucotrack/l10n/app_localizations.dart';
import 'package:glucotrack/l10n/translation_loader.dart';
import 'package:glucotrack/main.dart' show AppPageWithFooter;
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/screens/emergency_card_screen.dart';
import 'package:glucotrack/screens/emergency_profile_screen.dart';
import 'package:glucotrack/screens/home_screen.dart';
import 'package:glucotrack/screens/profile_screen.dart';
import 'package:glucotrack/screens/sensors_screen.dart';
import 'package:glucotrack/screens/subscription_screen.dart';
import 'package:glucotrack/screens/voice_assistant_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(loadCoreTranslations);

  test('Patient Card and SOS Profile keys resolve for all 30 locales',
      () async {
    await loadCoreTranslations();
    const keys = [
      'patientCard.title',
      'patientCard.publicNotice',
      'patientCard.medicalInformation',
      'patientCard.bloodType',
      'patientCard.treatment',
      'patientCard.insulin',
      'patientCard.diagnoses',
      'patientCard.medications',
      'patientCard.languages',
      'patientCard.contacts',
      'patientCard.name',
      'patientCard.phone',
      'patientCard.otherRelatives',
      'patientCard.doctorClinic',
      'patientCard.emergencyInstruction',
      'patientCard.privacy',
      'patientCard.hideSensitiveData',
      'patientCard.pinNotice',
      'patientCard.relativeDoctorPin',
      'patientCard.mode',
      'patientCard.enableMonitoring',
      'patientCard.autoCallDelay',
      'patientCard.openCardQr',
      'patientCard.fullAccess',
      'patientCard.cancel',
      'patientCard.open',
      'patientCard.pin',
      'patientCard.sendSmsQuestion',
      'patientCard.smsLocationConfirm',
      'patientCard.createSms',
      'patientCard.sendSmsLocation',
      'patientCard.patient',
      'patientCard.years',
      'patientCard.diabetes',
      'patientCard.diabetesType1',
      'patientCard.diabetesType2',
      'patientCard.diabetesGestational',
      'patientCard.currentGlucose',
      'patientCard.lastUpdated',
      'patientCard.noData',
      'patientCard.allergies',
      'patientCard.allergyStatus',
      'patientCard.allergyDetails',
      'patientCard.yes',
      'patientCard.no',
      'patientCard.sensitiveHidden',
      'patientCard.call112',
      'patientCard.callRelative',
      'patientCard.createPublicQr',
      'patientCard.updatePublicCard',
      'patientCard.printablePdf',
      'patientCard.settingsSaved',
      'patientCard.networkUnavailable',
      'patientCard.language',
      'patientCard.showOnLockScreen',
      'patientCard.prepareSms',
      'patientCard.addLocation',
      'patientCard.autoCallLovedOne',
      'patientCard.saveSosProfile',
      'patientCard.saving',
      'patientCard.pinHint',
      'patientCard.criticalThreshold',
      'navigation.home',
      'navigation.askAi',
      'navigation.profile',
      'sosPublicCard.callEmergency',
      'sosPublicCard.callEmergencyWithNumber',
      'sosPublicCard.callRelative',
      'sosPublicCard.callRelativeWithName',
      'sosPublicCard.sendSosSmsWithLocation',
      'sosPublicCard.refreshPublicCard',
      'sosPublicCard.printablePdfCard',
    ];

    for (final language in AppState.supportedLanguages) {
      final l10n = AppLocalizations(language.code);
      for (final key in keys) {
        final value = l10n.t(key).trim();
        expect(value, isNotEmpty, reason: '${language.code}: $key');
        expect(value, isNot(key), reason: '${language.code}: $key');
        expect(value.contains('ui.text.'), isFalse,
            reason: '${language.code}: $key');
      }
    }
  });

  test('Patient Card screens do not use legacy localization sources', () {
    final screenSources = [
      File('lib/screens/emergency_profile_screen.dart').readAsStringSync(),
      File('lib/screens/emergency_card_screen.dart').readAsStringSync(),
    ].join('\n');
    final publicServiceSource =
        File('lib/services/sos_public_service.dart').readAsStringSync();

    for (final forbidden in [
      'LocalizedText',
      'emergencyProfileText',
      'sosText(',
      "l10n.t('settingsSaved')",
      "l10n.t('networkUnavailable')",
      "l10n.t('phone')",
      "l10n.t('language')",
      "l10n.t('currentGlucose')",
      "l10n.t('patientCard.call112')",
      "l10n.t('patientCard.callRelative')",
      "l10n.t('patientCard.updatePublicCard')",
      "l10n.t('patientCard.printablePdf')",
      "l10n.t('sos.call_112')",
      "l10n.t('sos.call_relative')",
      'l10n.literal(',
      '? emergencyInstructionText(state.languageCode)',
    ]) {
      expect(screenSources.contains(forbidden), isFalse, reason: forbidden);
    }
    expect(publicServiceSource.contains("l10n.t('sos.call_112')"), isFalse);
    expect(
      publicServiceSource.contains("l10n.t('sos.call_relative')"),
      isFalse,
    );
  });

  testWidgets('SOS Profile and Patient Card render for all 30 locales',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(1280, 2200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    for (final language in AppState.supportedLanguages) {
      SharedPreferences.setMockInitialValues({
        'languageCode': language.code,
        'onboardingCompleted': true,
        'hideSensitiveSosData': false,
      });
      final state = AppState()
        ..languageCode = language.code
        ..onboardingCompleted = true
        ..premium = true
        ..fullName = 'Alex Patient'
        ..emergencyContactName = 'Maria'
        ..emergencyContactPhone = '+100000000'
        ..hasAllergies = true
        ..allergies = 'Peanuts'
        ..importantDiagnoses = 'Hypertension'
        ..medications = 'Metformin'
        ..insulinName = 'Lispro'
        ..bloodType = 'A+'
        ..communicationLanguages = 'English'
        ..hideSensitiveSosData = false;

      await tester.pumpWidget(
        _Harness(state: state, child: const EmergencyProfileScreen()),
      );
      await tester.pumpAndSettle();
      _expectNoRawPatientCardText(tester, '${language.code}/profile');

      await tester.pumpWidget(
        _Harness(state: state, child: const EmergencyCardScreen()),
      );
      await tester.pumpAndSettle();
      _expectNoRawPatientCardText(tester, '${language.code}/card');
    }
  });

  testWidgets('Patient Card reacts to language change without restart',
      (tester) async {
    SharedPreferences.setMockInitialValues({
      'languageCode': 'en',
      'onboardingCompleted': true,
      'hideSensitiveSosData': false,
    });
    await tester.binding.setSurfaceSize(const Size(1280, 2200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final state = AppState()
      ..languageCode = 'en'
      ..onboardingCompleted = true
      ..premium = true
      ..hideSensitiveSosData = false;

    await tester.pumpWidget(
      _Harness(state: state, child: const EmergencyProfileScreen()),
    );
    await tester.pumpAndSettle();
    expect(_texts(tester).join('\n').contains('Show on lock screen'), isTrue);

    await state.setLanguage('ro');
    await tester.pumpAndSettle();

    final joined = _texts(tester).join('\n');
    expect(joined.contains('Afiseaza pe ecranul blocat'), isTrue);
    expect(joined.contains('Show on lock screen'), isFalse);
  });

  testWidgets('SOS Profile has no Russian system labels outside Russian',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(1280, 2600));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    const forbiddenRussianSystemLabels = [
      'Лечение',
      'Диагнозы',
      'Языки',
      'Контакты',
      'Имя',
      'Другие близкие',
      'Врач / клиника',
      'Экстренная инструкция',
      'Приватность публичной страницы',
      'PIN родственника или врача',
      'SOS-режим',
    ];

    for (final language in AppState.supportedLanguages) {
      if (language.code == 'ru') continue;
      SharedPreferences.setMockInitialValues({
        'languageCode': language.code,
        'onboardingCompleted': true,
        'hideSensitiveSosData': false,
      });
      final state = AppState()
        ..languageCode = language.code
        ..onboardingCompleted = true
        ..premium = true
        ..hideSensitiveSosData = false
        ..importantDiagnoses = 'Гипертония 2ст'
        ..medications = 'Сиофор'
        ..communicationLanguages = 'русский';

      await tester.pumpWidget(
        _Harness(
          state: state,
          child: const AppPageWithFooter(
            selectedIndex: 2,
            child: EmergencyProfileScreen(),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 100));

      final systemStrings = _systemLabelsAndHints(tester);
      for (final forbidden in forbiddenRussianSystemLabels) {
        expect(
          systemStrings.contains(forbidden),
          isFalse,
          reason: '${language.code}: $forbidden in $systemStrings',
        );
      }

      if (language.code != 'en') {
        final allText = _texts(tester).join('\n');
        expect(allText.contains('Home'), isFalse, reason: language.code);
        expect(allText.contains('Ask AI'), isFalse, reason: language.code);
        expect(allText.contains('Profile'), isFalse, reason: language.code);
      }
    }
  });

  testWidgets('Public SOS card action labels are localized for all 30 locales',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(1280, 2600));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    const forbiddenRussianSystemLabels = [
      'Вызвать',
      'Позвонить близкому',
      'Обновить публичную карточку',
      'PDF-карта для печати',
    ];

    for (final language in AppState.supportedLanguages) {
      SharedPreferences.setMockInitialValues({
        'languageCode': language.code,
        'onboardingCompleted': true,
        'hideSensitiveSosData': false,
        'sosPublicToken': 'token-${language.code}',
      });
      final state = AppState()
        ..languageCode = language.code
        ..onboardingCompleted = true
        ..premium = true
        ..hideSensitiveSosData = false
        ..sosPublicToken = 'token-${language.code}'
        ..emergencyContactName = 'Вадим'
        ..emergencyContactPhone = '+100000000'
        ..insulinName = 'Lispro'
        ..medications = 'Сиофор';

      await tester.pumpWidget(
        _Harness(state: state, child: const EmergencyCardScreen()),
      );
      await tester.pump(const Duration(milliseconds: 100));

      final l10n = AppLocalizations(language.code);
      expect(
        _texts(tester),
        contains(l10n.format(
          'sosPublicCard.callEmergencyWithNumber',
          {'number': '112'},
        )),
        reason: language.code,
      );
      expect(
        _texts(tester),
        contains(l10n.format(
          'sosPublicCard.callRelativeWithName',
          {'name': 'Вадим'},
        )),
        reason: language.code,
      );
      expect(
        _texts(tester),
        contains(l10n.t('sosPublicCard.refreshPublicCard')),
        reason: language.code,
      );
      expect(
        _texts(tester),
        contains(l10n.t('sosPublicCard.printablePdfCard')),
        reason: language.code,
      );

      if (language.code != 'ru') {
        final allText = _texts(tester).join('\n');
        for (final forbidden in forbiddenRussianSystemLabels) {
          expect(allText.contains(forbidden), isFalse,
              reason: '${language.code}: $forbidden in $allText');
        }
      }
    }
  });
}

class _Harness extends StatelessWidget {
  final AppState state;
  final Widget child;

  const _Harness({required this.state, required this.child});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<AppState>.value(
      value: state,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        locale: state.locale,
        supportedLocales:
            AppState.supportedLanguages.map((language) => language.locale),
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        routes: {
          '/subscription': (_) => const SubscriptionScreen(),
          '/emergency-profile': (_) => const EmergencyProfileScreen(),
          '/emergency-card': (_) => const EmergencyCardScreen(),
          '/sensors': (_) => const SensorsScreen(),
          '/profile': (_) => const ProfileScreen(),
          '/home': (_) => const HomeScreen(),
          '/voice-assistant': (_) => const VoiceAssistantScreen(),
        },
        home: child,
      ),
    );
  }
}

void _expectNoRawPatientCardText(WidgetTester tester, String reason) {
  final raw = _texts(tester)
      .where((value) =>
          value.startsWith('ui.text.') || value.startsWith('patientCard.'))
      .toList();
  expect(raw, isEmpty, reason: '$reason unresolved: $raw');
}

List<String> _texts(WidgetTester tester) {
  return tester
      .widgetList<Text>(find.byType(Text))
      .map((widget) => widget.data)
      .whereType<String>()
      .toList();
}

List<String> _systemLabelsAndHints(WidgetTester tester) {
  final values = <String>[
    ..._texts(tester),
  ];
  for (final field in tester.widgetList<TextField>(find.byType(TextField))) {
    final decoration = field.decoration;
    final label = decoration?.labelText;
    final hint = decoration?.hintText;
    if (label != null) values.add(label);
    if (hint != null) values.add(hint);
  }
  return values;
}
