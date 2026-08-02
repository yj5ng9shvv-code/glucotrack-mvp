import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/family_watch/sos_alert_handler.dart';

void main() {
  test('notification tap opens an authorized SOS destination', () async {
    SosAlertDestination? opened;
    final handler = SosAlertHandler(
      isAuthenticated: () => true,
      token: () => 'caregiver-token',
      resolver: _Resolver(_destination()),
      onAuthorizedOpen: (destination) => opened = destination,
    );

    expect(
      await handler.handleNotificationPayload(
        const {'type': 'family_sos', 'event_id': '42'},
      ),
      SosAlertHandlingResult.opened,
    );
    expect(opened?.eventId, '42');
    expect(opened?.patientId, 'patient-7');
  });

  test('unauthorized deep link is rejected before SOS lookup', () async {
    final resolver = _Resolver(_destination());
    final handler = SosAlertHandler(
      isAuthenticated: () => false,
      token: () => '',
      resolver: resolver,
      onAuthorizedOpen: (_) {},
    );

    expect(
      await handler.handleDeepLink(Uri.parse('glucotrack://sos/42')),
      SosAlertHandlingResult.authenticationRequired,
    );
    expect(resolver.calls, 0);
  });

  test('authorized caregiver opens the map destination after verification',
      () async {
    SosAlertDestination? opened;
    final handler = SosAlertHandler(
      isAuthenticated: () => true,
      token: () => 'caregiver-token',
      resolver: _Resolver(_destination()),
      onAuthorizedOpen: (destination) => opened = destination,
    );

    expect(
      await handler.handleDeepLink(Uri.parse('glucotrack://sos/42')),
      SosAlertHandlingResult.opened,
    );
    expect(opened?.patientName, 'Alex');
  });

  test('invalid SOS id is handled without an API lookup', () async {
    final resolver = _Resolver(_destination());
    final handler = SosAlertHandler(
      isAuthenticated: () => true,
      token: () => 'caregiver-token',
      resolver: resolver,
      onAuthorizedOpen: (_) {},
    );

    expect(
      await handler.handleDeepLink(Uri.parse('glucotrack://sos/not-an-id')),
      SosAlertHandlingResult.invalid,
    );
    expect(resolver.calls, 0);
  });
}

SosAlertDestination _destination() => const SosAlertDestination(
      eventId: '42',
      patientId: 'patient-7',
      patientName: 'Alex',
      status: 'ACTIVE',
    );

class _Resolver implements SosAlertDestinationResolver {
  _Resolver(this.destination);

  final SosAlertDestination? destination;
  var calls = 0;

  @override
  Future<SosAlertDestination?> resolve({
    required String token,
    required String eventId,
  }) async {
    calls++;
    return destination;
  }
}
