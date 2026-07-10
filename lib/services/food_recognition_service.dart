import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../models/app_state.dart';
import '../models/food_recognition_result.dart';
import 'auth_service.dart';

class FoodRecognitionService {
  FoodRecognitionService({http.Client? client})
      : _client = client ?? http.Client();

  static const _backendEndpoint =
      String.fromEnvironment('FOOD_RECOGNITION_ENDPOINT');

  final http.Client _client;

  String get backendEndpoint {
    if (_backendEndpoint.trim().isNotEmpty) return _backendEndpoint.trim();
    final baseUrl = AuthService.apiBaseUrl.replaceFirst(RegExp(r'/$'), '');
    return baseUrl.isEmpty ? '' : '$baseUrl/ai/recognize-food';
  }

  bool get hasBackend => backendEndpoint.isNotEmpty;
  bool get isConfigured => hasBackend;

  void close() {
    _client.close();
  }

  Future<FoodRecognitionResult> recognizeFood({
    required Uint8List imageBytes,
    required String mimeType,
    required AppState appState,
  }) async {
    if (imageBytes.isEmpty) {
      throw const FoodRecognitionException(
        'Photo is empty. Choose the image again.',
      );
    }

    if (hasBackend) {
      return _recognizeViaBackend(
        imageBytes: imageBytes,
        mimeType: mimeType,
        appState: appState,
      );
    }

    throw const FoodRecognitionException(
      'AI food recognition backend is not configured.',
    );
  }

  Future<FoodRecognitionResult> _recognizeViaBackend({
    required Uint8List imageBytes,
    required String mimeType,
    required AppState appState,
  }) async {
    if (!appState.isAuthenticated || appState.accountToken.isEmpty) {
      throw const FoodRecognitionException(
        'Sign in to use AI food recognition.',
      );
    }
    final uri = Uri.parse(backendEndpoint);
    final request = http.MultipartRequest('POST', uri)
      ..headers['Authorization'] = 'Bearer ${appState.accountToken}'
      ..fields['language_code'] = appState.languageCode
      ..fields['glucose_unit'] = appState.glucoseUnitLabel
      ..fields['glucose_mmol'] = appState.glucoseMmol.toStringAsFixed(1)
      ..fields['target_glucose'] = appState.targetGlucose.toStringAsFixed(1)
      ..fields['insulin_to_carb_ratio'] =
          appState.insulinToCarbRatio.toStringAsFixed(1)
      ..fields['correction_factor'] =
          appState.correctionFactor.toStringAsFixed(1)
      ..files.add(
        http.MultipartFile.fromBytes(
          'image',
          imageBytes,
          filename: 'meal.${_extensionForMime(mimeType)}',
          contentType: MediaType.parse(mimeType),
        ),
      );

    final streamedResponse =
        await _client.send(request).timeout(const Duration(seconds: 45));
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw FoodRecognitionException(
        'Food recognition backend returned error ${response.statusCode}.',
      );
    }

    final decoded = _decodeJson(response.bodyBytes);
    final payload = decoded['data'] is Map<String, dynamic>
        ? decoded['data'] as Map<String, dynamic>
        : decoded;
    return FoodRecognitionResult.fromJson(payload, remote: true);
  }

  Map<String, dynamic> _decodeJson(List<int> bodyBytes) {
    final decoded = jsonDecode(utf8.decode(bodyBytes));
    if (decoded is! Map<String, dynamic>) {
      throw const FoodRecognitionException(
        'Service returned an unexpected response format.',
      );
    }
    return decoded;
  }

  String _extensionForMime(String mimeType) {
    return switch (mimeType) {
      'image/png' => 'png',
      'image/webp' => 'webp',
      _ => 'jpg',
    };
  }
}

class FoodRecognitionException implements Exception {
  final String message;

  const FoodRecognitionException(this.message);

  @override
  String toString() => message;
}
