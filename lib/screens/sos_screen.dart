import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../platform/sos_geolocation.dart';
import '../services/emergency_service.dart';

class SosScreen extends StatefulWidget {
  const SosScreen({super.key});
  @override
  State<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends State<SosScreen>
    with SingleTickerProviderStateMixin {
  final _service = AndroidEmergencyService();
  late final AnimationController _holdProgress;
  Timer? _holdTimer;
  SosLocation? _location;
  DateTime? _locationTime;
  DateTime? _lastActivation;
  bool _locating = false;
  bool _activating = false;

  AppLocalizations get _l10n =>
      AppLocalizations(context.read<AppState>().languageCode);

  @override
  void initState() {
    super.initState();
    _holdProgress = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    );
    SharedPreferences.getInstance().then((prefs) {
      final stored = prefs.getString('sos.last_activation_at');
      if (mounted && stored != null) {
        setState(() => _lastActivation = DateTime.tryParse(stored));
      }
    });
  }

  @override
  void dispose() {
    _holdTimer?.cancel();
    _holdProgress.dispose();
    super.dispose();
  }

  void _startHold() {
    if (_activating) return;
    _holdTimer?.cancel();
    _holdProgress.forward(from: 0);
    _holdTimer = Timer(const Duration(seconds: 2), _activateSos);
  }

  void _cancelHold() {
    _holdTimer?.cancel();
    _holdTimer = null;
    if (!_activating) _holdProgress.reverse();
  }

  Future<void> _activateSos() async {
    _holdTimer = null;
    if (_activating) return;
    final state = context.read<AppState>();
    setState(() => _activating = true);
    await HapticFeedback.heavyImpact();
    final location = await _getLocation(showMessage: false);
    final now = DateTime.now();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('sos.last_activation_at', now.toIso8601String());
    if (!mounted) return;
    setState(() => _lastActivation = now);
    await _service.showAlert(state);
    if (!mounted) return;
    setState(() => _activating = false);
    _holdProgress.reset();
    if (location == null) _message(_l10n.t('sos.locationUnavailable'));
  }

  Future<SosLocation?> _getLocation({bool showMessage = true}) async {
    if (_locating) return _location;
    setState(() => _locating = true);
    final result = await getCurrentSosLocation();
    if (!mounted) return result;
    setState(() {
      _locating = false;
      if (result != null) {
        _location = result;
        _locationTime = DateTime.now();
      }
    });
    if (showMessage) {
      _message(
        _l10n.t(
          result == null ? 'sos.locationUnavailable' : 'sos.locationReady',
        ),
      );
    }
    return result;
  }

  Future<void> _openMap() async {
    final location = _location ?? await _getLocation();
    if (location == null || !mounted) return;
    final opened = await launchUrl(
      Uri.parse(location.mapsUrl),
      mode: LaunchMode.externalApplication,
    );
    if (!opened && mounted) {
      _message(_l10n.t('sos.locationUnavailable'));
    }
  }

  Future<void> _sendLocation(AppState state) async {
    final phone = state.emergencyContactPhone.trim();
    if (phone.isEmpty) {
      _message(_l10n.t('sos.noEmergencyContact'));
      return;
    }
    final location = await _getLocation();
    if (location == null || !mounted) return;
    final patient =
        state.fullName.trim().isEmpty ? 'GlukoTrack' : state.fullName.trim();
    await _service.composeSms(
      phone,
      'SOS GlukoTrack: $patient. ${location.mapsUrl}',
    );
    if (mounted) _message(_l10n.t('sos.smsComposerOpened'));
  }

  void _message(String value) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(value)));
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = context.l10n;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('sos.cardTitle')),
        actions: [
          IconButton(
            tooltip: l10n.t('settings'),
            onPressed: () => Navigator.pushNamed(context, '/emergency-profile'),
            icon: const Icon(Icons.settings_outlined),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Semantics(
            button: true,
            label: l10n.t('sos.holdToActivate'),
            child: GestureDetector(
              onTapDown: (_) => _startHold(),
              onTapUp: (_) => _cancelHold(),
              onTapCancel: _cancelHold,
              child: AnimatedBuilder(
                animation: _holdProgress,
                builder: (context, child) => Container(
                  constraints: const BoxConstraints(minHeight: 156),
                  decoration: BoxDecoration(
                    color: Color.lerp(
                      const Color(0xFFE11D48),
                      const Color(0xFF9F1239),
                      reduceMotion ? 0 : _holdProgress.value,
                    ),
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x33E11D48),
                        blurRadius: 24,
                        offset: Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      SizedBox.square(
                        dimension: 104,
                        child: CircularProgressIndicator(
                          value: _holdProgress.value,
                          strokeWidth: 7,
                          color: Colors.white,
                          backgroundColor: Colors.white24,
                        ),
                      ),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.sos, size: 56, color: Colors.white),
                          Text(
                            _activating
                                ? l10n.t('sos.activating')
                                : l10n.t('sos.holdToActivate'),
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          if (_lastActivation != null) ...[
            const SizedBox(height: 10),
            Text(
              '${l10n.t('sos.lastActivation')}: '
              '${l10n.formatDateTime(_lastActivation!)}',
            ),
          ],
          const SizedBox(height: 16),
          if (_locating) const LinearProgressIndicator(),
          if (_location != null)
            Card(
              child: ListTile(
                leading: const Icon(
                  Icons.location_on,
                  color: Color(0xFFE11D48),
                ),
                title: Text(l10n.t('sos.locationReady')),
                subtitle: Text(
                  '${_location!.latitude.toStringAsFixed(6)}, '
                  '${_location!.longitude.toStringAsFixed(6)}\n'
                  '${l10n.t('sos.accuracy')}: '
                  '${_location!.accuracy?.toStringAsFixed(0) ?? '—'} m · '
                  '${l10n.t('sos.updatedAt')}: '
                  '${l10n.formatDateTime(_locationTime!)}',
                ),
              ),
            ),
          _ActionGrid(
            children: [
              _action(
                Icons.my_location,
                l10n.t('sos.myLocation'),
                () => _getLocation(),
              ),
              _action(Icons.call, l10n.t('sos.callContact'), () {
                final phone = state.emergencyContactPhone.trim();
                if (phone.isEmpty) {
                  _message(l10n.t('sos.noEmergencyContact'));
                } else {
                  _service.dial(phone);
                }
              }),
              _action(
                Icons.qr_code_2,
                l10n.t('sos.showQr'),
                () => Navigator.pushNamed(context, '/emergency-card'),
              ),
              _action(
                Icons.medical_information,
                l10n.t('sos.medicalCard'),
                () => Navigator.pushNamed(context, '/emergency-card'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: _locating ? null : () => _sendLocation(state),
            icon: const Icon(Icons.sms_outlined),
            label: Text(l10n.t('sos.sendLocation')),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _locating ? null : _openMap,
            icon: const Icon(Icons.map_outlined),
            label: Text(l10n.t('sos.openMap')),
          ),
          const SizedBox(height: 12),
          Card(
            color: const Color(0xFFFFF1F2),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.lock_outline, color: Color(0xFF9F1239)),
                  const SizedBox(width: 10),
                  Expanded(child: Text(l10n.t('sos.lockScreenInfo'))),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _action(IconData icon, String label, VoidCallback onPressed) =>
      OutlinedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon),
        label: Text(label, textAlign: TextAlign.center),
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(76),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
      );
}

class _ActionGrid extends StatelessWidget {
  const _ActionGrid({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var index = 0; index < children.length; index++) ...[
            if (index > 0) const SizedBox(height: 12),
            children[index],
          ],
        ],
      );
}
