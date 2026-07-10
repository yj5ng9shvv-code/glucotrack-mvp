import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/ui_key_sources.dart';

void main() {
  test('LocalizedText static arguments are stable localization keys', () {
    final localizedTextCall = RegExp(
      r'''Localized(?:Selectable)?Text\(\s*['"]([^'"]+)['"]''',
      multiLine: true,
    );
    final stableKey = RegExp(r'''^(?:[a-z][a-zA-Z0-9_]*\.)+[a-zA-Z0-9_]+$''');
    final violations = <String>[];
    for (final entity in Directory('lib').listSync(recursive: true)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      if (entity.path.endsWith('localized_text.dart')) continue;
      for (final match
          in localizedTextCall.allMatches(entity.readAsStringSync())) {
        final key = match.group(1)!;
        if (!stableKey.hasMatch(key)) {
          violations.add('${entity.path}: $key');
        }
      }
    }
    expect(violations, isEmpty, reason: violations.join('\n'));
  });

  test('migrated keys are unique and have non-empty source phrases', () {
    expect(uiKeySources, isNotEmpty);
    expect(uiKeySources.keys.toSet(), hasLength(uiKeySources.length));
    for (final entry in uiKeySources.entries) {
      expect(entry.key, startsWith('ui.text.'));
      expect(entry.value.trim(), isNotEmpty, reason: entry.key);
    }
  });
}
