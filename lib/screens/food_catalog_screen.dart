import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../models/food_item.dart';
import '../services/food_database.dart';
import '../services/food_search_service.dart';

class FoodCatalogScreen extends StatefulWidget {
  const FoodCatalogScreen({super.key});

  @override
  State<FoodCatalogScreen> createState() => _FoodCatalogScreenState();
}

class _FoodCatalogScreenState extends State<FoodCatalogScreen> {
  final _controller = TextEditingController();
  final _service = FoodSearchService();
  String query = '';
  List<AiFoodItem> _aiItems = const [];
  String _disclaimer = '';
  String? _error;
  bool _searching = false;

  @override
  void dispose() {
    _controller.dispose();
    _service.close();
    super.dispose();
  }

  Future<void> _searchAi() async {
    final value = _controller.text.trim();
    if (value.length < 2 || _searching) return;
    final state = context.read<AppState>();
    setState(() {
      query = value;
      _searching = true;
      _error = null;
      _aiItems = const [];
      _disclaimer = '';
    });
    try {
      final result = await _service.search(
        query: value,
        languageCode: state.languageCode,
        token: state.accountToken,
      );
      if (!mounted) return;
      setState(() {
        _aiItems = result.items;
        _disclaimer = result.disclaimer;
      });
    } catch (error) {
      if (mounted) {
        setState(
            () => _error = context.l10n.t('networkUnavailable'));
      }
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final normalizedQuery = query.toLowerCase();
    final localItems = FoodDatabase.items.where((food) {
      if (normalizedQuery.isEmpty) return true;
      final name = l10n.t('food.${food.name}').toLowerCase();
      final category = l10n.t('category.${food.category}').toLowerCase();
      return name.contains(normalizedQuery) ||
          category.contains(normalizedQuery);
    }).toList();

    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('foodCatalog'))),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          TextField(
            controller: _controller,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              labelText: l10n.t('searchProducts'),
              border: const OutlineInputBorder(),
              suffixIcon: IconButton(
                tooltip: l10n.t('searchProducts'),
                onPressed: _searching ? null : _searchAi,
                icon: const Icon(Icons.auto_awesome),
              ),
            ),
            onChanged: (value) => setState(() => query = value.trim()),
            onSubmitted: (_) => _searchAi(),
          ),
          if (_searching) ...[
            const SizedBox(height: 10),
            const LinearProgressIndicator(),
            const SizedBox(height: 6),
            Center(child: Text(l10n.t('analyzing'))),
          ],
          if (_error != null) ...[
            const SizedBox(height: 10),
            _MessageCard(text: _error!, error: true),
          ],
          if (_aiItems.isNotEmpty) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.auto_awesome, color: Color(0xFF1463C2)),
                const SizedBox(width: 7),
                Text(l10n.t('recognitionResult'),
                    style: Theme.of(context).textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 6),
            for (final food in _aiItems) _AiFoodCard(food: food),
            if (_disclaimer.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 3, 8, 8),
                child: Text(
                  _disclaimer,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
          ],
          if (localItems.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              l10n.t('foodCatalog'),
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            for (final food in localItems) _LocalFoodCard(food: food),
          ],
        ],
      ),
    );
  }
}

class _AiFoodCard extends StatelessWidget {
  final AiFoodItem food;

  const _AiFoodCard({required this.food});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final recommendation = switch (food.recommendation) {
      'recommended' => FoodRecommendation.recommended,
      'notRecommended' => FoodRecommendation.notRecommended,
      _ => FoodRecommendation.limited,
    };
    final color = _recommendationColor(recommendation);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(_recommendationIcon(recommendation), color: color),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(food.name,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text(
                    '${food.category} • ${l10n.t('carbs')} '
                    '${food.carbsPer100g.toStringAsFixed(1)} ${l10n.t('grams')} • '
                    '${l10n.t('calories')} '
                    '${food.caloriesPer100g.toStringAsFixed(0)} ${l10n.t('kcal')} / '
                    '100 ${l10n.t('grams')}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  if (food.note.isNotEmpty)
                    Text(food.note,
                        style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LocalFoodCard extends StatelessWidget {
  final FoodItem food;

  const _LocalFoodCard({required this.food});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Card(
      child: ListTile(
        dense: true,
        leading: Icon(_recommendationIcon(food.recommendation),
            color: _recommendationColor(food.recommendation)),
        title: Text(l10n.t('food.${food.name}')),
        subtitle: Text(
          '${l10n.t('category.${food.category}')} • '
          '${food.carbsPer100g} ${l10n.t('grams')} '
          '${l10n.t('carbs').toLowerCase()} / 100 ${l10n.t('grams')} • '
          '${food.caloriesPer100g} ${l10n.t('kcal')}',
        ),
      ),
    );
  }
}

class _MessageCard extends StatelessWidget {
  final String text;
  final bool error;

  const _MessageCard({required this.text, required this.error});

  @override
  Widget build(BuildContext context) => Card(
        color: error ? const Color(0xFFFFEEEE) : const Color(0xFFEAF3FF),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Text(text),
        ),
      );
}

IconData _recommendationIcon(FoodRecommendation value) => switch (value) {
      FoodRecommendation.recommended => Icons.check_circle,
      FoodRecommendation.limited => Icons.error,
      FoodRecommendation.notRecommended => Icons.cancel,
    };

Color _recommendationColor(FoodRecommendation value) => switch (value) {
      FoodRecommendation.recommended => Colors.green,
      FoodRecommendation.limited => Colors.orange,
      FoodRecommendation.notRecommended => Colors.red,
    };
