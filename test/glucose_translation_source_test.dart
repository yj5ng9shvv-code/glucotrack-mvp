import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/app_localizations.dart';
import 'package:glucotrack/l10n/translation_loader.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('writes English source values for glucose fallback keys', () async {
    await loadCoreTranslations();
    final keys = (jsonDecode(File('reports/glucose-fallback-keys.json').readAsStringSync()) as List).cast<String>();
    const english = AppLocalizations('en');
    File('reports/glucose-fallback-source.json').writeAsStringSync(const JsonEncoder.withIndent('  ').convert({for (final key in keys) key: english.t(key)}));
    expect(keys, isNotEmpty);
  });
}
