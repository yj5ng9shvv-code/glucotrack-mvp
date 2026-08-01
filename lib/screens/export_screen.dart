import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../models/app_state.dart';
import '../widgets/localized_text.dart';
import '../widgets/responsive_two_column_list.dart';

class ExportScreen extends StatelessWidget {
  const ExportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final csv = _buildCsv(state);
    final html = _buildDoctorHtml(state);
    return Scaffold(
      appBar: AppBar(title: const LocalizedText('ui.text.60fb70319be9')),
      body: ResponsiveTwoColumnList(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const LocalizedText(
                    'ui.text.721d604525bb',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const LocalizedText('ui.text.b87be56977ed'),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: csv));
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: LocalizedText('ui.text.718b3dfb03cf'),
                        ),
                      );
                    },
                    icon: const Icon(Icons.copy),
                    label: const LocalizedText('ui.text.0bb7f0f49be7'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: html));
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: LocalizedText('ui.text.7c7e4e371e5b'),
                        ),
                      );
                    },
                    icon: const Icon(Icons.picture_as_pdf),
                    label: const LocalizedText('ui.text.07a3ac61a4d8'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const LocalizedText(
                    'ui.text.8f6b7f0760d0',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  SelectableText(_plainDoctorSummary(state)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: SelectableText(csv.isEmpty ? 'No data yet.' : csv),
            ),
          ),
        ],
      ),
    );
  }
}

String _buildCsv(AppState state) {
  final rows = <List<String>>[
    [
      'time',
      'type',
      'glucose_${state.glucoseUnitLabel}',
      'carbs_g',
      'insulin_units',
      'source',
      'title',
      'note',
    ],
  ];
  for (final entry in state.diaryEntries) {
    rows.add([
      entry.time.toIso8601String(),
      entry.type.name,
      entry.glucoseMmol > 0
          ? state
              .glucoseToDisplay(entry.glucoseMmol)
              .toStringAsFixed(state.glucoseUnit == GlucoseUnit.mgDl ? 0 : 1)
          : '',
      entry.carbs == 0 ? '' : entry.carbs.toString(),
      entry.insulinUnits == 0 ? '' : entry.insulinUnits.toStringAsFixed(1),
      entry.source.name,
      entry.title,
      entry.note,
    ]);
  }
  for (final reading in state.sensorReadings) {
    rows.add([
      reading.time.toIso8601String(),
      'sensor',
      state
          .glucoseToDisplay(reading.glucoseMmol)
          .toStringAsFixed(state.glucoseUnit == GlucoseUnit.mgDl ? 0 : 1),
      '',
      '',
      reading.brand.name,
      'Sensor glucose',
      reading.note,
    ]);
  }
  return rows.map((row) => row.map(_escapeCsv).join(',')).join('\n');
}

String _escapeCsv(String value) {
  final escaped = value.replaceAll('"', '""');
  return '"$escaped"';
}

String _plainDoctorSummary(AppState state) {
  final values = [
    ...state.sensorReadings.map((reading) => reading.glucoseMmol),
    ...state.diaryEntries
        .where((entry) => entry.glucoseMmol > 0)
        .map((entry) => entry.glucoseMmol),
  ];
  final average =
      values.isEmpty ? 0.0 : values.reduce((a, b) => a + b) / values.length;
  final low = values.where((value) => value < 3.9).length;
  final high = values.where((value) => value > 10.0).length;
  return [
    'GlukoTrack doctor summary',
    'Patient: ${state.fullName.isEmpty ? 'Not specified' : state.fullName}',
    'Average glucose: ${values.isEmpty ? 'No data' : state.formatGlucose(average)}',
    'Low episodes: $low',
    'High episodes: $high',
    'Diary entries: ${state.diaryEntries.length}',
    'Sensor readings: ${state.sensorReadings.length}',
    'Important: informational report, not a diagnosis or prescription.',
  ].join('\n');
}

String _buildDoctorHtml(AppState state) {
  final summary = _plainDoctorSummary(state).split('\n');
  final rows = state.diaryEntries.take(100).map((entry) {
    final glucose =
        entry.glucoseMmol > 0 ? state.formatGlucose(entry.glucoseMmol) : '';
    return '<tr><td>${_html(entry.time.toIso8601String())}</td><td>${_html(entry.type.name)}</td><td>${_html(glucose)}</td><td>${entry.carbs}</td><td>${entry.insulinUnits.toStringAsFixed(1)}</td><td>${_html(entry.note)}</td></tr>';
  }).join();
  return '''
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>GlukoTrack Doctor Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #172033; }
    h1 { color: #075BBB; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
    th, td { border: 1px solid #d8e2ef; padding: 8px; text-align: left; }
    th { background: #eaf3ff; }
    .note { background: #fff7e6; padding: 12px; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>GlukoTrack Doctor Report</h1>
  <ul>${summary.map((line) => '<li>${_html(line)}</li>').join()}</ul>
  <p class="note">This report is informational and does not replace medical care.</p>
  <h2>Diary entries</h2>
  <table>
    <thead><tr><th>Time</th><th>Type</th><th>Glucose</th><th>Carbs</th><th>Insulin</th><th>Note</th></tr></thead>
    <tbody>$rows</tbody>
  </table>
</body>
</html>
''';
}

String _html(String value) {
  return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
}
