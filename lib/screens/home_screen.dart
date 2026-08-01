import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../navigation/app_navigator.dart';
import '../services/notification_service.dart';
import '../widgets/localized_text.dart';
import '../widgets/medical_disclaimer.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _glucoseController = TextEditingController();
  final _notificationService = NotificationService();
  bool _savingGlucose = false;
  int _unreadNotifications = 0;
  bool _loadingNotifications = false;
  bool _notificationsRequested = false;

  @override
  void dispose() {
    _glucoseController.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_notificationsRequested) return;
    _notificationsRequested = true;
    _loadUnreadNotifications();
  }

  Future<void> _loadUnreadNotifications() async {
    if (_loadingNotifications) return;
    final state = context.read<AppState>();
    if (!state.isAuthenticated || state.accountToken.isEmpty) return;
    _loadingNotifications = true;
    try {
      final notifications = await _notificationService.list(state.accountToken);
      if (mounted) {
        setState(() {
          _unreadNotifications =
              notifications.where((item) => !item.isRead).length;
        });
      }
    } catch (_) {
      // The home screen should stay usable when notification loading fails.
    } finally {
      _loadingNotifications = false;
    }
  }

  Future<void> _openNotifications() async {
    await AppNavigator.pushNamed('/notifications');
    if (mounted) _loadUnreadNotifications();
  }

  Future<void> _saveGlucose(AppState state) async {
    final l10n = AppLocalizations(state.languageCode);
    final value = double.tryParse(_glucoseController.text.replaceAll(',', '.'));
    if (value == null) {
      _message(l10n.t('invalidGlucose'));
      return;
    }

    setState(() => _savingGlucose = true);
    try {
      await state.recordGlucoseMeasurement(value);
      _glucoseController.clear();
      if (mounted) _message(l10n.t('measurementSaved'));
    } on ArgumentError {
      if (mounted) {
        _message(
          state.glucoseUnit == GlucoseUnit.mgDl
              ? l10n.t('glucoseRangeMg')
              : l10n.t('glucoseRangeMmol'),
        );
      }
    } finally {
      if (mounted) setState(() => _savingGlucose = false);
    }
  }

  void _message(String text) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 46,
        title: const LocalizedText('ui.text.f60a227611f3'),
        actions: [
          if (state.isAuthenticated)
            IconButton(
              tooltip: l10n.t('referrals'),
              onPressed: () => AppNavigator.pushNamed('/referrals'),
              icon: const Icon(Icons.group_add_outlined),
            ),
          if (state.isAuthenticated)
            _NotificationBell(
              unreadCount: _unreadNotifications,
              onPressed: _openNotifications,
            ),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: state.languageCode,
                menuWidth: 210,
                menuMaxHeight: 520,
                borderRadius: BorderRadius.circular(14),
                onChanged: (value) {
                  if (value != null) state.setLanguage(value);
                },
                selectedItemBuilder: (context) => AppState.supportedLanguages
                    .map(
                      (language) => Align(
                        alignment: Alignment.centerLeft,
                        child: Text(language.flag),
                      ),
                    )
                    .toList(),
                items: AppState.supportedLanguages
                    .map(
                      (language) => DropdownMenuItem(
                        value: language.code,
                        child: SizedBox(
                          width: 178,
                          child: Text(
                            '${language.flag} ${language.label}',
                            maxLines: 1,
                            softWrap: false,
                          ),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1180),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
            children: [
              if (state.isTrialEndingTomorrow) ...[
                _TrialEndingBanner(l10n: l10n),
                const SizedBox(height: 6),
              ],
              _VoiceAiIntroCard(l10n: l10n),
              const SizedBox(height: 6),
              _GlucoseHeader(
                state: state,
                l10n: l10n,
                controller: _glucoseController,
                saving: _savingGlucose,
                onSave: () => _saveGlucose(state),
              ),
              const SizedBox(height: 6),
              const MedicalDisclaimer(),
              const SizedBox(height: 6),
              _EmergencyStrip(l10n: l10n),
              const SizedBox(height: 8),
              _HomeSectionsGrid(l10n: l10n),
            ],
          ),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        height: 64,
        selectedIndex: 0,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home),
            label: l10n.t('navigation.home'),
          ),
          NavigationDestination(
            icon: const CircleAvatar(
              radius: 22,
              backgroundColor: Color(0xFF075BBB),
              child: Icon(Icons.mic, color: Colors.white),
            ),
            label: l10n.t('navigation.askAi'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.person),
            label: l10n.t('navigation.profile'),
          ),
        ],
        onDestinationSelected: (i) {
          if (i == 1) AppNavigator.pushNamed('/voice-assistant');
          if (i == 2) AppNavigator.pushNamed('/profile');
        },
      ),
    );
  }
}

class _NotificationBell extends StatelessWidget {
  const _NotificationBell({required this.unreadCount, required this.onPressed});

  final int unreadCount;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final count = unreadCount > 99 ? '99+' : unreadCount.toString();
    final notificationTooltip = context.l10n.t('notifications.title');
    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          IconButton(
            tooltip: notificationTooltip,
            onPressed: onPressed,
            icon: const Icon(Icons.notifications_none),
          ),
          if (unreadCount > 0)
            Positioned(
              right: 4,
              top: 4,
              child: Container(
                constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                padding: const EdgeInsets.symmetric(horizontal: 5),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.error,
                  borderRadius: BorderRadius.circular(999),
                ),
                alignment: Alignment.center,
                child: Text(
                  count,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onError,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _VoiceAiIntroCard extends StatelessWidget {
  const _VoiceAiIntroCard({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFFEFF8FF),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => AppNavigator.pushNamed('/voice-assistant'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const CircleAvatar(
                backgroundColor: Color(0xFF075BBB),
                child: Icon(Icons.mic, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.t('marketingVoiceTitle'),
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      l10n.t('marketingVoiceText'),
                      style: const TextStyle(height: 1.3),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

class _TrialEndingBanner extends StatelessWidget {
  final AppLocalizations l10n;

  const _TrialEndingBanner({required this.l10n});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFFFFF7E6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final textScale = MediaQuery.textScalerOf(context).scale(1);
            final needsStackedLayout =
                constraints.maxWidth < (520 + (textScale - 1) * 620);
            final title = _TrialEndingTitle(text: l10n.t('trialEndsTomorrow'));
            final action = FilledButton(
              onPressed: () => AppNavigator.pushNamed('/subscription'),
              child: Text(l10n.t('subscribeToContinue')),
            );

            if (needsStackedLayout) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.notifications_active,
                        color: Color(0xFFF79009),
                      ),
                      const SizedBox(width: 10),
                      Expanded(child: title),
                    ],
                  ),
                  const SizedBox(height: 10),
                  action,
                ],
              );
            }

            return Row(
              children: [
                const Icon(
                  Icons.notifications_active,
                  color: Color(0xFFF79009),
                ),
                const SizedBox(width: 10),
                Expanded(child: title),
                const SizedBox(width: 12),
                action,
              ],
            );
          },
        ),
      ),
    );
  }
}

class _TrialEndingTitle extends StatelessWidget {
  const _TrialEndingTitle({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontWeight: FontWeight.w700,
        letterSpacing: 0,
        wordSpacing: 0,
      ),
    );
  }
}

class _GlucoseHeader extends StatelessWidget {
  const _GlucoseHeader({
    required this.state,
    required this.l10n,
    required this.controller,
    required this.saving,
    required this.onSave,
  });

  final AppState state;
  final AppLocalizations l10n;
  final TextEditingController controller;
  final bool saving;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF075BBB), Color(0xFF00A6D6)],
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.t('currentGlucose'),
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Text(
                  state.formatGlucose(state.glucoseMmol),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 116,
                child: TextField(
                  controller: controller,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => onSave(),
                  style: const TextStyle(
                    color: Color(0xFF182230),
                    fontWeight: FontWeight.w700,
                  ),
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: Colors.white,
                    hintText: state.glucoseUnit == GlucoseUnit.mgDl
                        ? 'mg/dL'
                        : 'mmol/L',
                    suffixIcon: IconButton(
                      tooltip: l10n.t('saveMeasurement'),
                      onPressed: saving ? null : onSave,
                      icon: saving
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.add_chart),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 6,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            l10n.t('measurementHint'),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.8),
              fontSize: 11,
            ),
          ),
          Text(
            l10n.t('statusNormal'),
            style: const TextStyle(color: Colors.white, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _EmergencyStrip extends StatelessWidget {
  const _EmergencyStrip({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      color: const Color(0xFFFFE9E7),
      child: ListTile(
        minLeadingWidth: 24,
        visualDensity: const VisualDensity(vertical: -3),
        leading: const Icon(Icons.sos, color: Color(0xFFB42318), size: 22),
        title: Text(
          l10n.t('emergencyInfo'),
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
        ),
        subtitle: Text(
          l10n.t('emergencySubtitle'),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 11),
        ),
        trailing: const Icon(Icons.chevron_right, size: 20),
        onTap: () => AppNavigator.pushNamed('/emergency'),
      ),
    );
  }
}

class _HomeSectionsGrid extends StatelessWidget {
  const _HomeSectionsGrid({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final sections = [
      _HomeSection(
        title: l10n.t('homeSectionSos'),
        subtitle: l10n.t('homeSectionSosSubtitle'),
        icon: Icons.sos,
        color: const Color(0xFFB42318),
        entries: [
          _SectionEntry(
            title: l10n.t('familyControl'),
            icon: Icons.family_restroom,
            route: '/family-access',
          ),
          _SectionEntry(
            title: l10n.t('sosMode'),
            icon: Icons.sos,
            route: '/sos',
          ),
          _SectionEntry(
            title: l10n.t('sosProfile'),
            icon: Icons.health_and_safety,
            route: '/emergency-profile',
          ),
          _SectionEntry(
            title: l10n.t('emergencyCard'),
            icon: Icons.emergency,
            route: '/emergency-card',
          ),
        ],
      ),
      _HomeSection(
        title: l10n.t('homeSectionTools'),
        subtitle: l10n.t('homeSectionToolsSubtitle'),
        icon: Icons.calculate,
        color: const Color(0xFF075BBB),
        entries: [
          _SectionEntry(
            title: l10n.t('calculator'),
            icon: Icons.calculate,
            route: '/calculator',
          ),
          _SectionEntry(
            title: l10n.t('foodCatalog'),
            icon: Icons.restaurant_menu,
            route: '/catalog',
          ),
          _SectionEntry(
            title: l10n.t('aiAssistant'),
            icon: Icons.smart_toy,
            route: '/ai-assistant',
          ),
          _SectionEntry(
            title: l10n.t('foodPhoto'),
            icon: Icons.camera_alt,
            route: '/scanner',
          ),
        ],
      ),
      _HomeSection(
        title: l10n.t('homeSectionAnalytics'),
        subtitle: l10n.t('homeSectionAnalyticsSubtitle'),
        icon: Icons.insights,
        color: const Color(0xFF6840C6),
        entries: [
          _SectionEntry(
            title: l10n.t('diary'),
            icon: Icons.edit_note,
            route: '/diary',
          ),
          _SectionEntry(
            title: l10n.t('trends'),
            icon: Icons.show_chart,
            route: '/trends',
          ),
          _SectionEntry(
            title: l10n.t('diaryAnalysis'),
            icon: Icons.insights,
            route: '/diary-analysis',
          ),
          _SectionEntry(
            title: l10n.t('doctorReport'),
            icon: Icons.description,
            route: '/doctor-report',
          ),
          _SectionEntry(
            title: l10n.t('export'),
            icon: Icons.file_download,
            route: '/export',
          ),
        ],
      ),
      _HomeSection(
        title: l10n.t('homeSectionIntegrations'),
        subtitle: l10n.t('homeSectionIntegrationsSubtitle'),
        icon: Icons.hub,
        color: const Color(0xFF0086C9),
        entries: [
          _SectionEntry(
            title: l10n.t('cloudSync'),
            icon: Icons.cloud_sync,
            route: '/cloud-sync',
          ),
          _SectionEntry(
            title: l10n.t('sensors'),
            icon: Icons.sensors,
            route: '/sensors',
          ),
        ],
      ),
      _HomeSection(
        title: l10n.t('homeSectionProfile'),
        subtitle: l10n.t('homeSectionProfileSubtitle'),
        icon: Icons.person,
        color: const Color(0xFF475467),
        entries: [
          _SectionEntry(
            title: l10n.t('premium'),
            icon: Icons.workspace_premium,
            route: '/subscription',
          ),
          _SectionEntry(
            title: l10n.t('referrals'),
            icon: Icons.group_add,
            route: '/referrals',
          ),
          _SectionEntry(
            title: l10n.t('settings'),
            icon: Icons.settings,
            route: '/profile',
          ),
          _SectionEntry(
            title: l10n.t('helpTitle'),
            icon: Icons.help_outline,
            route: '/help',
          ),
          _SectionEntry(
            title: l10n.t('about.title'),
            icon: Icons.info_outline,
            route: '/about',
          ),
        ],
      ),
      _HomeSection(
        title: l10n.t('homeSectionAiDoctor'),
        subtitle: l10n.t('homeSectionAiDoctorSubtitle'),
        icon: Icons.medical_services,
        color: const Color(0xFF027A48),
        route: '/ai-doctor',
        entries: const [],
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final textScale = MediaQuery.textScalerOf(context).scale(1);
        final columns = width >= 920
            ? 3
            : width >= 560
                ? 2
                : 1;
        final baseCellHeight = columns == 1 ? 116.0 : 128.0;
        final cellHeight = baseCellHeight + ((textScale - 1) * 64);
        final cellWidth = (width - (columns - 1) * 8) / columns;

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: cellWidth / cellHeight,
          ),
          itemCount: sections.length,
          itemBuilder: (context, index) =>
              _SectionCard(section: sections[index]),
        );
      },
    );
  }
}

class _HomeSection {
  const _HomeSection({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.entries,
    this.route,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final List<_SectionEntry> entries;
  final String? route;
}

class _SectionEntry {
  const _SectionEntry({required this.title, required this.icon, this.route});

  final String title;
  final IconData icon;
  final String? route;
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.section});

  final _HomeSection section;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () {
          if (section.route != null) {
            AppNavigator.pushNamed(section.route!);
            return;
          }
          _showSectionSheet(context, section);
        },
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: section.color.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(section.icon, color: section.color, size: 30),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      section.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 17,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      section.subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFF667085),
                        fontSize: 12,
                        height: 1.15,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Color(0xFF98A2B3)),
            ],
          ),
        ),
      ),
    );
  }

  void _showSectionSheet(BuildContext context, _HomeSection section) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(section.icon, color: section.color),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      section.title,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              ...section.entries.map(
                (entry) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: Icon(entry.icon, color: section.color),
                    title: Text(entry.title),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      Navigator.pop(sheetContext);
                      if (entry.route != null) {
                        WidgetsBinding.instance.addPostFrameCallback((_) {
                          AppNavigator.pushNamed(entry.route!);
                        });
                      }
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
