import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../navigation/app_navigator.dart';
import '../services/apple_auth_service.dart';
import '../services/auth_service.dart';
import '../services/google_auth_service.dart';
import '../widgets/google_web_button.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  bool _registerMode = true;
  bool _accepted = false;
  bool _obscurePassword = true;
  bool _submitting = false;
  String? _error;
  bool _deviceLimitReached = false;
  bool _googleWebReady = false;
  String? _deviceManagementToken;
  StreamSubscription<String>? _googleWebSubscription;

  @override
  void initState() {
    super.initState();
    if (kIsWeb) {
      GoogleAuthService.instance.initialize().then((_) {
        if (mounted) setState(() => _googleWebReady = true);
      }).catchError((Object _) {});
      _googleWebSubscription = GoogleAuthService.instance.webIdTokens.listen(
        _completeGoogleLogin,
        onError: (Object error) {
          if (mounted) {
            final l10n = _readL10n();
            setState(() => _handleAuthError(error, l10n));
          }
        },
      );
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final state = context.read<AppState>();
    if (state.hasAccount && _emailController.text.isEmpty) {
      _registerMode = false;
      _emailController.text = state.accountEmail;
    }
  }

  @override
  void dispose() {
    _googleWebSubscription?.cancel();
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  AppLocalizations _readL10n() =>
      AppLocalizations(context.read<AppState>().languageCode);

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final l10n = _readL10n();
    final state = context.read<AppState>();
    if (_registerMode && !_accepted) {
      setState(() => _error = l10n.t('auth.consent_required'));
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
      _deviceLimitReached = false;
      _deviceManagementToken = null;
    });
    try {
      if (_registerMode) {
        await state.register(
          name: _nameController.text,
          email: _emailController.text,
          password: _passwordController.text,
        );
      } else {
        await state.login(
          email: _emailController.text,
          password: _passwordController.text,
        );
      }
    } on AuthException catch (error) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _handleAuthError(error, l10n);
        });
      }
      return;
    }
    if (!mounted) return;
    setState(() => _submitting = false);
  }

  void _switchMode(bool registerMode) {
    setState(() {
      _registerMode = registerMode;
      _error = null;
      _passwordController.clear();
      _confirmController.clear();
    });
  }

  bool get _supportsNativeAppleSignIn =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.iOS ||
          defaultTargetPlatform == TargetPlatform.macOS);

  void _showSocialLoginNotice(String provider) {
    final message = _readL10n().t('socialLoginNotConfigured');
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text('$provider: $message')));
  }

  bool _isDeviceLimitError(AuthException error) =>
      error.code == 'DEVICE_LIMIT_REACHED' ||
      error.code == 'device limit reached' ||
      error.message == 'deviceLimitReached';

  void _handleAuthError(Object error, AppLocalizations l10n) {
    if (error is! AuthException) {
      _error = l10n.t('networkUnavailable');
      _deviceLimitReached = false;
      _deviceManagementToken = null;
      return;
    }
    final deviceLimit = _isDeviceLimitError(error);
    _error = deviceLimit ? l10n.t('deviceLimitReached') : l10n.t(error.message);
    _deviceLimitReached = deviceLimit;
    _deviceManagementToken = error.managementToken;
  }

  Future<void> _startGoogleLogin() async {
    final l10n = _readL10n();
    setState(() {
      _submitting = true;
      _error = null;
      _deviceLimitReached = false;
      _deviceManagementToken = null;
    });
    try {
      final token = await GoogleAuthService.instance.authenticate();
      await _completeGoogleLogin(token);
    } catch (error) {
      if (mounted) {
        setState(() {
          _handleAuthError(error, l10n);
        });
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _completeGoogleLogin(String idToken) async {
    if (!mounted) return;
    final l10n = _readL10n();
    final state = context.read<AppState>();
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await state.loginWithGoogle(idToken);
      if (mounted) setState(() => _submitting = false);
    } catch (error) {
      if (mounted) {
        setState(() {
          _handleAuthError(error, l10n);
        });
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _startAppleLogin() async {
    final l10n = _readL10n();
    final state = context.read<AppState>();
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final token = await AppleAuthService.instance.authenticate();
      await state.loginWithApple(
        token.identityToken,
        email: token.email,
        fullName: token.fullName,
      );
      if (mounted) setState(() => _submitting = false);
    } catch (error) {
      if (mounted) {
        setState(() {
          _handleAuthError(error, l10n);
        });
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _showPasswordRecovery() async {
    final controller = TextEditingController(text: _emailController.text);
    final l10n = _readL10n();
    final languageCode = context.read<AppState>().languageCode;
    final cancelLabel = MaterialLocalizations.of(context).cancelButtonLabel;
    final email = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.t('resetPasswordTitle')),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.emailAddress,
          autofocus: true,
          decoration: InputDecoration(
            labelText: l10n.t('email'),
            helperText: l10n.t('resetPasswordHint'),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(cancelLabel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, controller.text),
            child: Text(l10n.t('send')),
          ),
        ],
      ),
    );
    controller.dispose();
    if (email == null || email.trim().isEmpty || !mounted) return;
    setState(() => _submitting = true);
    try {
      await AuthService().requestPasswordReset(email, locale: languageCode);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.t('resetEmailSent'))));
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _handleAuthError(error, l10n);
        });
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasAccount = context.watch<AppState>().hasAccount;
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final compact = constraints.maxHeight < 760;
            final dense = constraints.maxHeight < 680;
            final pagePadding = dense ? 8.0 : (compact ? 12.0 : 20.0);
            final cardPadding = dense ? 14.0 : (compact ? 18.0 : 24.0);
            final fieldGap = dense ? 8.0 : 12.0;
            final sectionGap = dense ? 8.0 : (compact ? 12.0 : 20.0);
            final iconSize = dense ? 34.0 : (compact ? 42.0 : 54.0);
            final buttonStyle = FilledButton.styleFrom(
              minimumSize: Size.fromHeight(dense ? 34 : 38),
              padding: EdgeInsets.symmetric(
                horizontal: dense ? 12 : 16,
                vertical: dense ? 8 : 10,
              ),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            );
            final inputDecorationTheme = InputDecorationTheme(
              isDense: true,
              contentPadding: EdgeInsets.symmetric(
                horizontal: 12,
                vertical: dense ? 9 : 11,
              ),
              prefixIconConstraints: const BoxConstraints(
                minWidth: 42,
                minHeight: 34,
              ),
              suffixIconConstraints: const BoxConstraints(
                minWidth: 42,
                minHeight: 34,
              ),
              border: const OutlineInputBorder(),
            );

            return Center(
              child: SingleChildScrollView(
                padding: EdgeInsets.all(pagePadding),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: 456,
                    minHeight: constraints.maxHeight - pagePadding * 2,
                  ),
                  child: Align(
                    alignment: Alignment.center,
                    child: Card(
                      child: Padding(
                        padding: EdgeInsets.all(cardPadding),
                        child: Theme(
                          data: Theme.of(context).copyWith(
                            inputDecorationTheme: inputDecorationTheme,
                            filledButtonTheme: FilledButtonThemeData(
                              style: buttonStyle,
                            ),
                            visualDensity: dense
                                ? VisualDensity.compact
                                : VisualDensity.standard,
                          ),
                          child: Form(
                            key: _formKey,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Icon(
                                  Icons.monitor_heart,
                                  size: iconSize,
                                  color: const Color(0xFF075BBB),
                                ),
                                SizedBox(height: dense ? 4 : 8),
                                Text(
                                  context.l10n.t(
                                    _registerMode
                                        ? 'auth.action.signUp'
                                        : 'auth.action.login',
                                  ),
                                  textAlign: TextAlign.center,
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleLarge
                                      ?.copyWith(fontWeight: FontWeight.w700),
                                ),
                                if (!dense) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                    _registerMode
                                        ? context.l10n.t(
                                            'auth.registration_hint',
                                          )
                                        : context.l10n.t('auth.login_hint'),
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      color: Color(0xFF667085),
                                    ),
                                  ),
                                ],
                                SizedBox(height: sectionGap),
                                if (!hasAccount)
                                  SegmentedButton<bool>(
                                    style: ButtonStyle(
                                      visualDensity: dense
                                          ? VisualDensity.compact
                                          : VisualDensity.standard,
                                      tapTargetSize:
                                          MaterialTapTargetSize.shrinkWrap,
                                    ),
                                    segments: [
                                      ButtonSegment(
                                        value: true,
                                        label: Text(
                                          context.l10n.t('auth.action.signUp'),
                                        ),
                                      ),
                                      ButtonSegment(
                                        value: false,
                                        label: Text(
                                          context.l10n.t('auth.action.login'),
                                        ),
                                      ),
                                    ],
                                    selected: {_registerMode},
                                    onSelectionChanged: (value) =>
                                        _switchMode(value.first),
                                  ),
                                if (!hasAccount) SizedBox(height: fieldGap),
                                Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    if (kIsWeb && _googleWebReady)
                                      Center(child: buildGoogleWebButton())
                                    else if (!kIsWeb)
                                      FilledButton.icon(
                                        onPressed: _submitting
                                            ? null
                                            : _startGoogleLogin,
                                        icon: const Icon(
                                          Icons.g_mobiledata,
                                          size: 28,
                                        ),
                                        label: Text(
                                          context.l10n.t('continueWithGoogle'),
                                        ),
                                      ),
                                    SizedBox(height: dense ? 6 : 10),
                                    FilledButton.icon(
                                      onPressed: _submitting
                                          ? null
                                          : _supportsNativeAppleSignIn
                                              ? _startAppleLogin
                                              : () => _showSocialLoginNotice(
                                                  'Apple'),
                                      icon: const Icon(Icons.apple),
                                      label: Text(
                                        context.l10n.t('continueWithApple'),
                                      ),
                                    ),
                                  ],
                                ),
                                SizedBox(height: fieldGap),
                                Row(
                                  children: [
                                    const Expanded(child: Divider()),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                      ),
                                      child: Text(context.l10n.t('email')),
                                    ),
                                    const Expanded(child: Divider()),
                                  ],
                                ),
                                SizedBox(height: fieldGap),
                                if (_registerMode)
                                  TextFormField(
                                    controller: _nameController,
                                    textInputAction: TextInputAction.next,
                                    decoration: InputDecoration(
                                      labelText: context.l10n.t('auth.name'),
                                      prefixIcon: const Icon(
                                        Icons.person_outline,
                                      ),
                                    ),
                                    validator: (value) =>
                                        value == null || value.trim().length < 2
                                            ? context.l10n.t('auth.nameInvalid')
                                            : null,
                                  ),
                                if (_registerMode) SizedBox(height: fieldGap),
                                TextFormField(
                                  controller: _emailController,
                                  keyboardType: TextInputType.emailAddress,
                                  textInputAction: TextInputAction.next,
                                  decoration: InputDecoration(
                                    labelText: context.l10n.t('auth.email'),
                                    prefixIcon: const Icon(
                                      Icons.email_outlined,
                                    ),
                                  ),
                                  validator: (value) {
                                    final email = value?.trim() ?? '';
                                    return RegExp(
                                      r'^[^@\s]+@[^@\s]+\.[^@\s]+$',
                                    ).hasMatch(email)
                                        ? null
                                        : context.l10n.t('auth.emailInvalid');
                                  },
                                ),
                                if (!_registerMode)
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: TextButton(
                                      onPressed: _submitting
                                          ? null
                                          : _showPasswordRecovery,
                                      child: Text(
                                        context.l10n.t('forgotPassword'),
                                      ),
                                    ),
                                  ),
                                SizedBox(height: fieldGap),
                                TextFormField(
                                  controller: _passwordController,
                                  obscureText: _obscurePassword,
                                  textInputAction: _registerMode
                                      ? TextInputAction.next
                                      : TextInputAction.done,
                                  onFieldSubmitted: (_) {
                                    if (!_registerMode) _submit();
                                  },
                                  decoration: InputDecoration(
                                    labelText: context.l10n.t('auth.password'),
                                    helperText: dense
                                        ? null
                                        : context.l10n.t('auth.passwordHelp'),
                                    prefixIcon: const Icon(Icons.lock_outline),
                                    suffixIcon: IconButton(
                                      onPressed: () => setState(
                                        () => _obscurePassword =
                                            !_obscurePassword,
                                      ),
                                      icon: Icon(
                                        _obscurePassword
                                            ? Icons.visibility
                                            : Icons.visibility_off,
                                      ),
                                    ),
                                  ),
                                  validator: (value) => (value?.length ?? 0) < 8
                                      ? context.l10n.t('auth.passwordInvalid')
                                      : null,
                                ),
                                if (_registerMode) SizedBox(height: fieldGap),
                                if (_registerMode)
                                  TextFormField(
                                    controller: _confirmController,
                                    obscureText: _obscurePassword,
                                    textInputAction: TextInputAction.done,
                                    decoration: InputDecoration(
                                      labelText: context.l10n.t(
                                        'auth.confirmPassword',
                                      ),
                                      prefixIcon: const Icon(
                                        Icons.lock_outline,
                                      ),
                                    ),
                                    validator: (value) =>
                                        value != _passwordController.text
                                            ? context.l10n.t(
                                                'auth.passwordMismatch',
                                              )
                                            : null,
                                  ),
                                if (_registerMode)
                                  SizedBox(
                                    height: dense ? 36 : 44,
                                    child: CheckboxListTile(
                                      contentPadding: EdgeInsets.zero,
                                      dense: true,
                                      visualDensity: VisualDensity.compact,
                                      value: _accepted,
                                      onChanged: (value) => setState(
                                        () => _accepted = value ?? false,
                                      ),
                                      title: Text(
                                        context.l10n.t('auth.acceptTerms'),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: dense ? 12 : 14,
                                        ),
                                      ),
                                      controlAffinity:
                                          ListTileControlAffinity.trailing,
                                    ),
                                  ),
                                if (_error != null)
                                  Padding(
                                    padding: EdgeInsets.only(bottom: fieldGap),
                                    child: Text(
                                      _error!,
                                      style: const TextStyle(
                                        color: Color(0xFFB42318),
                                      ),
                                    ),
                                  ),
                                if (_deviceLimitReached)
                                  TextButton.icon(
                                    onPressed: _deviceManagementToken == null
                                        ? null
                                        : () async {
                                            final state =
                                                context.read<AppState>();
                                            await state
                                                .useDeviceManagementToken(
                                              _deviceManagementToken!,
                                            );
                                            if (context.mounted) {
                                              AppNavigator.pushNamed(
                                                '/subscription',
                                              );
                                            }
                                          },
                                    icon: const Icon(Icons.devices),
                                    label: Text(
                                      context.l10n.t('manageDevices'),
                                    ),
                                  ),
                                FilledButton.icon(
                                  onPressed: _submitting ? null : _submit,
                                  icon: _submitting
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : Icon(
                                          _registerMode
                                              ? Icons.person_add_alt_1
                                              : Icons.login,
                                        ),
                                  label: Text(
                                    _registerMode
                                        ? context.l10n.t('auth.action.signUp')
                                        : context.l10n.t('auth.action.login'),
                                  ),
                                ),
                                if (hasAccount) ...[
                                  const SizedBox(height: 10),
                                  Text(
                                    context.l10n.t('auth.accountStoredNotice'),
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      color: Color(0xFF667085),
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
