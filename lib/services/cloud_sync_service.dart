import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

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
    final preferences = await SharedPreferences.getInstance();
    final localPayload = _payload(state);
    final baseRevision = preferences.getInt('cloudSyncRevision') ?? 0;
    var response =
        await _pushRequest(uri, state.accountToken, localPayload, baseRevision);

    if (response.statusCode == 409) {
      final conflict = _decodeBody(response.body);
      final serverPayload = conflict is Map ? conflict['payload'] : null;
      final serverRevision =
          conflict is Map ? _integer(conflict['revision']) : null;
      if (serverPayload is Map && serverRevision != null) {
        final merged = _mergePayloads(
          serverPayload.map((key, value) => MapEntry(key.toString(), value)),
          localPayload,
        );
        response =
            await _pushRequest(uri, state.accountToken, merged, serverRevision);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          await state.applyServerSnapshot(merged);
        }
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return const CloudSyncResult(
        ok: false,
        messageKey: 'networkUnavailable',
      );
    }

    final decoded = _decodeBody(response.body);
    final revision = decoded is Map ? _integer(decoded['revision']) : null;
    if (revision != null) {
      await preferences.setInt('cloudSyncRevision', revision);
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
      final revision = _integer(snapshot is Map ? snapshot['revision'] : null);
      if (revision != null) {
        final preferences = await SharedPreferences.getInstance();
        await preferences.setInt('cloudSyncRevision', revision);
      }
    }

    return const CloudSyncResult(
      ok: true,
      messageKey: 'settingsSaved',
    );
  }

  Map<String, String> _headers(String token) {
    return {
      'Content-Type': 'application/json; charset=utf-8',
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
      'syncedAt': DateTime.now().toUtc().toIso8601String(),
    };
  }

  Future<http.Response> _pushRequest(
    Uri uri,
    String token,
    Map<String, dynamic> payload,
    int baseRevision,
  ) {
    return _client
        .post(
          uri,
          headers: _headers(token),
          body: jsonEncode({
            'schemaVersion': 1,
            'baseRevision': baseRevision,
            'payload': payload,
          }),
        )
        .timeout(const Duration(seconds: 20));
  }

  Map<String, dynamic> _mergePayloads(
    Map<String, dynamic> server,
    Map<String, dynamic> local,
  ) {
    return {
      ...server,
      ...local,
      'profile': {
        ..._stringMap(server['profile']),
        ..._stringMap(local['profile']),
      },
      'emergency': {
        ..._stringMap(server['emergency']),
        ..._stringMap(local['emergency']),
      },
      'diaryEntries': _mergeList(
        server['diaryEntries'],
        local['diaryEntries'],
        (item) => item['id']?.toString() ?? '',
      ),
      'sensorReadings': _mergeList(
        server['sensorReadings'],
        local['sensorReadings'],
        _sensorReadingKey,
      ),
      'syncedAt': DateTime.now().toUtc().toIso8601String(),
    };
  }

  String _sensorReadingKey(Map<String, dynamic> item) {
    final sourceId = item['sourceId'];
    if (sourceId is String && sourceId.trim().isNotEmpty) {
      return sourceId;
    }
    final brand = item['brand'];
    final time = item['time'];
    if (time is String &&
        time.trim().isNotEmpty &&
        brand is String &&
        brand.trim().isNotEmpty) {
      return '$brand|$time';
    }
    return '';
  }

  List<Map<String, dynamic>> _mergeList(
    dynamic server,
    dynamic local,
    String Function(Map<String, dynamic>) keyOf,
  ) {
    final byKey = <String, Map<String, dynamic>>{};
    for (final source in [server, local]) {
      if (source is! List) continue;
      for (final value in source.whereType<Map>()) {
        final item = value.map((key, value) => MapEntry(key.toString(), value));
        final key = keyOf(item);
        if (key.isNotEmpty) byKey[key] = item;
      }
    }
    final result = byKey.values.toList();
    result.sort((a, b) =>
        (b['time']?.toString() ?? '').compareTo(a['time']?.toString() ?? ''));
    return result;
  }

  Map<String, dynamic> _stringMap(dynamic value) => value is Map
      ? value.map((key, value) => MapEntry(key.toString(), value))
      : <String, dynamic>{};

  int? _integer(dynamic value) => value is int ? value : int.tryParse('$value');

  dynamic _decodeBody(String body) {
    try {
      final decoded = jsonDecode(body);
      return decoded;
    } catch (_) {
      return {};
    }
  }
}

class CloudSyncResult {
  final bool ok;
  final String messageKey;

  const CloudSyncResult({required this.ok, required this.messageKey});
}
