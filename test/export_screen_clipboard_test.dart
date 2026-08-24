import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/translation_loader.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/screens/export_screen.dart';
import 'package:provider/provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(loadCoreTranslations);

  testWidgets('copies CSV and HTML without rendering either export', (
    tester,
  ) async {
    final clipboardValues = <String>[];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') {
        clipboardValues.add((call.arguments as Map)['text'] as String);
      }
      return null;
    });
    addTearDown(
      () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null),
    );

    await tester.pumpWidget(_ExportHarness(state: AppState()));
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.copy));
    await tester.pump();
    expect(clipboardValues.single, startsWith('"time","type"'));
    expect(find.textContaining('"time","type"'), findsNothing);
    expect(find.byType(SelectableText), findsOneWidget);
    expect(find.byIcon(Icons.check_circle), findsOneWidget);

    await tester.tap(find.byIcon(Icons.picture_as_pdf));
    await tester.pump();
    expect(clipboardValues.last, startsWith('<!doctype html>'));
    expect(find.textContaining('<!doctype html>'), findsNothing);
  });

  testWidgets('repeated CSV exports leave no export widget in the tree', (
    tester,
  ) async {
    var clipboardCalls = 0;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') clipboardCalls++;
      return null;
    });
    addTearDown(
      () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null),
    );

    await tester.pumpWidget(_ExportHarness(state: AppState()));
    await tester.pumpAndSettle();
    final copyCsv = find.byIcon(Icons.copy);
    for (var index = 0; index < 100; index++) {
      await tester.tap(copyCsv);
      await tester.pump();
    }

    expect(clipboardCalls, 100);
    expect(find.textContaining('"time","type"'), findsNothing);
    expect(find.byType(SelectableText), findsOneWidget);
  });
}

class _ExportHarness extends StatelessWidget {
  const _ExportHarness({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<AppState>.value(
      value: state,
      child: MaterialApp(
        locale: state.locale,
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const ExportScreen(),
      ),
    );
  }
}
