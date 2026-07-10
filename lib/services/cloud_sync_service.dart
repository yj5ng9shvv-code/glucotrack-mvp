import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/app_state.dart';
import 'auth_service.dart';

class CloudSyncService {
  CloudSyncService({http.Client? client}) : _client = client ?? http.Client();

  static const _endpoint = AuthService.apiBaseUrl;

  final http.Client _client;

  bool get isConfigured => _endpoint.trim().isNotEmpty;

  void close() {
    _client.close();
  }

  Future<CloudSyncResult> push(AppState state) async {
    if (!isConfigured) {
      return const CloudSyncResult(
        ok: false,
        messageKey: 'networkUnavailable',
      );
    }

    final uri =
        Uri.parse('${_endpoint.replaceFirst(RegExp(r'/$'), '')}/sync/push');
    final response = await _client
        .post(
          uri,
          headers: _headers(state.accountToken),
          body: jsonEncode(_payload(state)),
        )
        .timeout(const Duration(seconds: 20));

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return const CloudSyncResult(
        ok: false,
        messageKey: 'networkUnavailable',
      );
    }

    return const CloudSyncResult(ok: true, messageKey: 'settingsSaved');
  }

  Future<CloudSyncResult> pull(AppState state) async {
    if (!isConfigured) {
      return const CloudSyncResult(
        ok: false,
        messageKey: 'networkUnavailable',
      );
    }

    final uri =
        Uri.parse('${_endpoint.replaceFirst(RegExp(r'/$'), '')}/sync/pull');
    final response = await _client
        .post(uri, headers: _headers(state.accountToken), body: jsonEncode({}))
        .timeout(const Duration(seconds: 20));

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return const CloudSyncResult(
        ok: false,
        messageKey: 'networkUnavailable',
      );
    }

    final decoded = jsonDecode(response.body);
    final snapshot = decoded is Map ? decoded['snapshot'] : null;
    final payload = snapshot is Map ? snapshot['payload'] : null;
    if (payload is Map) {
      await state.applyServerSnapshot(
        payload.map((key, value) => MapEntry(key.toString(), value)),
      );
    }

    return const CloudSyncResult(
      ok: true,
      messageKey: 'settingsSaved',
    );
  }

  Map<String, String> _headers(String token) {
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  Map<String, dynamic> _payload(AppState state) {
    return {
      'profile': {
        'fullName': state.fullName,
        'email': state.email,
        'phone': state.phone,
        'age': state.age,
        'weightKg': state.weightKg,
        'heightCm': state.heightCm,
        'languageCode': state.languageCode,
        'glucoseUnitPreference': state.glucoseUnitPreference.name,
        'diabetesType': state.diabetesType.name,
        'targetGlucoseMmol': state.targetGlucose,
        'insulinToCarbRatio': state.insulinToCarbRatio,
        'correctionFactor': state.correctionFactor,
        'glucoseMmol': state.glucoseMmol,
        if (state.profilePhotoBytes != null)
          'profilePhotoBase64': base64Encode(state.profilePhotoBytes!),
      },
      'diaryEntries':
          state.diaryEntries.map((entry) => entry.toJson()).toList(),
      'sensorReadings':
          state.sensorReadings.map((reading) => reading.toJson()).toList(),
      'emergency': {
        'contactName': state.emergencyContactName,
        'contactPhone': state.emergencyContactPhone,
        'bloodType': state.bloodType,
        'insulinName': state.insulinName,
        'hasAllergy': state.hasAllergies,
        'hasAllergies': state.hasAllergies,
        'allergyStatusCode': state.hasAllergies ? 'yes' : 'no',
        'allergyStatus': state.hasAllergies ? 'YES' : 'NO',
        'allergies': state.allergies,
        'importantDiagnoses': state.importantDiagnoses,
        'diabetesTreatment': state.diabetesTreatment,
        'medications': state.medications,
        'doctorContact': state.doctorContact,
        'communicationLanguages': state.communicationLanguages,
        'emergencyInstructions': state.emergencyInstructions,
        'additionalContacts': state.additionalEmergencyContacts,
        'hideSensitive': state.hideSensitiveSosData,
        'publicToken': state.sosPublicToken,
        'sosEnabled': state.sosEnabled,
        'showEmergencyOnLockScreen': state.showEmergencyOnLockScreen,
      },
      'syncedAt': DateTime.now().toIso8601String(),
    };
  }
}

class CloudSyncResult {
  final bool ok;
  final String messageKey;

  const CloudSyncResult({required this.ok, required this.messageKey});
}
