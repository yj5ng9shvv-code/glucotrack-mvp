import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auth_service.dart';

class ReferralService {
  ReferralService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<ReferralOverview> overview(String token) async {
    final response = await _client.get(_uri('/referrals/me'), headers: {
      'Authorization': 'Bearer $token'
    }).timeout(const Duration(seconds: 20));
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ReferralException(body['code']?.toString() ?? 'referral_failed');
    }
    return ReferralOverview.fromJson(body);
  }

  Uri _uri(String path) => Uri.parse(
        '${AuthService.apiBaseUrl.replaceFirst(RegExp(r'/$'), '')}$path',
      );

  Map<String, dynamic> _decode(String value) {
    try {
      final decoded = jsonDecode(value);
      return decoded is Map<String, dynamic> ? decoded : {};
    } catch (_) {
      return {};
    }
  }
}

class ReferralOverview {
  const ReferralOverview({
    required this.code,
    required this.link,
    required this.active,
    required this.stats,
    required this.history,
  });

  final String code;
  final String link;
  final bool active;
  final ReferralStats stats;
  final List<ReferralHistoryItem> history;

  factory ReferralOverview.fromJson(Map<String, dynamic> json) {
    final code = json['code'] is Map ? json['code'] as Map : const {};
    return ReferralOverview(
      code: code['code']?.toString() ?? '',
      link: code['link']?.toString() ?? '',
      active: code['active'] != false,
      stats: ReferralStats.fromJson(
        json['stats'] is Map ? json['stats'] as Map : const {},
      ),
      history: (json['history'] is List ? json['history'] as List : const [])
          .whereType<Map>()
          .map(ReferralHistoryItem.fromJson)
          .toList(),
    );
  }
}

class ReferralStats {
  const ReferralStats({
    required this.total,
    required this.rewarded,
    required this.manualReview,
    required this.rejected,
  });

  final int total;
  final int rewarded;
  final int manualReview;
  final int rejected;

  factory ReferralStats.fromJson(Map json) => ReferralStats(
        total: _int(json['total']),
        rewarded: _int(json['rewarded']),
        manualReview: _int(json['manualReview']),
        rejected: _int(json['rejected']),
      );
}

class ReferralHistoryItem {
  const ReferralHistoryItem({
    required this.id,
    required this.status,
    required this.grantedDays,
    this.registeredAt,
    this.rewardedAt,
    this.rejectionReason,
  });

  final String id;
  final String status;
  final int grantedDays;
  final DateTime? registeredAt;
  final DateTime? rewardedAt;
  final String? rejectionReason;

  factory ReferralHistoryItem.fromJson(Map json) => ReferralHistoryItem(
        id: json['id']?.toString() ?? '',
        status: json['status']?.toString() ?? '',
        grantedDays: _int(json['grantedDays']),
        registeredAt: DateTime.tryParse(json['registeredAt']?.toString() ?? ''),
        rewardedAt: DateTime.tryParse(json['rewardedAt']?.toString() ?? ''),
        rejectionReason: json['rejectionReason']?.toString(),
      );
}

class ReferralException implements Exception {
  const ReferralException(this.message);
  final String message;
}

int _int(Object? value) => int.tryParse(value?.toString() ?? '') ?? 0;
