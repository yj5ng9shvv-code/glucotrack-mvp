import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/services/auth_service.dart';
import 'package:glucotrack/services/food_recognition_service.dart';

void main() {
  test('client food recognition does not contain direct OpenAI key fallback',
      () {
    final source =
        File('lib/services/food_recognition_service.dart').readAsStringSync();

    expect(source, isNot(contains('OPENAI_API_KEY')));
    expect(source, isNot(contains('OPENAI_BASE_URL')));
    expect(source, isNot(contains('api.openai.com')));
    expect(source, isNot(contains('Authorization\': \'Bearer \$_apiKey')));
  });

  test('food recognition sends authenticated multipart request to backend',
      () async {
    SharedPreferences.setMockInitialValues({});
    final appState = AppState(authService: _FoodAuthService());
    await appState.load();
    await appState.login(email: 'food@example.com', password: 'secure123');

    late http.Request captured;
    final service = FoodRecognitionService(
      client: MockClient((request) async {
        captured = request;
        return http.Response(
          jsonEncode({
            'data': {
              'foods': [
                {
                  'name': 'Apple',
                  'portion_grams': 120,
                  'carbs_per_100g': 12,
                  'carbs_grams': 14.4,
                  'calories': 62,
                  'confidence': 0.8,
                  'note': 'Estimated portion',
                }
              ],
              'total_carbs_grams': 14.4,
              'total_calories': 62,
              'warnings': [],
              'summary': 'Apple portion',
            }
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    final result = await service.recognizeFood(
      imageBytes: Uint8List.fromList(const [1, 2, 3, 4]),
      mimeType: 'image/jpeg',
      appState: appState,
    );

    expect(captured.method, 'POST');
    expect(captured.url.path, '/api/ai/recognize-food');
    expect(captured.headers['Authorization'], 'Bearer food-token');
    expect(captured.headers['content-type'], contains('multipart/form-data'));
    expect(result.remote, isTrue);
    expect(result.foods.single.name, 'Apple');
    expect(result.totalCarbsGrams, 14.4);
  });
}

class _FoodAuthService extends AuthService {
  @override
  Future<AuthSession> login({
    required String email,
    required String password,
    required String locale,
  }) async {
    return AuthSession(
      token: 'food-token',
      email: email,
      fullName: 'Food User',
      premium: true,
      premiumStatus: 'active',
      premiumPlan: 'monthly',
    );
  }

  @override
  Future<AuthSession?> restoreSession(String token) async => null;
}
