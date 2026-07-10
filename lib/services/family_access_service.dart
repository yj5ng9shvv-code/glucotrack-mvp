import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auth_service.dart';

class FamilyAccessService {
  FamilyAccessService({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? AuthService.apiBaseUrl;

  final http.Client _client;
  final String _baseUrl;

  Future<FamilyDashboard> load(String token) async {
    final responses = await Future.wait([
      _get('/family/members', token),
      _get('/family/patients', token),
    ]);
    return FamilyDashboard(
      members: (responses[0]['members'] as List? ?? [])
          .whereType<Map>()
          .map((item) => FamilyMember.fromJson(_stringMap(item)))
          .toList(),
      patients: (responses[1]['patients'] as List? ?? [])
          .whereType<Map>()
          .map((item) => MonitoredPatient.fromJson(_stringMap(item)))
          .toList(),
    );
  }

  Future<FamilyMember> invite({
    required String token,
    required String email,
    required FamilyPermissions permissions,
  }) async {
    final body = await _send(
      'POST',
      '/family/invitations',
      token,
      {'email': email, 'permissions': permissions.toJson()},
    );
    return FamilyMember.fromJson(
      _stringMap(body['invitation'] as Map? ?? {}),
    );
  }

  Future<void> accept({required String token, required String code}) async {
    await _send(
      'POST',
      '/family/invitations/accept',
      token,
      {'code': code},
    );
  }

  Future<void> revoke({required String token, required String id}) async {
    await _send('DELETE', '/family/members/$id', token, null);
  }

  Future<Map<String, dynamic>> _get(String path, String token) {
    return _send('GET', path, token, null);
  }

  Future<Map<String, dynamic>> _send(
    String method,
    String path,
    String token,
    Map<String, dynamic>? payload,
  ) async {
    if (_baseUrl.trim().isEmpty) {
      throw const FamilyAccessException('NETWORK_ERROR');
    }
    final uri = Uri.parse(
      '${_baseUrl.replaceFirst(RegExp(r'/$'), '')}$path',
    );
    final headers = {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    };
    final response = switch (method) {
      'GET' => await _client.get(uri, headers: headers),
      'DELETE' => await _client.delete(uri, headers: headers),
      _ => await _client.post(
          uri,
          headers: headers,
          body: jsonEncode(payload ?? {}),
        ),
    };
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw const FamilyAccessException(
        'NETWORK_ERROR',
      );
    }
    return body;
  }

  Map<String, dynamic> _decode(String source) {
    try {
      final value = jsonDecode(source);
      return value is Map<String, dynamic> ? value : {};
    } catch (_) {
      return {};
    }
  }

  Map<String, dynamic> _stringMap(Map value) =>
      value.map((key, item) => MapEntry(key.toString(), item));
}

class FamilyDashboard {
  final List<FamilyMember> members;
  final List<MonitoredPatient> patients;

  const FamilyDashboard({required this.members, required this.patients});
}

class FamilyPermissions {
  final bool glucose;
  final bool history;
  final bool emergency;

  const FamilyPermissions({
    required this.glucose,
    required this.history,
    required this.emergency,
  });

  factory FamilyPermissions.fromJson(Map<String, dynamic> json) {
    return FamilyPermissions(
      glucose: json['glucose'] == true,
      history: json['history'] == true,
      emergency: json['emergency'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
        'glucose': glucose,
        'history': history,
        'emergency': emergency,
      };
}

class FamilyMember {
  final String id;
  final String email;
  final String? fullName;
  final String status;
  final String? inviteCode;
  final FamilyPermissions permissions;

  const FamilyMember({
    required this.id,
    required this.email,
    required this.fullName,
    required this.status,
    required this.inviteCode,
    required this.permissions,
  });

  factory FamilyMember.fromJson(Map<String, dynamic> json) {
    return FamilyMember(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      fullName: json['fullName']?.toString(),
      status: json['status']?.toString() ?? 'pending',
      inviteCode: json['inviteCode']?.toString(),
      permissions: FamilyPermissions.fromJson(
        (json['permissions'] as Map? ?? {})
            .map((key, value) => MapEntry(key.toString(), value)),
      ),
    );
  }
}

class MonitoredPatient {
  final String id;
  final String fullName;
  final String email;
  final double? glucoseMmol;
  final DateTime? updatedAt;
  final FamilyPermissions permissions;

  const MonitoredPatient({
    required this.id,
    required this.fullName,
    required this.email,
    required this.glucoseMmol,
    required this.updatedAt,
    required this.permissions,
  });

  factory MonitoredPatient.fromJson(Map<String, dynamic> json) {
    return MonitoredPatient(
      id: json['id']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      glucoseMmol: (json['glucoseMmol'] as num?)?.toDouble(),
      updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? ''),
      permissions: FamilyPermissions.fromJson(
        (json['permissions'] as Map? ?? {})
            .map((key, value) => MapEntry(key.toString(), value)),
      ),
    );
  }
}

class FamilyAccessException implements Exception {
  final String message;

  const FamilyAccessException(this.message);

  @override
  String toString() => message;
}
