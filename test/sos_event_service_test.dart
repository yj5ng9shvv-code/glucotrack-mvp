import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:glucotrack/services/sos_event_service.dart';

void main() {
  test('creates an authenticated SOS event with the canonical mmol/L payload',
      () async {
    final service = SosEventService(
      client: MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.path, '/api/sos/events');
        expect(request.headers['authorization'], 'Bearer jwt-token');
        expect(jsonDecode(request.body), {
          'glucoseMmol': 3.2,
          'latitude': 52.2297,
          'longitude': 21.0122,
          'accuracyMeters': 8.0,
        });
        return http.Response(jsonEncode({'id': '42', 'status': 'active'}), 201);
      }),
    );

    final id = await service.activate(
      token: 'jwt-token',
      glucoseMmol: 3.2,
      latitude: 52.2297,
      longitude: 21.0122,
      accuracyMeters: 8,
    );

    expect(id, '42');
  });

  test('rejects malformed SOS coordinates before a request is sent', () async {
    final service = SosEventService(
      client: MockClient((_) async => throw StateError('request must not run')),
    );

    expect(
      () => service.activate(token: 'jwt-token', latitude: 91, longitude: 0),
      throwsArgumentError,
    );
  });

  test('surfaces an unauthorized SOS response', () async {
    final service = SosEventService(
      client: MockClient((_) async => http.Response('', 401)),
    );

    expect(
      () => service.activate(token: 'expired-token'),
      throwsStateError,
    );
  });
}
