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
}
