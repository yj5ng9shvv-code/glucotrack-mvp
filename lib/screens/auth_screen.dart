import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../services/auth_service.dart';
import '../services/google_auth_service.dart';
import '../widgets/google_web_button.dart';
import '../widgets/localized_text.dart';

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
          if (mounted) setState(() => _error = _localizedError(error));
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

  String _localizedError(Object error) => error is AuthException
      ? context.l10n.t(error.message)
      : context.l10n.t('networkUnavailable');

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_registerMode && !_accepted) {
      setState(() => _error = context.l10n.t('auth.consent_required'));
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
      _deviceLimitReached = false;
      _deviceManagementToken = null;
    });
    final state = context.read<AppState>();
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
          final deviceLimit = error.code == 'device limit reached' ||
              error.code == 'DEVICE_LIMIT_REACHED';
          _error = deviceLimit
              ? context.l10n.t('deviceLimitReached')
              : context.l10n.t(error.message);
          _deviceLimitReached = deviceLimit;
          _deviceManagementToken = error.managementToken;
        });
      }
      return;
    }
    if (!mounted) return;
    Navigator.pushNamedAndRemoveUntil(context, '/', (_) => false);
  }

  void _switchMode(bool registerMode) {
    setState(() {
      _registerMode = registerMode;
      _error = null;
      _passwordController.clear();
      _confirmController.clear();
    });
  }

  void _showSocialLoginNotice(String provider) {
    final message = context.l10n.t('socialLoginNotConfigured');
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$provider: $message')),
    );
  }

  Future<void> _startGoogleLogin() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final token = await GoogleAuthService.instance.authenticate();
      await _completeGoogleLogin(token);
    } catch (error) {
      if (mounted) setState(() => _error = _localizedError(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _completeGoogleLogin(String idToken) async {
    if (!mounted) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await context.read<AppState>().loginWithGoogle(idToken);
      if (mounted) {
        Navigator.pushNamedAndRemoveUntil(context, '/', (_) => false);
      }
    } catch (error) {
      if (mounted) setState(() => _error = _localizedError(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _showPasswordRecovery() async {
    final controller = TextEditingController(text: _emailController.text);
    final email = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(context.l10n.t('resetPasswordTitle')),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.emailAddress,
          autofocus: true,
          decoration: InputDecoration(
            labelText: context.l10n.t('email'),
            helperText: context.l10n.t('resetPasswordHint'),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(MaterialLocalizations.of(context).cancelButtonLabel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, controller.text),
            child: Text(context.l10n.t('send')),
          ),
        ],
      ),
    );
    controller.dispose();
    if (email == null || email.trim().isEmpty || !mounted) return;
    setState(() => _submitting = true);
    try {
      await AuthService().requestPasswordReset(
        email,
        locale: context.read<AppState>().languageCode,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.t('resetEmailSent'))),
        );
      }
    } catch (error) {
      if (mounted) setState(() => _error = _localizedError(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasAccount = context.watch<AppState>().hasAccount;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Icon(Icons.monitor_heart,
                            size: 54, color: Color(0xFF075BBB)),
                        const SizedBox(height: 8),
                        Text(
                          context.l10n.t(
                            _registerMode
                                ? 'auth.action.signUp'
                                : 'auth.action.login',
                          ),
                          textAlign: TextAlign.center,
                          style: Theme.of(context)
                              .textTheme
                              .headlineSmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _registerMode
                              ? context.l10n.t('auth.registration_hint')
                              : context.l10n.t('auth.login_hint'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Color(0xFF667085)),
                        ),
                        const SizedBox(height: 20),
                        if (!hasAccount)
                          SegmentedButton<bool>(
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
                        if (!hasAccount) const SizedBox(height: 16),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (kIsWeb && _googleWebReady)
                              Center(child: buildGoogleWebButton())
                            else if (!kIsWeb)
                              FilledButton.icon(
                                onPressed:
                                    _submitting ? null : _startGoogleLogin,
                                icon: const Icon(Icons.g_mobiledata, size: 28),
                                label:
                                    Text(context.l10n.t('continueWithGoogle')),
                              ),
                            const SizedBox(height: 10),
                            FilledButton.icon(
                              onPressed: _submitting
                                  ? null
                                  : () => _showSocialLoginNotice('Apple'),
                              icon: const Icon(Icons.apple),
                              label: Text(context.l10n.t('continueWithApple')),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            const Expanded(child: Divider()),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 10),
                              child: Text(context.l10n.t('email')),
                            ),
                            const Expanded(child: Divider()),
                          ],
                        ),
                        const SizedBox(height: 12),
                        if (_registerMode)
                          TextFormField(
                            controller: _nameController,
                            textInputAction: TextInputAction.next,
                            decoration: const InputDecoration(
                              label: LocalizedText('ui.text.ae7cb234d36c'),
                              prefixIcon: Icon(Icons.person_outline),
                              border: OutlineInputBorder(),
                            ),
                            validator: (value) =>
                                value == null || value.trim().length < 2
                                    ? context.l10n.t('ui.text.694c2919b4fa')
                                    : null,
                          ),
                        if (_registerMode) const SizedBox(height: 12),
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                            label: LocalizedText('ui.text.f1849e7f8d82'),
                            prefixIcon: Icon(Icons.email_outlined),
                            border: OutlineInputBorder(),
                          ),
                          validator: (value) {
                            final email = value?.trim() ?? '';
                            return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
                                    .hasMatch(email)
                                ? null
                                : context.l10n.t('ui.text.b30e7468eca0');
                          },
                        ),
                        if (!_registerMode)
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed:
                                  _submitting ? null : _showPasswordRecovery,
                              child: Text(context.l10n.t('forgotPassword')),
                            ),
                          ),
                        const SizedBox(height: 12),
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
                            label: const LocalizedText('ui.text.c619f2912636'),
                            helper: const LocalizedText('ui.text.17ba2567d612'),
                            prefixIcon: const Icon(Icons.lock_outline),
                            border: const OutlineInputBorder(),
                            suffixIcon: IconButton(
                              onPressed: () => setState(
                                () => _obscurePassword = !_obscurePassword,
                              ),
                              icon: Icon(_obscurePassword
                                  ? Icons.visibility
                                  : Icons.visibility_off),
                            ),
                          ),
                          validator: (value) => (value?.length ?? 0) < 8
                              ? context.l10n.t('ui.text.2b80bffa2578')
                              : null,
                        ),
                        if (_registerMode) const SizedBox(height: 12),
                        if (_registerMode)
                          TextFormField(
                            controller: _confirmController,
                            obscureText: _obscurePassword,
                            textInputAction: TextInputAction.done,
                            decoration: const InputDecoration(
                              label: LocalizedText('ui.text.94f30d6ae6a8'),
                              prefixIcon: Icon(Icons.lock_outline),
                              border: OutlineInputBorder(),
                            ),
                            validator: (value) =>
                                value != _passwordController.text
                                    ? context.l10n.t('ui.text.96765c2bf438')
                                    : null,
                          ),
                        if (_registerMode)
                          CheckboxListTile(
                            contentPadding: EdgeInsets.zero,
                            value: _accepted,
                            onChanged: (value) =>
                                setState(() => _accepted = value ?? false),
                            title: const LocalizedText(
                              'ui.text.257e97b169ee',
                              style: TextStyle(fontSize: 14),
                            ),
                          ),
                        if (_error != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Text(
                              _error!,
                              style: const TextStyle(color: Color(0xFFB42318)),
                            ),
                          ),
                        if (_deviceLimitReached)
                          TextButton.icon(
                            onPressed: _deviceManagementToken == null
                                ? null
                                : () async {
                                    await context
                                        .read<AppState>()
                                        .useDeviceManagementToken(
                                            _deviceManagementToken!);
                                    if (context.mounted) {
                                      Navigator.pushNamed(
                                          context, '/subscription');
                                    }
                                  },
                            icon: const Icon(Icons.devices),
                            label: Text(context.l10n.t('manageDevices')),
                          ),
                        FilledButton.icon(
                          onPressed: _submitting ? null : _submit,
                          icon: _submitting
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : Icon(_registerMode
                                  ? Icons.person_add_alt_1
                                  : Icons.login),
                          label: Text(
                            _registerMode
                                ? context.l10n.t('auth.action.signUp')
                                : context.l10n.t('auth.action.login'),
                          ),
                        ),
                        if (hasAccount) ...[
                          const SizedBox(height: 10),
                          const LocalizedText(
                            'ui.text.0eb4d523000e',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                color: Color(0xFF667085), fontSize: 12),
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
  }
}
