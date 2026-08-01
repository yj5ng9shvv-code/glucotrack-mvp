import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auth_service.dart';

class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.metadata,
    required this.createdAt,
    this.readAt,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final Map<String, dynamic> metadata;
  final DateTime createdAt;
  final DateTime? readAt;

  bool get isRead => readAt != null;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    final metadata = json['metadata'];
    return AppNotification(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? 'general',
      title: json['title']?.toString() ?? '',
      body: json['body']?.toString() ?? '',
      metadata: metadata is Map
          ? metadata.map((key, value) => MapEntry(key.toString(), value))
          : const {},
      createdAt: DateTime.tryParse(json['created_at']?.toString() ?? '') ??
          DateTime.now(),
      readAt: DateTime.tryParse(json['read_at']?.toString() ?? ''),
    );
  }
}

class NotificationService {
  NotificationService({http.Client? client})
      : _client = client ?? http.Client();

  final http.Client _client;

  Future<List<AppNotification>> list(String token) async {
    final body = await _request('GET', '/notifications', token);
    final raw = body['notifications'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map(
          (item) => AppNotification.fromJson(
            item.map((key, value) => MapEntry(key.toString(), value)),
          ),
        )
        .toList();
  }

  Future<void> markRead(String token, String id) async {
    await _request('PATCH', '/notifications/$id/read', token);
  }

  Future<void> delete(String token, String id) async {
    await _request('DELETE', '/notifications/$id', token);
  }

  Future<Map<String, dynamic>> _request(
    String method,
    String path,
    String token,
  ) async {
    if (AuthService.apiBaseUrl.isEmpty || token.isEmpty) {
      throw const NotificationException('networkUnavailable');
    }
    final uri = Uri.parse(
      '${AuthService.apiBaseUrl.replaceFirst(RegExp(r'/$'), '')}$path',
    );
    final headers = {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json; charset=utf-8',
    };
    final response = switch (method) {
      'GET' => await _client.get(uri, headers: headers),
      'PATCH' => await _client.patch(uri, headers: headers),
      'DELETE' => await _client.delete(uri, headers: headers),
      _ => throw const NotificationException('networkUnavailable'),
    };
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw NotificationException(
        body['code']?.toString() ??
            body['error']?.toString() ??
            'networkUnavailable',
      );
    }
    return body;
  }

  Map<String, dynamic> _decode(String value) {
    try {
      final decoded = jsonDecode(value);
      return decoded is Map
          ? decoded.map((key, item) => MapEntry(key.toString(), item))
          : {};
    } catch (_) {
      return {};
    }
  }
}

class NotificationException implements Exception {
  const NotificationException(this.message);

  final String message;

  @override
  String toString() => message;
}
