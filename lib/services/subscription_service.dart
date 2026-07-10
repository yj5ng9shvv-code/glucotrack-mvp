import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auth_service.dart';
import 'device_identity_service.dart';

class SubscriptionService {
  SubscriptionService({http.Client? client})
      : _client = client ?? http.Client();

  final http.Client _client;

  Future<ServerSubscription> status(String token) async {
    final device = await DeviceIdentityService.current();
    final body = await _request(
      'GET',
      '/subscription/status',
      token,
      null,
      device.id,
    );
    final value = body['subscription'];
    return ServerSubscription.fromJson(
      value is Map
          ? value.map((key, item) => MapEntry(key.toString(), item))
          : {},
    );
  }

  Future<ServerSubscription> startTrial(String token) async {
    final device = await DeviceIdentityService.current();
    final body = await _request(
      'POST',
      '/trial/start',
      token,
      {'deviceHash': device.id},
      device.id,
    );
    final value = body['subscription'];
    return ServerSubscription.fromJson(
      value is Map
          ? value.map((key, item) => MapEntry(key.toString(), item))
          : {},
      serverTime: DateTime.tryParse(body['serverTime']?.toString() ?? ''),
    );
  }

  Future<void> resendEmailVerification(
    String email, {
    required String locale,
  }) async {
    if (AuthService.apiBaseUrl.isEmpty) {
      throw const SubscriptionException('networkUnavailable');
    }
    final uri = Uri.parse(
      '${AuthService.apiBaseUrl.replaceFirst(RegExp(r'/$'), '')}/auth/email/verify/resend',
    );
    final response = await _client.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'locale': locale}),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw const SubscriptionException('networkUnavailable');
    }
  }

  Future<void> removeDevice(String token, String id) async {
    final device = await DeviceIdentityService.current();
    await _request(
      'DELETE',
      '/subscription/devices/$id',
      token,
      null,
      device.id,
    );
  }

  Future<Uri> createCheckout(String token, String plan) async {
    final body = await _request(
      'POST',
      '/billing/checkout',
      token,
      {'plan': plan},
    );
    final url = Uri.tryParse(body['checkoutUrl']?.toString() ?? '');
    if (url == null || !url.hasScheme) {
      throw const SubscriptionException('networkUnavailable');
    }
    return url;
  }

  Future<Uri> createPortal(String token) async {
    final body = await _request('POST', '/billing/portal', token, {});
    final url = Uri.tryParse(body['portalUrl']?.toString() ?? '');
    if (url == null || !url.hasScheme) {
      throw const SubscriptionException('networkUnavailable');
    }
    return url;
  }

  Future<Map<String, dynamic>> _request(
    String method,
    String path,
    String token, [
    Map<String, dynamic>? payload,
    String? deviceId,
  ]) async {
    if (AuthService.apiBaseUrl.isEmpty) {
      throw const SubscriptionException('networkUnavailable');
    }
    final uri = Uri.parse(
      '${AuthService.apiBaseUrl.replaceFirst(RegExp(r'/$'), '')}$path',
    );
    final headers = {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
      if (deviceId != null) 'X-Device-ID': deviceId,
    };
    final response = method == 'GET'
        ? await _client.get(uri, headers: headers)
        : method == 'DELETE'
            ? await _client.delete(uri, headers: headers)
            : await _client.post(
                uri,
                headers: headers,
                body: jsonEncode(payload ?? {}),
              );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = body['code']?.toString();
      throw SubscriptionException(
        switch (error) {
          'EMAIL_NOT_VERIFIED' =>
            'ui.text.a7ac75be7b72',
          'TRIAL_ALREADY_USED' =>
            'trialEndsTomorrow',
          _ => 'networkUnavailable',
        },
      );
    }
    return body;
  }

  Map<String, dynamic> _decode(String value) {
    try {
      final decoded = jsonDecode(value);
      return decoded is Map<String, dynamic> ? decoded : {};
    } catch (_) {
      return {};
    }
  }
}

class ServerSubscription {
  final bool active;
  final String status;
  final String? plan;
  final DateTime? until;
  final int deviceLimit;
  final List<SubscriptionDevice> devices;
  final String accessStatus;
  final bool trialUsed;
  final bool emailVerified;
  final DateTime? trialStartedAt;
  final DateTime? trialEndsAt;
  final DateTime? serverTime;

  const ServerSubscription({
    required this.active,
    required this.status,
    this.plan,
    this.until,
    this.deviceLimit = 3,
    this.devices = const [],
    this.accessStatus = 'free',
    this.trialUsed = false,
    this.emailVerified = false,
    this.trialStartedAt,
    this.trialEndsAt,
    this.serverTime,
  });

  factory ServerSubscription.fromJson(
    Map<String, dynamic> json, {
    DateTime? serverTime,
  }) {
    return ServerSubscription(
      active: json['premium'] == true,
      status: json['premiumStatus']?.toString() ?? 'inactive',
      plan: json['premiumPlan']?.toString(),
      until: DateTime.tryParse(json['premiumUntil']?.toString() ?? ''),
      deviceLimit: int.tryParse(json['deviceLimit']?.toString() ?? '') ?? 3,
      devices: (json['devices'] is List ? json['devices'] as List : const [])
          .whereType<Map>()
          .map((item) => SubscriptionDevice.fromJson(
                item.map((key, value) => MapEntry(key.toString(), value)),
              ))
          .toList(),
      accessStatus: json['accessStatus']?.toString() ?? 'free',
      trialUsed: json['trialUsed'] == true,
      emailVerified: json['emailVerified'] == true,
      trialStartedAt:
          DateTime.tryParse(json['trialStartedAt']?.toString() ?? ''),
      trialEndsAt: DateTime.tryParse(json['trialEndsAt']?.toString() ?? ''),
      serverTime:
          serverTime ?? DateTime.tryParse(json['serverTime']?.toString() ?? ''),
    );
  }
}

class SubscriptionDevice {
  final String id;
  final String deviceId;
  final String name;
  final String platform;
  final DateTime? lastSeenAt;

  const SubscriptionDevice({
    required this.id,
    required this.deviceId,
    required this.name,
    required this.platform,
    this.lastSeenAt,
  });

  factory SubscriptionDevice.fromJson(Map<String, dynamic> json) {
    return SubscriptionDevice(
      id: json['id']?.toString() ?? '',
      deviceId: json['deviceId']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      platform: json['platform']?.toString() ?? '',
      lastSeenAt: DateTime.tryParse(json['lastSeenAt']?.toString() ?? ''),
    );
  }
}

class SubscriptionException implements Exception {
  final String message;
  const SubscriptionException(this.message);
  @override
  String toString() => message;
}
