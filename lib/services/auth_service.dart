import 'dart:convert';

import 'package:http/http.dart' as http;

import 'device_identity_service.dart';

class AuthService {
  AuthService({http.Client? client}) : _client = client ?? http.Client();

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://glukotrack.com/api',
  );
  final http.Client _client;

  bool get isConfigured => apiBaseUrl.trim().isNotEmpty;

  Future<AuthSession> register({
    required String name,
    required String email,
    required String password,
    required String locale,
  }) {
    return _authenticate(
      '/auth/register',
      {
        'fullName': name,
        'email': email,
        'password': password,
        'locale': locale
      },
    );
  }

  Future<AuthSession> login({
    required String email,
    required String password,
    required String locale,
  }) {
    return _authenticate(
      '/auth/login',
      {'email': email, 'password': password, 'locale': locale},
    );
  }

  Future<AuthSession> loginWithGoogle(String idToken,
      {required String locale}) {
    return _authenticate(
        '/auth/google', {'idToken': idToken, 'locale': locale});
  }

  Future<void> requestPasswordReset(String email,
      {required String locale}) async {
    if (!isConfigured) {
      throw const AuthException('networkUnavailable');
    }
    final response = await _client
        .post(
          _uri('/auth/password/forgot'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'email': email.trim(), 'locale': locale}),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthException(
          _errorMessage(response.statusCode, _decode(response.body)));
    }
  }

  Future<bool> validateToken(String token) async {
    return await restoreSession(token) != null;
  }

  Future<AuthSession?> restoreSession(String token) async {
    if (!isConfigured || token.isEmpty) return null;
    try {
      final device = await DeviceIdentityService.current();
      final response = await _client.get(
        _uri('/auth/me'),
        headers: {
          'Authorization': 'Bearer $token',
          'X-Device-ID': device.id,
        },
      ).timeout(const Duration(seconds: 15));
      if (response.statusCode != 200) return null;
      final body = _decode(response.body);
      final user = body['user'];
      if (user is! Map) return null;
      return _sessionFromUser(token, user);
    } catch (_) {
      return null;
    }
  }

  Future<AuthSession> _authenticate(
    String path,
    Map<String, dynamic> payload,
  ) async {
    if (!isConfigured) {
      throw const AuthException(
        'networkUnavailable',
      );
    }
    final device = await DeviceIdentityService.current();
    payload['device'] = device.toJson();
    final response = await _client
        .post(
          _uri(path),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode(payload),
        )
        .timeout(const Duration(seconds: 20));
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthException(
        _errorMessage(response.statusCode, body),
        code: body['code']?.toString() ?? body['error']?.toString(),
        managementToken: body['managementToken']?.toString(),
      );
    }
    final user = body['user'];
    final token = body['token'];
    if (user is! Map || token is! String || token.isEmpty) {
      throw const AuthException('networkUnavailable');
    }
    await DeviceIdentityService.acceptServerId(
      (body['device'] as Map?)?['id']?.toString(),
    );
    return _sessionFromUser(token, user);
  }

  AuthSession _sessionFromUser(String token, Map user) => AuthSession(
        token: token,
        email: user['email']?.toString() ?? '',
        fullName: user['fullName']?.toString() ?? '',
        premium: user['premium'] == true,
        premiumStatus: user['premiumStatus']?.toString() ?? 'inactive',
        premiumPlan: user['premiumPlan']?.toString(),
        premiumUntil: DateTime.tryParse(user['premiumUntil']?.toString() ?? ''),
        diabetesType: (user['profile'] as Map?)?['diabetesType']?.toString(),
        glucoseUnit: (user['profile'] as Map?)?['glucoseUnit']?.toString(),
        onboardingCompleted:
            (user['profile'] as Map?)?['onboardingCompleted'] == true,
      );

  Future<void> saveOnboardingProfile(
      String token, String diabetesType, String glucoseUnit) async {
    final response = await _client.put(
      _uri('/auth/profile'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'diabetesType': diabetesType,
        'glucoseUnit': glucoseUnit,
      }),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw const AuthException('profile_save_failed');
    }
  }

  Uri _uri(String path) =>
      Uri.parse('${apiBaseUrl.replaceFirst(RegExp(r'/$'), '')}$path');

  Map<String, dynamic> _decode(String value) {
    try {
      final decoded = jsonDecode(value);
      return decoded is Map<String, dynamic> ? decoded : {};
    } catch (_) {
      return {};
    }
  }

  String _errorMessage(int statusCode, Map<String, dynamic> body) {
    final code = body['code']?.toString();
    if (statusCode == 409 && code == 'DEVICE_LIMIT_REACHED') {
      return 'deviceLimitReached';
    }
    if (statusCode == 400 || statusCode == 409 || statusCode == 422) {
      return 'auth.error.invalidRequest';
    }
    if (statusCode == 401) return 'auth.error.invalidCredentials';
    if (statusCode == 403) return 'auth.error.forbidden';
    if (statusCode == 404) return 'auth.error.notFound';
    if (statusCode == 429) return 'auth.error.tooManyRequests';
    if (statusCode >= 500) return 'auth.error.serverUnavailable';
    return 'auth.error.invalidRequest';
  }
}

class AuthSession {
  final String token;
  final String email;
  final String fullName;
  final bool premium;
  final String premiumStatus;
  final String? premiumPlan;
  final DateTime? premiumUntil;
  final String? diabetesType;
  final String? glucoseUnit;
  final bool onboardingCompleted;

  const AuthSession({
    required this.token,
    required this.email,
    required this.fullName,
    this.premium = false,
    this.premiumStatus = 'inactive',
    this.premiumPlan,
    this.premiumUntil,
    this.diabetesType,
    this.glucoseUnit,
    this.onboardingCompleted = false,
  });
}

class AuthException implements Exception {
  final String message;
  final String? code;
  final String? managementToken;

  const AuthException(this.message, {this.code, this.managementToken});

  @override
  String toString() => message;
}
