import '../models/food_item.dart';

class FoodDatabase {
  static const items = <FoodItem>[
    FoodItem(
      name: 'buckwheat',
      category: 'grains',
      carbsPer100g: 21,
      caloriesPer100g: 110,
      recommendation: FoodRecommendation.recommended,
    ),
    FoodItem(
      name: 'chickenBreast',
      category: 'meat',
      carbsPer100g: 0,
      caloriesPer100g: 165,
      recommendation: FoodRecommendation.recommended,
    ),
    FoodItem(
      name: 'cucumber',
      category: 'vegetables',
      carbsPer100g: 3.6,
      caloriesPer100g: 15,
      recommendation: FoodRecommendation.recommended,
    ),
    FoodItem(
      name: 'apple',
      category: 'fruits',
      carbsPer100g: 14,
      caloriesPer100g: 52,
      recommendation: FoodRecommendation.limited,
    ),
    FoodItem(
      name: 'whiteRice',
      category: 'grains',
      carbsPer100g: 28,
      caloriesPer100g: 130,
      recommendation: FoodRecommendation.limited,
    ),
    FoodItem(
      name: 'sweetSoda',
      category: 'drinks',
      carbsPer100g: 11,
      caloriesPer100g: 42,
      recommendation: FoodRecommendation.notRecommended,
    ),
    FoodItem(
      name: 'chocolateBar',
      category: 'sweets',
      carbsPer100g: 60,
      caloriesPer100g: 480,
      recommendation: FoodRecommendation.notRecommended,
    ),
  ];
}
