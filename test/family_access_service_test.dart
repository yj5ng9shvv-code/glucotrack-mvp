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
        requestedPaths, containsAll(['/family/members', '/family/patients']));
    expect(dashboard.members.single.email, 'caregiver@example.com');
    expect(dashboard.members.single.permissions.emergency, isTrue);
    expect(dashboard.patients.single.fullName, 'Анна');
    expect(dashboard.patients.single.glucoseMmol, 5.8);
  });

  test('returns no cached patients after server suspends family access',
      () async {
    final service = FamilyAccessService(
      baseUrl: 'https://api.example.com',
      client: MockClient((request) async => http.Response(
            jsonEncode({
              if (request.url.path == '/family/members') 'members': [],
              if (request.url.path == '/family/patients') 'patients': [],
            }),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          )),
    );

    final dashboard = await service.load('jwt-token');

    expect(dashboard.members, isEmpty);
    expect(dashboard.patients, isEmpty);
  });

  test('maps missing family subscription error to a localized key', () async {
    final service = FamilyAccessService(
      baseUrl: 'https://api.example.com',
      client: MockClient((request) async => http.Response(
            jsonEncode({'error': 'family subscription required'}),
            403,
            headers: {'content-type': 'application/json; charset=utf-8'},
          )),
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
      client: MockClient((request) async => http.Response(
            jsonEncode({'error': 'invalid invitation code'}),
            400,
            headers: {'content-type': 'application/json; charset=utf-8'},
          )),
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

  test('maps family member limit error to a localized key', () async {
    final service = FamilyAccessService(
      baseUrl: 'https://api.example.com',
      client: MockClient((request) async => http.Response(
            jsonEncode({'error': 'family member limit reached'}),
            409,
            headers: {'content-type': 'application/json; charset=utf-8'},
          )),
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
}
