import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../services/digital_twin_service.dart';

class DigitalTwinScreen extends StatefulWidget {
  const DigitalTwinScreen({super.key});

  @override
  State<DigitalTwinScreen> createState() => _DigitalTwinScreenState();
}

class _DigitalTwinScreenState extends State<DigitalTwinScreen> {
  final _carbsController = TextEditingController();
  bool _enabled = false;
  bool _loaded = false;
  DigitalTwinPrediction? _prediction;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_loaded) _loadConsent();
  }

  Future<void> _loadConsent() async {
    final state = context.read<AppState>();
    final prefs = await SharedPreferences.getInstance();
    final key = 'digitalTwinEnabled:${state.accountEmail}';
    if (mounted) setState(() { _enabled = prefs.getBool(key) ?? false; _loaded = true; });
  }

  Future<void> _setEnabled(bool value) async {
    final state = context.read<AppState>();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('digitalTwinEnabled:${state.accountEmail}', value);
    if (mounted) setState(() { _enabled = value; if (!value) _prediction = null; });
  }

  Future<void> _deleteModel() async {
    final state = context.read<AppState>();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('digitalTwinEnabled:${state.accountEmail}');
    if (mounted) setState(() { _enabled = false; _prediction = null; });
  }

  void _predict(AppState state) {
    final carbs = int.tryParse(_carbsController.text.trim());
    if (carbs == null || carbs < 0) return;
    const service = DigitalTwinService();
    setState(() => _prediction = service.predictForCarbs(
          state.diaryEntries,
          currentGlucoseMmol: state.glucoseMmol,
          carbs: carbs,
        ));
  }

  @override
  void dispose() { _carbsController.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = context.watch<AppState>();
    final profile = const DigitalTwinService().profileFor(state.diaryEntries);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('digitalTwin'))),
      body: !_loaded ? const Center(child: CircularProgressIndicator()) : Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: ListView(padding: const EdgeInsets.all(16), children: [
            Card(child: SwitchListTile(
              value: _enabled,
              onChanged: _setEnabled,
              secondary: const Icon(Icons.privacy_tip_outlined),
              title: Text(l10n.t('digitalTwinConsent')),
              subtitle: Text(l10n.t('aiInformationNotice')),
            )),
            const SizedBox(height: 12),
            Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${l10n.t('recentEntries')}: ${profile.glucoseReadings}'),
                const SizedBox(height: 8),
                Text('${l10n.t('digitalTwinCases')}: ${profile.matchedCases}'),
                const SizedBox(height: 8),
                Text(profile.readiness == DigitalTwinReadiness.insufficient
                    ? l10n.t('insufficient_data') : l10n.t('patterns')),
              ],
            ))),
            if (_enabled) ...[
              const SizedBox(height: 12),
              Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.t('digitalTwinScenario'), style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  TextField(controller: _carbsController, keyboardType: TextInputType.number,
                    decoration: InputDecoration(labelText: l10n.t('carbs'))),
                  const SizedBox(height: 12),
                  FilledButton(onPressed: () => _predict(state), child: Text(l10n.t('digitalTwinScenario'))),
                  if (_prediction != null) ...[
                    const SizedBox(height: 12),
                    Text('${l10n.t('digitalTwinRange')}: ${state.formatGlucose(_prediction!.lowerMmol)}–${state.formatGlucose(_prediction!.upperMmol)} ${state.glucoseUnitLabel}'),
                    Text('${l10n.t('digitalTwinConfidence')}: ${(_prediction!.confidence * 100).toStringAsFixed(0)}%'),
                  ] else const SizedBox.shrink(),
                ],
              ))),
              TextButton.icon(onPressed: _deleteModel, icon: const Icon(Icons.delete_outline), label: Text(l10n.t('digitalTwinDelete'))),
            ],
          ]),
        ),
      ),
    );
  }
}
