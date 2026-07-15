import 'dart:convert';

import 'package:http/http.dart' as http;

import '../l10n/network_error_translations.dart';
import '../l10n/voice_assistant_translations.dart';
import '../models/app_state.dart';
import 'auth_service.dart';

class AiService {
  AiService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  bool get isRemoteConfigured => AuthService.apiBaseUrl.trim().isNotEmpty;

  void close() => _client.close();

  Future<String> sendMessage(
    String message, {
    required AppState appState,
  }) async {
    final question = message.trim();
    if (question.isEmpty) {
      return voiceAssistantTranslations[appState.languageCode]
              ?['voiceAnyQuestion'] ??
          voiceAssistantTranslations['en']!['voiceAnyQuestion']!;
    }

    if (!isRemoteConfigured) {
      return _networkError(appState.languageCode);
    }

    try {
      return await _sendBackend(question, appState);
    } on Exception {
      return _networkError(appState.languageCode);
    }
  }

  String _networkError(String languageCode) =>
      networkErrorTranslations[languageCode] ?? networkErrorTranslations['en']!;

  Future<String> _sendBackend(String question, AppState appState) async {
    if (!appState.isAuthenticated || appState.accountToken.isEmpty) {
      throw Exception('AUTH_REQUIRED');
    }
    final baseUrl = AuthService.apiBaseUrl.replaceFirst(RegExp(r'/$'), '');
    final response = await _client
        .post(
          Uri.parse('$baseUrl/ai/chat'),
          headers: {
            'Authorization': 'Bearer ${appState.accountToken}',
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: jsonEncode({
            'message': question,
            'language_code': appState.languageCode,
            'profile': {
              'diabetes_type': appState.diabetesType.name,
              'glucose': appState.formatGlucose(appState.glucoseMmol),
              'target_glucose': appState.formatGlucose(appState.targetGlucose),
              'carb_ratio': appState.insulinToCarbRatio,
              'correction_factor': appState.correctionFactor,
              'sensor_readings': appState.sensorReadings
                  .take(96)
                  .map((item) => {
                        'time': item.time.toIso8601String(),
                        'glucose_mmol': item.glucoseMmol,
                        'trend': item.trend.name,
                      })
                  .toList(),
              'diary_entries': appState.diaryEntries
                  .take(50)
                  .map((item) => {
                        'time': item.time.toIso8601String(),
                        'type': item.type.name,
                        'glucose_mmol': item.glucoseMmol,
                        'carbs': item.carbs,
                        'insulin_units': item.insulinUnits,
                        'title': item.title,
                        'note': item.note,
                      })
                  .toList(),
            },
          }),
        )
        .timeout(const Duration(seconds: 30));

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('NETWORK_ERROR');
    }
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    final text = decoded is Map ? decoded['text'] : null;
    if (text is! String || text.trim().isEmpty) {
      throw Exception('INVALID_RESPONSE');
    }
    return text.trim();
  }
}
