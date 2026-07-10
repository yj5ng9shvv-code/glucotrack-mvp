import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'models/app_state.dart';
import 'l10n/app_localizations.dart';
import 'l10n/translation_loader.dart';
import 'screens/home_screen.dart';
import 'screens/auth_screen.dart';
import 'screens/family_access_screen.dart';
import 'screens/ai_assistant_screen.dart';
import 'screens/ai_doctor_screen.dart';
import 'screens/calculator_screen.dart';
import 'screens/cloud_sync_screen.dart';
import 'screens/diary_screen.dart';
import 'screens/food_catalog_screen.dart';
import 'screens/food_scanner_screen.dart';
import 'screens/diary_analysis_screen.dart';
import 'screens/doctor_report_screen.dart';
import 'screens/emergency_card_screen.dart';
import 'screens/emergency_profile_screen.dart';
import 'screens/export_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/sensors_screen.dart';
import 'screens/subscription_screen.dart';
import 'screens/sos_screen.dart';
import 'screens/trends_screen.dart';
import 'screens/emergency_screen.dart';
import 'screens/voice_assistant_screen.dart';
import 'widgets/pulsing_voice_button.dart';
import 'widgets/localized_text.dart';
import 'services/subscription_service.dart';
import 'services/emergency_service.dart';
import 'services/cloud_sync_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await loadCoreTranslations();
  runApp(const GlukoTrackApp());
}

class GlukoTrackApp extends StatelessWidget {
  final AppState? initialState;

  const GlukoTrackApp({super.key, this.initialState});

  @override
  Widget build(BuildContext context) {
    final emergencyService = AndroidEmergencyService();
    return ChangeNotifierProvider(
      create: (_) =>
          initialState ??
          AppState(emergencyCardUpdater: emergencyService.updateLockScreenCard),
      child: AppStateLoader(
        child: Consumer<AppState>(
          builder: (context, state, _) {
            return MaterialApp(
              debugShowCheckedModeBanner: false,
              title: 'GlukoTrack',
              locale: state.locale,
              supportedLocales: AppState.supportedLanguages
                  .map((language) => language.locale),
              localizationsDelegates: const [
                GlobalMaterialLocalizations.delegate,
                GlobalWidgetsLocalizations.delegate,
                GlobalCupertinoLocalizations.delegate,
              ],
              theme: ThemeData(
                colorScheme:
                    ColorScheme.fromSeed(seedColor: const Color(0xFF075BBB)),
                scaffoldBackgroundColor: const Color(0xFFF4F8FC),
                useMaterial3: true,
                appBarTheme: const AppBarTheme(centerTitle: true),
                inputDecorationTheme: const InputDecorationTheme(
                  isDense: true,
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  helperStyle: TextStyle(fontSize: 11, height: 1.1),
                ),
                cardTheme: const CardThemeData(
                  margin: EdgeInsets.symmetric(vertical: 4),
                ),
                visualDensity:
                    const VisualDensity(horizontal: -2, vertical: -3),
                listTileTheme: const ListTileThemeData(
                  dense: true,
                  minVerticalPadding: 6,
                  contentPadding: EdgeInsets.symmetric(horizontal: 12),
                ),
                filledButtonTheme: FilledButtonThemeData(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 40),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
                outlinedButtonTheme: OutlinedButtonThemeData(
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 40),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
                textButtonTheme: TextButtonThemeData(
                  style: TextButton.styleFrom(
                    minimumSize: const Size(0, 36),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ),
              routes: {
                '/': (_) => const StartupGate(),
                '/auth': (_) => const AuthScreen(),
                '/home': (_) => const HomeScreen(),
                '/family-access': (_) => const AppPageWithFooter(
                      child: PremiumGate2(child: FamilyAccessScreen()),
                    ),
                '/onboarding': (_) => const OnboardingScreen(),
                '/diary': (_) => const AppPageWithFooter(child: DiaryScreen()),
                '/trends': (_) =>
                    const AppPageWithFooter(child: TrendsScreen()),
                '/export': (_) => const AppPageWithFooter(
                      child: PremiumGate2(child: ExportScreen()),
                    ),
                '/cloud-sync': (_) => const AppPageWithFooter(
                      child: PremiumGate2(child: CloudSyncScreen()),
                    ),
                '/calculator': (_) =>
                    const AppPageWithFooter(child: CalculatorScreen()),
                '/catalog': (_) =>
                    const AppPageWithFooter(child: FoodCatalogScreen()),
                '/scanner': (_) => const AppPageWithFooter(
                      child: PremiumGate2(child: FoodScannerScreen()),
                    ),
                '/diary-analysis': (_) => const AppPageWithFooter(
                      child: PremiumGate2(child: DiaryAnalysisScreen()),
                    ),
                '/doctor-report': (_) => const AppPageWithFooter(
                      child: PremiumGate2(child: DoctorReportScreen()),
                    ),
                '/emergency-profile': (_) => const AppPageWithFooter(
                      child: EmergencyProfileScreen(),
                    ),
                '/emergency-card': (_) => const AppPageWithFooter(
                      child: EmergencyCardScreen(),
                    ),
                '/sos': (_) => const AppPageWithFooter(child: SosScreen()),
                '/ai-assistant': (_) => const AppPageWithFooter(
                      selectedIndex: 1,
                      child: PremiumGate2(child: AiAssistantScreen()),
                    ),
                '/ai-doctor': (_) => const AppPageWithFooter(
                      selectedIndex: 1,
                      child: PremiumGate2(child: AiDoctorScreen()),
                    ),
                '/chat': (_) => const AppPageWithFooter(
                      selectedIndex: 1,
                      child: PremiumGate2(child: AiAssistantScreen()),
                    ),
                '/profile': (_) => const AppPageWithFooter(
                      selectedIndex: 2,
                      child: ProfileScreen(),
                    ),
                '/sensors': (_) => const AppPageWithFooter(
                      child: PremiumGate2(child: SensorsScreen()),
                    ),
                '/subscription': (_) => const AppPageWithFooter(
                      child: SubscriptionScreen(),
                    ),
                '/emergency': (_) =>
                    const AppPageWithFooter(child: EmergencyScreen()),
                '/voice-assistant': (_) =>
                    const PremiumGate2(child: VoiceAssistantScreen()),
              },
            );
          },
        ),
      ),
    );
  }
}

class AppPageWithFooter extends StatelessWidget {
  final Widget child;
  final int selectedIndex;

  const AppPageWithFooter({
    super.key,
    required this.child,
    this.selectedIndex = 0,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      children: [
        Expanded(child: child),
        NavigationBar(
          height: 64,
          selectedIndex: selectedIndex,
          destinations: [
            NavigationDestination(
              icon: const Icon(Icons.home),
              label: l10n.t('navigation.home'),
            ),
            NavigationDestination(
              icon: const PulsingVoiceButton(
                size: 44,
                iconSize: 23,
              ),
              label: l10n.t('navigation.askAi'),
            ),
            NavigationDestination(
              icon: const Icon(Icons.person),
              label: l10n.t('navigation.profile'),
            ),
          ],
          onDestinationSelected: (index) {
            if (index == 0) {
              Navigator.of(context).pushNamedAndRemoveUntil(
                '/home',
                (route) => false,
              );
            } else if (index == 1) {
              Navigator.of(context).pushNamed('/voice-assistant');
            } else if (index == 2 && selectedIndex != 2) {
              Navigator.of(context).pushReplacementNamed('/profile');
            }
          },
        ),
      ],
    );
  }
}

class AppStateLoader extends StatefulWidget {
  final Widget child;

  const AppStateLoader({super.key, required this.child});

  @override
  State<AppStateLoader> createState() => _AppStateLoaderState();
}

class PremiumGate extends StatelessWidget {
  final Widget child;

  const PremiumGate({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final premium = context.watch<AppState>().premium;
    if (premium) return child;
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.t('premium'))),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.workspace_premium,
                        size: 64, color: Color(0xFFF79009)),
                    const SizedBox(height: 12),
                    const LocalizedText(
                      'ui.text.b460edcb71ae',
                      textAlign: TextAlign.center,
                      style:
                          TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    const LocalizedText(
                      'ui.text.56d5c793ff9d',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 18),
                    FilledButton.icon(
                      onPressed: () =>
                          Navigator.pushNamed(context, '/subscription'),
                      icon: const Icon(Icons.lock_open),
                      label: const LocalizedText('ui.text.af2a3e117208'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class PremiumGate2 extends StatefulWidget {
  final Widget child;

  const PremiumGate2({super.key, required this.child});

  @override
  State<PremiumGate2> createState() => _PremiumGate2State();
}

class _PremiumGate2State extends State<PremiumGate2> {
  Future<ServerSubscription?>? _serverAccess;
  Timer? _verificationTimer;
  bool _actionBusy = false;
  bool _verificationSent = false;
  String? _actionError;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _serverAccess ??= _checkServerAccess();
  }

  Future<ServerSubscription?> _checkServerAccess() async {
    final state = context.read<AppState>();
    if (!state.isAuthenticated || state.accountToken.isEmpty) return null;
    try {
      var subscription = await SubscriptionService().status(state.accountToken);
      if (subscription.emailVerified &&
          !subscription.trialUsed &&
          !subscription.active) {
        subscription =
            await SubscriptionService().startTrial(state.accountToken);
      }
      state.updateServerSubscription(
        active: subscription.active,
        status: subscription.status,
        plan: subscription.plan,
        until: subscription.until,
      );
      if (!subscription.emailVerified) _startVerificationPolling();
      return subscription;
    } catch (_) {
      state.updateServerSubscription(active: false, status: 'inactive');
      return null;
    }
  }

  void _startVerificationPolling() {
    _verificationTimer ??= Timer.periodic(
      const Duration(seconds: 5),
      (_) => _refreshAfterEmailVerification(),
    );
  }

  Future<void> _refreshAfterEmailVerification() async {
    if (!mounted || _actionBusy) return;
    final state = context.read<AppState>();
    try {
      var subscription = await SubscriptionService().status(state.accountToken);
      if (!subscription.emailVerified) return;
      _verificationTimer?.cancel();
      _verificationTimer = null;
      if (!subscription.trialUsed && !subscription.active) {
        subscription =
            await SubscriptionService().startTrial(state.accountToken);
      }
      state.updateServerSubscription(
        active: subscription.active,
        status: subscription.status,
        plan: subscription.plan,
        until: subscription.until,
      );
      if (mounted) {
        setState(() => _serverAccess = Future.value(subscription));
      }
    } catch (_) {
      // Temporary network failures are retried by the next interval.
    }
  }

  @override
  void dispose() {
    _verificationTimer?.cancel();
    super.dispose();
  }

  Future<void> _resendVerification() async {
    if (_actionBusy) return;
    setState(() {
      _actionBusy = true;
      _verificationSent = false;
      _actionError = null;
    });
    try {
      final state = context.read<AppState>();
      await SubscriptionService().resendEmailVerification(
        state.accountEmail,
        locale: state.languageCode,
      );
      if (mounted) setState(() => _verificationSent = true);
    } catch (error) {
      if (mounted) {
        setState(() => _actionError = context.l10n.t('networkUnavailable'));
      }
    } finally {
      if (mounted) setState(() => _actionBusy = false);
    }
  }

  Future<void> _startTrial() async {
    if (_actionBusy) return;
    setState(() {
      _actionBusy = true;
      _actionError = null;
    });
    try {
      final state = context.read<AppState>();
      final subscription =
          await SubscriptionService().startTrial(state.accountToken);
      state.updateServerSubscription(
        active: subscription.active,
        status: subscription.status,
        plan: subscription.plan,
        until: subscription.until,
      );
      if (mounted) {
        setState(() => _serverAccess = Future.value(subscription));
      }
    } catch (error) {
      if (mounted) {
        setState(() => _actionError = context.l10n.t('networkUnavailable'));
      }
    } finally {
      if (mounted) setState(() => _actionBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return FutureBuilder<ServerSubscription?>(
      future: _serverAccess,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (snapshot.data?.active == true) return widget.child;
        return _locked(context, l10n, snapshot.data);
      },
    );
  }

  Widget _locked(BuildContext context, AppLocalizations l10n,
      ServerSubscription? subscription) {
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.t('premium'))),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(22),
                    child: Column(
                      children: [
                        const Icon(Icons.workspace_premium,
                            size: 60, color: Color(0xFFF79009)),
                        const SizedBox(height: 12),
                        Text(
                          l10n.t('premiumLockedTitle'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                              fontSize: 23, fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          l10n.t('premiumLockedSubtitle'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Color(0xFF667085)),
                        ),
                        const SizedBox(height: 16),
                        if (subscription != null &&
                            !subscription.emailVerified) ...[
                          Text(
                            l10n.t('confirmEmailForTrial'),
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Color(0xFFB42318)),
                          ),
                          const SizedBox(height: 10),
                          FilledButton.icon(
                            onPressed: _actionBusy ? null : _resendVerification,
                            icon: const Icon(Icons.mark_email_unread),
                            label: Text(l10n.t('resendVerification')),
                          ),
                          if (_verificationSent) ...[
                            const SizedBox(height: 10),
                            Text(
                              l10n.t('verificationEmailSent'),
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Color(0xFF027A48),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ] else if (subscription != null &&
                            !subscription.trialUsed) ...[
                          FilledButton.icon(
                            onPressed: _actionBusy ? null : _startTrial,
                            icon: const Icon(Icons.card_giftcard),
                            label: Text(l10n.t('startFreeTrial')),
                          ),
                        ] else
                          FilledButton.icon(
                            onPressed: () =>
                                Navigator.pushNamed(context, '/subscription'),
                            icon: const Icon(Icons.lock_open),
                            label: Text(l10n.t('subscribeToContinue')),
                          ),
                        if (_actionBusy) ...[
                          const SizedBox(height: 12),
                          const LinearProgressIndicator(),
                        ],
                        if (_actionError != null) ...[
                          const SizedBox(height: 10),
                          Text(
                            _actionError!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Color(0xFFB42318)),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                _PremiumInfoGrid(l10n: l10n),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PremiumInfoGrid extends StatelessWidget {
  final AppLocalizations l10n;

  const _PremiumInfoGrid({required this.l10n});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final cards = [
          _InfoCard(
            title: l10n.t('freeForeverTitle'),
            icon: Icons.favorite,
            color: const Color(0xFF039855),
            items: [
              l10n.t('freeCurrentSugar'),
              l10n.t('freeBasicStats'),
              l10n.t('freeDiary'),
            ],
          ),
          _InfoCard(
            title: l10n.t('premiumIncludesTitle'),
            icon: Icons.workspace_premium,
            color: const Color(0xFFF79009),
            items: [
              l10n.t('premiumAiAssistant'),
              l10n.t('premiumSugarForecast'),
              l10n.t('premiumFoodPhoto'),
              l10n.t('premiumReports'),
              l10n.t('premiumFamily'),
              l10n.t('premiumExport'),
              l10n.t('premiumRecommendations'),
            ],
          ),
        ];
        if (constraints.maxWidth < 520) {
          return Column(
            children: [
              cards[0],
              const SizedBox(height: 10),
              cards[1],
            ],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: cards[0]),
            const SizedBox(width: 10),
            Expanded(child: cards[1]),
          ],
        );
      },
    );
  }
}

class _InfoCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color color;
  final List<String> items;

  const _InfoCard({
    required this.title,
    required this.icon,
    required this.color,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: color),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ...items.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 5),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.check_circle, size: 17, color: color),
                    const SizedBox(width: 7),
                    Expanded(child: Text(item)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class StartupGate extends StatelessWidget {
  const StartupGate({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    if (!state.loaded) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (!state.isAuthenticated) return const AuthScreen();
    return state.onboardingCompleted
        ? const HomeScreen()
        : const OnboardingScreen();
  }
}

class _AppStateLoaderState extends State<AppStateLoader> {
  final _emergencyService = AndroidEmergencyService();
  final _cloudService = CloudSyncService();
  AppState? _state;
  Timer? _syncTimer;
  bool _syncing = false;
  bool _initializing = true;
  bool _lastAuthenticated = false;
  double? _lastGlucoseMmol;
  bool _lowAlertActive = false;

  @override
  void initState() {
    super.initState();
    final state = context.read<AppState>();
    _state = state;
    state.emergencyCardUpdater ??= _emergencyService.updateLockScreenCard;
    state.addListener(_checkEmergencyThreshold);
    Future.microtask(_loadAndSync);
  }

  Future<void> _loadAndSync() async {
    final state = _state;
    if (state == null) return;
    try {
      await state.load();
      if (state.isAuthenticated && _cloudService.isConfigured) {
        _lastAuthenticated = true;
        await _restoreThenSync(state);
      }
      await _emergencyService.updateLockScreenCard(state);
    } finally {
      _initializing = false;
    }
  }

  void _checkEmergencyThreshold() {
    final state = _state;
    if (_initializing) return;
    if (state == null || !state.loaded) return;
    if (!state.isAuthenticated) {
      _lastAuthenticated = false;
      _syncTimer?.cancel();
      return;
    }
    if (!_lastAuthenticated) {
      _lastAuthenticated = true;
      unawaited(_restoreThenSync(state));
      return;
    }
    _scheduleCloudSync(state);
    final previous = _lastGlucoseMmol;
    final current = state.glucoseMmol;
    _lastGlucoseMmol = current;

    if (!state.sosEnabled || !state.showEmergencyOnLockScreen) {
      _lowAlertActive = false;
      return;
    }
    if (current > state.sosThresholdMmol) {
      _lowAlertActive = false;
      return;
    }
    if (previous == null || previous == current || _lowAlertActive) return;

    _lowAlertActive = true;
    _emergencyService.showAlert(state).catchError((_) {});
  }

  Future<void> _restoreThenSync(AppState state) async {
    if (!_cloudService.isConfigured || _syncing) return;
    _syncing = true;
    try {
      await _cloudService.pull(state);
      await _cloudService.push(state);
      await _emergencyService.updateLockScreenCard(state);
    } finally {
      _syncing = false;
    }
  }

  void _scheduleCloudSync(AppState state) {
    if (!state.isAuthenticated || !_cloudService.isConfigured || _syncing) {
      return;
    }
    _syncTimer?.cancel();
    _syncTimer = Timer(const Duration(seconds: 2), () async {
      _syncing = true;
      try {
        await _cloudService.push(state);
      } finally {
        _syncing = false;
      }
    });
  }

  @override
  void dispose() {
    _state?.removeListener(_checkEmergencyThreshold);
    _syncTimer?.cancel();
    _cloudService.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
