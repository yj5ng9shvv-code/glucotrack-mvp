import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../services/cloud_sync_service.dart';

class CloudSyncScreen extends StatefulWidget {
  const CloudSyncScreen({super.key});

  @override
  State<CloudSyncScreen> createState() => _CloudSyncScreenState();
}

class _CloudSyncScreenState extends State<CloudSyncScreen> {
  final _service = CloudSyncService();
  bool _busy = false;
  String? _status;

  @override
  void dispose() {
    _service.close();
    super.dispose();
  }

  Future<void> _push() async {
    setState(() => _busy = true);
    final state = context.read<AppState>();
    final l10n = context.l10n;
    final result = await _service.push(state);
    if (!mounted) return;
    if (result.ok) {
      await state.setCloudSyncEnabled(true);
    }
    setState(() {
      _busy = false;
      _status = l10n.t(result.messageKey);
    });
  }

  Future<void> _pull() async {
    setState(() => _busy = true);
    final state = context.read<AppState>();
    final l10n = context.l10n;
    final result = await _service.pull(state);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _status = l10n.t(result.messageKey);
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('cloudSync'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: SwitchListTile(
              value: state.cloudSyncEnabled,
              onChanged: (value) =>
                  context.read<AppState>().setCloudSyncEnabled(value),
              title: Text(l10n.t('cloudSyncEnable')),
              subtitle: Text(
                _service.isConfigured
                    ? l10n.t('cloudSyncReady')
                    : l10n.t('cloudSyncUnavailable'),
              ),
              secondary: const Icon(Icons.cloud_sync, color: Color(0xFF075BBB)),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: _busy ? null : _push,
                  icon: const Icon(Icons.upload),
                  label: Text(l10n.t('cloudSyncPush')),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _busy ? null : _pull,
                  icon: const Icon(Icons.download),
                  label: Text(l10n.t('cloudSyncPull')),
                ),
              ),
            ],
          ),
          if (_busy) ...[
            const SizedBox(height: 12),
            const LinearProgressIndicator(),
          ],
          if (_status != null) ...[
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Text(_status!),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.t('cloudSyncStatus'),
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text('${l10n.t('diary')}: ${state.diaryEntries.length}'),
                  Text('${l10n.t('sensors')}: ${state.sensorReadings.length}'),
                  Text(
                    '${l10n.t('cloudSyncLastSync')}: '
                    '${state.lastCloudSyncAt == null ? l10n.t('noData') : l10n.formatDateTime(state.lastCloudSyncAt!)}',
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            color: const Color(0xFFFFF7E6),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Text(l10n.t('cloudSyncPrivacyNotice')),
            ),
          ),
        ],
      ),
    );
  }
}
