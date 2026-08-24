import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/services/csv_export_sanitizer.dart';

void main() {
  test('neutralizes spreadsheet formula prefixes including leading whitespace', () {
    for (final value in ['=1+1', '+SUM(A1)', '-10+5', '@cmd', '  =HYPERLINK()']) {
      final escaped = escapeCsvCell(value);
      expect(escaped, startsWith('"\''));
      expect(escaped, endsWith('"'));
    }
  });

  test('keeps ordinary UTF-8 text and quotes valid CSV fields', () {
    expect(escapeCsvCell('Привет, Łódź'), '"Привет, Łódź"');
    expect(escapeCsvCell('say "hello"'), '"say ""hello"""');
  });
}
