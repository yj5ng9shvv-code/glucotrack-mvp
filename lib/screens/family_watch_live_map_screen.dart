import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../family_watch/family_location_api.dart';
import '../family_watch/location_models.dart';
import '../l10n/app_localizations.dart';
import '../widgets/localized_text.dart';

typedef FamilyLocationLoader = Future<FamilyLocationPoint?> Function();

/// Read-only caregiver view of a patient's consented Family Watch location.
///
/// Server-side authorization remains the source of truth: every refresh calls
/// the protected current-location endpoint and treats a 401/403 as no access.
class FamilyWatchLiveMapScreen extends StatefulWidget {
  const FamilyWatchLiveMapScreen({
    super.key,
    required this.patientId,
    required this.patientName,
    required this.token,
    this.locationLoader,
    this.pollingInterval = const Duration(seconds: 60),
    this.now,
    this.onOpenHistory,
    this.onSos,
  });

  final String patientId;
  final String patientName;
  final String token;
  final FamilyLocationLoader? locationLoader;
  final Duration pollingInterval;
  final DateTime Function()? now;
  final VoidCallback? onOpenHistory;
  final VoidCallback? onSos;

  @override
  State<FamilyWatchLiveMapScreen> createState() =>
      _FamilyWatchLiveMapScreenState();
}

class _FamilyWatchLiveMapScreenState extends State<FamilyWatchLiveMapScreen> {
  Timer? _pollTimer;
  FamilyLocationPoint? _location;
  _LiveMapState _state = _LiveMapState.loading;
  bool _refreshing = false;

  DateTime get _now => (widget.now ?? DateTime.now)().toUtc();

  @override
  void initState() {
    super.initState();
    _load();
    _pollTimer = Timer.periodic(widget.pollingInterval, (_) => _load());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<FamilyLocationPoint?> _fetch() {
    final loader = widget.locationLoader;
    if (loader != null) return loader();
    return FamilyLocationApi().getCurrentLocation(
      token: widget.token,
      patientId: widget.patientId,
    );
  }

  Future<void> _load({bool manual = false}) async {
    if (_refreshing) return;
    if (mounted) setState(() => _refreshing = true);
    try {
      final location = await _fetch();
      if (!mounted) return;
      setState(() {
        _location = location;
        _state = location == null ? _LiveMapState.empty : _LiveMapState.ready;
      });
    } on FamilyLocationApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _state = error.accessRevoked
            ? _LiveMapState.denied
            : _LiveMapState.networkError;
      });
    } catch (_) {
      if (mounted) setState(() => _state = _LiveMapState.networkError);
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final location = _location;
    return Scaffold(
      backgroundColor: const Color(0xFF07131F),
      appBar: AppBar(
        backgroundColor: const Color(0xFF07131F),
        foregroundColor: Colors.white,
        title: const LocalizedText('ui.text.familyWatchTitle'),
        actions: [
          IconButton(
            tooltip: context.l10n.t('ui.text.familyWatchRefreshNow'),
            onPressed: _refreshing ? null : () => _load(manual: true),
            icon: _refreshing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            _PatientStatusCard(
              patientName: widget.patientName,
              location: location,
              now: _now,
            ),
            Expanded(child: _buildMapContent(location)),
            _ControlBar(
              onRefresh: _refreshing ? null : () => _load(manual: true),
              onHistory: widget.onOpenHistory,
              onSos: widget.onSos,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMapContent(FamilyLocationPoint? location) {
    switch (_state) {
      case _LiveMapState.loading:
        return const _LiveMapMessage(
          key: Key('family-map-loading'),
          icon: Icons.location_searching,
          titleKey: 'ui.text.familyWatchFindingLocation',
          detailKey: 'ui.text.familyWatchCheckingConnection',
          loading: true,
        );
      case _LiveMapState.denied:
        return const _LiveMapMessage(
          key: Key('family-map-denied'),
          icon: Icons.lock_outline,
          titleKey: 'ui.text.familyWatchAccessUnavailable',
          detailKey: 'ui.text.familyWatchAccessRevokedDetail',
        );
      case _LiveMapState.empty:
        return const _LiveMapMessage(
          key: Key('family-map-empty'),
          icon: Icons.location_off_outlined,
          titleKey: 'ui.text.familyWatchNoLocation',
          detailKey: 'ui.text.familyWatchNoLocationDetail',
        );
      case _LiveMapState.networkError:
        return const _LiveMapMessage(
          key: Key('family-map-network-error'),
          icon: Icons.wifi_off_rounded,
          titleKey: 'ui.text.familyWatchConnectionUnavailable',
          detailKey: 'ui.text.familyWatchConnectionUnavailableDetail',
        );
      case _LiveMapState.ready:
        return _LiveMapCanvas(location: location!);
    }
  }
}

enum _LiveMapState { loading, ready, empty, denied, networkError }

class _PatientStatusCard extends StatelessWidget {
  const _PatientStatusCard({
    required this.patientName,
    required this.location,
    required this.now,
  });

  final String patientName;
  final FamilyLocationPoint? location;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final status = _locationStatus(location, now);
    final statusColor = switch (status) {
      _LocationStatus.online => const Color(0xFF32D583),
      _LocationStatus.stale => const Color(0xFFFDB022),
      _LocationStatus.offline => const Color(0xFF98A2B3),
    };
    final statusKey = switch (status) {
      _LocationStatus.online => 'ui.text.familyWatchOnline',
      _LocationStatus.stale => 'ui.text.familyWatchStale',
      _LocationStatus.offline => 'ui.text.familyWatchOffline',
    };
    return Semantics(
      label: context.l10n.t('ui.text.familyWatchPatientStatus'),
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF10273A),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFF204660)),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 23,
              backgroundColor: const Color(0xFF173A55),
              child: Text(
                patientName.isEmpty ? '?' : patientName.characters.first,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    patientName.isEmpty
                        ? context.l10n.t('ui.text.familyWatchPatient')
                        : patientName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    _lastUpdateLabel(location, now),
                    style: const TextStyle(color: Color(0xFFB7CDD9)),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(99),
              ),
              child: Text(
                context.l10n.t(statusKey),
                key: const Key('family-map-status'),
                style: TextStyle(
                  color: statusColor,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LiveMapCanvas extends StatelessWidget {
  const _LiveMapCanvas({required this.location});

  final FamilyLocationPoint location;

  @override
  Widget build(BuildContext context) {
    final point = LatLng(location.latitude, location.longitude);
    final accuracy = (location.accuracy ?? 0).clamp(0, 1000).toDouble();
    return ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: FlutterMap(
          options: MapOptions(initialCenter: point, initialZoom: 15),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.glucotrack.app',
            ),
            if (accuracy > 0)
              CircleLayer(circles: [
                CircleMarker(
                  point: point,
                  radius: accuracy,
                  useRadiusInMeter: true,
                  color: const Color(0xFF2E90FA).withValues(alpha: 0.16),
                  borderColor: const Color(0xFF2E90FA).withValues(alpha: 0.55),
                  borderStrokeWidth: 1.5,
                ),
              ]),
            MarkerLayer(markers: [
              Marker(
                point: point,
                width: 58,
                height: 58,
                child: const _PatientMarker(),
              ),
            ]),
          ],
        ),
      ),
    );
  }
}

class _PatientMarker extends StatelessWidget {
  const _PatientMarker();

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: const Color(0xFF0B74DE),
          border: Border.all(color: Colors.white, width: 3),
          boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 10)],
        ),
        child: const Icon(Icons.favorite, color: Colors.white, size: 25),
      );
}

class _LiveMapMessage extends StatelessWidget {
  const _LiveMapMessage({
    super.key,
    required this.icon,
    required this.titleKey,
    required this.detailKey,
    this.loading = false,
  });

  final IconData icon;
  final String titleKey;
  final String detailKey;
  final bool loading;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (loading)
                const CircularProgressIndicator(color: Color(0xFF53B1FD))
              else
                Icon(icon, color: const Color(0xFF98C7EB), size: 46),
              const SizedBox(height: 16),
              LocalizedText(titleKey,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              LocalizedText(detailKey,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFFB7CDD9))),
            ],
          ),
        ),
      );
}

class _ControlBar extends StatelessWidget {
  const _ControlBar({this.onRefresh, this.onHistory, this.onSos});

  final VoidCallback? onRefresh;
  final VoidCallback? onHistory;
  final VoidCallback? onSos;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        decoration: const BoxDecoration(color: Color(0xFF07131F)),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                key: const Key('family-map-refresh'),
                onPressed: onRefresh,
                icon: const Icon(Icons.refresh),
                label: const LocalizedText('ui.text.familyWatchRefresh'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Color(0xFF37637E)),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: onHistory,
                icon: const Icon(Icons.route_outlined),
                label: const LocalizedText('ui.text.familyWatchHistory'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Color(0xFF37637E)),
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: onSos,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFD92D20),
                foregroundColor: Colors.white,
              ),
              child: const Icon(Icons.sos),
            ),
          ],
        ),
      );
}

enum _LocationStatus { online, stale, offline }

_LocationStatus _locationStatus(FamilyLocationPoint? location, DateTime now) {
  if (location == null) return _LocationStatus.offline;
  final age = now.difference(location.capturedAt.toUtc());
  if (age < const Duration(minutes: 5)) return _LocationStatus.online;
  if (age < const Duration(minutes: 15)) return _LocationStatus.stale;
  return _LocationStatus.offline;
}

String _lastUpdateLabel(FamilyLocationPoint? location, DateTime now) {
  if (location == null) return 'No location update yet';
  final minutes = now.difference(location.capturedAt.toUtc()).inMinutes;
  if (minutes <= 0) return 'Updated just now';
  if (minutes == 1) return 'Updated 1 minute ago';
  return 'Updated $minutes minutes ago';
}
