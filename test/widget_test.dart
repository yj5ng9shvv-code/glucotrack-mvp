import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:glucotrack/main.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/services/auth_service.dart';

void main() {
  testWidgets('requires registration before onboarding', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(
      GlukoTrackApp(initialState: AppState(authService: _FakeAuthService())),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    await tester.pumpAndSettle();

    expect(find.text('Sign up'), findsWidgets);
    expect(find.text('Welcome to GlucoTrack'), findsNothing);
  });

  testWidgets('registration unlocks onboarding', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(
      GlukoTrackApp(initialState: AppState(authService: _FakeAuthService())),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.widgetWithText(TextFormField, 'Имя'), 'Иван');
    await tester.enterText(
        find.widgetWithText(TextFormField, 'Email'), 'ivan@example.com');
    await tester.enterText(
        find.widgetWithText(TextFormField, 'Пароль'), 'secure123');
    await tester.enterText(
        find.widgetWithText(TextFormField, 'Повторите пароль'), 'secure123');
    final termsCheckbox = find.byType(CheckboxListTile);
    await tester.ensureVisible(termsCheckbox);
    await tester.tap(termsCheckbox);
    await tester.pumpAndSettle();
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -300));
    await tester.pumpAndSettle();
    final signUpButton = find.byIcon(Icons.person_add_alt_1);
    await tester.ensureVisible(signUpButton);
    await tester.tap(signUpButton);
    await tester.pumpAndSettle();

    expect(find.byType(CheckboxListTile), findsOneWidget);
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
      token: 'test-token',
      email: email.toLowerCase(),
      fullName: name,
    );
  }

  @override
  Future<bool> validateToken(String token) async => token == 'test-token';
}
