import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:glucotrack/l10n/app_localizations.dart';
import 'package:glucotrack/l10n/premium_translations.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/screens/home_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const iphoneSe = Size(320, 568);
  const iphone13 = Size(390, 844);
  const iphoneProMax = Size(430, 932);
  const landscape = Size(844, 390);
  const textScales = <double>[1, 1.25, 1.5, 2];

  test('Russian trial ending translation has no hidden line breaks', () {
    final value = premiumTranslations['ru']!['trialEndsTomorrow']!;
    const hiddenRunes = [
      0x200B,
      0x200C,
      0x200D,
      0x2060,
      0xFEFF,
    ];

    expect(value, isNot(contains('\n')));
    expect(value, isNot(contains('\r')));
    expect(value, isNot(contains('\t')));
    expect(value, value.trim());
    for (final rune in hiddenRunes) {
      expect(value.runes, isNot(contains(rune)));
    }
  });

  for (final language in AppState.supportedLanguages) {
    for (final size in [iphoneSe, iphone13, iphoneProMax, landscape]) {
      for (final scale in textScales) {
        testWidgets(
          'Home trial banner lays out for ${language.code} at ${size.width}x${size.height} scale $scale',
          (tester) async {
            await tester.binding.setSurfaceSize(size);
            addTearDown(() => tester.binding.setSurfaceSize(null));

            final state = AppState();
            state.languageCode = language.code;
            state.updateServerSubscription(
              active: false,
              status: 'trialing',
              until: DateTime.now().add(const Duration(hours: 12)),
            );

            await tester.pumpWidget(
              ChangeNotifierProvider.value(
                value: state,
                child: MaterialApp(
                  locale: state.locale,
                  home: Builder(
                    builder: (context) {
                      final media = MediaQuery.of(context);
                      return MediaQuery(
                        data: media.copyWith(
                          textScaler: TextScaler.linear(scale),
                        ),
                        child: const HomeScreen(),
                      );
                    },
                  ),
                ),
              ),
            );
            await tester.pump();

            final title = AppLocalizations(language.code).t(
              'trialEndsTomorrow',
            );
            expect(find.text(title), findsOneWidget);

            final titleBox = tester.renderObject<RenderBox>(find.text(title));
            if (size.width < 520) {
              expect(titleBox.size.width, greaterThan(size.width - 120));
            }

            final exception = tester.takeException();
            expect(exception, isNull);
          },
        );
      }
    }
  }
}
