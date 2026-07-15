import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:glucotrack/services/subscription_service.dart';

void main() {
  test('maps lowercase API error code to verified email message', () async {
    final service = SubscriptionService(
      client: MockClient((request) async => http.Response(
            '{"code":"email_not_verified"}',
            400,
            headers: {'content-type': 'application/json'},
          )),
    );

    expect(
      () => service.createCheckout('token', 'family'),
      throwsA(
        isA<SubscriptionException>().having(
          (error) => error.message,
          'message',
          'ui.text.a7ac75be7b72',
        ),
      ),
    );
  });

  test('maps lowercase trial-used error code to trialEndsTomorrow message', () async {
    final service = SubscriptionService(
      client: MockClient((request) async => http.Response(
            '{"code":"trial_already_used"}',
            409,
            headers: {'content-type': 'application/json'},
          )),
    );

    expect(
      () => service.createCheckout('token', 'family'),
      throwsA(
        isA<SubscriptionException>().having(
          (error) => error.message,
          'message',
          'trialEndsTomorrow',
        ),
      ),
    );
  });

  test('keeps uppercase trial-used mapping for backwards compatibility', () async {
    final service = SubscriptionService(
      client: MockClient((request) async => http.Response(
            '{"code":"TRIAL_ALREADY_USED"}',
            409,
            headers: {'content-type': 'application/json'},
          )),
    );

    expect(
      () => service.createCheckout('token', 'family'),
      throwsA(
        isA<SubscriptionException>().having(
          (error) => error.message,
          'message',
          'trialEndsTomorrow',
        ),
      ),
    );
  });

  test('maps lowercase error field to trial message', () async {
    final service = SubscriptionService(
      client: MockClient((request) async => http.Response(
            '{"error":"trial_already_used"}',
            409,
            headers: {'content-type': 'application/json'},
          )),
    );

    expect(
      () => service.createCheckout('token', 'family'),
      throwsA(
        isA<SubscriptionException>().having(
          (error) => error.message,
          'message',
          'trialEndsTomorrow',
        ),
      ),
    );
  });

  test('maps spaced error text to trial message', () async {
    final service = SubscriptionService(
      client: MockClient((request) async => http.Response(
            '{"error":"trial already used"}',
            409,
            headers: {'content-type': 'application/json'},
          )),
    );

    expect(
      () => service.createCheckout('token', 'family'),
      throwsA(
        isA<SubscriptionException>().having(
          (error) => error.message,
          'message',
          'trialEndsTomorrow',
        ),
      ),
    );
  });

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
