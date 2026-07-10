import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/services/subscription_service.dart';

void main() {
  test('parses family subscription and connected devices', () {
    final subscription = ServerSubscription.fromJson({
      'premium': true,
      'premiumStatus': 'active',
      'premiumPlan': 'family',
      'premiumUntil': '2027-01-01T00:00:00.000Z',
      'deviceLimit': 8,
      'devices': [
        {
          'id': '12',
          'deviceId': 'device-12345678',
          'name': 'Android device',
          'platform': 'android',
          'lastSeenAt': '2026-07-03T10:00:00.000Z',
        },
      ],
    });

    expect(subscription.active, isTrue);
    expect(subscription.plan, 'family');
    expect(subscription.deviceLimit, 8);
    expect(subscription.devices, hasLength(1));
    expect(subscription.devices.single.platform, 'android');
  });
}
