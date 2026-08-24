import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/models/diary_log_entry.dart';
import 'package:glucotrack/models/sensor_reading.dart';
import 'package:glucotrack/services/auth_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const audioGlobalChannel = MethodChannel('xyz.luan/audioplayers.global');
  const audioPlayerChannel = MethodChannel('xyz.luan/audioplayers');

  setUpAll(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(audioGlobalChannel, (_) async => null);
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(audioPlayerChannel, (_) async => null);
  });

  tearDownAll(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(audioGlobalChannel, null);
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(audioPlayerChannel, null);
  });
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

  test('server snapshot replaces stale local diary tombstones', () async {
    SharedPreferences.setMockInitialValues({
      'deletedDiaryEntryIds': '["restored-entry"]',
    });
    final state = AppState(authService: _OfflineAuthService());
    await state.load();

    await state.applyServerSnapshot({
      'profile': {
        'fullName': 'Server User',
        'email': 'server@example.com',
        'age': 42,
        'languageCode': 'en',
        'glucoseMmol': 6.1,
      },
      'diaryEntries': [
        {
          'id': 'restored-entry',
          'time': '2026-08-02T15:37:31Z',
          'type': 'meal',
          'glucoseMmol': 6.1,
          'carbs': 40,
          'insulinUnits': 0,
          'title': 'Meal',
          'note': '',
          'source': 'manual',
        },
      ],
      'sensorReadings': <Map<String, dynamic>>[],
      'emergency': <String, dynamic>{},
    });

    expect(state.deletedDiaryEntryIds, isEmpty);
    expect(state.diaryEntries.single.id, 'restored-entry');
  });
  test('medical settings persist glucose units to account profile', () async {
    SharedPreferences.setMockInitialValues({});
    final authService = _RecordingAuthService();
    final state = AppState(authService: authService);
    await state.load();
    await state.useDeviceManagementToken('token');

    await state.updateMedicalSettings(
      diabetesType: DiabetesType.type2,
      glucoseUnitPreference: GlucoseUnitPreference.mgDl,
      targetGlucose: 6.0,
      insulinToCarbRatio: 10.0,
      correctionFactor: 2.0,
    );

    expect(authService.savedDiabetesType, 'type2');
    expect(authService.savedGlucoseUnit, 'mgDl');
    expect(state.glucoseUnitPreference, GlucoseUnitPreference.mgDl);
  });
  test('diary entry is pushed after save and restored after logout login',
      () async {
    SharedPreferences.setMockInitialValues({});
    Map<String, dynamic>? serverPayload;
    var pushes = 0;
    var pulls = 0;
    final authService = _LoginAuthService();
    final state = AppState(
      authService: authService,
      cloudSyncPush: (state) async {
        pushes += 1;
        serverPayload = {
          'profile': {'email': state.email},
          'diaryEntries':
              state.diaryEntries.map((entry) => entry.toJson()).toList(),
          'deletedDiaryEntryIds': state.deletedDiaryEntryIds.toList(),
          'sensorReadings': <Map<String, dynamic>>[],
          'emergency': <String, dynamic>{},
        };
      },
      cloudSyncPull: (state) async {
        pulls += 1;
        final payload = serverPayload;
        if (payload != null) await state.applyServerSnapshot(payload);
      },
    );
    await state.load();
    await state.useDeviceManagementToken('token');

    await state.addDiaryEntry(
      DiaryLogEntry(
        id: 'diary-test-1',
        time: DateTime.utc(2026, 8, 23, 8),
        type: DiaryLogType.meal,
        glucoseMmol: 7.2,
        carbs: 40,
        insulinUnits: 5,
        title: 'Manual diary test',
        note: 'Тест дневника',
        source: SensorBrand.manual,
      ),
    );


    await state.addDiaryEntry(
      DiaryLogEntry(
        id: 'diary-test-2',
        time: DateTime.utc(2026, 8, 23, 9),
        type: DiaryLogType.note,
        glucoseMmol: 0,
        carbs: 0,
        insulinUnits: 0,
        title: 'Second diary test',
        note: 'second saved diary note',
        source: SensorBrand.manual,
      ),
    );
    expect(pushes, 2);
    expect(serverPayload?['diaryEntries'], isNotEmpty);

    await state.logout();
    state.diaryEntries = [];
    await state.login(email: 'diary@example.com', password: 'secure123');

    expect(pulls, 1);
    expect(state.diaryEntries, hasLength(2));
    expect(state.diaryEntries.map((entry) => entry.id), containsAll(['diary-test-1', 'diary-test-2']));
    final restored = state.diaryEntries.firstWhere((entry) => entry.id == 'diary-test-1');
    expect(restored.glucoseMmol, 7.2);
    expect(restored.insulinUnits, 5);
    expect(restored.carbs, 40);
    expect(restored.note, 'Тест дневника');
  });
}

class _RecordingAuthService extends _OfflineAuthService {
  String? savedDiabetesType;
  String? savedGlucoseUnit;

  @override
  Future<void> saveOnboardingProfile(
    String token,
    String diabetesType,
    String glucoseUnit,
  ) async {
    savedDiabetesType = diabetesType;
    savedGlucoseUnit = glucoseUnit;
  }
}

class _LoginAuthService extends _OfflineAuthService {
  @override
  Future<AuthSession> login({
    required String email,
    required String password,
    required String locale,
  }) async {
    return AuthSession(
      token: 'login-token',
      email: email,
      fullName: 'Diary User',
    );
  }

  @override
  Future<void> logout(String token, {String? refreshToken}) async {}
}

class _OfflineAuthService extends AuthService {
  @override
  Future<AuthSession?> restoreSession(
    String token, {
    String? refreshToken,
  }) async =>
      null;
}
