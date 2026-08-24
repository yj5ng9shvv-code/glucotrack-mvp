import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/widgets/global_language_switcher.dart';

void main() {
  Future<void> pumpSwitcher(WidgetTester tester, AppState state) async {
    await tester.pumpWidget(
      ChangeNotifierProvider<AppState>.value(
        value: state,
        child: const MaterialApp(
          home: Scaffold(
            body: Align(
              alignment: Alignment.topRight,
              child: GlobalLanguageSwitcher(),
            ),
          ),
        ),
      ),
    );
  }

  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  test(
      'keeps the configured Russian, English, Polish, German and French locales',
      () async {
    final state = AppState();
    for (final language in const ['ru', 'en', 'pl', 'de', 'fr']) {
      await state.setLanguage(language);
      expect(state.languageCode, language);
    }
  });

  testWidgets('uses a language name without locale code or country',
      (tester) async {
    final state = AppState();
    await state.setLanguage('ru');
    await pumpSwitcher(tester, state);

    expect(find.text('Русский'), findsOneWidget);
    expect(find.text('RU Русский'), findsNothing);
    expect(find.textContaining('Россия'), findsNothing);
    expect(find.byIcon(Icons.language_rounded), findsOneWidget);
  });

  testWidgets('reflects a globally persisted language choice', (tester) async {
    final state = AppState();
    await pumpSwitcher(tester, state);

    await tester.tap(find.byType(GlobalLanguageSwitcher));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Polski'), findsWidgets);
    expect(find.byIcon(Icons.check_rounded), findsOneWidget);

    await state.setLanguage('pl');
    await tester.pump(const Duration(milliseconds: 300));

    expect(state.languageCode, 'pl');
    expect(find.text('Polski'), findsWidgets);
  });

  testWidgets('uses compact responsive header dimensions', (tester) async {
    final state = AppState();
    final view = tester.view;
    addTearDown(view.resetPhysicalSize);
    addTearDown(view.resetDevicePixelRatio);

    await pumpSwitcher(tester, state);
    var size = tester.getSize(find.byType(PopupMenuButton<String>));
    expect(size, const Size(140, 32));

    view.physicalSize = const Size(390, 844);
    view.devicePixelRatio = 1;
    await tester.pumpWidget(const SizedBox.shrink());
    await pumpSwitcher(tester, state);
    size = tester.getSize(find.byType(PopupMenuButton<String>));
    expect(size, const Size(130, 30));

    view.physicalSize = const Size(1200, 800);
    await tester.pumpWidget(const SizedBox.shrink());
    await pumpSwitcher(tester, state);
    size = tester.getSize(find.byType(PopupMenuButton<String>));
    expect(size, const Size(160, 34));
  });
}
