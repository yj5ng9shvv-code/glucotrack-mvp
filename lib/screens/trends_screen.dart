import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../widgets/localized_text.dart';

class TrendsScreen extends StatelessWidget {
  const TrendsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final readings = [
      ...state.sensorReadings.map(
        (reading) => (reading.time, reading.glucoseMmol),
      ),
      ...state.diaryEntries
          .where((entry) => entry.glucoseMmol > 0)
          .map((entry) => (entry.time, entry.glucoseMmol)),
    ]..sort((a, b) => a.$1.compareTo(b.$1));
    final latest = readings.length > 48
        ? readings.sublist(readings.length - 48)
        : readings;
    final spots = <FlSpot>[];
    for (var i = 0; i < latest.length; i++) {
      spots.add(FlSpot(i.toDouble(), state.glucoseToDisplay(latest[i].$2)));
    }

    return Scaffold(
      appBar: AppBar(title: const LocalizedText('ui.text.76778b95f536')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const LocalizedText(
                    'ui.text.76a74c7fb542',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 260,
                    child: spots.length < 2
                        ? const Center(
                            child: LocalizedText('ui.text.a6567ab58d2d'),
                          )
                        : LineChart(
                            LineChartData(
                              minY: state.glucoseUnit == GlucoseUnit.mgDl
                                  ? 50
                                  : 2.8,
                              maxY: state.glucoseUnit == GlucoseUnit.mgDl
                                  ? 260
                                  : 14.5,
                              gridData: const FlGridData(show: true),
                              titlesData: FlTitlesData(
                                rightTitles: const AxisTitles(),
                                topTitles: const AxisTitles(),
                                bottomTitles: const AxisTitles(),
                                leftTitles: AxisTitles(
                                  sideTitles: SideTitles(
                                    showTitles: true,
                                    reservedSize: 44,
                                    getTitlesWidget: (value, meta) => Text(
                                      value.toStringAsFixed(0),
                                      style: const TextStyle(fontSize: 10),
                                    ),
                                  ),
                                ),
                              ),
                              borderData: FlBorderData(show: true),
                              lineBarsData: [
                                LineChartBarData(
                                  spots: spots,
                                  isCurved: true,
                                  color: const Color(0xFF075BBB),
                                  barWidth: 3,
                                  dotData: const FlDotData(show: false),
                                ),
                              ],
                              extraLinesData: ExtraLinesData(
                                horizontalLines: [
                                  HorizontalLine(
                                    y: state.glucoseToDisplay(3.9),
                                    color: Colors.red.withValues(alpha: 0.7),
                                    strokeWidth: 1,
                                  ),
                                  HorizontalLine(
                                    y: state.glucoseToDisplay(10.0),
                                    color: Colors.orange.withValues(alpha: 0.7),
                                    strokeWidth: 1,
                                  ),
                                ],
                              ),
                            ),
                          ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${context.l10n.t('ui.text.e66be3ccdf73')}: ${state.glucoseUnitLabel}',
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          _StatsCard(values: readings.map((item) => item.$2).toList()),
        ],
      ),
    );
  }
}

class _StatsCard extends StatelessWidget {
  final List<double> values;

  const _StatsCard({required this.values});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    if (values.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: LocalizedText('ui.text.5475da3c99f4'),
        ),
      );
    }
    final average = values.reduce((a, b) => a + b) / values.length;
    final inRange =
        values.where((value) => value >= 3.9 && value <= 10.0).length;
    final low = values.where((value) => value < 3.9).length;
    final high = values.where((value) => value > 10.0).length;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _Metric(
              label: context.l10n.t('averageGlucose'),
              value: state.formatGlucose(average),
            ),
            _Metric(
              label: context.l10n.t('inRange'),
              value: '${(inRange / values.length * 100).toStringAsFixed(0)}%',
            ),
            _Metric(label: context.l10n.t('low'), value: '$low'),
            _Metric(label: context.l10n.t('highValues'), value: '$high'),
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  final String label;
  final String value;

  const _Metric({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 150,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0xFFEAF3FF),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: Color(0xFF64748B))),
              const SizedBox(height: 6),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
