import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../services/insulin_calculator.dart';
import '../widgets/medical_disclaimer.dart';
import '../widgets/responsive_two_column_list.dart';

class CalculatorScreen extends StatefulWidget {
  const CalculatorScreen({super.key});

  @override
  State<CalculatorScreen> createState() => _CalculatorScreenState();
}

class _CalculatorScreenState extends State<CalculatorScreen> {
  final _carbsCtrl = TextEditingController(text: '45');
  final _activeInsulinCtrl = TextEditingController(text: '0');
  ActivityLevel _activityLevel = ActivityLevel.none;
  HealthFactor _healthFactor = HealthFactor.normal;

  @override
  void dispose() {
    _carbsCtrl.dispose();
    _activeInsulinCtrl.dispose();
    super.dispose();
  }

  double _parsePositiveNumber(String value, {double fallback = 0}) {
    final parsed = double.tryParse(value.replaceAll(',', '.'));
    if (parsed == null || !parsed.isFinite || parsed < 0) {
      return fallback;
    }
    return parsed;
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = context.l10n;
    final carbs = _parsePositiveNumber(_carbsCtrl.text);
    final activeInsulin = _parsePositiveNumber(_activeInsulinCtrl.text);
    final result = InsulinCalculator.calculate(
      carbs: carbs,
      currentGlucose: state.glucoseMmol,
      targetGlucose: state.targetGlucose,
      insulinToCarbRatio: state.insulinToCarbRatio,
      correctionFactor: state.correctionFactor,
      activeInsulin: activeInsulin,
      activityLevel: _activityLevel,
      healthFactor: _healthFactor,
    );

    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('calculator'))),
      body: ResponsiveTwoColumnList(
        padding: const EdgeInsets.all(10),
        wideLeftOrder: const [0, 2, 1],
        wideRightOrder: const [3],
        children: [
          const MedicalDisclaimer(),
          const SizedBox(height: 16),
          _InputCard(
            child: Column(
              children: [
                DropdownButtonFormField<DiabetesType>(
                  initialValue: state.diabetesType,
                  decoration: InputDecoration(
                    labelText: l10n.t('diabetesType'),
                    border: const OutlineInputBorder(),
                  ),
                  items: DiabetesType.values
                      .map(
                        (type) => DropdownMenuItem(
                          value: type,
                          child: Text(l10n.diabetesType(type)),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      value == null ? null : state.setDiabetesType(value),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  initialValue:
                      state.glucoseToDisplay(state.glucoseMmol).toStringAsFixed(
                            state.glucoseUnit == GlucoseUnit.mgDl ? 0 : 1,
                          ),
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText:
                        '${l10n.t('currentGlucose')}, ${state.glucoseUnitLabel}',
                    border: const OutlineInputBorder(),
                  ),
                  onChanged: (value) => state.setGlucose(
                    state.glucoseFromDisplay(
                      _parsePositiveNumber(
                        value,
                        fallback: state.glucoseToDisplay(state.glucoseMmol),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _carbsCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: l10n.t('foodCarbsInput'),
                    border: const OutlineInputBorder(),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _activeInsulinCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: l10n.t('activeInsulin'),
                    helperText: l10n.t('activeInsulinHelp'),
                    border: const OutlineInputBorder(),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _InputCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.t('smartAdjustments'),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                Column(
                  children: [
                    _ActivityOptionButton(
                      label: l10n.t('insulinCalculator.calmDay'),
                      icon: Icons.sentiment_satisfied_alt,
                      selected: _activityLevel == ActivityLevel.none,
                      onTap: () =>
                          setState(() => _activityLevel = ActivityLevel.none),
                    ),
                    const SizedBox(height: 8),
                    _ActivityOptionButton(
                      label: l10n.t('insulinCalculator.walk'),
                      icon: Icons.directions_walk,
                      selected: _activityLevel == ActivityLevel.light,
                      onTap: () =>
                          setState(() => _activityLevel = ActivityLevel.light),
                    ),
                    const SizedBox(height: 8),
                    _ActivityOptionButton(
                      label: l10n.t('insulinCalculator.sport'),
                      icon: Icons.directions_run,
                      selected: _activityLevel == ActivityLevel.planned,
                      onTap: () => setState(
                        () => _activityLevel = ActivityLevel.planned,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(l10n.t('illnessStress')),
                  subtitle: Text(l10n.t('illnessStressHelp')),
                  value: _healthFactor == HealthFactor.stressOrIllness,
                  onChanged: (value) {
                    setState(() {
                      _healthFactor = value
                          ? HealthFactor.stressOrIllness
                          : HealthFactor.normal;
                    });
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _ResultCard(result: result),
        ],
      ),
    );
  }
}

class _ActivityOptionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _ActivityOptionButton({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final borderColor =
        selected ? colorScheme.primary : colorScheme.outlineVariant;
    final backgroundColor = selected
        ? Color.alphaBlend(
            colorScheme.primary.withValues(alpha: 0.12),
            colorScheme.surface,
          )
        : colorScheme.surface;
    final foregroundColor =
        selected ? colorScheme.primary : colorScheme.onSurface;

    return Material(
      color: backgroundColor,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: borderColor),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 52),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                Icon(icon, color: foregroundColor),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    softWrap: true,
                    style: TextStyle(
                      color: foregroundColor,
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                AnimatedOpacity(
                  opacity: selected ? 1 : 0,
                  duration: const Duration(milliseconds: 120),
                  child: Icon(Icons.check, color: colorScheme.primary),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InputCard extends StatelessWidget {
  final Widget child;

  const _InputCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(padding: const EdgeInsets.all(16), child: child),
    );
  }
}

class _ResultCard extends StatelessWidget {
  final InsulinResult result;

  const _ResultCard({required this.result});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.t('recommendation'),
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Text(
              '${result.totalDose.toStringAsFixed(1)} ${l10n.t('insulinUnits')}',
              style: const TextStyle(
                fontSize: 42,
                fontWeight: FontWeight.bold,
                color: Color(0xFF075BBB),
              ),
            ),
            Text(
              '${l10n.t('rawEstimate')}: ${result.rawDose.toStringAsFixed(2)}',
              style: const TextStyle(color: Color(0xFF64748B)),
            ),
            const Divider(height: 28),
            _ResultRow(
              label: l10n.t('carbs'),
              value: '${result.carbs.toStringAsFixed(0)} ${l10n.t('grams')}',
            ),
            _ResultRow(
              label: l10n.t('breadUnits'),
              value: result.breadUnits.toStringAsFixed(1),
            ),
            _ResultRow(
              label: l10n.t('mealBolus'),
              value: result.mealBolus.toStringAsFixed(1),
            ),
            _ResultRow(
              label: l10n.t('glucoseCorrection'),
              value: result.correctionBolus.toStringAsFixed(1),
            ),
            _ResultRow(
              label: l10n.t('activeInsulin'),
              value: '-${result.activeInsulin.toStringAsFixed(1)}',
            ),
            if (result.activityAdjustment != 0)
              _ResultRow(
                label: l10n.t('activityAdjustment'),
                value: result.activityAdjustment.toStringAsFixed(1),
              ),
            if (result.healthAdjustment != 0)
              _ResultRow(
                label: l10n.t('stressAdjustment'),
                value: '+${result.healthAdjustment.toStringAsFixed(1)}',
              ),
            if (result.warningKeys.isNotEmpty) ...[
              const SizedBox(height: 12),
              ...result.warningKeys.map(
                (key) => _WarningText(text: l10n.t(key)),
              ),
            ],
            const SizedBox(height: 8),
            ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: Text(l10n.t('explainCalculation')),
              childrenPadding: const EdgeInsets.only(bottom: 8),
              children: <String>[
                '${l10n.t('carbs')}: ${l10n.formatNumber(result.carbs, decimals: 0)}',
                '${l10n.t('breadUnits')}: ${l10n.formatNumber(result.breadUnits, decimals: 1)}',
                '${l10n.t('mealBolus')}: ${l10n.formatNumber(result.mealBolus, decimals: 1)}',
                '${l10n.t('glucoseCorrection')}: ${l10n.formatNumber(result.correctionBolus, decimals: 1)}',
                '${l10n.t('activeInsulin')}: ${l10n.formatNumber(result.activeInsulin, decimals: 1)}',
                '${l10n.t('recommendation')}: ${l10n.formatNumber(result.totalDose, decimals: 1)}',
              ]
                  .map(
                    (line) => Align(
                      alignment: Alignment.centerLeft,
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Text(line),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResultRow extends StatelessWidget {
  final String label;
  final String value;

  const _ResultRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _WarningText extends StatelessWidget {
  final String text;

  const _WarningText({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.warning_amber_rounded,
            color: Colors.orange,
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}
