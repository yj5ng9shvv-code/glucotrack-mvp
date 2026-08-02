import 'dart:async';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'sos_alert_handler.dart';

const _sosChannelId = 'glucotrack_family_sos';
const _sosNotificationId = 5301;

/// Handles provider payload hand-off and presents a privacy-preserving local
/// foreground alert. Remote FCM/APNs reception remains provider-specific and
/// should call [handleIncomingPayload] when configured.
class SosAlertNotificationHandler {
  SosAlertNotificationHandler({FlutterLocalNotificationsPlugin? notifications})
      : _notifications = notifications ?? FlutterLocalNotificationsPlugin();

  final FlutterLocalNotificationsPlugin _notifications;
  FutureOr<void> Function(String eventId)? _onTap;
  bool _initialized = false;

  Future<void> initialize({
    required FutureOr<void> Function(String eventId) onTap,
  }) async {
    _onTap = onTap;
    if (_initialized) return;
    _initialized = true;

    const channel = AndroidNotificationChannel(
      _sosChannelId,
      'Family Watch SOS alerts',
      description: 'Urgent Family Watch emergency notifications.',
      importance: Importance.high,
      playSound: true,
      enableVibration: true,
    );
    await _notifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
    await _notifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
      onDidReceiveNotificationResponse: (response) {
        final eventId = SosAlertHandler.eventIdFromValue(response.payload);
        if (eventId != null) unawaited(_dispatch(eventId));
      },
    );
    final launchDetails =
        await _notifications.getNotificationAppLaunchDetails();
    if (launchDetails?.didNotificationLaunchApp ?? false) {
      final eventId = SosAlertHandler.eventIdFromValue(
        launchDetails?.notificationResponse?.payload,
      );
      if (eventId != null) await _dispatch(eventId);
    }
  }

  /// Call from a remote-push foreground/background callback. It never trusts
  /// patient data from the payload and only forwards a validated opaque id.
  Future<void> handleIncomingPayload(Map<String, dynamic> payload) async {
    if (payload['type']?.toString() != 'family_sos') return;
    final eventId = SosAlertHandler.eventIdFromValue(payload['event_id']);
    if (eventId == null) return;
    await showForegroundAlert(eventId: eventId);
  }

  Future<void> showForegroundAlert({required String eventId}) {
    return _notifications.show(
      _sosNotificationId,
      'Family Watch emergency alert',
      'Open GlucoTrack to check the current SOS status.',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _sosChannelId,
          'Family Watch SOS alerts',
          channelDescription: 'Urgent Family Watch emergency notifications.',
          importance: Importance.high,
          priority: Priority.high,
          category: AndroidNotificationCategory.alarm,
          visibility: NotificationVisibility.private,
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: eventId,
    );
  }

  Future<void> _dispatch(String eventId) async {
    await _onTap?.call(eventId);
  }
}
