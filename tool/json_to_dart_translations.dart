import 'dart:convert';
import 'dart:io';

String quote(String value) => jsonEncode(value).replaceAll(r'$', r'\$');

void main(List<String> args) {
  if (args.length != 2) {
    stderr.writeln(
        'Usage: json_to_dart_translations.dart input.json output.dart');
    exitCode = 64;
    return;
  }
  final decoded = jsonDecode(File(args[0]).readAsStringSync());
  final data = (decoded as Map).map(
    (key, value) => MapEntry(
      key.toString(),
      (value as Map).map(
        (innerKey, innerValue) =>
            MapEntry(innerKey.toString(), innerValue.toString()),
      ),
    ),
  );
  final output = StringBuffer(
    'const fullTranslations = <String, Map<String, String>>{\n',
  );
  for (final language in data.entries) {
    output.writeln('  ${quote(language.key)}: {');
    for (final entry in language.value.entries) {
      output.writeln('    ${quote(entry.key)}: ${quote(entry.value)},');
    }
    output.writeln('  },');
  }
  output.writeln('};');
  File(args[1]).writeAsStringSync(output.toString());
}
