class RecognizedFood {
  final String name;
  final double portionGrams;
  final double carbsPer100g;
  final double carbsGrams;
  final double calories;
  final double confidence;
  final String note;

  const RecognizedFood({
    required this.name,
    required this.portionGrams,
    required this.carbsPer100g,
    required this.carbsGrams,
    required this.calories,
    required this.confidence,
    required this.note,
  });

  factory RecognizedFood.fromJson(Map<String, dynamic> json) {
    return RecognizedFood(
      name: _stringValue(json['name'], fallback: 'i18n:foodPhoto'),
      portionGrams: _doubleValue(json['portion_grams']),
      carbsPer100g: _doubleValue(json['carbs_per_100g']),
      carbsGrams: _doubleValue(json['carbs_grams']),
      calories: _doubleValue(json['calories']),
      confidence: _doubleValue(json['confidence']).clamp(0, 1).toDouble(),
      note: _stringValue(json['note']),
    );
  }

  static String _stringValue(Object? value, {String fallback = ''}) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? fallback : text;
  }

  static double _doubleValue(Object? value) {
    if (value is num) {
      return value.toDouble();
    }
    if (value is String) {
      return double.tryParse(value.replaceAll(',', '.')) ?? 0;
    }
    return 0;
  }
}

class FoodRecognitionResult {
  final List<RecognizedFood> foods;
  final double totalCarbsGrams;
  final double totalCalories;
  final List<String> warnings;
  final String summary;
  final bool remote;

  const FoodRecognitionResult({
    required this.foods,
    required this.totalCarbsGrams,
    required this.totalCalories,
    required this.warnings,
    required this.summary,
    required this.remote,
  });

  factory FoodRecognitionResult.fromJson(
    Map<String, dynamic> json, {
    required bool remote,
  }) {
    final foodsJson = json['foods'];
    final foods = foodsJson is List
        ? foodsJson
            .whereType<Map>()
            .map((item) => RecognizedFood.fromJson(
                  item.map((key, value) => MapEntry(key.toString(), value)),
                ))
            .toList()
        : <RecognizedFood>[];

    final totalCarbs = _doubleValue(json['total_carbs_grams']);
    final totalCalories = _doubleValue(json['total_calories']);

    return FoodRecognitionResult(
      foods: foods,
      totalCarbsGrams: totalCarbs > 0
          ? totalCarbs
          : foods.fold<double>(0, (sum, food) => sum + food.carbsGrams),
      totalCalories: totalCalories > 0
          ? totalCalories
          : foods.fold<double>(0, (sum, food) => sum + food.calories),
      warnings: _stringList(json['warnings']),
      summary: _stringValue(json['summary']),
      remote: remote,
    );
  }

  factory FoodRecognitionResult.localFallback() {
    return const FoodRecognitionResult(
      foods: [
        RecognizedFood(
          name: 'i18n:food.buckwheat',
          portionGrams: 100,
          carbsPer100g: 21,
          carbsGrams: 21,
          calories: 110,
          confidence: 0.45,
          note: 'i18n:foodPhotoDisclaimer',
        ),
        RecognizedFood(
          name: 'i18n:food.chickenBreast',
          portionGrams: 150,
          carbsPer100g: 0,
          carbsGrams: 0,
          calories: 248,
          confidence: 0.35,
          note: 'i18n:foodPhotoDisclaimer',
        ),
        RecognizedFood(
          name: 'i18n:category.vegetables',
          portionGrams: 100,
          carbsPer100g: 4,
          carbsGrams: 4,
          calories: 30,
          confidence: 0.35,
          note: 'i18n:foodPhotoDisclaimer',
        ),
      ],
      totalCarbsGrams: 25,
      totalCalories: 388,
      warnings: ['i18n:foodPhotoDisclaimer'],
      summary: 'i18n:foodPhoto',
      remote: false,
    );
  }

  static String _stringValue(Object? value, {String fallback = ''}) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? fallback : text;
  }

  static double _doubleValue(Object? value) {
    if (value is num) {
      return value.toDouble();
    }
    if (value is String) {
      return double.tryParse(value.replaceAll(',', '.')) ?? 0;
    }
    return 0;
  }

  static List<String> _stringList(Object? value) {
    if (value is! List) {
      return const [];
    }
    return value
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }
}
