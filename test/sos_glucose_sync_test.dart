import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/models/diary_log_entry.dart';
import 'package:glucotrack/models/sensor_reading.dart';
import 'package:glucotrack/services/auth_service.dart';
import 'package:glucotrack/services/emergency_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('glucotrack/emergency');
  final calls = <Map<dynamic, dynamic>>[];

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      if (call.method == 'updateLockScreenCard') {
        calls.add(call.arguments as Map<dynamic, dynamic>);
      }
      return null;
    });
  });

  tearDown(() {
    calls.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test('SOS glucose follows latest diary entry and deletion fallback', () async {
    final service = AndroidEmergencyService();
    final state = AppState(
      authService: _OfflineAuthService(),
      emergencyCardUpdater: service.updateLockScreenCard,
    )..showEmergencyOnLockScreen = true;

    final firstTime = DateTime(2026, 7, 9, 14, 30);
    final secondTime = DateTime(2026, 7, 9, 15, 5);

    await state.addDiaryEntry(_glucoseEntry('first', firstTime, 7.8));
    expect(calls.last['glucose'], '7.8 mmol/L');
    expect(calls.last['glucoseUpdatedAt'], '09.07.2026 14:30');

    await state.addDiaryEntry(_glucoseEntry('second', secondTime, 9.1));
    expect(calls.last['glucose'], '9.1 mmol/L');
    expect(calls.last['glucoseUpdatedAt'], '09.07.2026 15:05');

    await state.removeDiaryEntry('second');
    expect(calls.last['glucose'], '7.8 mmol/L');
    expect(calls.last['glucoseUpdatedAt'], '09.07.2026 14:30');

    await state.removeDiaryEntry('first');
    expect(calls.last['glucose'], 'No data');
    expect(calls.last['glucoseUpdatedAt'], isEmpty);
  });

  test('SOS glucose refreshes when glucose unit changes', () async {
    final service = AndroidEmergencyService();
    final state = AppState(
      authService: _OfflineAuthService(),
      emergencyCardUpdater: service.updateLockScreenCard,
    )..showEmergencyOnLockScreen = true;

    await state.addDiaryEntry(
      _glucoseEntry('entry', DateTime(2026, 7, 9, 10), 7.8),
    );
    await state.setGlucoseUnitPreference(GlucoseUnitPreference.mgDl);

    expect(calls.last['glucose'], '141 mg/dL');
    expect(calls.last['glucoseUpdatedAt'], '09.07.2026 10:00');
  });

  test('lock screen SOS refreshes diabetes type and unit profile changes',
      () async {
    final service = AndroidEmergencyService();
    final state = AppState(
      authService: _OfflineAuthService(),
      emergencyCardUpdater: service.updateLockScreenCard,
    )..showEmergencyOnLockScreen = true;

    await state.addDiaryEntry(
      _glucoseEntry('entry', DateTime(2026, 7, 9, 10), 7.8),
    );
    await state.setDiabetesType(DiabetesType.type2);
    await state.setGlucoseUnitPreference(GlucoseUnitPreference.mgDl);

    expect(calls.last['diabetesText'], 'Type 2 Diabetes');
    expect(calls.last['glucose'], '141 mg/dL');
  });

  test('SOS glucose falls back to sensor reading when diary is empty', () async {
    final service = AndroidEmergencyService();
    final state = AppState(
      authService: _OfflineAuthService(),
      emergencyCardUpdater: service.updateLockScreenCard,
    )..showEmergencyOnLockScreen = true;

    await state.replaceSensorReadings([
      SensorReading(
        time: DateTime(2026, 7, 9, 8, 45),
        glucoseMmol: 6.4,
        brand: SensorBrand.manual,
        trend: SensorTrend.steady,
        sourceId: 'sensor',
        note: '',
      ),
    ]);

    expect(calls.last['glucose'], '6.4 mmol/L');
    expect(calls.last['glucoseUpdatedAt'], '09.07.2026 08:45');
  });
}

DiaryLogEntry _glucoseEntry(String id, DateTime time, double glucoseMmol) {
  return DiaryLogEntry(
    id: id,
    time: time,
    type: DiaryLogType.glucose,
    glucoseMmol: glucoseMmol,
    carbs: 0,
    insulinUnits: 0,
    title: 'Glucose',
    note: '',
    source: SensorBrand.manual,
  );
}

class _OfflineAuthService extends AuthService {
  @override
  Future<AuthSession?> restoreSession(String token) async => null;
}
