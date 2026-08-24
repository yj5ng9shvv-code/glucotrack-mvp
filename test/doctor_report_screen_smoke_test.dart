import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:glucotrack/l10n/translation_loader.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/screens/doctor_report_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('REPORT-001 opens safely with a clean local store in Russian', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await loadCoreTranslations();
    final state = AppState();
    await state.load();

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: state,
        child: const MaterialApp(
          locale: Locale('ru'),
          localizationsDelegates: [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: DoctorReportScreen(),
        ),
      ),
    );
    // Do not wait for unrelated framework timers; this test only verifies
    // the first report frame and its immediate asynchronous period restore.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(tester.takeException(), isNull);
    expect(find.byType(DoctorReportScreen), findsOneWidget);
  });
}
