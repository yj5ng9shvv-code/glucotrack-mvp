import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../models/app_state.dart';
import 'auth_service.dart';

class AiDoctorService {
  AiDoctorService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  String get _baseUrl => AuthService.apiBaseUrl.replaceFirst(RegExp(r'/$'), '');

  Future<String> analyzeLabPhoto({
    required Uint8List imageBytes,
    required String mimeType,
    required AppState state,
  }) async {
    if (_baseUrl.isEmpty || !state.isAuthenticated) {
      throw const AiDoctorException('AUTH_REQUIRED');
    }

    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$_baseUrl/ai/lab-analysis'),
    )
      ..headers['Authorization'] = 'Bearer ${state.accountToken}'
      ..fields['language_code'] = state.languageCode
      ..files.add(
        http.MultipartFile.fromBytes(
          'image',
          imageBytes,
          filename: 'lab-result.${mimeType.contains('png') ? 'png' : 'jpg'}',
          contentType: MediaType.parse(mimeType),
        ),
      );

    final response = await http.Response.fromStream(
      await _client.send(request).timeout(const Duration(seconds: 60)),
    );
    return _readText(response);
  }

  Future<String> checkMedications({
    required String medications,
    required String context,
    required AppState state,
  }) async {
    if (_baseUrl.isEmpty || !state.isAuthenticated) {
      throw const AiDoctorException('AUTH_REQUIRED');
    }

    final response = await _client
        .post(
          Uri.parse('$_baseUrl/ai/medication-check'),
          headers: {
            'Authorization': 'Bearer ${state.accountToken}',
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: jsonEncode({
            'medications': medications,
            'context': context,
            'language_code': state.languageCode,
            'diabetes_type': state.diabetesType.name,
          }),
        )
        .timeout(const Duration(seconds: 45));
    return _readText(response);
  }

  String _readText(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw const AiDoctorException('NETWORK_ERROR');
    }
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));

    final text = decoded is Map ? decoded['text']?.toString().trim() : '';
    if (text == null || text.isEmpty) {
      throw const AiDoctorException('INVALID_RESPONSE');
    }
    return text;
  }

  void close() => _client.close();
}

class AiDoctorException implements Exception {
  const AiDoctorException(this.message);

  final String message;

  @override
  String toString() => message;
}
