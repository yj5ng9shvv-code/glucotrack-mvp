import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:glucotrack/services/food_search_service.dart';

void main() {
  test('maps non-json backend failure to network error', () async {
    final service = FoodSearchService(
      client: MockClient(
        (request) async => http.Response('server unavailable', 500),
      ),
    );

    expect(
      () => service.search(query: 'apple', languageCode: 'en', token: 'token'),
      throwsA(
        isA<Exception>().having(
          (error) => error.toString(),
          'message',
          'Exception: NETWORK_ERROR',
        ),
      ),
    );
  });
}
