import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../navigation/app_navigator.dart';
import '../services/about_service.dart';
import '../services/help_center_service.dart';

class AboutScreen extends StatefulWidget {
  const AboutScreen({super.key});

  @override
  State<AboutScreen> createState() => _AboutScreenState();
}

class _AboutScreenState extends State<AboutScreen> {
  final _service = AboutService();
  Future<AboutContent>? _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= _service.content(_locale);
  }

  String get _locale => context.read<AppState>().languageCode;

  @override
  Widget build(BuildContext context) {
    const appName = 'GlukoTrack';
    return Scaffold(
      appBar: AppBar(title: const Text(appName)),
      body: FutureBuilder<AboutContent>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return _ErrorView(
              onRetry: () {
                setState(() => _future = _service.content(_locale));
              },
            );
          }
          final content = snapshot.data!;
          return RefreshIndicator(
            onRefresh: () async {
              setState(() => _future = _service.content(_locale));
              await _future;
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              children: [
                _Hero(content: content),
                const SizedBox(height: 14),
                _TextSection(content: content),
                const SizedBox(height: 14),
                Text(
                  content.advantagesTitle,
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 10),
                ...content.advantages.map(_AdvantageCard.new),
                const SizedBox(height: 14),
                _Disclaimer(content: content),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.content});

  final AboutContent content;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF075BBB), Color(0xFF00A6C8)],
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(content.title, style: const TextStyle(color: Colors.white70)),
          const SizedBox(height: 8),
          Text(
            content.heroTitle,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                ),
          ),
          const SizedBox(height: 10),
          Text(
            content.heroSubtitle,
            style: const TextStyle(color: Colors.white, height: 1.45),
          ),
        ],
      ),
    );
  }
}

class _TextSection extends StatelessWidget {
  const _TextSection({required this.content});

  final AboutContent content;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              content.whatIsTitle,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            ...content.paragraphs.map(
              (paragraph) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(paragraph, style: const TextStyle(height: 1.45)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AdvantageCard extends StatelessWidget {
  const _AdvantageCard(this.advantage);

  final AboutAdvantage advantage;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0xFFE8F7FF),
          foregroundColor: const Color(0xFF075BBB),
          child: Icon(_iconFor(advantage.key)),
        ),
        title: Text(
          advantage.title,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(advantage.description),
      ),
    );
  }

  IconData _iconFor(String key) {
    return switch (key) {
      'ai' => Icons.smart_toy,
      'sos' => Icons.sos,
      'diary' => Icons.edit_note,
      'family' => Icons.family_restroom,
      'location' => Icons.location_on,
      'localization' => Icons.language,
      'referral' => Icons.group_add,
      'sync' => Icons.cloud_sync,
      'privacy' => Icons.privacy_tip,
      _ => Icons.info_outline,
    };
  }
}

class _Disclaimer extends StatelessWidget {
  const _Disclaimer({required this.content});

  final AboutContent content;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFFFFF3ED),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.warning_amber, color: Color(0xFFB42318)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    content.disclaimerTitle,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(content.disclaimerText, style: const TextStyle(height: 1.45)),
          ],
        ),
      ),
    );
  }
}

// ignore: unused_element
class _Links extends StatelessWidget {
  const _Links({required this.content});

  final AboutContent content;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: content.links.entries
          .where((entry) => entry.value.isNotEmpty)
          .map(
            (entry) => ActionChip(
              label: Text(entry.value),
              onPressed: () => _open(context, entry.key),
            ),
          )
          .toList(),
    );
  }

  void _open(BuildContext context, String key) {
    if (key == 'support') {
      _showSupportDialog(context);
      return;
    }
    final routes = {
      'helpCenter': '/help',
      'exportData': '/export',
      'consents': '/profile',
      'deleteAccount': '/profile',
      'openSourceLicenses': '/profile',
    };
    final route = routes[key];
    if (route != null) AppNavigator.pushNamed(route);
  }

  void _showSupportDialog(BuildContext context) {
    final state = context.read<AppState>();
    final locale = state.languageCode;
    final l10n = context.l10n;
    final emailController = TextEditingController(text: state.email);
    final subjectController = TextEditingController();
    final messageController = TextEditingController();
    final messenger = ScaffoldMessenger.of(context);
    var sending = false;
    showDialog<void>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(
            content.links['support'] ?? l10n.t('about.support.title'),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    labelText: l10n.t('about.support.email'),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: subjectController,
                  decoration: InputDecoration(
                    labelText: l10n.t('about.support.subject'),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: messageController,
                  minLines: 4,
                  maxLines: 6,
                  decoration: InputDecoration(
                    labelText: l10n.t('about.support.message'),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed:
                  sending ? null : () => Navigator.of(dialogContext).pop(),
              child: Text(l10n.t('about.support.close')),
            ),
            FilledButton(
              onPressed: sending
                  ? null
                  : () async {
                      setState(() => sending = true);
                      try {
                        await HelpCenterService().contact(
                          locale: locale,
                          email: emailController.text.trim(),
                          subject: subjectController.text.trim(),
                          message: messageController.text.trim(),
                        );
                        if (dialogContext.mounted) {
                          Navigator.of(dialogContext).pop();
                          WidgetsBinding.instance.addPostFrameCallback((_) {
                            messenger.showSnackBar(
                              SnackBar(
                                content: Text(l10n.t('about.support.sent')),
                              ),
                            );
                          });
                        }
                      } catch (_) {
                        if (dialogContext.mounted) {
                          setState(() => sending = false);
                          messenger.showSnackBar(
                            SnackBar(
                              content: Text(l10n.t('about.support.error')),
                            ),
                          );
                        }
                      }
                    },
              child: sending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(l10n.t('about.support.send')),
            ),
          ],
        ),
      ),
    ).whenComplete(() {
      emailController.dispose();
      subjectController.dispose();
      messageController.dispose();
    });
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off, size: 42),
            const SizedBox(height: 12),
            Text(l10n.t('about.offline'), textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: onRetry,
              child: Text(l10n.t('about.retry')),
            ),
          ],
        ),
      ),
    );
  }
}
