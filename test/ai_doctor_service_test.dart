import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/services/ai_doctor_service.dart';
import 'package:glucotrack/services/auth_service.dart';

void main() {
  test('maps non-json backend failure to network error exception', () async {
    SharedPreferences.setMockInitialValues({});
    final state = AppState(authService: _FakeAuthService());
    await state.register(
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    );
    final service = AiDoctorService(
      client: MockClient(
        (request) async => http.Response('server unavailable', 500),
      ),
    );

    expect(
      () => service.checkMedications(
        medications: 'metformin',
        context: '',
        state: state,
      ),
      throwsA(
        isA<AiDoctorException>().having(
          (error) => error.message,
          'message',
          'NETWORK_ERROR',
        ),
      ),
    );
  });
}

class _FakeAuthService extends AuthService {
  @override
  Future<AuthSession> register({
    required String name,
    required String email,
    required String password,
    required String locale,
  }) async {
    return AuthSession(
      token: 'valid-token',
      email: email.toLowerCase(),
      fullName: name,
    );
  }
}
