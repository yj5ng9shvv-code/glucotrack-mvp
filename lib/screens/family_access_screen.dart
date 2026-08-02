import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../models/app_state.dart';
import '../widgets/localized_text.dart';
import '../services/family_access_service.dart';
import 'family_watch_live_map_screen.dart';

class FamilyAccessScreen extends StatefulWidget {
  const FamilyAccessScreen({super.key});

  @override
  State<FamilyAccessScreen> createState() => _FamilyAccessScreenState();
}

class _FamilyAccessScreenState extends State<FamilyAccessScreen> {
  final _service = FamilyAccessService();
  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  FamilyDashboard? _dashboard;
  bool _shareHistory = false;
  bool _shareEmergency = true;
  bool _busy = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  AppLocalizations _l10n() =>
      AppLocalizations(context.read<AppState>().languageCode);

  Future<void> _load() async {
    await _run(() async {
      _dashboard = await _service.load(context.read<AppState>().accountToken);
    }, successMessage: null);
  }

  Future<void> _invite() async {
    final email = _emailController.text.trim();
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
      final l10n = _l10n();
      setState(() => _message = l10n.t('auth.invalid_email'));
      return;
    }
    final token = context.read<AppState>().accountToken;
    final l10n = _l10n();
    FamilyMember? invitation;
    await _run(() async {
      invitation = await _service.invite(
        token: token,
        email: email,
        permissions: FamilyPermissions(
          glucose: true,
          history: _shareHistory,
          emergency: _shareEmergency,
        ),
      );
      _emailController.clear();
      _dashboard = await _service.load(token);
    }, successMessage: l10n.t('settingsSaved'));
    final code = invitation?.inviteCode;
    if (code != null && mounted) {
      await Clipboard.setData(ClipboardData(text: code));
    }
  }

  Future<void> _accept() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) return;
    final token = context.read<AppState>().accountToken;
    final l10n = _l10n();
    await _run(() async {
      await _service.accept(
        token: token,
        code: code,
      );
      _codeController.clear();
      _dashboard = await _service.load(token);
    }, successMessage: l10n.t('settingsSaved'));
  }

  Future<void> _revoke(FamilyMember member) async {
    final token = context.read<AppState>().accountToken;
    final l10n = _l10n();
    await _run(() async {
      await _service.revoke(
        token: token,
        id: member.id,
      );
      _dashboard = await _service.load(token);
    }, successMessage: l10n.t('settingsSaved'));
  }

  Future<void> _run(
    Future<void> Function() action, {
    required String? successMessage,
  }) async {
    if (_busy) return;
    final l10n = _l10n();
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await action();
      if (mounted) setState(() => _message = successMessage);
    } catch (error) {
      if (mounted) {
        setState(() => _message = l10n.t('networkUnavailable'));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = _dashboard;
    return Scaffold(
      appBar: AppBar(
        title: const LocalizedText('family.title'),
        actions: [
          IconButton(
              onPressed: _busy ? null : _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          const Card(
            color: Color(0xFFEAF3FF),
            child: Padding(
              padding: EdgeInsets.all(14),
              child: LocalizedText(
                'family.description',
              ),
            ),
          ),
          const SizedBox(height: 8),
          _ResponsivePanels(
            children: [
              _Section(
                title: context.l10n.t('family.invite'),
                children: [
                  TextField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: context.l10n.t('family.emailLabel'),
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    value: true,
                    onChanged: null,
                    title: LocalizedText('family.currentGlucose'),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _shareHistory,
                    onChanged: (value) => setState(() => _shareHistory = value),
                    title: const LocalizedText('family.historyDiary'),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _shareEmergency,
                    onChanged: (value) =>
                        setState(() => _shareEmergency = value),
                    title: const LocalizedText('family.emergencySos'),
                  ),
                  FilledButton.icon(
                    onPressed: _busy ? null : _invite,
                    icon: const Icon(Icons.person_add),
                    label: const LocalizedText('family.createInvitation'),
                  ),
                ],
              ),
              _Section(
                title: context.l10n.t('family.accept'),
                children: [
                  TextField(
                    controller: _codeController,
                    decoration: InputDecoration(
                      labelText: context.l10n.t('family.inviteCodeLabel'),
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: _busy ? null : _accept,
                    icon: const Icon(Icons.check_circle_outline),
                    label: const LocalizedText('family.acceptAccess'),
                  ),
                ],
              ),
            ],
          ),
          if (_busy) ...[
            const SizedBox(height: 8),
            const LinearProgressIndicator(),
          ],
          if (_message != null) ...[
            const SizedBox(height: 12),
            Text(_message!, style: const TextStyle(color: Color(0xFF344054))),
          ],
          const SizedBox(height: 16),
          LocalizedText('family.visibleTo',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          if (dashboard == null || dashboard.members.isEmpty)
            _EmptyCard(context.l10n.t('family.invite')),
          for (final member in dashboard?.members ?? <FamilyMember>[])
            Card(
              child: ListTile(
                leading: Icon(
                  member.status == 'accepted'
                      ? Icons.verified_user
                      : Icons.schedule,
                  color: member.status == 'accepted'
                      ? const Color(0xFF039855)
                      : const Color(0xFFF79009),
                ),
                title: Text(member.fullName ?? member.email),
                subtitle: Text(member.status == 'accepted'
                    ? context.l10n.t('family.acceptAccess')
                    : context.l10n.t('family.accept')),
                trailing: PopupMenuButton<String>(
                  onSelected: (value) async {
                    final l10n = _l10n();
                    if (value == 'copy' && member.inviteCode != null) {
                      await Clipboard.setData(
                          ClipboardData(text: member.inviteCode!));
                      if (mounted) {
                        setState(() => _message = l10n.t('settingsSaved'));
                      }
                    }
                    if (value == 'revoke') await _revoke(member);
                  },
                  itemBuilder: (_) => [
                    if (member.status == 'pending' && member.inviteCode != null)
                      const PopupMenuItem(
                          value: 'copy',
                          child: LocalizedText('family.copyCode')),
                    const PopupMenuItem(
                        value: 'revoke',
                        child: LocalizedText('family.revokeAccess')),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 16),
          LocalizedText('family.monitoredPeople',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          if (dashboard == null || dashboard.patients.isEmpty)
            _EmptyCard(context.l10n.t('family.accept')),
          for (final patient in dashboard?.patients ?? <MonitoredPatient>[])
            Card(
              child: ListTile(
                leading: const CircleAvatar(child: Icon(Icons.favorite)),
                title: Text(patient.fullName.isEmpty
                    ? patient.email
                    : patient.fullName),
                subtitle: Text(patient.updatedAt == null
                    ? context.l10n.t('cloudSync')
                    : '${context.l10n.t('cloudSync')}: ${context.l10n.formatDateTime(patient.updatedAt!)}'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      patient.glucoseMmol == null
                          ? '-'
                          : '${patient.glucoseMmol!.toStringAsFixed(1)}\nmmol/L',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontSize: 17, fontWeight: FontWeight.w700),
                    ),
                    IconButton(
                      tooltip: context.l10n.t('ui.text.familyWatchMap'),
                      icon: const Icon(Icons.location_on_outlined),
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => FamilyWatchLiveMapScreen(
                            patientId: patient.id,
                            patientName: patient.fullName.isEmpty
                                ? patient.email
                                : patient.fullName,
                            token: context.read<AppState>().accountToken,
                            onSos: () =>
                                Navigator.of(context).pushNamed('/emergency'),
                          ),
                        ),
                      ),
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

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _Section({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _ResponsivePanels extends StatelessWidget {
  final List<Widget> children;

  const _ResponsivePanels({required this.children});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 760) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var index = 0; index < children.length; index++) ...[
                children[index],
                if (index < children.length - 1) const SizedBox(height: 8),
              ],
            ],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var index = 0; index < children.length; index++) ...[
              Expanded(child: children[index]),
              if (index < children.length - 1) const SizedBox(width: 10),
            ],
          ],
        );
      },
    );
  }
}

class _EmptyCard extends StatelessWidget {
  final String text;

  const _EmptyCard(this.text);

  @override
  Widget build(BuildContext context) {
    return Card(
        child: Padding(padding: const EdgeInsets.all(16), child: Text(text)));
  }
}
