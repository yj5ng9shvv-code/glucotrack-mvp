import 'dart:convert';

import 'package:flutter/services.dart';

Map<String, Map<String, Map<String, String>>> coreTranslationGroups = {};
Map<String, String> networkErrorTranslations = {};
Map<String, String> uiKeySources = {};

Future<void> loadCoreTranslations() async {
  final source =
      jsonDecode(await rootBundle.loadString('assets/translations/core.json'))
          as Map<String, dynamic>;

  coreTranslationGroups = {
    for (final entry in source.entries)
      if (entry.value is Map &&
          entry.key != 'networkError' &&
          entry.key != 'uiKeySources')
        entry.key: _decode(entry.value),
  };
  networkErrorTranslations = Map<String, String>.from(
    source['networkError'] as Map,
  );
  uiKeySources = Map<String, String>.from(source['uiKeySources'] as Map);
}

String? coreTranslation(
  String languageCode,
  String key,
  List<String> groups, {
  String fallback = 'en',
}) {
  for (final groupName in groups) {
    final group = coreTranslationGroups[groupName];
    final value = group?[languageCode]?[key] ?? group?[fallback]?[key];
    if (value != null) return value;
  }
  return null;
}

Map<String, Map<String, String>> coreGroup(String name) {
  return coreTranslationGroups[name] ?? const {};
}

Map<String, Map<String, String>> _decode(Object? value) {
  final outer = value as Map<String, dynamic>;
  return outer.map(
    (language, translations) =>
        MapEntry(language, Map<String, String>.from(translations as Map)),
  );
}
