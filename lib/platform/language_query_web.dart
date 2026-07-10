import 'package:web/web.dart' as web;

String? requestedLanguageCode() {
  final search = web.window.location.search;
  if (search.isNotEmpty) {
    final queryLanguage = Uri.splitQueryString(search.substring(1))['lang'];
    if (queryLanguage != null && queryLanguage.trim().isNotEmpty) {
      return queryLanguage;
    }
  }
  final storedLanguage = web.window.localStorage.getItem('glucotrack-language');
  return storedLanguage?.trim().isEmpty ?? true ? null : storedLanguage;
}

void updateRequestedLanguageCode(String value) {
  final current = Uri.parse(web.window.location.href);
  final parameters = Map<String, String>.from(current.queryParameters);
  parameters['lang'] = value;
  final updated = current.replace(queryParameters: parameters);
  web.window.history.replaceState(null, '', updated.toString());
  web.window.localStorage.setItem('glucotrack-language', value);
}
