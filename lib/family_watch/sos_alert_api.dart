import 'dart:convert';

import 'package:http/http.dart' as http;

import '../services/auth_service.dart';
import '../services/family_access_service.dart';
import 'sos_alert_handler.dart';

/// Resolves an SOS id only by traversing the authenticated caregiver's own
/// monitored-patient list and protected `/sos/active/:patientId` endpoint.
/// This prevents a deep link from becoming an IDOR read primitive.
class FamilySosAlertApi implements SosAlertDestinationResolver {
  FamilySosAlertApi({
    http.Client? client,
    FamilyAccessService? familyAccessService,
    String? baseUrl,
  })  : _client = client ?? http.Client(),
        _familyAccessService = familyAccessService ?? FamilyAccessService(),
        _baseUrl = baseUrl ?? AuthService.apiBaseUrl;

  final http.Client _client;
  final FamilyAccessService _familyAccessService;
  final String _baseUrl;

  @override
  Future<SosAlertDestination?> resolve({
    required String token,
    required String eventId,
  }) async {
    if (token.isEmpty || _baseUrl.trim().isEmpty) return null;
    try {
      final dashboard = await _familyAccessService.load(token);
      for (final patient in dashboard.patients) {
        final event = await _activeEvent(token, patient.id);
        if (event == null || event['sos_id']?.toString() != eventId) continue;
        return SosAlertDestination(
          eventId: eventId,
          patientId: patient.id,
          patientName:
              patient.fullName.isEmpty ? patient.email : patient.fullName,
          status: event['status']?.toString() ?? 'ACTIVE',
          createdAt: DateTime.tryParse(event['created_at']?.toString() ?? ''),
        );
      }
    } catch (_) {
      // Unauthorized, revoked and transient failures intentionally produce the
      // same generic unavailable state and disclose no SOS metadata.
    }
    return null;
  }

  Future<Map<String, dynamic>?> _activeEvent(
      String token, String patientId) async {
    final uri = Uri.parse(
      '${_baseUrl.replaceFirst(RegExp(r'/$'), '')}/sos/active/$patientId',
    );
    try {
      final response = await _client.get(uri, headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      });
      if (response.statusCode < 200 || response.statusCode >= 300) return null;
      final decoded = jsonDecode(response.body);
      if (decoded is! Map || decoded['sos'] is! Map) return null;
      return Map<String, dynamic>.from(decoded['sos'] as Map);
    } catch (_) {
      return null;
    }
  }
}
