import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

class GoogleAuthService {
  GoogleAuthService._();

  static final instance = GoogleAuthService._();
  static const clientId = String.fromEnvironment(
    'GOOGLE_CLIENT_ID',
    defaultValue:
        '967750323381-32r09tkmqfkssusn75ukdjmqh8f0gbs0.apps.googleusercontent.com',
  );

  final GoogleSignIn _signIn = GoogleSignIn.instance;
  final StreamController<String> _webTokens = StreamController.broadcast();
  Future<void>? _initialization;

  Stream<String> get webIdTokens => _webTokens.stream;

  Future<void> initialize() => _initialization ??= _initialize();

  Future<void> _initialize() async {
    if (clientId.trim().isEmpty) {
      throw StateError('GOOGLE_CLIENT_ID is not configured');
    }
    await _signIn.initialize(
      clientId: kIsWeb ? clientId : null,
      serverClientId: kIsWeb ? null : clientId,
    );
    _signIn.authenticationEvents.listen((event) {
      if (!kIsWeb || event is! GoogleSignInAuthenticationEventSignIn) return;
      final token = event.user.authentication.idToken;
      if (token != null && token.isNotEmpty) _webTokens.add(token);
    }, onError: _webTokens.addError);
  }

  Future<String> authenticate() async {
    await initialize();
    if (!_signIn.supportsAuthenticate()) {
      throw StateError('Google sign-in must use the web button');
    }
    final account = await _signIn.authenticate();
    final token = account.authentication.idToken;
    if (token == null || token.isEmpty) {
      throw StateError('Google did not return an ID token');
    }
    return token;
  }
}
