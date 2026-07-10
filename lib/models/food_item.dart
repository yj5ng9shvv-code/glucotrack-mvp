class FoodItem {
  final String name;
  final String category;
  final double carbsPer100g;
  final double caloriesPer100g;
  final FoodRecommendation recommendation;

  const FoodItem({
    required this.name,
    required this.category,
    required this.carbsPer100g,
    required this.caloriesPer100g,
    required this.recommendation,
  });
}

enum FoodRecommendation { recommended, limited, notRecommended }
