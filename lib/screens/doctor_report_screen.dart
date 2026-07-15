import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../widgets/responsive_two_column_list.dart';
import '../models/diary_entry.dart';
import '../models/diary_log_entry.dart';
import '../services/diary_analysis_service.dart';
import '../services/doctor_report_service.dart';
import '../services/report_storage_service.dart';

class DoctorReportScreen extends StatelessWidget {
  const DoctorReportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const diaryService = DiaryAnalysisService();
    const reportService = DoctorReportService();
    final l10n = context.l10n;
    final appState = context.watch<AppState>();
    final entries = appState.diaryEntries
        .map(
          (entry) => DiaryEntry(
            time: entry.time,
            glucoseMmol: entry.glucoseMmol,
            type: switch (entry.type) {
              DiaryLogType.meal => DiaryEntryType.afterMeal,
              DiaryLogType.glucose => DiaryEntryType.fasting,
              _ => DiaryEntryType.beforeMeal,
            },
            carbs: entry.carbs,
            insulinUnits: entry.insulinUnits,
            note: entry.note,
          ),
        )
        .toList();
    final analysis = diaryService.analyze(entries);
    final report = reportService.buildReport(
      appState: appState,
      analysis: analysis,
      entries: entries,
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('doctorReport')),
        actions: [
          IconButton(
            tooltip: l10n.t('doctorReportHistory'),
            onPressed: () async {
              try {
                final reports = await ReportStorageService().list(
                  appState.accountToken,
                );
                if (!context.mounted) return;
                await showDialog<void>(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: Text(context.l10n.t('doctorReportHistory')),
                    content: SizedBox(
                      width: 420,
                      child: reports.isEmpty
                          ? Text(context.l10n.t('doctorReportEmptyHistory'))
                          : ListView(
                              shrinkWrap: true,
                              children: reports
                                  .map(
                                    (item) => ListTile(
                                      leading: const Icon(Icons.description),
                                      title: Text(item.title),
                                      subtitle: Text(
                                        item.createdAt?.toLocal().toString() ??
                                            '',
                                      ),
                                    ),
                                  )
                                  .toList(),
                            ),
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: Text(context.l10n.t('close')),
                      ),
                    ],
                  ),
                );
              } catch (error) {
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(context.l10n.t('networkUnavailable'))),
                );
              }
            },
            icon: const Icon(Icons.cloud_done),
          ),
        ],
      ),
      body: ResponsiveTwoColumnList(
        padding: const EdgeInsets.all(16),
        children: [
          const _ReportDisclaimer(),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.t('summary'),
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _ReportRow(
                    label: l10n.t('averageGlucose'),
                    value: appState.formatGlucose(analysis.averageGlucose),
                  ),
                  _ReportRow(
                    label: l10n.t('inRange'),
                    value: '${analysis.inRangePercent.toStringAsFixed(0)}%',
                  ),
                  _ReportRow(
                    label: l10n.t('low'),
                    value: '${analysis.lowCount}',
                  ),
                  _ReportRow(
                    label: l10n.t('highValues'),
                    value: '${analysis.highCount}',
                  ),
                  _ReportRow(
                    label: l10n.t('records'),
                    value: '${analysis.totalCount}',
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: () async {
              try {
                await ReportStorageService().save(
                  token: appState.accountToken,
                  title:
                      '${l10n.t('doctorReport')} ${l10n.formatDateTime(DateTime.now())}',
                  content: report,
                  metadata: {
                    'records': analysis.totalCount,
                    'averageGlucose': analysis.averageGlucose,
                    'languageCode': appState.languageCode,
                  },
                );
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(context.l10n.t('reportSavedToServer')),
                  ),
                );
              } catch (error) {
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(context.l10n.t('networkUnavailable'))),
                );
              }
            },
            icon: const Icon(Icons.cloud_upload),
            label: Text(l10n.t('saveReportToAccount')),
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: report));
              if (!context.mounted) {
                return;
              }
              ScaffoldMessenger.of(
                context,
              ).showSnackBar(SnackBar(content: Text(l10n.t('reportCopied'))));
            },
            icon: const Icon(Icons.copy),
            label: Text(l10n.t('copyReport')),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: SelectableText(
                report,
                style: const TextStyle(height: 1.35),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReportRow extends StatelessWidget {
  final String label;
  final String value;

  const _ReportRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _ReportDisclaimer extends StatelessWidget {
  const _ReportDisclaimer();

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
                l10n.t('reportDisclaimer'),
                style: const TextStyle(fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
