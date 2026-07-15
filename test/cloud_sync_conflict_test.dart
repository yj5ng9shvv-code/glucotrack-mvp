import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/services/auth_service.dart';
import 'package:glucotrack/services/cloud_sync_service.dart';

void main() {
  test(
    'retries a conflicting push with merged diary entries and new revision',
    () async {
      SharedPreferences.setMockInitialValues({'cloudSyncRevision': 2});
      final state = AppState(authService: _OfflineAuthService());
      await state.load();
      await state.applyServerSnapshot(
        _snapshot(
          'phone-entry',
          sensorReadings: [
            {
              'time': '2026-07-11T10:05:00Z',
              'glucoseMmol': 6.2,
              'brand': 'manual',
              'trend': 'steady',
              'sourceId': 'phone-reading',
              'note': '',
            },
          ],
        ),
      );
      var requests = 0;
      final service = CloudSyncService(
        client: MockClient((request) async {
          requests += 1;
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          if (requests == 1) {
            expect(body['baseRevision'], 2);
            return http.Response(
              jsonEncode({
                'code': 'SYNC_CONFLICT',
                'revision': 4,
                'payload': _snapshot(
                  'web-entry',
                  sensorReadings: [
                    {
                      'time':
                          '', // invalid sensor reading should not be merged as duplicate
                      'glucoseMmol': 6.5,
                      'brand': '',
                      'trend': 'steady',
                      'sourceId': '',
                      'note': '',
                    },
                  ],
                ),
              }),
              409,
              headers: {'content-type': 'application/json'},
            );
          }
          expect(body['baseRevision'], 4);
          final payload = body['payload'] as Map<String, dynamic>;
          final entries = (payload['diaryEntries'] as List)
              .cast<Map>()
              .map((entry) => entry['id'])
              .toSet();
          expect(entries, {'phone-entry', 'web-entry'});
          final sensorReadingIds = (payload['sensorReadings'] as List)
              .cast<Map>()
              .map((entry) => entry['sourceId']?.toString() ?? '')
              .toSet();
          expect(sensorReadingIds, {'phone-reading'});
          return http.Response(jsonEncode({'ok': true, 'revision': 5}), 200);
        }),
      );

      final result = await service.push(state);

      expect(result.ok, isTrue);
      expect(requests, 2);
      final preferences = await SharedPreferences.getInstance();
      expect(preferences.getInt('cloudSyncRevision'), 5);
    },
  );
}

Map<String, dynamic> _snapshot(
  String id, {
  List<Map<String, dynamic>>? sensorReadings,
}) =>
    {
      'profile': {
        'fullName': 'Sync User',
        'email': 'sync@example.com',
        'phone': '',
        'age': 40,
        'weightKg': 75.0,
        'heightCm': 180.0,
        'languageCode': 'en',
        'glucoseUnitPreference': 'mmolL',
        'diabetesType': 'type1',
        'targetGlucoseMmol': 6.0,
        'insulinToCarbRatio': 10.0,
        'correctionFactor': 2.0,
        'glucoseMmol': 6.0,
      },
      'diaryEntries': [
        {
          'id': id,
          'time': '2026-07-11T10:00:00Z',
          'type': 'meal',
          'glucoseMmol': 6.0,
          'carbs': 10.0,
          'insulinUnits': 1.0,
          'title': 'Meal',
          'note': '',
          'source': 'manual',
        },
      ],
      'sensorReadings': sensorReadings ?? <dynamic>[],
      'emergency': <String, dynamic>{},
    };

class _OfflineAuthService extends AuthService {
  @override
  Future<AuthSession?> restoreSession(
    String token, {
    String? refreshToken,
  }) async =>
      null;
}
