import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/journal_translations.dart';

void main() {
  test('writes English source values for the journal module', () {
    final values = journalTranslations['en']!;
    File('reports/journal-fallback-source.json').writeAsStringSync(
      const JsonEncoder.withIndent('  ').convert(values),
    );
    expect(values, isNotEmpty);
  });
}
