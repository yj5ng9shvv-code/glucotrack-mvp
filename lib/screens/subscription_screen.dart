import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../services/device_identity_service.dart';
import '../services/subscription_service.dart';
import '../widgets/localized_text.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  final _service = SubscriptionService();
  bool _busy = false;
  bool _verificationSent = false;
  String? _message;
  ServerSubscription? _subscription;
  String? _currentDeviceId;

  @override
  void initState() {
    super.initState();
    Future.microtask(_refresh);
  }

  Future<void> _refresh() async {
    await _run(() async {
      final state = context.read<AppState>();
      final identity = await DeviceIdentityService.current();
      final subscription = await _service.status(state.accountToken);
      if (mounted) {
        setState(() {
          _subscription = subscription;
          _currentDeviceId = identity.id;
        });
      }
      state.updateServerSubscription(
        active: subscription.active,
        status: subscription.status,
        plan: subscription.plan,
        until: subscription.until,
      );
    });
  }

  Future<void> _removeDevice(SubscriptionDevice device) async {
    await _run(() async {
      final state = context.read<AppState>();
      await _service.removeDevice(state.accountToken, device.id);
    });
    await _refresh();
  }

  Future<void> _startTrial() async {
    await _run(() async {
      final state = context.read<AppState>();
      final subscription = await _service.startTrial(state.accountToken);
      if (mounted) setState(() => _subscription = subscription);
      state.updateServerSubscription(
        active: subscription.active,
        status: subscription.status,
        plan: subscription.plan,
        until: subscription.until,
      );
      if (mounted) {
        setState(() => _message = subscription.trialEndsAt == null
            ? null
            : '${context.l10n.t('premiumTrialTitle')}: ${context.l10n.formatDateTime(subscription.trialEndsAt!)}');
      }
    });
  }

  Future<void> _resendVerification() async {
    if (mounted) setState(() => _verificationSent = false);
    await _run(() async {
      final state = context.read<AppState>();
      await _service.resendEmailVerification(
        state.accountEmail,
        locale: state.languageCode,
      );
      if (mounted) {
        setState(() => _verificationSent = true);
      }
    });
  }

  Future<void> _checkout(String plan) async {
    await _run(() async {
      final state = context.read<AppState>();
      final url = await _service.createCheckout(state.accountToken, plan);
      if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
        throw const SubscriptionException('networkUnavailable');
      }
    });
  }

  Future<void> _portal() async {
    await _run(() async {
      final state = context.read<AppState>();
      final url = await _service.createPortal(state.accountToken);
      if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
        throw const SubscriptionException('networkUnavailable');
      }
    });
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await action();
    } catch (error) {
      if (mounted) {
        final rawValue = error.toString();
        final raw = rawValue.toLowerCase();
        final message = error is SubscriptionException
            ? context.l10n.t(error.message)
            : raw.contains('socketexception') ||
                raw.contains('clientexception') ||
                raw.contains('failed host lookup') ||
                raw.contains('timed out')
            ? context.l10n.t('networkUnavailable')
            : context.l10n.t('networkUnavailable');
        setState(() => _message = message);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(
        title: const LocalizedText('ui.text.fa9b4ee785d7'),
        actions: [
          IconButton(
              onPressed: _busy ? null : _refresh,
              icon: const Icon(Icons.refresh)),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(l10n.t('premium'),
                      style: const TextStyle(
                          fontSize: 28, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  Text(
                    l10n.t('premiumDescription'),
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 16),
                  Card(
                    color: const Color(0xFFEFF8FF),
                    child: ListTile(
                      leading: const Icon(Icons.card_giftcard,
                          color: Color(0xFF075BBB)),
                      title: Text(l10n.t('premiumTrialTitle'),
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                      subtitle: Text(l10n.t('premiumTrialText')),
                    ),
                  ),
                  if (_subscription != null &&
                      !_subscription!.active &&
                      !_subscription!.trialUsed) ...[
                    const SizedBox(height: 8),
                    if (!_subscription!.emailVerified) ...[
                      const LocalizedText(
                        'ui.text.a7ac75be7b72',
                        style: TextStyle(color: Color(0xFFB42318)),
                      ),
                      TextButton.icon(
                        onPressed: _busy ? null : _resendVerification,
                        icon: const Icon(Icons.mark_email_unread),
                        label: const LocalizedText(
                          'ui.text.ea53bbb03834',
                        ),
                      ),
                      if (_verificationSent)
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.check_circle,
                                color: Color(0xFF039855), size: 20),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                l10n.t('verificationEmailSent'),
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: Color(0xFF027A48),
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                    ],
                    FilledButton.icon(
                      onPressed: _busy ? null : _startTrial,
                      icon: const Icon(Icons.card_giftcard),
                      label: Text(l10n.t('premiumTrialTitle')),
                    ),
                  ],
                  if (_subscription?.accessStatus == 'trial_expired') ...[
                    const SizedBox(height: 8),
                    const LocalizedText(
                      'ui.text.e0ad5945a1a9',
                      style: TextStyle(color: Color(0xFFB42318)),
                    ),
                  ],
                  if (state.isTrialEndingTomorrow) ...[
                    const SizedBox(height: 8),
                    Card(
                      color: const Color(0xFFFFF7E6),
                      child: ListTile(
                        leading: const Icon(Icons.notifications_active,
                            color: Color(0xFFF79009)),
                        title: Text(l10n.t('trialEndsTomorrow')),
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Text(l10n.t('freeForeverTitle'),
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w800)),
                  _Feature(text: l10n.t('freeCurrentSugar')),
                  _Feature(text: l10n.t('freeBasicStats')),
                  _Feature(text: l10n.t('freeDiary')),
                  const SizedBox(height: 12),
                  Text(l10n.t('premiumIncludesTitle'),
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w800)),
                  _Feature(text: l10n.t('premiumAiAssistant')),
                  _Feature(text: l10n.t('premiumSugarForecast')),
                  _Feature(text: l10n.t('premiumFoodPhoto')),
                  _Feature(text: l10n.t('premiumReports')),
                  _Feature(text: l10n.t('premiumFamily')),
                  _Feature(text: l10n.t('premiumExport')),
                  _Feature(text: l10n.t('premiumRecommendations')),
                  const SizedBox(height: 20),
                  if (state.premium) ...[
                    const ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.verified, color: Color(0xFF039855)),
                      title: LocalizedText('ui.text.be447dcdbb3f'),
                    ),
                    Text(
                        '${l10n.t('ui.text.f23dc4f4fbb4')}: ${state.premiumPlan ?? 'subscription'}'),
                    if (state.premiumUntil != null)
                      Text(
                          '${l10n.t('ui.text.fe3c73ce5b52')}: ${state.premiumUntil!.toLocal()}'),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: _busy ? null : _portal,
                      child: const LocalizedText('ui.text.537f95d8b61c'),
                    ),
                  ] else ...[
                    _PlanOption(
                      icon: Icons.calendar_month,
                      title: l10n.t('personalMonthlyPlan'),
                      price: l10n.t('monthPrice'),
                      description: l10n.t('personalPlanDescription'),
                      primary: true,
                      onPressed: _busy ? null : () => _checkout('monthly'),
                    ),
                    const SizedBox(height: 8),
                    _PlanOption(
                      icon: Icons.event_available,
                      title: l10n.t('personalYearlyPlan'),
                      price: l10n.t('yearPrice'),
                      description: l10n.t('yearlyPlanDescription'),
                      onPressed: _busy ? null : () => _checkout('yearly'),
                    ),
                    const SizedBox(height: 8),
                    _PlanOption(
                      icon: Icons.family_restroom,
                      title: l10n.t('familyPlan'),
                      price: l10n.t('familyPrice'),
                      description: l10n.t('familyPlanDescription'),
                      onPressed: _busy ? null : () => _checkout('family'),
                    ),
                  ],
                  if (_subscription != null) ...[
                    const SizedBox(height: 24),
                    Text(
                      l10n.t('connectedDevices'),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      l10n
                          .t('deviceUsage')
                          .replaceAll(
                              '{count}', '${_subscription!.devices.length}')
                          .replaceAll(
                              '{limit}', '${_subscription!.deviceLimit}'),
                    ),
                    const SizedBox(height: 8),
                    ..._subscription!.devices.map(
                      (device) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(_deviceIcon(device.platform)),
                        title: Text(device.name),
                        subtitle: Text(
                          device.deviceId == _currentDeviceId
                              ? l10n.t('thisDevice')
                              : l10n.t('deviceLastActive').replaceAll(
                                    '{date}',
                                    device.lastSeenAt == null
                                        ? '-'
                                        : l10n.formatDateTime(
                                            device.lastSeenAt!,
                                          )
                                  ),
                        ),
                        trailing: device.deviceId == _currentDeviceId
                            ? const Icon(Icons.check_circle,
                                color: Color(0xFF039855))
                            : IconButton(
                                tooltip: l10n.t('removeDevice'),
                                onPressed:
                                    _busy ? null : () => _removeDevice(device),
                                icon: const Icon(Icons.logout),
                              ),
                      ),
                    ),
                  ],
                  if (_busy) ...[
                    const SizedBox(height: 12),
                    const LinearProgressIndicator(),
                  ],
                  if (_message != null) ...[
                    const SizedBox(height: 12),
                    Text(_message!,
                        style: const TextStyle(color: Color(0xFFB42318))),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Feature extends StatelessWidget {
  final String text;
  const _Feature({required this.text});
  @override
  Widget build(BuildContext context) => Row(
        children: [
          const Icon(Icons.check, size: 18),
          const SizedBox(width: 6),
          Expanded(child: Text(text)),
        ],
      );
}

class _PlanOption extends StatelessWidget {
  final IconData icon;
  final String title;
  final String price;
  final String description;
  final bool primary;
  final VoidCallback? onPressed;

  const _PlanOption({
    required this.icon,
    required this.title,
    required this.price,
    required this.description,
    required this.onPressed,
    this.primary = false,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final compact = constraints.maxWidth < 520;
      final details = Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 28),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 17, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(description),
              ],
            ),
          ),
        ],
      );
      final content = Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: compact
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  details,
                  const SizedBox(height: 12),
                  Text(price,
                      textAlign: TextAlign.end,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w900)),
                ],
              )
            : Row(
                children: [
                  Expanded(child: details),
                  const SizedBox(width: 24),
                  Text(price,
                      textAlign: TextAlign.end,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w900)),
                ],
              ),
      );
      final shape = RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
      );
      if (!primary) {
        return OutlinedButton(
          onPressed: onPressed,
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            shape: shape,
          ),
          child: content,
        );
      }
      return DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: const LinearGradient(
            colors: [Color(0xFF075BBB), Color(0xFF635BDF), Color(0xFF8B5CF6)],
          ),
        ),
        child: FilledButton(
          onPressed: onPressed,
          style: FilledButton.styleFrom(
            backgroundColor: Colors.transparent,
            shadowColor: Colors.transparent,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            shape: shape,
          ),
          child: content,
        ),
      );
    });
  }
}

IconData _deviceIcon(String platform) {
  return switch (platform) {
    'android' || 'iOS' => Icons.smartphone,
    'web' => Icons.language,
    _ => Icons.computer,
  };
}
