import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auth_service.dart';

class ReportStorageService {
  ReportStorageService({http.Client? client})
      : _client = client ?? http.Client();

  final http.Client _client;

  Future<void> save({
    required String token,
    required String title,
    required String content,
    required Map<String, dynamic> metadata,
  }) async {
    final response = await _client.post(
      _uri('/reports'),
      headers: _headers(token),
      body: jsonEncode({
        'title': title,
        'content': content,
        'metadata': metadata,
      }),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(_error(response));
    }
  }

  Future<List<StoredReport>> list(String token) async {
    final response =
        await _client.get(_uri('/reports'), headers: _headers(token));
    if (response.statusCode != 200) throw Exception(_error(response));
    final body = jsonDecode(response.body);
    return (body['reports'] as List? ?? [])
        .whereType<Map>()
        .map((item) => StoredReport.fromJson(
              item.map((key, value) => MapEntry(key.toString(), value)),
            ))
        .toList();
  }

  Uri _uri(String path) {
    if (AuthService.apiBaseUrl.isEmpty) {
      throw Exception('NETWORK_ERROR');
    }
    return Uri.parse(
      '${AuthService.apiBaseUrl.replaceFirst(RegExp(r'/$'), '')}$path',
    );
  }

  Map<String, String> _headers(String token) => {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      };

  String _error(http.Response response) {
    try {
      return jsonDecode(response.body)['code']?.toString() ??
          'NETWORK_ERROR';
    } catch (_) {
      return 'NETWORK_ERROR';
    }
  }
}

class StoredReport {
  final String id;
  final String title;
  final DateTime? createdAt;

  const StoredReport({required this.id, required this.title, this.createdAt});

  factory StoredReport.fromJson(Map<String, dynamic> json) => StoredReport(
        id: json['id']?.toString() ?? '',
        title: json['title']?.toString() ?? '',
        createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
      );
}
