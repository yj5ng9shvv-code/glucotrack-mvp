import 'dart:convert';
import 'dart:io';

String quote(String value) => jsonEncode(value).replaceAll(r'$', r'\$');

void main(List<String> args) {
  if (args.length != 2) {
    stderr.writeln(
        'Usage: json_to_dart_literal_translations.dart input.json output.dart');
    exitCode = 64;
    return;
  }
  final decoded = jsonDecode(File(args[0]).readAsStringSync()) as Map;
  final output = StringBuffer(
    'const literalTranslations = <String, Map<String, String>>{\n',
  );
  for (final language in decoded.entries) {
    output.writeln('  ${quote(language.key.toString())}: {');
    final values = (language.value as Map).map(
      (key, value) => MapEntry(key.toString(), value.toString()),
    );
    for (final entry in values.entries) {
      output.writeln('    ${quote(entry.key)}: ${quote(entry.value)},');
    }
    output.writeln('  },');
  }
  output.writeln('};');
  File(args[1]).writeAsStringSync(output.toString());
}
