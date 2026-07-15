import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auth_service.dart';

class GdprService {
  GdprService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Uri _uri(String path) => Uri.parse(
        '${AuthService.apiBaseUrl.replaceFirst(RegExp(r'/$'), '')}$path',
      );

  Map<String, String> _headers(String token) => {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json; charset=utf-8',
      };

  Future<GdprListResult> listRequests(String token) async {
    final response = await _client.get(
      _uri('/privacy/gdpr/requests'),
      headers: _headers(token),
    );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw GdprException(_error(response.statusCode, body));
    }
    final rows = body['rows'];
    return GdprListResult(
      rows: rows is List
          ? rows
              .whereType<Map>()
              .map((row) => GdprRequest.fromJson(row))
              .toList()
          : const [],
      total: _intValue(body['total']),
      page: _intValue(body['page'], fallback: 1),
      limit: _intValue(body['limit'], fallback: 25),
    );
  }

  Future<GdprDetails> getRequest(String token, String publicId) async {
    final response = await _client.get(
      _uri('/privacy/gdpr/requests/$publicId'),
      headers: _headers(token),
    );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw GdprException(_error(response.statusCode, body));
    }
    return GdprDetails.fromJson(body);
  }

  Future<GdprRequest> createRequest(
    String token, {
    required String requestType,
    required String subject,
    required String description,
    required String locale,
  }) async {
    final response = await _client.post(
      _uri('/privacy/gdpr/requests'),
      headers: _headers(token),
      body: jsonEncode({
        'requestType': requestType,
        'subject': subject,
        'description': description,
        'locale': locale,
      }),
    );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw GdprException(_error(response.statusCode, body));
    }
    return GdprRequest.fromJson(body);
  }

  Future<void> cancelRequest(
    String token,
    String publicId, {
    String? comment,
  }) async {
    final response = await _client.post(
      _uri('/privacy/gdpr/requests/$publicId/cancel'),
      headers: _headers(token),
      body: jsonEncode({'comment': comment ?? ''}),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw GdprException(_error(response.statusCode, _decode(response.body)));
    }
  }

  Future<void> reply(
    String token,
    String publicId, {
    required String comment,
  }) async {
    final response = await _client.post(
      _uri('/privacy/gdpr/requests/$publicId/reply'),
      headers: _headers(token),
      body: jsonEncode({'comment': comment}),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw GdprException(_error(response.statusCode, _decode(response.body)));
    }
  }

  String downloadUrl(String publicId) =>
      _uri('/privacy/gdpr/requests/$publicId/download').toString();

  Map<String, dynamic> _decode(String value) {
    try {
      final decoded = jsonDecode(value);
      return decoded is Map<String, dynamic> ? decoded : {};
    } catch (_) {
      return {};
    }
  }

  String _error(int statusCode, Map<String, dynamic> body) {
    final code = body['code']?.toString() ?? body['error']?.toString();
    if (code != null && code.isNotEmpty) return code;
    if (statusCode == 401) return 'auth.error.invalidCredentials';
    if (statusCode == 403) return 'auth.error.forbidden';
    if (statusCode == 404) return 'auth.error.notFound';
    if (statusCode == 429) return 'auth.error.tooManyRequests';
    if (statusCode >= 500) return 'auth.error.serverUnavailable';
    return 'auth.error.invalidRequest';
  }
}

class GdprListResult {
  final List<GdprRequest> rows;
  final int total;
  final int page;
  final int limit;

  const GdprListResult({
    required this.rows,
    required this.total,
    required this.page,
    required this.limit,
  });
}

class GdprDetails {
  final GdprRequest request;
  final List<GdprEvent> events;
  final List<GdprFile> files;

  const GdprDetails({
    required this.request,
    required this.events,
    required this.files,
  });

  factory GdprDetails.fromJson(Map<String, dynamic> json) => GdprDetails(
        request: GdprRequest.fromJson((json['request'] as Map?) ?? const {}),
        events: (json['events'] as List? ?? const [])
            .whereType<Map>()
            .map((event) => GdprEvent.fromJson(event))
            .toList(),
        files: (json['files'] as List? ?? const [])
            .whereType<Map>()
            .map((file) => GdprFile.fromJson(file))
            .toList(),
      );
}

class GdprRequest {
  final String id;
  final String publicId;
  final String requestType;
  final String status;
  final String subject;
  final String description;
  final DateTime? createdAt;
  final DateTime? dueAt;
  final DateTime? completedAt;
  final int? daysRemaining;

  const GdprRequest({
    required this.id,
    required this.publicId,
    required this.requestType,
    required this.status,
    required this.subject,
    required this.description,
    this.createdAt,
    this.dueAt,
    this.completedAt,
    this.daysRemaining,
  });

  factory GdprRequest.fromJson(Map json) => GdprRequest(
        id: json['id']?.toString() ?? '',
        publicId: json['publicId']?.toString() ??
            json['public_id']?.toString() ??
            json['id']?.toString() ??
            '',
        requestType: json['requestType']?.toString() ??
            json['request_type']?.toString() ??
            '',
        status: json['status']?.toString() ?? '',
        subject: json['subject']?.toString() ?? '',
        description: json['description']?.toString() ?? '',
        createdAt: _dateValue(json['createdAt'] ?? json['created_at']),
        dueAt: _dateValue(json['dueAt'] ?? json['due_at']),
        completedAt: _dateValue(json['completedAt'] ?? json['completed_at']),
        daysRemaining: json['daysRemaining'] is num
            ? (json['daysRemaining'] as num).round()
            : int.tryParse(json['daysRemaining']?.toString() ?? ''),
      );
}

class GdprEvent {
  final String eventType;
  final String comment;
  final String? oldStatus;
  final String? newStatus;
  final DateTime? createdAt;

  const GdprEvent({
    required this.eventType,
    required this.comment,
    this.oldStatus,
    this.newStatus,
    this.createdAt,
  });

  factory GdprEvent.fromJson(Map json) => GdprEvent(
        eventType: json['event_type']?.toString() ??
            json['eventType']?.toString() ??
            '',
        comment: json['comment']?.toString() ?? '',
        oldStatus:
            json['old_status']?.toString() ?? json['oldStatus']?.toString(),
        newStatus:
            json['new_status']?.toString() ?? json['newStatus']?.toString(),
        createdAt: _dateValue(json['created_at'] ?? json['createdAt']),
      );
}

class GdprFile {
  final String id;
  final String originalName;
  final int sizeBytes;
  final DateTime? expiresAt;

  const GdprFile({
    required this.id,
    required this.originalName,
    required this.sizeBytes,
    this.expiresAt,
  });

  factory GdprFile.fromJson(Map json) => GdprFile(
        id: json['id']?.toString() ?? '',
        originalName: json['original_name']?.toString() ??
            json['originalName']?.toString() ??
            '',
        sizeBytes: _intValue(json['size_bytes'] ?? json['sizeBytes']),
        expiresAt: _dateValue(json['expires_at'] ?? json['expiresAt']),
      );
}

class GdprException implements Exception {
  final String message;

  const GdprException(this.message);

  @override
  String toString() => message;
}

DateTime? _dateValue(Object? value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString())?.toLocal();
}

int _intValue(Object? value, {int fallback = 0}) {
  if (value is num) return value.round();
  return int.tryParse(value?.toString() ?? '') ?? fallback;
}
