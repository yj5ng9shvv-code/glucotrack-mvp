import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:glucotrack/services/family_access_service.dart';

void main() {
  test('loads members and monitored patients with bearer token', () async {
    final requestedPaths = <String>[];
    final service = FamilyAccessService(
      baseUrl: 'https://api.example.com',
      client: MockClient((request) async {
        expect(request.headers['authorization'], 'Bearer jwt-token');
        requestedPaths.add(request.url.path);
        if (request.url.path == '/family/members') {
          return http.Response(
            jsonEncode({
              'members': [
                {
                  'id': '1',
                  'email': 'caregiver@example.com',
                  'status': 'accepted',
                  'permissions': {
                    'glucose': true,
                    'history': false,
                    'emergency': true,
                  },
                },
              ],
            }),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }
        return http.Response(
          jsonEncode({
            'patients': [
              {
                'id': '7',
                'fullName': 'Анна',
                'email': 'anna@example.com',
                'glucoseMmol': 5.8,
                'updatedAt': '2026-06-22T10:00:00Z',
                'permissions': {
                  'glucose': true,
                  'history': true,
                  'emergency': false,
                },
              },
            ],
          }),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );

    final dashboard = await service.load('jwt-token');

    expect(
      requestedPaths,
      containsAll(['/family/members', '/family/patients']),
    );
    expect(dashboard.members.single.email, 'caregiver@example.com');
    expect(dashboard.members.single.permissions.emergency, isTrue);
    expect(dashboard.patients.single.fullName, 'Анна');
    expect(dashboard.patients.single.glucoseMmol, 5.8);
  });

  test(
    'returns no cached patients after server suspends family access',
    () async {
      final service = FamilyAccessService(
        baseUrl: 'https://api.example.com',
        client: MockClient(
          (request) async => http.Response(
            jsonEncode({
              if (request.url.path == '/family/members') 'members': [],
              if (request.url.path == '/family/patients') 'patients': [],
            }),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          ),
        ),
      );

      final dashboard = await service.load('jwt-token');

      expect(dashboard.members, isEmpty);
      expect(dashboard.patients, isEmpty);
    },
  );

  test('maps missing family subscription error to a localized key', () async {
    final service = FamilyAccessService(
      baseUrl: 'https://api.example.com',
      client: MockClient(
        (request) async => http.Response(
          jsonEncode({'error': 'family subscription required'}),
          403,
          headers: {'content-type': 'application/json; charset=utf-8'},
        ),
      ),
    );

    expect(
      () => service.invite(
        token: 'jwt-token',
        email: 'caregiver@example.com',
        permissions: const FamilyPermissions(
          glucose: true,
          history: false,
          emergency: true,
        ),
        locale: 'en',
      ),
      throwsA(
        isA<FamilyAccessException>().having(
          (error) => error.message,
          'message',
          'family.error.familySubscriptionRequired',
        ),
      ),
    );
  });

  test('maps invalid invitation code error to a localized key', () async {
    final service = FamilyAccessService(
      baseUrl: 'https://api.example.com',
      client: MockClient(
        (request) async => http.Response(
          jsonEncode({'error': 'invalid invitation code'}),
          400,
          headers: {'content-type': 'application/json; charset=utf-8'},
        ),
      ),
    );

    expect(
      () => service.accept(token: 'jwt-token', code: 'bad-code'),
      throwsA(
        isA<FamilyAccessException>().having(
          (error) => error.message,
          'message',
          'family.error.invalidInvitationCode',
        ),
      ),
    );
  });

  test('accepts an invite with the authenticated recipient token', () async {
    final service = FamilyAccessService(
      baseUrl: 'https://api.example.com',
      client: MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.path, '/family/invitations/accept');
        expect(request.headers['authorization'], 'Bearer recipient-token');
        expect(jsonDecode(request.body), {'code': 'invite-code-123456'});
        return http.Response(jsonEncode({'link': {'status': 'accepted'}}), 200);
      }),
    );

    await service.accept(
      token: 'recipient-token',
      code: 'invite-code-123456',
    );
  });

  test('explains a replaced or expired invite instead of exposing HTTP 404',
      () async {
    final service = FamilyAccessService(
      baseUrl: 'https://api.example.com',
      client: MockClient(
        (request) async => http.Response(
          jsonEncode({'error': 'invitation is unavailable'}),
          404,
          headers: {'content-type': 'application/json; charset=utf-8'},
        ),
      ),
    );

    expect(
      () => service.accept(token: 'recipient-token', code: 'old-invite-code'),
      throwsA(
        isA<FamilyAccessException>().having(
          (error) => error.message,
          'message',
          'Приглашение недействительно, уже использовано или заменено повторной отправкой.',
        ),
      ),
    );
  });

  test('explains that acceptance requires the invited account', () async {
    final service = FamilyAccessService(
      baseUrl: 'https://api.example.com',
      client: MockClient(
        (request) async => http.Response(
          jsonEncode({
            'code': 'INVITATION_EMAIL_MISMATCH',
            'error': 'sign in with the invited email',
          }),
          403,
          headers: {'content-type': 'application/json; charset=utf-8'},
        ),
      ),
    );

    expect(
      () => service.accept(token: 'wrong-account-token', code: 'invite-code'),
      throwsA(
        isA<FamilyAccessException>()
            .having(
              (error) => error.backendMessage,
              'backendMessage',
              'sign in with the invited email',
            )
            .having(
              (error) => error.message,
              'message',
              contains('email'),
            ),
      ),
    );
  });

  test('maps family member limit error to a localized key', () async {
    final service = FamilyAccessService(
      baseUrl: 'https://api.example.com',
      client: MockClient(
        (request) async => http.Response(
          jsonEncode({'error': 'family member limit reached'}),
          409,
          headers: {'content-type': 'application/json; charset=utf-8'},
        ),
      ),
    );

    expect(
      () => service.invite(
        token: 'jwt-token',
        email: 'caregiver@example.com',
        permissions: const FamilyPermissions(
          glucose: true,
          history: true,
          emergency: true,
        ),
        locale: 'en',
      ),
      throwsA(
        isA<FamilyAccessException>().having(
          (error) => error.message,
          'message',
          'family.error.memberLimitReached',
        ),
      ),
    );
  });

  test('maps invitation email delivery failure to the invitation error state',
      () async {
    final service = FamilyAccessService(
      baseUrl: 'https://api.example.com',
      client: MockClient(
        (request) async => http.Response(
          jsonEncode({'error': 'invitation email failed'}),
          502,
          headers: {'content-type': 'application/json; charset=utf-8'},
        ),
      ),
    );

    expect(
      () => service.invite(
        token: 'jwt-token',
        email: 'caregiver@example.com',
        permissions: const FamilyPermissions(
          glucose: true,
          history: false,
          emergency: true,
        ),
        locale: 'en',
      ),
      throwsA(
        isA<FamilyAccessException>().having(
          (error) => error.message,
          'message',
          'familyWatch.invite.failed',
        ),
      ),
    );
  });

  test('resends by invitation ID with the bearer token and locale only',
      () async {
    late Map<String, dynamic> payload;
    final service = FamilyAccessService(
      baseUrl: 'https://api.example.com',
      client: MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.path, '/family/invitations/inv-42/resend');
        expect(request.headers['authorization'], 'Bearer jwt-token');
        payload = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(jsonEncode({'ok': true}), 200);
      }),
    );

    await service.resend(
      token: 'jwt-token',
      invitationId: 'inv-42',
      locale: 'ru',
    );

    expect(payload, {'locale': 'ru'});
  });

  test('keeps an API response visible instead of treating it as a network error',
      () async {
    final service = FamilyAccessService(
      baseUrl: 'https://api.example.com',
      client: MockClient(
        (request) async => http.Response(
          jsonEncode({'error': 'pending invitation not found'}),
          404,
        ),
      ),
    );

    expect(
      () => service.resend(
        token: 'jwt-token',
        invitationId: 'inv-42',
        locale: 'en',
      ),
      throwsA(
        isA<FamilyAccessException>()
            .having((error) => error.kind, 'kind', FamilyAccessErrorKind.api)
            .having(
              (error) => error.message,
              'message',
              'pending invitation not found',
            ),
      ),
    );
  });

  test('classifies expired authorization separately from a connection error',
      () async {
    final service = FamilyAccessService(
      baseUrl: 'https://api.example.com',
      client: MockClient(
        (request) async => http.Response(
          jsonEncode({'error': 'token expired'}),
          401,
        ),
      ),
    );

    expect(
      () => service.resend(
        token: 'expired-token',
        invitationId: 'inv-42',
        locale: 'en',
      ),
      throwsA(
        isA<FamilyAccessException>().having(
          (error) => error.kind,
          'kind',
          FamilyAccessErrorKind.expiredToken,
        ),
      ),
    );
  });

  test('maps empty API base URL to network unavailable key', () async {
    final service = FamilyAccessService(baseUrl: '');

    expect(
      () => service.load('jwt-token'),
      throwsA(
        isA<FamilyAccessException>().having(
          (error) => error.message,
          'message',
          'networkUnavailable',
        ),
      ),
    );
  });

  test('sends the selected role and granular permissions', () async {
    late Map<String, dynamic> payload;
    final service = FamilyAccessService(
      baseUrl: 'https://api.example.com',
      client: MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.path, '/family/invitations');
        payload = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(
          jsonEncode({'invitation': {'id': '1', 'email': 'anna@example.com'}}),
          201,
        );
      }),
    );

    await service.invite(
      token: 'jwt-token',
      email: 'anna@example.com',
      name: 'Анна',
      role: 'patient',
      permissions: const FamilyPermissions(
        glucose: true,
        history: true,
        emergency: true,
        insulin: true,
        reports: true,
      ),
      locale: 'ru',
    );

    expect(payload['role'], 'patient');
    expect(payload['name'], 'Анна');
    expect((payload['permissions'] as Map)['viewInsulin'], isTrue);
    expect((payload['permissions'] as Map)['viewReports'], isTrue);
  });

  test('updates permissions through the protected member endpoint', () async {
    final service = FamilyAccessService(
      baseUrl: 'https://api.example.com',
      client: MockClient((request) async {
        expect(request.method, 'PATCH');
        expect(request.url.path, '/family/members/42/permissions');
        return http.Response(jsonEncode({'permissions': {'glucose': true}}), 200);
      }),
    );

    final permissions = await service.updatePermissions(
      token: 'jwt-token',
      memberId: '42',
      permissions: const FamilyPermissions(
        glucose: true,
        history: false,
        emergency: false,
      ),
    );
    expect(permissions.glucose, isTrue);
  });
}
