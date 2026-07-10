import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../services/ai_service.dart';
import '../widgets/medical_disclaimer.dart';

class AiAssistantScreen extends StatefulWidget {
  const AiAssistantScreen({super.key});

  @override
  State<AiAssistantScreen> createState() => _AiAssistantScreenState();
}

class _AiAssistantScreenState extends State<AiAssistantScreen> {
  final _aiService = AiService();
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final List<_ChatMessage> _messages = [];
  bool _isSending = false;
  String? _lastLanguageCode;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final state = context.watch<AppState>();
    if (_lastLanguageCode == state.languageCode && _messages.isNotEmpty) {
      return;
    }
    _lastLanguageCode = state.languageCode;
    if (_messages.isEmpty ||
        (_messages.length == 1 && !_messages.first.fromUser)) {
      _messages
        ..clear()
        ..add(
            _ChatMessage(text: context.l10n.t('aiGreeting'), fromUser: false));
    }
  }

  @override
  void dispose() {
    _aiService.close();
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _send(String text) async {
    final question = text.trim();
    if (question.isEmpty || _isSending) {
      return;
    }

    setState(() {
      _messages.add(_ChatMessage(text: question, fromUser: true));
      _controller.clear();
      _isSending = true;
    });
    _scrollToBottom();

    final answer = await _aiService.sendMessage(
      question,
      appState: context.read<AppState>(),
    );

    if (!mounted) {
      return;
    }

    setState(() {
      _messages.add(_ChatMessage(text: answer, fromUser: false));
      _isSending = false;
    });
    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) {
        return;
      }
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = context.l10n;
    const quickActions = [
      _AiQuickAction(
        id: 'can_i_eat_this',
        labelKey: 'quickProduct',
        promptKey: 'aiPromptCanIEatThis',
        route: '/scanner',
      ),
      _AiQuickAction(
        id: 'analyze_glucose',
        labelKey: 'quickGlucose',
        promptKey: 'aiPromptAnalyzeGlucose',
      ),
      _AiQuickAction(
        id: 'explain_insulin',
        labelKey: 'quickInsulin',
        promptKey: 'aiPromptExplainInsulin',
      ),
      _AiQuickAction(
        id: 'doctor_questions',
        labelKey: 'quickDoctor',
        promptKey: 'aiPromptDoctorQuestions',
      ),
    ];

    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('aiAssistant'))),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: _AssistantHeader(
              glucose: state.formatGlucose(state.glucoseMmol),
              target: state.formatGlucose(state.targetGlucose),
              isRemoteConfigured: _aiService.isRemoteConfigured,
            ),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: MedicalDisclaimer(),
          ),
          SizedBox(
            height: 58,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              scrollDirection: Axis.horizontal,
              itemCount: quickActions.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final action = quickActions[index];
                return ActionChip(
                  key: ValueKey(action.id),
                  avatar: const Icon(Icons.bolt, size: 18),
                  label: Text(l10n.t(action.labelKey)),
                  onPressed: _isSending
                      ? null
                      : () {
                          final route = action.route;
                          if (route != null) {
                            Navigator.of(context).pushNamed(route);
                            return;
                          }
                          _send(l10n.t(action.promptKey));
                        },
                );
              },
            ),
          ),
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              itemCount: _messages.length + (_isSending ? 1 : 0),
              itemBuilder: (context, index) {
                if (_isSending && index == _messages.length) {
                  return const _TypingBubble();
                }
                return _MessageBubble(message: _messages[index]);
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      enabled: !_isSending,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      decoration: InputDecoration(
                        hintText: l10n.t('enterQuestion'),
                        border: const OutlineInputBorder(),
                      ),
                      onSubmitted: _send,
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed:
                        _isSending ? null : () => _send(_controller.text),
                    icon: const Icon(Icons.send),
                    tooltip: l10n.t('send'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AssistantHeader extends StatelessWidget {
  final String glucose;
  final String target;
  final bool isRemoteConfigured;

  const _AssistantHeader({
    required this.glucose,
    required this.target,
    required this.isRemoteConfigured,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final contextLine = l10n
        .t('aiContext')
        .replaceAll('{currentGlucose}', glucose)
        .replaceAll('{targetGlucose}', target);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFEAF3FF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFD4E6FF)),
      ),
      child: Row(
        children: [
          const Icon(Icons.smart_toy, color: Color(0xFF075BBB)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  contextLine,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  isRemoteConfigured
                      ? l10n.t('modeCloud')
                      : l10n.t('modeLocal'),
                  style: const TextStyle(
                    color: Color(0xFF475569),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TypingBubble extends StatelessWidget {
  const _TypingBubble();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(context.l10n.t('typing')),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final _ChatMessage message;

  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final alignment =
        message.fromUser ? Alignment.centerRight : Alignment.centerLeft;
    final color = message.fromUser ? const Color(0xFF075BBB) : Colors.white;
    final textColor = message.fromUser ? Colors.white : const Color(0xFF1E293B);

    return Align(
      alignment: alignment,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 5),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(16),
            boxShadow: const [
              BoxShadow(
                color: Color(0x14000000),
                blurRadius: 8,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Text(
            message.text,
            style: TextStyle(color: textColor, height: 1.35),
          ),
        ),
      ),
    );
  }
}

class _ChatMessage {
  final String text;
  final bool fromUser;

  const _ChatMessage({required this.text, required this.fromUser});
}

class _AiQuickAction {
  final String id;
  final String labelKey;
  final String promptKey;
  final String? route;

  const _AiQuickAction({
    required this.id,
    required this.labelKey,
    required this.promptKey,
    this.route,
  });
}
