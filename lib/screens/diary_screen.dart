import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';
import 'package:provider/provider.dart';

import '../models/app_state.dart';
import '../services/diary_command_service.dart';
import '../services/voice_recognition_service.dart';
import '../widgets/localized_text.dart';
import '../widgets/responsive_two_column_list.dart';
import '../models/diary_log_entry.dart';
import '../models/sensor_reading.dart';

class DiaryScreen extends StatefulWidget {
  const DiaryScreen({super.key});

  @override
  State<DiaryScreen> createState() => _DiaryScreenState();
}

class _DiaryScreenState extends State<DiaryScreen> {
  final _glucoseController = TextEditingController();
  final _carbsController = TextEditingController();
  final _insulinController = TextEditingController();
  final _titleController = TextEditingController();
  final _noteController = TextEditingController();
  final _speech = const VoiceRecognitionService();
  final _diaryCommands = const DiaryCommandService();
  DiaryLogType _type = DiaryLogType.glucose;
  bool _listening = false;

  @override
  void dispose() {
    _glucoseController.dispose();
    _carbsController.dispose();
    _insulinController.dispose();
    _titleController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _addEntry() async {
    final state = context.read<AppState>();
    final displayGlucose = _parse(_glucoseController.text);
    final glucoseMmol =
        displayGlucose > 0 ? state.glucoseFromDisplay(displayGlucose) : 0.0;
    final entry = DiaryLogEntry(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      time: DateTime.now(),
      type: _type,
      glucoseMmol: glucoseMmol,
      carbs: int.tryParse(_carbsController.text.trim()) ?? 0,
      insulinUnits: _parse(_insulinController.text),
      title: _titleController.text.trim().isEmpty
          ? _labelForType(_type)
          : _titleController.text.trim(),
      note: _noteController.text.trim(),
      source: SensorBrand.manual,
    );
    await state.addDiaryEntry(entry);
    _glucoseController.clear();
    _carbsController.clear();
    _insulinController.clear();
    _titleController.clear();
    _noteController.clear();
  }

  double _parse(String value) {
    return double.tryParse(value.trim().replaceAll(',', '.')) ?? 0;
  }

  Future<void> _addEntryByVoice() async {
    if (_listening) return;
    setState(() => _listening = true);
    final state = context.read<AppState>();
    final result = await _speech.listen(
      state.languageCode,
      prompt: context.l10n.t('diaryVoiceMicTooltip'),
      accountToken: state.accountToken,
    );
    if (!mounted) return;
    setState(() => _listening = false);
    if (!result.hasText) {
      _showVoiceError(result.error ?? VoiceListenError.unavailable);
      return;
    }
    await _handleDiaryVoiceText(result.text!.trim());
  }

  Future<void> _handleDiaryVoiceText(String text) async {
    final l10n = context.l10n;
    if (_diaryCommands.looksLikeMedicalDoseAdviceRequest(text)) {
      _message(l10n.t('diaryVoiceMedicalAdviceWarning'));
      return;
    }
    final state = context.read<AppState>();
    final command = _diaryCommands.parse(
      text,
      languageCode: state.languageCode,
    );
    if (command == null) {
      final clarification = _diaryCommands.clarificationKey(text);
      _message(l10n.t(clarification ?? 'voiceAnyQuestion'));
      return;
    }
    final now = DateTime.now();
    final decision = await showDialog<_DiarySaveDecision>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(context.l10n.t('diary')),
        content: Text(command.confirmationText(
          state,
          now,
          l10n: context.l10n,
        )),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, _DiarySaveDecision.cancel),
            child: Text(context.l10n.t('diaryVoiceCancelButton')),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, _DiarySaveDecision.edit),
            child: Text(context.l10n.t('diaryVoiceEditButton')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, _DiarySaveDecision.save),
            child: Text(context.l10n.t('diaryVoiceConfirmButton')),
          ),
        ],
      ),
    );
    if (!mounted) return;
    if (decision == _DiarySaveDecision.edit) {
      _noteController.text = text;
      _message(l10n.t('diaryVoiceEditHint'));
      return;
    }
    if (decision != _DiarySaveDecision.save) {
      _message(l10n.t('diaryVoiceCanceled'));
      return;
    }
    try {
      await state.addDiaryEntry(command.toEntry(state, now));
      _message(l10n.t('diaryVoiceSaved'));
    } catch (_) {
      _message(l10n.t('diaryVoiceSaveError'));
    }
  }

  void _showVoiceError(VoiceListenError error) {
    final l10n = context.l10n;
    final message = switch (error) {
      VoiceListenError.permissionDenied => l10n.t('voiceMicPermissionDenied'),
      VoiceListenError.permissionPermanentlyDenied =>
        l10n.t('voiceMicPermanentlyDenied'),
      VoiceListenError.busy => l10n.t('voiceRecognizerBusy'),
      VoiceListenError.noMatch => l10n.t('voiceNoSpeechRecognized'),
      VoiceListenError.unavailable => l10n.t('voiceMicUnavailable'),
    };
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        action: error == VoiceListenError.permissionPermanentlyDenied
            ? SnackBarAction(
                label: l10n.t('voiceOpenSettings'),
                onPressed: () => _speech.openAppSettings(),
              )
            : null,
      ),
    );
  }

  void _message(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(title: const LocalizedText('ui.text.b1631a227b9a')),
      body: ResponsiveTwoColumnList(
        padding: const EdgeInsets.all(10),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  DropdownButtonFormField<DiaryLogType>(
                    initialValue: _type,
                    decoration: InputDecoration(
                      labelText: context.l10n.t('ui.text.24735ed6c731'),
                      border: const OutlineInputBorder(),
                    ),
                    items: DiaryLogType.values
                        .map(
                          (type) => DropdownMenuItem(
                            value: type,
                            child: Text(_labelForType(type)),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value != null) {
                        setState(() => _type = value);
                      }
                    },
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _glucoseController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: context.l10n
                          .literal('Glucose, ${state.glucoseUnitLabel}'),
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _carbsController,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: context.l10n.t('ui.text.bfe5f1cc39b9'),
                            border: const OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _insulinController,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: context.l10n.t('ui.text.7c0f501da83f'),
                            border: const OutlineInputBorder(),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _titleController,
                    decoration: InputDecoration(
                      labelText: context.l10n.t('ui.text.45757daea694'),
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _noteController,
                    minLines: 1,
                    maxLines: 3,
                    decoration: InputDecoration(
                      labelText: context.l10n.t('ui.text.62d2929e0b74'),
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: _addEntry,
                    icon: const Icon(Icons.add),
                    label: const LocalizedText('ui.text.5dcdb992ab28'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _listening ? null : _addEntryByVoice,
                    icon: Icon(_listening ? Icons.mic : Icons.mic_none),
                    label: Text(context.l10n.t('diaryVoiceMicTooltip')),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (state.diaryEntries.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: LocalizedText(
                  'ui.text.2740b7861903',
                ),
              ),
            )
          else
            ...state.diaryEntries.map(
              (entry) => Card(
                child: ListTile(
                  leading: Icon(
                    _iconForType(entry.type),
                    color: const Color(0xFF075BBB),
                  ),
                  title: Text(entry.title),
                  subtitle: Text(
                    '${_dateLabel(entry.time)} - ${_details(entry, state)}\n${entry.note}',
                  ),
                  isThreeLine: entry.note.isNotEmpty,
                  trailing: IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () => state.removeDiaryEntry(entry.id),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

enum _DiarySaveDecision { save, edit, cancel }

String _labelForType(DiaryLogType type) {
  return switch (type) {
    DiaryLogType.glucose => 'Glucose',
    DiaryLogType.meal => 'Meal',
    DiaryLogType.insulin => 'Insulin',
    DiaryLogType.activity => 'Activity',
    DiaryLogType.note => 'Note',
  };
}

IconData _iconForType(DiaryLogType type) {
  return switch (type) {
    DiaryLogType.glucose => Icons.bloodtype,
    DiaryLogType.meal => Icons.restaurant,
    DiaryLogType.insulin => Icons.medication,
    DiaryLogType.activity => Icons.directions_run,
    DiaryLogType.note => Icons.note_alt,
  };
}

String _details(DiaryLogEntry entry, AppState state) {
  final parts = <String>[];
  if (entry.glucoseMmol > 0) {
    parts.add(state.formatGlucose(entry.glucoseMmol));
  }
  if (entry.carbs > 0) {
    parts.add('${entry.carbs} g carbs');
  }
  if (entry.insulinUnits > 0) {
    parts.add('${entry.insulinUnits.toStringAsFixed(1)} u insulin');
  }
  return parts.isEmpty ? _labelForType(entry.type) : parts.join(' - ');
}

String _dateLabel(DateTime value) {
  final day = value.day.toString().padLeft(2, '0');
  final month = value.month.toString().padLeft(2, '0');
  final hour = value.hour.toString().padLeft(2, '0');
  final minute = value.minute.toString().padLeft(2, '0');
  return '$day.$month $hour:$minute';
}
