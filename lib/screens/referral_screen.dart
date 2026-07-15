import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../models/app_state.dart';
import '../services/referral_service.dart';

class ReferralScreen extends StatefulWidget {
  const ReferralScreen({super.key});

  @override
  State<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends State<ReferralScreen> {
  final _service = ReferralService();
  late Future<ReferralOverview> _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final token = context.read<AppState>().accountToken;
    _future = _service.overview(token);
  }

  @override
  Widget build(BuildContext context) {
    final language = context.watch<AppState>().languageCode;
    final ru = language == 'ru' || language == 'uk';
    return Scaffold(
      appBar: AppBar(title: Text(_referralLabel(ru, 'title'))),
      body: FutureBuilder<ReferralOverview>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return _Message(
              text: _referralLabel(ru, 'loadError'),
              retryLabel: _referralLabel(ru, 'retry'),
              onRetry: _reload,
            );
          }
          return _ReferralContent(
            overview: snapshot.data!,
            ru: ru,
            onRefresh: _reload,
          );
        },
      ),
    );
  }

  void _reload() {
    final token = context.read<AppState>().accountToken;
    setState(() => _future = _service.overview(token));
  }
}

class _ReferralContent extends StatelessWidget {
  const _ReferralContent({
    required this.overview,
    required this.ru,
    required this.onRefresh,
  });

  final ReferralOverview overview;
  final bool ru;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final stats = overview.stats;
    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    _referralLabel(ru, 'inviteCode'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 10),
                  SelectableText(
                    overview.code,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.2,
                        ),
                  ),
                  const SizedBox(height: 14),
                  Center(
                    child: QrImageView(
                      data: overview.link,
                      version: QrVersions.auto,
                      size: 180,
                      backgroundColor: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 12),
                  SelectableText(
                    overview.link,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      FilledButton.icon(
                        onPressed: () => _copy(context, overview.link),
                        icon: const Icon(Icons.link),
                        label: Text(_referralLabel(ru, 'copyLink')),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => _copy(context, overview.code),
                        icon: const Icon(Icons.pin),
                        label: Text(_referralLabel(ru, 'copyCode')),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _referralLabel(ru, 'rewardNote'),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                  child: _Stat(
                      label: _referralLabel(ru, 'total'), value: stats.total)),
              const SizedBox(width: 8),
              Expanded(
                  child: _Stat(
                      label: _referralLabel(ru, 'rewards'),
                      value: stats.rewarded)),
              const SizedBox(width: 8),
              Expanded(
                  child: _Stat(
                      label: _referralLabel(ru, 'review'),
                      value: stats.manualReview)),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _referralLabel(ru, 'history'),
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          if (overview.history.isEmpty)
            _Empty(text: _referralLabel(ru, 'empty'))
          else
            ...overview.history.map((item) => Card(
                  child: ListTile(
                    leading: const Icon(Icons.person_add_alt_1),
                    title: Text(_statusLabel(item.status, ru)),
                    subtitle: Text([
                      if (item.registeredAt != null) _date(item.registeredAt!),
                      if ((item.rejectionReason ?? '').isNotEmpty)
                        item.rejectionReason!,
                    ].join(' · ')),
                    trailing: Text(
                      _rewardDays(item.grantedDays),
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                )),
        ],
      ),
    );
  }

  static Future<void> _copy(BuildContext context, String value) async {
    await Clipboard.setData(ClipboardData(text: value));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(_referralLabel(_isRu(context), 'copied'))),
    );
  }

  static String _date(DateTime value) {
    return '${value.day.toString().padLeft(2, '0')}.'
        '${value.month.toString().padLeft(2, '0')}.${value.year}';
  }

  static String _rewardDays(int days) => '+$days';

  static String _statusLabel(String status, bool ru) {
    if (!ru) return status;
    return {
          'email_pending': 'Ожидает подтверждения email',
          'awaiting_payment': 'Ожидает оплату',
          'payment_pending': 'Ожидает начисления',
          'qualified': 'Условия выполнены',
          'manual_review': 'На проверке',
          'rewarded': 'Награда начислена',
          'rejected': 'Отклонено',
          'revoked': 'Отозвано',
        }[status] ??
        status;
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Text(label, textAlign: TextAlign.center),
            const SizedBox(height: 4),
            Text(
              value.toString(),
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
          ],
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({
    required this.text,
    required this.retryLabel,
    required this.onRetry,
  });

  final String text;
  final String retryLabel;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(text, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: Text(retryLabel)),
        ],
      ),
    );
  }
}

bool _isRu(BuildContext context) {
  final language = context.read<AppState>().languageCode;
  return language == 'ru' || language == 'uk';
}

String _referralLabel(bool ru, String key) {
  const en = {
    'title': 'Referral program',
    'loadError': 'Could not load referral data.',
    'retry': 'Retry',
    'inviteCode': 'Your invite code',
    'copyLink': 'Copy link',
    'copyCode': 'Copy code',
    'rewardNote':
        'Reward is granted after the invited user verifies email and completes the first real Premium payment.',
    'total': 'Total',
    'rewards': 'Rewards',
    'review': 'Review',
    'history': 'History',
    'empty': 'No referrals yet.',
    'copied': 'Copied',
  };
  const ruText = {
    'title': 'Реферальная программа',
    'loadError': 'Не удалось загрузить реферальные данные.',
    'retry': 'Повторить',
    'inviteCode': 'Ваш код приглашения',
    'copyLink': 'Скопировать ссылку',
    'copyCode': 'Скопировать код',
    'rewardNote':
        'Награда начисляется после подтверждения email и первой реальной оплаты Premium приглашенным пользователем.',
    'total': 'Всего',
    'rewards': 'Наград',
    'review': 'Проверка',
    'history': 'История',
    'empty': 'Приглашений пока нет.',
    'copied': 'Скопировано',
  };
  return ru ? (ruText[key] ?? en[key] ?? key) : (en[key] ?? key);
}

class _Empty extends StatelessWidget {
  const _Empty({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(text, textAlign: TextAlign.center),
      ),
    );
  }
}
