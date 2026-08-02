import 'dart:convert';

import 'package:http/http.dart' as http;

import '../services/auth_service.dart';
import 'location_models.dart';

class FamilyLocationApiException implements Exception {
  const FamilyLocationApiException(this.statusCode, {this.body = const {}});

  final int statusCode;
  final Map<String, dynamic> body;

  bool get retryable =>
      statusCode == 0 || statusCode == 429 || statusCode >= 500;
  bool get accessRevoked => statusCode == 401 || statusCode == 403;
}

abstract class LocationUpdateSender {
  Future<void> updateLocation(
      {required String token, required FamilyLocationPoint point});
}

class FamilyLocationApi implements LocationUpdateSender {
  FamilyLocationApi({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? AuthService.apiBaseUrl;

  final http.Client _client;
  final String _baseUrl;

  @override
  Future<void> updateLocation(
      {required String token, required FamilyLocationPoint point}) async {
    await _send('POST', '/location/update', token, point.toJson(),
        deviceId: point.deviceId);
  }

  Future<void> grantLocationAccess(
      {required String token,
      required String caregiverId,
      DateTime? expiresAt,
      String? deviceId}) {
    return _send(
        'POST',
        '/location/grant',
        token,
        {
          'caregiver_id': caregiverId,
          if (expiresAt != null)
            'expires_at': expiresAt.toUtc().toIso8601String(),
        },
        deviceId: deviceId);
  }

  Future<void> revokeLocationAccess(
      {required String token, required String caregiverId, String? deviceId}) {
    return _send('DELETE', '/location/revoke/$caregiverId', token, null,
        deviceId: deviceId);
  }

  Future<FamilyLocationPoint?> getCurrentLocation(
      {required String token,
      required String patientId,
      String? deviceId}) async {
    final body = await _send('GET', '/location/current/$patientId', token, null,
        deviceId: deviceId);
    final location = body['location'];
    if (location is! Map) return null;
    final map = Map<String, dynamic>.from(location);
    return FamilyLocationPoint(
      latitude: (map['latitude'] as num).toDouble(),
      longitude: (map['longitude'] as num).toDouble(),
      accuracy: (map['accuracy'] as num?)?.toDouble(),
      batteryLevel: (map['battery_level'] as num?)?.toInt(),
      deviceId: map['device_id']?.toString() ?? '',
      capturedAt:
          DateTime.tryParse(map['created_at']?.toString() ?? '')?.toUtc() ??
              DateTime.now().toUtc(),
    );
  }

  Future<Map<String, dynamic>> _send(
      String method, String path, String token, Map<String, dynamic>? payload,
      {String? deviceId}) async {
    if (_baseUrl.trim().isEmpty || token.isEmpty) {
      throw const FamilyLocationApiException(0);
    }
    final headers = <String, String>{
      'Authorization': 'Bearer $token',
      if (payload != null) 'Content-Type': 'application/json',
      if (deviceId != null && deviceId.isNotEmpty) 'X-Device-ID': deviceId,
    };
    try {
      final uri = Uri.parse('${_baseUrl.replaceFirst(RegExp(r'/$'), '')}$path');
      final response = switch (method) {
        'GET' => await _client.get(uri, headers: headers),
        'DELETE' => await _client.delete(uri, headers: headers),
        _ => await _client.post(uri,
            headers: headers, body: jsonEncode(payload ?? const {})),
      };
      final body = _decode(response.body);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw FamilyLocationApiException(response.statusCode, body: body);
      }
      return body;
    } on FamilyLocationApiException {
      rethrow;
    } catch (_) {
      throw const FamilyLocationApiException(0);
    }
  }

  Map<String, dynamic> _decode(String source) {
    try {
      final value = jsonDecode(source);
      return value is Map<String, dynamic> ? value : const {};
    } catch (_) {
      return const {};
    }
  }
}
