import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'auth_service.dart';
import 'device_identity_service.dart';

typedef PushPayloadHandler = FutureOr<void> Function(
  Map<String, dynamic> payload,
);

/// A narrow adapter around Firebase Messaging so registration behaviour can be
/// unit-tested without a Firebase runtime.
abstract class PushMessagingGateway {
  Future<bool> initialize();
  Future<String?> getToken();
  Stream<String> get onTokenRefresh;
  Stream<Map<String, dynamic>> get onMessage;
}

class FirebasePushMessagingGateway implements PushMessagingGateway {
  bool _initialized = false;

  @override
  Future<bool> initialize() async {
    if (_initialized) return true;
    try {
      await Firebase.initializeApp();
      _initialized = true;
      return true;
    } catch (_) {
      // A build without google-services.json/GoogleService-Info.plist must not
      // block sign-in or cause a token registration request without a token.
      return false;
    }
  }

  @override
  Future<String?> getToken() async {
    if (!await initialize()) return null;
    try {
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        return null;
      }
      // FCM must not register an iOS token until APNs has issued one.
      if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
        final apnsToken = await FirebaseMessaging.instance.getAPNSToken();
        if (apnsToken == null || apnsToken.isEmpty) return null;
      }
      return await FirebaseMessaging.instance.getToken();
    } catch (_) {
      return null;
    }
  }

  @override
  Stream<String> get onTokenRefresh =>
      FirebaseMessaging.instance.onTokenRefresh;

  @override
  Stream<Map<String, dynamic>> get onMessage => FirebaseMessaging.onMessage
      .map((message) => Map<String, dynamic>.from(message.data));
}

/// Receives background data messages. Notification presentation remains owned
/// by the operating system for notification payloads; no protected data is
/// read from the background isolate.
@pragma('vm:entry-point')
Future<void> familyPushBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // Missing provider configuration is handled by the foreground manager.
  }
}

abstract class PushDeviceApi {
  Future<void> register({
    required String accessToken,
    required String deviceId,
    required String platform,
    required String pushToken,
  });

  Future<void> unregister({
    required String accessToken,
    required String deviceId,
  });
}

class PushDeviceApiException implements Exception {
  const PushDeviceApiException(this.statusCode, {this.body = const {}});

  final int statusCode;
  final Map<String, dynamic> body;
}

class HttpPushDeviceApi implements PushDeviceApi {
  HttpPushDeviceApi({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? AuthService.apiBaseUrl;

  final http.Client _client;
  final String _baseUrl;

  @override
  Future<void> register({
    required String accessToken,
    required String deviceId,
    required String platform,
    required String pushToken,
  }) {
    return _send('/devices/register', accessToken, {
      'device_id': deviceId,
      'platform': platform,
      'push_token': pushToken,
    });
  }

  @override
  Future<void> unregister({
    required String accessToken,
    required String deviceId,
  }) {
    return _send('/devices/unregister', accessToken, {
      'device_id': deviceId,
    });
  }

  Future<void> _send(
    String path,
    String accessToken,
    Map<String, dynamic> body,
  ) async {
    if (_baseUrl.trim().isEmpty || accessToken.trim().isEmpty) return;
    try {
      final response = await _client
          .post(
            Uri.parse('${_baseUrl.replaceFirst(RegExp(r'/$'), '')}$path'),
            headers: {
              'Authorization': 'Bearer $accessToken',
              'Content-Type': 'application/json',
            },
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 15));
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw PushDeviceApiException(
          response.statusCode,
          body: _decode(response.body),
        );
      }
    } on PushDeviceApiException {
      rethrow;
    } catch (_) {
      throw const PushDeviceApiException(0);
    }
  }

  Map<String, dynamic> _decode(String source) {
    try {
      final decoded = jsonDecode(source);
      return decoded is Map<String, dynamic> ? decoded : const {};
    } catch (_) {
      return const {};
    }
  }
}

/// Owns the transient push token lifecycle. Tokens are never persisted by the
/// client: they are sent over an authenticated TLS request and backend storage
/// encrypts them at rest.
class PushTokenManager {
  PushTokenManager({
    PushMessagingGateway? messaging,
    PushDeviceApi? api,
    Future<DeviceIdentity> Function()? deviceIdentity,
  })  : _messaging = messaging ?? FirebasePushMessagingGateway(),
        _api = api ?? HttpPushDeviceApi(),
        _deviceIdentity = deviceIdentity ?? DeviceIdentityService.current;

  final PushMessagingGateway _messaging;
  final PushDeviceApi _api;
  final Future<DeviceIdentity> Function() _deviceIdentity;
  StreamSubscription<String>? _tokenRefreshSubscription;
  StreamSubscription<Map<String, dynamic>>? _foregroundSubscription;
  String Function()? _accessTokenProvider;
  PushPayloadHandler? _foregroundHandler;
  bool _initialized = false;

  void setForegroundMessageHandler(PushPayloadHandler? handler) {
    _foregroundHandler = handler;
  }

  Future<void> registerDevice({
    required String Function() accessTokenProvider,
    PushPayloadHandler? onForegroundMessage,
  }) async {
    _accessTokenProvider = accessTokenProvider;
    _foregroundHandler = onForegroundMessage ?? _foregroundHandler;
    if (!await _initialize()) return;
    final accessToken = _accessTokenProvider?.call().trim() ?? '';
    if (accessToken.isEmpty) return;

    final pushToken = await _messaging.getToken();
    if (pushToken == null || pushToken.trim().isEmpty) return;
    await _registerToken(pushToken);
  }

  Future<void> unregisterDevice({required String accessToken}) async {
    final token = accessToken.trim();
    if (token.isNotEmpty) {
      try {
        final device = await _deviceIdentity();
        await _api.unregister(accessToken: token, deviceId: device.id);
      } catch (_) {
        // Logout is never blocked by a temporarily unavailable API.
      }
    }
    _accessTokenProvider = null;
    await _tokenRefreshSubscription?.cancel();
    await _foregroundSubscription?.cancel();
    _tokenRefreshSubscription = null;
    _foregroundSubscription = null;
    _initialized = false;
  }

  Future<void> dispose() async {
    _accessTokenProvider = null;
    await _tokenRefreshSubscription?.cancel();
    await _foregroundSubscription?.cancel();
    _tokenRefreshSubscription = null;
    _foregroundSubscription = null;
    _initialized = false;
  }

  Future<bool> _initialize() async {
    if (_initialized) return true;
    if (!await _messaging.initialize()) return false;
    _initialized = true;
    _tokenRefreshSubscription = _messaging.onTokenRefresh.listen((token) {
      unawaited(_registerToken(token));
    });
    _foregroundSubscription = _messaging.onMessage.listen((payload) {
      final handler = _foregroundHandler;
      if (handler == null) return;
      unawaited(Future.sync(() => handler(payload)).catchError((_) {}));
    });
    return true;
  }

  Future<void> _registerToken(String pushToken) async {
    final accessToken = _accessTokenProvider?.call().trim() ?? '';
    if (accessToken.isEmpty || pushToken.trim().isEmpty) return;
    try {
      final device = await _deviceIdentity();
      final platform = device.platform.toLowerCase();
      if (platform != 'android' && platform != 'ios') return;
      await _api.register(
        accessToken: accessToken,
        deviceId: device.id,
        platform: platform,
        pushToken: pushToken,
      );
    } catch (_) {
      // Token rotation is retried by the provider callback or the next login.
    }
  }
}
