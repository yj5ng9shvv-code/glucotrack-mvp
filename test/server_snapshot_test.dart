import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/services/auth_service.dart';

void main() {
  test('server snapshot restores profile, diary and sensor data', () async {
    SharedPreferences.setMockInitialValues({});
    final state = AppState(authService: _OfflineAuthService());
    await state.load();

    await state.applyServerSnapshot({
      'profile': {
        'fullName': 'Server User',
        'email': 'server@example.com',
        'phone': '+48123456789',
        'age': 42,
        'weightKg': 78.5,
        'heightCm': 181.0,
        'languageCode': 'pl',
        'glucoseMmol': 5.9,
        'diabetesType': 'type2',
        'glucoseUnitPreference': 'mmolL',
      },
      'diaryEntries': [
        {
          'id': 'entry-1',
          'time': '2026-06-22T08:00:00Z',
          'type': 'meal',
          'glucoseMmol': 6.1,
          'carbs': 35,
          'insulinUnits': 3.0,
          'title': 'Breakfast',
          'note': '',
          'source': 'manual',
        },
      ],
      'sensorReadings': [
        {
          'time': '2026-06-22T09:00:00Z',
          'glucoseMmol': 5.9,
          'brand': 'manual',
          'trend': 'steady',
          'sourceId': 'reading-1',
          'note': '',
        },
      ],
    });

    expect(state.fullName, 'Server User');
    expect(state.diabetesType, DiabetesType.type2);
    expect(state.glucoseMmol, 5.9);
    expect(state.diaryEntries.single.id, 'entry-1');
    expect(state.sensorReadings.single.sourceId, 'reading-1');
  });
}

class _OfflineAuthService extends AuthService {
  @override
  Future<AuthSession?> restoreSession(
    String token, {
    String? refreshToken,
  }) async =>
      null;
}
