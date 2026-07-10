import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auth_service.dart';

class AiFoodItem {
  final String name;
  final String category;
  final double carbsPer100g;
  final double caloriesPer100g;
  final double proteinPer100g;
  final double fatPer100g;
  final double fiberPer100g;
  final double servingGrams;
  final String recommendation;
  final String note;

  const AiFoodItem({
    required this.name,
    required this.category,
    required this.carbsPer100g,
    required this.caloriesPer100g,
    required this.proteinPer100g,
    required this.fatPer100g,
    required this.fiberPer100g,
    required this.servingGrams,
    required this.recommendation,
    required this.note,
  });

  factory AiFoodItem.fromJson(Map<String, dynamic> json) => AiFoodItem(
        name: json['name']?.toString() ?? '',
        category: json['category']?.toString() ?? '',
        carbsPer100g: _number(json['carbs_per_100g']),
        caloriesPer100g: _number(json['calories_per_100g']),
        proteinPer100g: _number(json['protein_per_100g']),
        fatPer100g: _number(json['fat_per_100g']),
        fiberPer100g: _number(json['fiber_per_100g']),
        servingGrams: _number(json['serving_grams']),
        recommendation: json['recommendation']?.toString() ?? 'limited',
        note: json['note']?.toString() ?? '',
      );

  static double _number(Object? value) =>
      value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
}

class FoodSearchResult {
  final List<AiFoodItem> items;
  final String disclaimer;

  const FoodSearchResult({required this.items, required this.disclaimer});
}

class FoodSearchService {
  FoodSearchService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<FoodSearchResult> search({
    required String query,
    required String languageCode,
    required String token,
  }) async {
    final baseUrl = AuthService.apiBaseUrl.replaceFirst(RegExp(r'/$'), '');
    if (baseUrl.isEmpty || token.isEmpty) {
      throw Exception('AUTH_REQUIRED');
    }
    final response = await _client
        .post(
          Uri.parse('$baseUrl/ai/search-food'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            'query': query,
            'language_code': languageCode,
          }),
        )
        .timeout(const Duration(seconds: 30));
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('NETWORK_ERROR');
    }
    final map = decoded is Map
        ? decoded.map((key, value) => MapEntry(key.toString(), value))
        : <String, dynamic>{};
    final items = map['items'];
    return FoodSearchResult(
      items: items is List
          ? items
              .whereType<Map>()
              .map((item) => AiFoodItem.fromJson(
                    item.map((key, value) => MapEntry(key.toString(), value)),
                  ))
              .where((item) => item.name.isNotEmpty)
              .toList()
          : const [],
      disclaimer: map['disclaimer']?.toString() ?? '',
    );
  }

  void close() => _client.close();
}
