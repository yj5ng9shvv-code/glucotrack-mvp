import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/app_localizations.dart';
import 'package:glucotrack/l10n/translation_loader.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('writes English source values for common fallback keys', () async {
    await loadCoreTranslations();
    final keys = (jsonDecode(
      File('reports/common-fallback-keys.json').readAsStringSync(),
    ) as List)
        .cast<String>();
    const english = AppLocalizations('en');
    final values = <String, String>{
      for (final key in keys) key: english.t(key),
    };
    File('reports/common-fallback-source.json')
      ..writeAsStringSync(const JsonEncoder.withIndent('  ').convert(values));
    expect(values.values.where((value) => value.trim().isEmpty), isEmpty);
  });
}
