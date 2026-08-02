import 'dart:async';

/// A verified SOS destination. The event id is opaque until the resolver has
/// found it through protected Family/SOS endpoints.
class SosAlertDestination {
  const SosAlertDestination({
    required this.eventId,
    required this.patientId,
    required this.patientName,
    required this.status,
    this.createdAt,
  });

  final String eventId;
  final String patientId;
  final String patientName;
  final String status;
  final DateTime? createdAt;
}

abstract class SosAlertDestinationResolver {
  Future<SosAlertDestination?> resolve({
    required String token,
    required String eventId,
  });
}

enum SosAlertHandlingResult {
  opened,
  authenticationRequired,
  unavailable,
  invalid,
}

/// Parses and authorizes notification and URI opens before any SOS data is
/// shown. A link/payload only carries an opaque event id; it grants no access.
class SosAlertHandler {
  const SosAlertHandler({
    required this.isAuthenticated,
    required this.token,
    required this.resolver,
    required this.onAuthorizedOpen,
  });

  final bool Function() isAuthenticated;
  final String Function() token;
  final SosAlertDestinationResolver resolver;
  final FutureOr<void> Function(SosAlertDestination destination)
      onAuthorizedOpen;

  Future<SosAlertHandlingResult> handleNotificationPayload(
      Map<String, dynamic> payload) {
    if (payload['type']?.toString() != 'family_sos') {
      return Future.value(SosAlertHandlingResult.invalid);
    }
    return _open(eventIdFromValue(payload['event_id']));
  }

  Future<SosAlertHandlingResult> handleDeepLink(Uri uri) =>
      _open(eventIdFromUri(uri));

  Future<SosAlertHandlingResult> _open(String? eventId) async {
    if (eventId == null) return SosAlertHandlingResult.invalid;
    if (!isAuthenticated() || token().isEmpty) {
      return SosAlertHandlingResult.authenticationRequired;
    }
    final destination =
        await resolver.resolve(token: token(), eventId: eventId);
    if (destination == null) return SosAlertHandlingResult.unavailable;
    await onAuthorizedOpen(destination);
    return SosAlertHandlingResult.opened;
  }

  static String? eventIdFromUri(Uri uri) {
    if (uri.scheme != 'glucotrack' ||
        uri.host != 'sos' ||
        uri.pathSegments.length != 1) {
      return null;
    }
    return eventIdFromValue(uri.pathSegments.single);
  }

  /// Flutter can expose an app link to Navigator as `/sos/<id>`.
  static String? eventIdFromRouteName(String? routeName) {
    if (routeName == null || routeName.isEmpty) return null;
    final uri = Uri.tryParse(routeName);
    final direct = uri == null ? null : eventIdFromUri(uri);
    if (direct != null) return direct;
    final segments =
        routeName.split('/').where((part) => part.isNotEmpty).toList();
    if (segments.length != 2 || segments.first != 'sos') return null;
    return eventIdFromValue(segments.last);
  }

  static String? eventIdFromValue(Object? value) {
    final eventId = value?.toString().trim() ?? '';
    return RegExp(r'^[1-9][0-9]*$').hasMatch(eventId) ? eventId : null;
  }
}
