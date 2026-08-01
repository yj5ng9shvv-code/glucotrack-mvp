import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:glucotrack/models/app_state.dart';
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

  test(
    'lock screen SOS payload stays English when app language changes',
    () async {
      final service = AndroidEmergencyService();
      final state = AppState(
        authService: _OfflineAuthService(),
        emergencyCardUpdater: service.updateLockScreenCard,
      )
        ..showEmergencyOnLockScreen = true
        ..fullName = 'Alex Patient'
        ..emergencyContactName = 'Taylor'
        ..emergencyContactPhone = '+48111222333'
        ..bloodType = 'O+'
        ..insulinName = 'Novorapid'
        ..hasAllergies = false
        ..allergies = 'peanuts'
        ..medications = 'Siofor';

      await state.setLanguage('pl');
      await state.setLanguage('en');
      await state.setLanguage('de');

      expect(calls, hasLength(3));

      _expectEnglishLockScreenPayload(calls[0]);
      _expectEnglishLockScreenPayload(calls[1]);
      _expectEnglishLockScreenPayload(calls[2]);
      expect(
        calls.map((payload) => payload['cardTitle']).toSet(),
        hasLength(1),
      );
      expect(calls.every((payload) => payload['bloodType'] == 'O+'), isTrue);
      expect(
        calls.every((payload) => payload['insulinName'] == 'Novorapid'),
        isTrue,
      );
      expect(
        calls.every((payload) => payload['allergyStatusCode'] == 'no'),
        isTrue,
      );
      expect(
        calls.every((payload) => payload['allergyStatus'] == 'NO'),
        isTrue,
      );
      expect(calls.every((payload) => payload['allergies'] == 'NO'), isTrue);
      expect(
        calls.every((payload) => payload['contactName'] == 'Taylor'),
        isTrue,
      );
    },
  );

  test(
    'normalized language code is persisted before lock screen refresh',
    () async {
      String? refreshedLanguage;
      final state = AppState(
        authService: _OfflineAuthService(),
        emergencyCardUpdater: (state) async {
          refreshedLanguage = state.languageCode;
        },
      )..showEmergencyOnLockScreen = true;

      await state.setLanguage('en_GB');
      final prefs = await SharedPreferences.getInstance();

      expect(state.languageCode, 'en');
      expect(refreshedLanguage, 'en');
      expect(prefs.getString('languageCode'), 'en');
    },
  );

  test(
    'lock screen system values are English and custom notes stay unchanged',
    () async {
      final service = AndroidEmergencyService();
      final state = AppState(
        authService: _OfflineAuthService(),
        emergencyCardUpdater: service.updateLockScreenCard,
      )
        ..showEmergencyOnLockScreen = true
        ..diabetesType = DiabetesType.type2
        ..insulinName = 'none'
        ..hasAllergies = true
        ..allergies = 'peanuts'
        ..emergencyInstructions = 'Пациент говорит только русский.';

      await state.setLanguage('ru');

      final payload = calls.single;
      expect(payload['languageCode'], 'en');
      expect(payload['diabetesText'], 'Type 2 Diabetes');
      expect(payload['insulinName'], 'None');
      expect(payload['allergyStatusCode'], 'yes');
      expect(payload['allergyStatus'], 'YES');
      expect(payload['allergies'], 'YES');
      expect(payload['allergies'], isNot('peanuts'));
      expect(payload['instructionText'], 'Пациент говорит только русский.');
    },
  );

  test(
    'allergy profile updates immediately refresh lock screen status',
    () async {
      final service = AndroidEmergencyService();
      final state = AppState(
        authService: _OfflineAuthService(),
        emergencyCardUpdater: service.updateLockScreenCard,
      )
        ..showEmergencyOnLockScreen = true
        ..allergies = 'peanuts';

      await state.updateAllergyProfile(
        hasAllergies: true,
        allergies: 'peanuts',
      );
      await state.updateAllergyProfile(
        hasAllergies: false,
        allergies: 'peanuts',
      );
      await state.updateAllergyProfile(
        hasAllergies: true,
        allergies: 'peanuts',
      );

      expect(calls.map((payload) => payload['allergyStatus']), [
        'YES',
        'NO',
        'YES',
      ]);
      expect(calls.map((payload) => payload['allergies']), [
        'YES',
        'NO',
        'YES',
      ]);
      expect(
        calls.every((payload) => payload['allergies'] != 'peanuts'),
        isTrue,
      );
    },
  );

  test(
    'every supported language can build a lock screen SOS payload',
    () async {
      final service = AndroidEmergencyService();
      final state = AppState(
        authService: _OfflineAuthService(),
        emergencyCardUpdater: service.updateLockScreenCard,
      )..showEmergencyOnLockScreen = true;

      for (final language in AppState.supportedLanguages) {
        await state.setLanguage(language.code);
        final payload = calls.last;
        expect(payload['languageCode'], 'en');
        _expectEnglishLockScreenPayload(payload);
        for (final key in const [
          'cardTitle',
          'emergencyMedicalCardLabel',
          'medicalInfoLabel',
          'nameLabel',
          'glucoseLabel',
          'lastUpdatedLabel',
          'diabetesLabel',
          'bloodLabel',
          'insulinLabel',
          'allergiesLabel',
          'contactLabel',
          'phoneLabel',
          'instructionTitle',
          'instructionText',
          'call112Label',
          'myLocationLabel',
          'callContactLabel',
          'showQrLabel',
          'medicalCardLabel',
          'sendLocationActionLabel',
          'openMapLabel',
          'closeLabel',
          'openCardLabel',
          'locationUnavailable',
          'smsUnavailable',
          'locationPermissionRequired',
        ]) {
          final value = payload[key]?.toString() ?? '';
          expect(value.trim(), isNotEmpty, reason: '${language.code}: $key');
          expect(value, isNot(key), reason: '${language.code}: $key');
        }
      }

      expect(calls, hasLength(AppState.supportedLanguages.length));
    },
  );
}

void _expectEnglishLockScreenPayload(Map<dynamic, dynamic> payload) {
  expect(payload['enabled'], isTrue);
  expect(payload['languageCode'], 'en');
  expect(payload['cardTitle'], 'Emergency Medical Card');
  expect(payload['emergencyMedicalCardLabel'], 'Emergency Medical Card');
  expect(payload['medicalInfoLabel'], 'Medical Information');
  expect(payload['nameLabel'], 'Name');
  expect(payload['glucoseLabel'], 'Current Glucose');
  expect(payload['lastUpdatedLabel'], 'Last updated');
  expect(payload['diabetesLabel'], 'Diabetes Type');
  expect(payload['diabetesText'], 'Type 1 Diabetes');
  expect(payload['bloodLabel'], 'Blood Type');
  expect(payload['insulinLabel'], 'Insulin');
  expect(payload['allergiesLabel'], 'ALLERGY');
  expect(payload['allergyStatusCode'], 'no');
  expect(payload['allergyStatus'], 'NO');
  expect(payload['allergies'], 'NO');
  expect(payload['contactLabel'], 'Emergency Contact');
  expect(payload['phoneLabel'], 'Phone');
  expect(payload['instructionTitle'], 'Notes');
  expect(payload['myLocationLabel'], 'My Location');
  expect(payload['callContactLabel'], 'Call Emergency Contact');
  expect(payload['showQrLabel'], 'Show QR');
  expect(payload['medicalCardLabel'], 'Medical Card');
  expect(payload['sendLocationActionLabel'], 'Send Location');
  expect(payload['openMapLabel'], 'Open Map');
  expect(payload['instructionText'], contains('I have diabetes'));
}

class _OfflineAuthService extends AuthService {
  @override
  Future<AuthSession?> restoreSession(
    String token, {
    String? refreshToken,
  }) async =>
      null;
}
