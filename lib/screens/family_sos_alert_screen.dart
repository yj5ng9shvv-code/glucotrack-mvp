import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../family_watch/sos_alert_api.dart';
import '../family_watch/sos_alert_handler.dart';
import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../widgets/localized_text.dart';
import 'family_watch_live_map_screen.dart';

/// Entry point for notification taps and URI links. It never renders SOS
/// details before an authenticated, server-authorized resolver finds them.
class FamilySosAlertEntryScreen extends StatefulWidget {
  const FamilySosAlertEntryScreen({
    super.key,
    required this.eventId,
    this.resolver,
  });

  final String eventId;
  final SosAlertDestinationResolver? resolver;

  @override
  State<FamilySosAlertEntryScreen> createState() =>
      _FamilySosAlertEntryScreenState();
}

class _FamilySosAlertEntryScreenState extends State<FamilySosAlertEntryScreen> {
  SosAlertDestination? _destination;
  _SosEntryState _state = _SosEntryState.loading;

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  Future<void> _resolve() async {
    final appState = context.read<AppState>();
    if (!appState.isAuthenticated || appState.accountToken.isEmpty) {
      if (mounted) {
        setState(() => _state = _SosEntryState.authenticationRequired);
      }
      return;
    }
    final destination = await (widget.resolver ?? FamilySosAlertApi()).resolve(
      token: appState.accountToken,
      eventId: widget.eventId,
    );
    if (!mounted) return;
    setState(() {
      _destination = destination;
      _state = destination == null
          ? _SosEntryState.unavailable
          : _SosEntryState.ready;
    });
  }

  @override
  Widget build(BuildContext context) {
    switch (_state) {
      case _SosEntryState.loading:
        return const _SosAlertMessage(
          key: Key('family-sos-loading'),
          icon: Icons.emergency_outlined,
          titleKey: 'ui.text.familySosChecking',
          detailKey: 'ui.text.familySosCheckingDetail',
        );
      case _SosEntryState.authenticationRequired:
        return const _SosAlertMessage(
          key: Key('family-sos-auth-required'),
          icon: Icons.lock_outline,
          titleKey: 'ui.text.familySosSignInRequired',
          detailKey: 'ui.text.familySosSignInDetail',
        );
      case _SosEntryState.unavailable:
        return const _SosAlertMessage(
          key: Key('family-sos-unavailable'),
          icon: Icons.lock_outline,
          titleKey: 'ui.text.familySosUnavailable',
          detailKey: 'ui.text.familySosUnavailableDetail',
        );
      case _SosEntryState.ready:
        return FamilySosAlertScreen(destination: _destination!);
    }
  }
}

class FamilySosAlertScreen extends StatelessWidget {
  const FamilySosAlertScreen({super.key, required this.destination});

  final SosAlertDestination destination;

  @override
  Widget build(BuildContext context) {
    final createdAt = destination.createdAt?.toLocal();
    return Scaffold(
      backgroundColor: const Color(0xFF07131F),
      appBar: AppBar(
        backgroundColor: const Color(0xFF07131F),
        foregroundColor: Colors.white,
        title: const LocalizedText('ui.text.familySosTitle'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Card(
            color: const Color(0xFF162534),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.sos, color: Colors.redAccent, size: 42),
                  const SizedBox(height: 16),
                  Text(
                    destination.patientName,
                    key: const Key('family-sos-patient'),
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${context.l10n.t('ui.text.familySosStatus')}: ${destination.status}',
                    key: const Key('family-sos-status'),
                    style: const TextStyle(color: Colors.redAccent),
                  ),
                  if (createdAt != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      '${context.l10n.t('ui.text.familySosAlertTime')}: $createdAt',
                      style: const TextStyle(color: Color(0xFFB9C6D0)),
                    ),
                  ],
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    key: const Key('family-sos-open-map'),
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => FamilyWatchLiveMapScreen(
                          patientId: destination.patientId,
                          patientName: destination.patientName,
                          token: context.read<AppState>().accountToken,
                        ),
                      ),
                    ),
                    icon: const Icon(Icons.map_outlined),
                    label: const LocalizedText('ui.text.familySosOpenMap'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SosAlertMessage extends StatelessWidget {
  const _SosAlertMessage({
    super.key,
    required this.icon,
    required this.titleKey,
    required this.detailKey,
  });

  final IconData icon;
  final String titleKey;
  final String detailKey;

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFF07131F),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, color: Colors.white, size: 40),
                const SizedBox(height: 16),
                LocalizedText(titleKey,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white, fontSize: 20)),
                const SizedBox(height: 8),
                LocalizedText(detailKey,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Color(0xFFB9C6D0))),
              ],
            ),
          ),
        ),
      );
}

enum _SosEntryState { loading, authenticationRequired, unavailable, ready }
