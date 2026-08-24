import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:glucotrack/l10n/translation_loader.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/screens/ai_assistant_screen.dart';
import 'package:glucotrack/screens/ai_doctor_screen.dart';
import 'package:glucotrack/screens/auth_screen.dart';
import 'package:glucotrack/screens/calculator_screen.dart';
import 'package:glucotrack/screens/cloud_sync_screen.dart';
import 'package:glucotrack/screens/diary_analysis_screen.dart';
import 'package:glucotrack/screens/diary_screen.dart';
import 'package:glucotrack/screens/doctor_report_screen.dart';
import 'package:glucotrack/screens/emergency_card_screen.dart';
import 'package:glucotrack/screens/emergency_profile_screen.dart';
import 'package:glucotrack/screens/emergency_screen.dart';
import 'package:glucotrack/screens/export_screen.dart';
import 'package:glucotrack/screens/family_access_screen.dart';
import 'package:glucotrack/screens/food_catalog_screen.dart';
import 'package:glucotrack/screens/home_screen.dart';
import 'package:glucotrack/screens/onboarding_screen.dart';
import 'package:glucotrack/screens/profile_screen.dart';
import 'package:glucotrack/screens/sensors_screen.dart';
import 'package:glucotrack/screens/sos_screen.dart';
import 'package:glucotrack/screens/subscription_screen.dart';
import 'package:glucotrack/screens/trends_screen.dart';
import 'package:glucotrack/screens/voice_assistant_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const runtimeScreens = <_RuntimeScreen>[
    _RuntimeScreen('auth', AuthScreen()),
    _RuntimeScreen('onboarding', OnboardingScreen()),
    _RuntimeScreen('home', HomeScreen()),
    _RuntimeScreen('profile', ProfileScreen()),
    _RuntimeScreen('diary', DiaryScreen()),
    _RuntimeScreen('trends', TrendsScreen()),
    _RuntimeScreen('export', ExportScreen()),
    _RuntimeScreen('calculator', CalculatorScreen()),
    _RuntimeScreen('catalog', FoodCatalogScreen()),
    _RuntimeScreen('diary-analysis', DiaryAnalysisScreen()),
    _RuntimeScreen('doctor-report', DoctorReportScreen()),
    _RuntimeScreen('cloud-sync', CloudSyncScreen()),
    _RuntimeScreen('sensors', SensorsScreen()),
    _RuntimeScreen('subscription', SubscriptionScreen()),
    _RuntimeScreen('family-access', FamilyAccessScreen()),
    _RuntimeScreen('ai-assistant', AiAssistantScreen()),
    _RuntimeScreen('ai-doctor', AiDoctorScreen()),
    _RuntimeScreen('voice-assistant', VoiceAssistantScreen()),
    _RuntimeScreen('sos', SosScreen()),
    _RuntimeScreen('emergency', EmergencyScreen()),
    _RuntimeScreen('emergency-profile', EmergencyProfileScreen()),
    _RuntimeScreen('emergency-card', EmergencyCardScreen()),
  ];

  setUpAll(loadCoreTranslations);

  for (final language in AppState.supportedLanguages) {
    testWidgets(
      'runtime localization renders core routes for ${language.code}',
      (tester) async {
        SharedPreferences.setMockInitialValues({
          'languageCode': language.code,
          'onboardingCompleted': true,
          'sosEnabled': true,
          'showEmergencyOnLockScreen': true,
        });
        await tester.binding.setSurfaceSize(const Size(1280, 1600));
        addTearDown(() => tester.binding.setSurfaceSize(null));

        for (final screen in runtimeScreens) {
          final state = AppState()
            ..languageCode = language.code
            ..onboardingCompleted = true
            ..premium = true;
          await tester.pumpWidget(
            _RuntimeHarness(state: state, child: screen.child),
          );
          await tester.pump();
          await tester.pump(const Duration(milliseconds: 50));

          final exception = tester.takeException();
          expect(
            exception,
            isNull,
            reason: '${language.code}/${screen.name} threw $exception',
          );
          _expectNoMissingLocalizationText(
            tester,
            reason: '${language.code}/${screen.name}',
          );
        }
      },
    );
  }
}

class _RuntimeScreen {
  final String name;
  final Widget child;

  const _RuntimeScreen(this.name, this.child);
}

class _RuntimeHarness extends StatelessWidget {
  final AppState state;
  final Widget child;

  const _RuntimeHarness({required this.state, required this.child});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<AppState>.value(
      value: state,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        locale: state.locale,
        supportedLocales: AppState.supportedLanguages.map(
          (language) => language.locale,
        ),
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

void _expectNoMissingLocalizationText(
  WidgetTester tester, {
  required String reason,
}) {
  final visibleTexts = tester
      .widgetList<Text>(find.byType(Text))
      .map((widget) => widget.data)
      .whereType<String>()
      .toList();

  final unresolved = visibleTexts
      .where(
        (value) =>
            value.startsWith('ui.text.') ||
            RegExp(
              r'^(?:sos|family|voice|premium|cloud|doctor|ai)[A-Za-z0-9_.-]+$',
            ).hasMatch(value),
      )
      .toList();
  expect(unresolved, isEmpty, reason: '$reason unresolved: $unresolved');
}
