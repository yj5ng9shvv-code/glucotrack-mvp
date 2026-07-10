import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../widgets/localized_text.dart';
import '../widgets/responsive_two_column_list.dart';
import '../models/diary_entry.dart';
import '../services/diary_analysis_service.dart';

class DiaryAnalysisScreen extends StatelessWidget {
  const DiaryAnalysisScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const service = DiaryAnalysisService();
    final l10n = context.l10n;
    final state = context.watch<AppState>();
    final cutoff = DateTime.now().subtract(const Duration(days: 7));
    final entries = state.diaryEntries
        .where((entry) => entry.time.isAfter(cutoff) && entry.glucoseMmol > 0)
        .map((entry) => DiaryEntry(
              time: entry.time,
              glucoseMmol: entry.glucoseMmol,
              type: DiaryEntryType.beforeMeal,
              carbs: entry.carbs,
              insulinUnits: entry.insulinUnits,
              note: [entry.title, entry.note]
                  .where((value) => value.trim().isNotEmpty)
                  .join(' — '),
            ))
        .toList()
      ..sort((a, b) => b.time.compareTo(a.time));
    final analysis = service.analyze(entries);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('diaryAnalysis'))),
      body: ResponsiveTwoColumnList(
        padding: const EdgeInsets.all(16),
        children: [
          const _DisclaimerCard(),
          const SizedBox(height: 12),
          _SummaryCard(analysis: analysis, state: state),
          const SizedBox(height: 12),
          _SectionCard(
            title: l10n.t('patterns'),
            icon: Icons.insights,
            children: [
              _BulletText(text: l10n.t('afterMealHighPattern')),
              if (analysis.lowCount > 0)
                _BulletText(text: l10n.t('lowPattern')),
            ],
          ),
          const SizedBox(height: 12),
          _SectionCard(
            title: l10n.t('discussWithDoctor'),
            icon: Icons.medical_information,
            children: [
              _BulletText(text: l10n.t('doctorRecommendation')),
            ],
          ),
          const SizedBox(height: 12),
          _EntriesCard(entries: entries, state: state),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final DiaryAnalysis analysis;
  final AppState state;

  const _SummaryCard({required this.analysis, required this.state});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.t('sevenDaySummary'),
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _MetricTile(
                  label: l10n.t('averageGlucose'),
                  value: state
                      .glucoseToDisplay(analysis.averageGlucose)
                      .toStringAsFixed(
                        state.glucoseUnit == GlucoseUnit.mgDl ? 0 : 1,
                      ),
                  unit: state.glucoseUnitLabel,
                ),
                _MetricTile(
                  label: l10n.t('inRange'),
                  value: '${analysis.inRangePercent.toStringAsFixed(0)}%',
                  unit: '${analysis.inRangeCount}/${analysis.totalCount}',
                ),
                _MetricTile(
                  label: l10n.t('minimum'),
                  value: state
                      .glucoseToDisplay(analysis.minGlucose)
                      .toStringAsFixed(
                        state.glucoseUnit == GlucoseUnit.mgDl ? 0 : 1,
                      ),
                  unit: state.glucoseUnitLabel,
                ),
                _MetricTile(
                  label: l10n.t('maximum'),
                  value: state
                      .glucoseToDisplay(analysis.maxGlucose)
                      .toStringAsFixed(
                        state.glucoseUnit == GlucoseUnit.mgDl ? 0 : 1,
                      ),
                  unit: state.glucoseUnitLabel,
                ),
              ],
            ),
            const SizedBox(height: 14),
            LinearProgressIndicator(
              value: analysis.inRangePercent / 100,
              minHeight: 10,
              borderRadius: BorderRadius.circular(99),
            ),
            const SizedBox(height: 8),
            Text(
              '${l10n.t('low')}: ${analysis.lowCount} • ${l10n.t('highValues')}: ${analysis.highCount}',
              style: const TextStyle(color: Color(0xFF64748B)),
            ),
          ],
        ),
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  final String label;
  final String value;
  final String unit;

  const _MetricTile({
    required this.label,
    required this.value,
    required this.unit,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 145,
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
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF075BBB),
                ),
              ),
              Text(unit, style: const TextStyle(fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: const Color(0xFF075BBB)),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _EntriesCard extends StatelessWidget {
  final List<DiaryEntry> entries;
  final AppState state;

  const _EntriesCard({required this.entries, required this.state});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.t('recentEntries'),
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            ...entries.reversed.map(
              (entry) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  _entryIcon(entry.type),
                  color: _glucoseColor(entry.glucoseMmol),
                ),
                title: Text(
                  state.formatGlucose(entry.glucoseMmol),
                ),
                subtitle: Text(_entryTypeLabel(context, entry.type)),
                trailing: Text(
                  entry.carbs > 0
                      ? '${entry.carbs} ${l10n.t('grams')} / ${entry.insulinUnits.toStringAsFixed(1)}'
                      : entry.insulinUnits.toStringAsFixed(1),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _entryIcon(DiaryEntryType type) {
    return switch (type) {
      DiaryEntryType.fasting => Icons.wb_sunny_outlined,
      DiaryEntryType.beforeMeal => Icons.restaurant_outlined,
      DiaryEntryType.afterMeal => Icons.dinner_dining,
      DiaryEntryType.bedtime => Icons.nightlight_outlined,
    };
  }

  String _entryTypeLabel(BuildContext context, DiaryEntryType type) {
    return switch (type) {
      DiaryEntryType.fasting => context.l10n.t('fasting'),
      DiaryEntryType.beforeMeal => context.l10n.t('beforeMeal'),
      DiaryEntryType.afterMeal => context.l10n.t('afterMeal'),
      DiaryEntryType.bedtime => context.l10n.t('bedtime'),
    };
  }

  Color _glucoseColor(double value) {
    if (value < 3.9) {
      return Colors.red;
    }
    if (value > 10.0) {
      return Colors.orange;
    }
    return Colors.green;
  }
}

class _BulletText extends StatelessWidget {
  final String text;

  const _BulletText({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const LocalizedText('ui.text.6f4cf552278a'),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}

class _DisclaimerCard extends StatelessWidget {
  const _DisclaimerCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Card(
      color: const Color(0xFFFFF7E6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.warning_amber_rounded, color: Colors.orange),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                l10n.t('medicalDisclaimer'),
                style: const TextStyle(fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
