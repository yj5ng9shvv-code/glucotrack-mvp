import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../services/ai_service.dart';
import '../services/diary_command_service.dart';
import '../services/voice_intent_service.dart';
import '../services/voice_recognition_service.dart';
import '../widgets/localized_text.dart';
import '../widgets/pulsing_voice_button.dart';

class VoiceAssistantScreen extends StatefulWidget {
  const VoiceAssistantScreen({super.key});

  @override
  State<VoiceAssistantScreen> createState() => _VoiceAssistantScreenState();
}

class _VoiceAssistantScreenState extends State<VoiceAssistantScreen> {
  final _speech = const VoiceRecognitionService();
  final _ai = AiService();
  final _diaryCommands = const DiaryCommandService();
  final _intents = const VoiceIntentService();
  final _text = TextEditingController();
  bool _listening = false;
  bool _busy = false;
  String? _answer;

  @override
  void dispose() {
    _ai.close();
    _text.dispose();
    super.dispose();
  }

  Future<void> _toggleListening() async {
    setState(() => _listening = true);
    final result = await _speech.listen(
      context.read<AppState>().languageCode,
      prompt: context.l10n.t('voiceAskAi'),
      accountToken: context.read<AppState>().accountToken,
    );
    if (!mounted) return;
    setState(() => _listening = false);
    if (!result.hasText) {
      _showVoiceError(result.error ?? VoiceListenError.unavailable);
      return;
    }
    _text.text = result.text!.trim();
    await _submit();
  }

  Future<void> _submit([String? suggestion, bool forceAi = false]) async {
    if (_busy) return;
    final query = (suggestion ?? _text.text).trim();
    if (query.isEmpty) return;
    _text.text = query;
    setState(() {
      _listening = false;
      _busy = true;
      _answer = null;
    });
    try {
      final languageCode = context.read<AppState>().languageCode;
      if (_diaryCommands.looksLikeMedicalDoseAdviceRequest(query)) {
        _setAnswer(context.l10n.t('diaryVoiceMedicalAdviceWarning'));
        return;
      }
      final diaryCommand = _diaryCommands.parse(
        query,
        languageCode: languageCode,
      );
      if (diaryCommand != null) {
        await _confirmAndSaveDiaryCommand(diaryCommand);
        return;
      }
      final clarification = _diaryCommands.clarificationKey(query);
      if (clarification != null) {
        _setAnswer(context.l10n.t(clarification));
        return;
      }
      await _execute(
        forceAi
            ? const VoiceIntent(VoiceIntentType.askAi)
            : _intents.parse(query, languageCode: languageCode),
        query,
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _execute(VoiceIntent intent, String query) async {
    final state = context.read<AppState>();
    final l10n = context.l10n;
    switch (intent.type) {
      case VoiceIntentType.recordGlucose:
        if (intent.value == null) {
          return _setAnswer(l10n.t('invalidGlucose'));
        }
        return _confirmAndSaveDiaryCommand(
          DiaryCommand(glucoseValue: intent.value),
        );
      case VoiceIntentType.recordInsulin:
        return _confirmAndSaveDiaryCommand(
          DiaryCommand(insulinUnits: intent.value),
        );
      case VoiceIntentType.openTrends:
        _open('/trends');
        return;
      case VoiceIntentType.openDoctorReport:
        _open('/doctor-report');
        return;
      case VoiceIntentType.openMedications:
        _open('/profile');
        return;
      case VoiceIntentType.familyStatus:
        _open('/family-access');
        return;
      case VoiceIntentType.sos:
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const LocalizedText('ui.text.909030232714'),
            content: const LocalizedText('ui.text.00ba8b4d7761'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const LocalizedText('ui.text.010737945e10'),
              ),
              FilledButton.icon(
                onPressed: () => Navigator.pop(context, true),
                icon: const Icon(Icons.sos),
                label: const LocalizedText('ui.text.a14ef3fee689'),
              ),
            ],
          ),
        );
        if (confirmed == true) _open('/sos');
        return;
      case VoiceIntentType.askAi:
        final answer = await _ai.sendMessage(query, appState: state);
        return _setAnswer(answer);
    }
  }

  Future<void> _confirmAndSaveDiaryCommand(DiaryCommand command) async {
    final state = context.read<AppState>();
    final now = DateTime.now();
    final l10n = context.l10n;
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
    if (decision == _DiarySaveDecision.edit) {
      return _setAnswer(l10n.t('diaryVoiceEditHint'));
    }
    if (decision != _DiarySaveDecision.save) {
      return _setAnswer(l10n.t('diaryVoiceCanceled'));
    }
    try {
      await state.addDiaryEntry(command.toEntry(state, now));
      return _setAnswer(l10n.t('diaryVoiceSaved'));
    } catch (_) {
      return _setAnswer(l10n.t('diaryVoiceSaveError'));
    }
  }

  void _open(String route) {
    if (mounted) Navigator.pushReplacementNamed(context, route);
  }

  void _setAnswer(String answer) {
    if (mounted) setState(() => _answer = answer);
  }

  void _showVoiceError(VoiceListenError error) {
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    final message = switch (error) {
      VoiceListenError.permissionDenied => l10n.t('voiceMicPermissionDenied'),
      VoiceListenError.permissionPermanentlyDenied =>
        l10n.t('voiceMicPermanentlyDenied'),
      VoiceListenError.busy => l10n.t('voiceRecognizerBusy'),
      VoiceListenError.noMatch => l10n.t('voiceNoSpeechRecognized'),
      VoiceListenError.unavailable => l10n.t('voiceMicUnavailable'),
    };

    messenger.showSnackBar(
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

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = context.l10n;
    final premium = state.premium;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('voiceAskAi')),
        actions: [
          IconButton(
            tooltip: l10n.t('close'),
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.close),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 680),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (!premium) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF7E6),
                      border: Border.all(color: const Color(0xFFF2C94C)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        const Icon(Icons.workspace_premium,
                            size: 36, color: Color(0xFFF79009)),
                        const SizedBox(height: 8),
                        const LocalizedText(
                          'ui.text.4d12726f93d5',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        const LocalizedText(
                          'ui.text.717756a51ecb',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Color(0xFF7A5A00)),
                        ),
                        const SizedBox(height: 10),
                        FilledButton.icon(
                          onPressed: () =>
                              Navigator.pushNamed(context, '/subscription'),
                          icon: const Icon(Icons.lock_open),
                          label: const LocalizedText('ui.text.af2a3e117208'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                Text(
                  state.formatGlucose(state.glucoseMmol),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 34, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 20),
                Center(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: PulsingVoiceButton(
                      size: 118,
                      iconSize: 52,
                      listening: _listening,
                      enabled: !_busy,
                      onPressed: _toggleListening,
                      semanticLabel: _listening
                          ? l10n.t('voiceStop')
                          : l10n.t('voiceStart'),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  _listening
                      ? l10n.t('voiceListening')
                      : l10n.t('voiceTapPrompt'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 18),
                TextField(
                  controller: _text,
                  minLines: 1,
                  maxLines: 3,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _submit(),
                  decoration: InputDecoration(
                    hintText: l10n.t('voiceAnyQuestion'),
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      tooltip: l10n.t('send'),
                      onPressed: _busy ? null : _submit,
                      icon: const Icon(Icons.send),
                    ),
                  ),
                ),
                if (_busy) ...[
                  const SizedBox(height: 24),
                  const Center(child: CircularProgressIndicator()),
                ],
                if (_answer != null) ...[
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: const Color(0xFFD7E3F0)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(_answer!,
                        style: const TextStyle(fontSize: 17, height: 1.45)),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

enum _DiarySaveDecision { save, edit, cancel }
