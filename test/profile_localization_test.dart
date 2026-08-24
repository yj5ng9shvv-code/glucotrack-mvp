import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:glucotrack/l10n/translation_loader.dart';
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

  testWidgets('Profile renders keyed labels for all 30 locales', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1280, 2200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    for (final language in AppState.supportedLanguages) {
      SharedPreferences.setMockInitialValues({
        'languageCode': language.code,
        'onboardingCompleted': true,
      });
      final state = AppState()
        ..languageCode = language.code
        ..onboardingCompleted = true
        ..premium = true;

      await tester.pumpWidget(_ProfileHarness(state: state));
      await tester.pumpAndSettle();

      final texts = _textData(tester);
      expect(texts, isNotEmpty, reason: language.code);
      expect(
        texts.where((value) => value.startsWith('ui.text.')).toList(),
        isEmpty,
        reason: '${language.code}: unresolved legacy key',
      );
      expect(
        texts.where((value) => RegExp(r'^profile\.').hasMatch(value)).toList(),
        isEmpty,
        reason: '${language.code}: unresolved profile key',
      );
    }
  });

  testWidgets(
    'Romanian Profile does not show old English or Russian fallbacks',
    (tester) async {
      SharedPreferences.setMockInitialValues({
        'languageCode': 'ro',
        'onboardingCompleted': true,
      });
      await tester.binding.setSurfaceSize(const Size(1280, 2200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final state = AppState()
        ..languageCode = 'ro'
        ..onboardingCompleted = true
        ..premium = true;
      await tester.pumpWidget(_ProfileHarness(state: state));
      await tester.pumpAndSettle();

      final joined = _textData(tester).join('\n');
      const forbidden = [
        'Language',
        'App language',
        'Selected: Română. The interface updates instantly.',
        'SOS-профиль',
        'Медицинская информация и экстренный контакт',
        'Экстренная карточка',
        'Просмотр данных для экрана блокировки',
        'Save settings',
        'Выйти из аккаунта',
        'Profile data and photo are stored locally',
      ];
      for (final text in forbidden) {
        expect(joined.contains(text), isFalse, reason: text);
      }
      expect(joined.contains('Limba aplicatiei'), isTrue);
      expect(joined.contains('Salveaza setarile'), isTrue);
    },
  );

  testWidgets('Profile reacts to language change without restart', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({
      'languageCode': 'en',
      'onboardingCompleted': true,
    });
    await tester.binding.setSurfaceSize(const Size(1280, 2200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final state = AppState()
      ..languageCode = 'en'
      ..onboardingCompleted = true
      ..premium = true;
    await tester.pumpWidget(_ProfileHarness(state: state));
    await tester.pumpAndSettle();

    expect(_textData(tester).join('\n').contains('App language'), isTrue);

    await state.setLanguage('ro');
    await tester.pumpAndSettle();

    final joined = _textData(tester).join('\n');
    expect(joined.contains('Limba aplicatiei'), isTrue);
    expect(joined.contains('App language'), isFalse);
    expect(joined.contains('Save settings'), isFalse);
  });
}

class _ProfileHarness extends StatelessWidget {
  final AppState state;

  const _ProfileHarness({required this.state});

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
        home: const ProfileScreen(),
      ),
    );
  }
}

List<String> _textData(WidgetTester tester) {
  return tester
      .widgetList<Text>(find.byType(Text))
      .map((widget) => widget.data)
      .whereType<String>()
      .toList();
}
