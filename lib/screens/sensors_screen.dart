import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../widgets/localized_text.dart';
import '../widgets/responsive_two_column_list.dart';
import '../models/sensor_reading.dart';
import '../services/sensor_adapters.dart';

class SensorsScreen extends StatefulWidget {
  const SensorsScreen({super.key});

  @override
  State<SensorsScreen> createState() => _SensorsScreenState();
}

class _SensorsScreenState extends State<SensorsScreen> {
  final _registry = const SensorAdapterRegistry();
  bool _syncing = false;

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _connect(SensorBrand brand) async {
    await context.read<AppState>().connectSensor(brand);
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${_brandLabel(brand)} — ${context.l10n.t('connectedDevices')}',
        ),
      ),
    );
  }

  Future<void> _sync() async {
    final state = context.read<AppState>();
    final brand = state.connectedSensorBrand;
    if (brand == null || _syncing) {
      return;
    }
    setState(() => _syncing = true);
    try {
      final readings = await _registry
          .adapterFor(brand)
          .fetchReadings(currentGlucoseMmol: state.glucoseMmol);
      await state.replaceSensorReadings(readings);
    } on SensorIntegrationException {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.t('networkUnavailable'))),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _syncing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final latest =
        state.sensorReadings.isEmpty ? null : state.sensorReadings.first;
    return Scaffold(
      appBar: AppBar(title: const LocalizedText('ui.text.76e87faaf0de')),
      body: ResponsiveTwoColumnList(
        padding: const EdgeInsets.all(16),
        children: [
          _CurrentSensorCard(
            brand: state.connectedSensorBrand,
            latest: latest,
            lastSyncAt: state.lastSensorSyncAt,
            state: state,
            syncing: _syncing,
            onSync: _sync,
            onDisconnect: state.connectedSensorBrand == null
                ? null
                : () => context.read<AppState>().disconnectSensor(),
          ),
          const SizedBox(height: 12),
          _BrandsCard(
            connected: state.connectedSensorBrand,
            adapters: _registry.adapters,
            onConnect: _connect,
          ),
          const SizedBox(height: 12),
          _HistoryCard(readings: state.sensorReadings, state: state),
        ],
      ),
    );
  }
}

class _CurrentSensorCard extends StatelessWidget {
  final SensorBrand? brand;
  final SensorReading? latest;
  final DateTime? lastSyncAt;
  final AppState state;
  final bool syncing;
  final VoidCallback onSync;
  final VoidCallback? onDisconnect;

  const _CurrentSensorCard({
    required this.brand,
    required this.latest,
    required this.lastSyncAt,
    required this.state,
    required this.syncing,
    required this.onSync,
    required this.onDisconnect,
  });

  @override
  Widget build(BuildContext context) {
    final latestReading = latest;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.sensors, color: Color(0xFF075BBB)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    brand == null ? 'No sensor connected' : _brandLabel(brand!),
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (latestReading == null)
              const LocalizedText('ui.text.00e86cb7d794')
            else
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    state
                        .glucoseToDisplay(latestReading.glucoseMmol)
                        .toStringAsFixed(
                          state.glucoseUnit == GlucoseUnit.mgDl ? 0 : 1,
                        ),
                    style: const TextStyle(
                      fontSize: 44,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF075BBB),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(state.glucoseUnitLabel),
                  ),
                  const SizedBox(width: 12),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(_trendIcon(latestReading.trend)),
                  ),
                ],
              ),
            if (lastSyncAt != null) ...[
              const SizedBox(height: 6),
              Text(
                '${context.l10n.t('cloudSync')}: ${_timeLabel(lastSyncAt!)}',
                style: const TextStyle(color: Color(0xFF64748B)),
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: brand == null || syncing ? null : onSync,
                    icon: syncing
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.sync),
                    label: Text(syncing ? 'Syncing...' : 'Sync data'),
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  onPressed: onDisconnect,
                  icon: const Icon(Icons.link_off),
                  label: const LocalizedText('ui.text.4190d9f8052e'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _BrandsCard extends StatelessWidget {
  final SensorBrand? connected;
  final List<SensorAdapter> adapters;
  final ValueChanged<SensorBrand> onConnect;

  const _BrandsCard({
    required this.connected,
    required this.adapters,
    required this.onConnect,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const LocalizedText(
              'ui.text.2405ea3b2e02',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            ...adapters.map(
              (adapter) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  _brandIcon(adapter.brand),
                  color: const Color(0xFF075BBB),
                ),
                title: Text(adapter.displayName),
                subtitle: Text(
                  '${adapter.authMethod}'
                  '${adapter.requiresBackend ? ' - backend' : ''}'
                  '${adapter.requiresNativeSdk ? ' - native SDK' : ''}',
                ),
                trailing: connected == adapter.brand
                    ? const Icon(Icons.check_circle, color: Colors.green)
                    : OutlinedButton(
                        onPressed: () => onConnect(adapter.brand),
                        child: const LocalizedText('ui.text.a2c65952e471'),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  final List<SensorReading> readings;
  final AppState state;

  const _HistoryCard({required this.readings, required this.state});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const LocalizedText(
              'ui.text.7e5746a89c82',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            if (readings.isEmpty)
              const LocalizedText('ui.text.a107a26899d6')
            else
              ...readings.take(30).map(
                    (reading) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Text(
                        _trendIcon(reading.trend),
                        style: const TextStyle(fontSize: 22),
                      ),
                      title: Text(state.formatGlucose(reading.glucoseMmol)),
                      subtitle: Text(
                        '${_brandLabel(reading.brand)} - ${_timeLabel(reading.time)}',
                      ),
                      trailing: Text(_glucoseStatus(reading.glucoseMmol)),
                    ),
                  ),
          ],
        ),
      ),
    );
  }
}

String _brandLabel(SensorBrand brand) {
  return switch (brand) {
    SensorBrand.freestyleLibre => 'FreeStyle Libre',
    SensorBrand.dexcom => 'Dexcom',
    SensorBrand.medtronicGuardian => 'Medtronic Guardian',
    SensorBrand.accuChek => 'Accu-Chek',
    SensorBrand.contour => 'Contour Next',
    SensorBrand.yuwellAnytime => 'Yuwell Anytime',
    SensorBrand.appleHealth => 'Apple Health',
    SensorBrand.healthConnect => 'Android Health Connect',
    SensorBrand.manual => 'Manual entry',
  };
}

IconData _brandIcon(SensorBrand brand) {
  return switch (brand) {
    SensorBrand.appleHealth => Icons.favorite,
    SensorBrand.healthConnect => Icons.android,
    SensorBrand.manual => Icons.edit,
    _ => Icons.sensors,
  };
}

String _trendIcon(SensorTrend trend) {
  return switch (trend) {
    SensorTrend.risingFast => '^^',
    SensorTrend.rising => '^',
    SensorTrend.steady => '->',
    SensorTrend.falling => 'v',
    SensorTrend.fallingFast => 'vv',
    SensorTrend.unknown => '*',
  };
}

String _glucoseStatus(double value) {
  if (value < 3.9) {
    return 'Low';
  }
  if (value > 10.0) {
    return 'High';
  }
  return 'In range';
}

String _timeLabel(DateTime value) {
  final hour = value.hour.toString().padLeft(2, '0');
  final minute = value.minute.toString().padLeft(2, '0');
  final day = value.day.toString().padLeft(2, '0');
  final month = value.month.toString().padLeft(2, '0');
  return '$day.$month $hour:$minute';
}
