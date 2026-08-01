import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../services/gdpr_service.dart';

class GdprScreen extends StatefulWidget {
  GdprScreen({super.key, GdprService? service})
      : service = service ?? GdprService();

  final GdprService service;

  @override
  State<GdprScreen> createState() => _GdprScreenState();
}

class _GdprScreenState extends State<GdprScreen> {
  late Future<GdprListResult> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<GdprListResult> _load() {
    final token = context.read<AppState>().accountToken;
    return widget.service.listRequests(token);
  }

  void _reload() {
    setState(() {
      _future = _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('gdpr.title'))),
      floatingActionButton: state.isAuthenticated
          ? FloatingActionButton.extended(
              onPressed: _createRequest,
              icon: const Icon(Icons.add),
              label: Text(l10n.t('gdpr.create')),
            )
          : null,
      body: FutureBuilder<GdprListResult>(
        future: _future,
        builder: (context, snapshot) {
          if (!state.isAuthenticated || state.accountToken.isEmpty) {
            return _MessageState(
              icon: Icons.lock_outline,
              title: l10n.t('gdpr.loginRequiredTitle'),
              body: l10n.t('gdpr.loginRequiredText'),
            );
          }
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _MessageState(
              icon: Icons.error_outline,
              title: l10n.t('gdpr.errorTitle'),
              body: _localizedError(l10n, snapshot.error),
              action: FilledButton.icon(
                onPressed: _reload,
                icon: const Icon(Icons.refresh),
                label: Text(l10n.t('gdpr.retry')),
              ),
            );
          }
          final rows = snapshot.data?.rows ?? const <GdprRequest>[];
          if (rows.isEmpty) {
            return _MessageState(
              icon: Icons.privacy_tip_outlined,
              title: l10n.t('gdpr.emptyTitle'),
              body: l10n.t('gdpr.emptyText'),
              action: FilledButton.icon(
                onPressed: _createRequest,
                icon: const Icon(Icons.add),
                label: Text(l10n.t('gdpr.create')),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
              itemBuilder: (context, index) {
                final request = rows[index];
                return _GdprRequestCard(
                  request: request,
                  onTap: () => _openDetails(request),
                );
              },
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemCount: rows.length,
            ),
          );
        },
      ),
    );
  }

  Future<void> _createRequest() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _CreateGdprRequestSheet(service: widget.service),
    );
    if (created == true) _reload();
  }

  Future<void> _openDetails(GdprRequest request) async {
    final updated = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => _GdprDetailsScreen(
          publicId: request.publicId,
          service: widget.service,
        ),
      ),
    );
    if (updated == true) _reload();
  }
}

class _GdprDetailsScreen extends StatefulWidget {
  const _GdprDetailsScreen({required this.publicId, required this.service});

  final String publicId;
  final GdprService service;

  @override
  State<_GdprDetailsScreen> createState() => _GdprDetailsScreenState();
}

class _GdprDetailsScreenState extends State<_GdprDetailsScreen> {
  late Future<GdprDetails> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<GdprDetails> _load() => widget.service.getRequest(
        context.read<AppState>().accountToken,
        widget.publicId,
      );

  void _reload() {
    setState(() {
      _future = _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(widget.publicId)),
      body: FutureBuilder<GdprDetails>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _MessageState(
              icon: Icons.error_outline,
              title: l10n.t('gdpr.errorTitle'),
              body: _localizedError(l10n, snapshot.error),
              action: FilledButton.icon(
                onPressed: _reload,
                icon: const Icon(Icons.refresh),
                label: Text(l10n.t('gdpr.retry')),
              ),
            );
          }
          final details = snapshot.data!;
          final request = details.request;
          final canCancel = !_terminalStatuses.contains(request.status);
          final hasExport = details.files.any(
            (file) => file.originalName.isNotEmpty,
          );
          return ListView(
            padding: const EdgeInsets.all(12),
            children: [
              _GdprRequestCard(request: request),
              const SizedBox(height: 12),
              if (request.description.isNotEmpty)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.t('gdpr.description'),
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        Text(request.description),
                      ],
                    ),
                  ),
                ),
              if (hasExport) ...[
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () => _openExport(request.publicId),
                  icon: const Icon(Icons.download),
                  label: Text(l10n.t('gdpr.downloadExport')),
                ),
              ],
              if (canCancel) ...[
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _cancel,
                  icon: const Icon(Icons.cancel_outlined),
                  label: Text(l10n.t('gdpr.cancel')),
                ),
              ],
              const SizedBox(height: 16),
              Text(
                l10n.t('gdpr.history'),
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              if (details.events.isEmpty)
                Text(l10n.t('gdpr.noHistory'))
              else
                ...details.events.map((event) => _GdprEventTile(event: event)),
            ],
          );
        },
      ),
    );
  }

  Future<void> _openExport(String publicId) async {
    final uri = Uri.parse(widget.service.downloadUrl(publicId));
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.t('gdpr.openExportFailed'))),
      );
    }
  }

  Future<void> _cancel() async {
    final l10n = context.l10n;
    final token = context.read<AppState>().accountToken;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.t('gdpr.cancel')),
        content: Text(l10n.t('gdpr.cancelConfirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(l10n.t('gdpr.no')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(l10n.t('gdpr.yes')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await widget.service.cancelRequest(token, widget.publicId);
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_localizedError(l10n, error))));
    }
  }
}

class _CreateGdprRequestSheet extends StatefulWidget {
  const _CreateGdprRequestSheet({required this.service});

  final GdprService service;

  @override
  State<_CreateGdprRequestSheet> createState() =>
      _CreateGdprRequestSheetState();
}

class _CreateGdprRequestSheetState extends State<_CreateGdprRequestSheet> {
  final _formKey = GlobalKey<FormState>();
  final _subjectController = TextEditingController();
  final _descriptionController = TextEditingController();
  String _requestType = _requestTypes.first;
  bool _saving = false;

  @override
  void dispose() {
    _subjectController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 16,
      ),
      child: Form(
        key: _formKey,
        child: ListView(
          shrinkWrap: true,
          children: [
            Text(
              l10n.t('gdpr.createTitle'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _requestType,
              decoration: InputDecoration(labelText: l10n.t('gdpr.type')),
              items: _requestTypes
                  .map(
                    (type) => DropdownMenuItem(
                      value: type,
                      child: Text(_requestTypeLabel(l10n, type)),
                    ),
                  )
                  .toList(),
              onChanged: _saving
                  ? null
                  : (value) => setState(() {
                        _requestType = value ?? _requestType;
                      }),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _subjectController,
              decoration: InputDecoration(labelText: l10n.t('gdpr.subject')),
              maxLength: 120,
              validator: (value) => (value == null || value.trim().length < 3)
                  ? l10n.t('gdpr.required')
                  : null,
            ),
            TextFormField(
              controller: _descriptionController,
              decoration: InputDecoration(
                labelText: l10n.t('gdpr.description'),
              ),
              minLines: 4,
              maxLines: 7,
              maxLength: 2000,
              validator: (value) => (value == null || value.trim().length < 10)
                  ? l10n.t('gdpr.required')
                  : null,
            ),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: _saving ? null : _submit,
              icon: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send),
              label: Text(
                _saving ? l10n.t('gdpr.sending') : l10n.t('gdpr.submit'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final state = context.read<AppState>();
    final l10n = context.l10n;
    try {
      await widget.service.createRequest(
        state.accountToken,
        requestType: _requestType,
        subject: _subjectController.text.trim(),
        description: _descriptionController.text.trim(),
        locale: state.languageCode,
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_localizedError(l10n, error))));
      setState(() => _saving = false);
    }
  }
}

class _GdprRequestCard extends StatelessWidget {
  const _GdprRequestCard({required this.request, this.onTap});

  final GdprRequest request;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Card(
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          backgroundColor: _statusColor(request.status).withValues(alpha: 0.12),
          child: Icon(
            Icons.privacy_tip_outlined,
            color: _statusColor(request.status),
          ),
        ),
        title: Text(
          request.subject.isEmpty
              ? _requestTypeLabel(l10n, request.requestType)
              : request.subject,
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(
              '${request.publicId} • ${_requestTypeLabel(l10n, request.requestType)}',
            ),
            if (request.dueAt != null)
              Text(
                l10n
                    .t('gdpr.due')
                    .replaceAll('{date}', _formatDate(request.dueAt!)),
              ),
          ],
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Chip(
              visualDensity: VisualDensity.compact,
              label: Text(_statusLabel(l10n, request.status)),
            ),
            if (onTap != null) const Icon(Icons.chevron_right, size: 18),
          ],
        ),
      ),
    );
  }
}

class _GdprEventTile extends StatelessWidget {
  const _GdprEventTile({required this.event});

  final GdprEvent event;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Card(
      child: ListTile(
        leading: const Icon(Icons.history),
        title: Text(_eventLabel(l10n, event.eventType)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (event.createdAt != null) Text(_formatDate(event.createdAt!)),
            if (event.comment.isNotEmpty) Text(event.comment),
          ],
        ),
      ),
    );
  }
}

class _MessageState extends StatelessWidget {
  const _MessageState({
    required this.icon,
    required this.title,
    required this.body,
    this.action,
  });

  final IconData icon;
  final String title;
  final String body;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 12),
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(body, textAlign: TextAlign.center),
            if (action != null) ...[const SizedBox(height: 16), action!],
          ],
        ),
      ),
    );
  }
}

const _requestTypes = [
  'data_access',
  'data_export',
  'data_rectification',
  'account_deletion',
  'data_anonymization',
  'processing_restriction',
  'consent_withdrawal',
  'processing_objection',
  'data_portability',
  'other',
];

const _terminalStatuses = {'completed', 'cancelled', 'expired', 'rejected'};

String _requestTypeLabel(AppLocalizations l10n, String type) {
  final translated = l10n.t('gdpr.type.$type');
  return translated == 'gdpr.type.$type'
      ? type.replaceAll('_', ' ')
      : translated;
}

String _statusLabel(AppLocalizations l10n, String status) {
  final translated = l10n.t('gdpr.status.$status');
  return translated == 'gdpr.status.$status'
      ? status.replaceAll('_', ' ')
      : translated;
}

String _eventLabel(AppLocalizations l10n, String event) {
  final translated = l10n.t('gdpr.event.$event');
  return translated == 'gdpr.event.$event'
      ? event.replaceAll('_', ' ')
      : translated;
}

Color _statusColor(String status) {
  if (status == 'completed' || status == 'approved' || status == 'verified') {
    return const Color(0xFF059669);
  }
  if (status == 'rejected' || status == 'expired' || status == 'cancelled') {
    return const Color(0xFFDC2626);
  }
  return const Color(0xFF075BBB);
}

String _formatDate(DateTime date) {
  final local = date.toLocal();
  return '${local.day.toString().padLeft(2, '0')}.'
      '${local.month.toString().padLeft(2, '0')}.'
      '${local.year}, '
      '${local.hour.toString().padLeft(2, '0')}:'
      '${local.minute.toString().padLeft(2, '0')}';
}

String _localizedError(AppLocalizations l10n, Object? error) {
  final message = error is GdprException ? error.message : error.toString();
  final translated = l10n.t(message);
  return translated == message ? l10n.t('gdpr.genericError') : translated;
}
