import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/services/auth_service.dart';

void main() {
  test('registration, logout and login update access state', () async {
    SharedPreferences.setMockInitialValues({});
    final state = AppState(authService: _FakeAuthService());
    await state.load();

    expect(state.hasAccount, isFalse);
    expect(state.isAuthenticated, isFalse);

    await state.register(
      name: 'Иван',
      email: 'Ivan@Example.com',
      password: 'secure123',
    );

    expect(state.hasAccount, isTrue);
    expect(state.isAuthenticated, isTrue);
    expect(state.accountEmail, 'ivan@example.com');

    await state.logout();
    expect(state.isAuthenticated, isFalse);
    await expectLater(
      state.login(email: 'ivan@example.com', password: 'wrong-pass'),
      throwsA(isA<AuthException>()),
    );
    expect(state.isAuthenticated, isFalse);
    expect(
      await state.login(email: 'ivan@example.com', password: 'secure123'),
      isTrue,
    );
    expect(state.isAuthenticated, isTrue);
  });

  test('Google login persists the verified backend session', () async {
    SharedPreferences.setMockInitialValues({});
    final state = AppState(authService: _FakeAuthService());
    await state.load();

    await state.loginWithGoogle('google-id-token');

    expect(state.isAuthenticated, isTrue);
    expect(state.accountEmail, 'google@example.com');
    expect(state.fullName, 'Google User');
    final preferences = await SharedPreferences.getInstance();
    expect(preferences.getString('accountToken'), 'google-session-token');
  });

  test('login keeps network diagnostics for mobile auth failures', () async {
    SharedPreferences.setMockInitialValues({});
    final service = AuthService(
      client: MockClient((request) {
        throw http.ClientException('Connection refused', request.url);
      }),
    );

    await expectLater(
      service.login(
        email: 'ivan@example.com',
        password: 'secure123',
        locale: 'ru',
      ),
      throwsA(
        isA<AuthException>()
            .having((error) => error.message, 'message', 'networkUnavailable')
            .having(
              (error) => error.details,
              'details',
              allOf(
                contains('https://glukotrack.com/api/auth/login'),
                contains('Connection refused'),
              ),
            ),
      ),
    );
  });
}

class _FakeAuthService extends AuthService {
  @override
  Future<AuthSession> loginWithGoogle(
    String idToken, {
    required String locale,
  }) async {
    if (idToken != 'google-id-token') {
      throw const AuthException('Invalid Google token');
    }
    return const AuthSession(
      token: 'google-session-token',
      email: 'google@example.com',
      fullName: 'Google User',
    );
  }

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

  @override
  Future<AuthSession> login({
    required String email,
    required String password,
    required String locale,
  }) async {
    if (password != 'secure123') {
      throw const AuthException('Неверный email или пароль.');
    }
    return AuthSession(
      token: 'valid-token',
      email: email.toLowerCase(),
      fullName: 'Иван',
    );
  }

  @override
  Future<bool> validateToken(String token) async => token == 'valid-token';
}
