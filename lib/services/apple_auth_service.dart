import 'package:sign_in_with_apple/sign_in_with_apple.dart';

class AppleAuthService {
  AppleAuthService._();

  static final instance = AppleAuthService._();

  Future<AppleAuthToken> authenticate() async {
    final credential = await SignInWithApple.getAppleIDCredential(
      scopes: [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
    );
    final token = credential.identityToken;
    if (token == null || token.isEmpty) {
      throw StateError('Apple did not return an identity token');
    }
    final fullName = [
      credential.givenName,
      credential.familyName,
    ].whereType<String>().where((value) => value.trim().isNotEmpty).join(' ');
    return AppleAuthToken(
      identityToken: token,
      email: credential.email,
      fullName: fullName.isEmpty ? null : fullName,
    );
  }
}

class AppleAuthToken {
  const AppleAuthToken({
    required this.identityToken,
    this.email,
    this.fullName,
  });

  final String identityToken;
  final String? email;
  final String? fullName;
}
