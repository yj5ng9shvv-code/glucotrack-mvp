/// Authentication mode labels intentionally remain English in every locale.
/// Keeping them behind localization keys avoids hardcoded UI strings while
/// preserving the original Login / Sign up wording requested for this screen.
final authActionTranslations = <String, Map<String, String>>{
  'en': {
    'auth.action.login': 'Login',
    'auth.action.signUp': 'Sign up',
    'continueWithGoogle': 'Continue with Google',
    'continueWithApple': 'Continue with Apple',
  },
};
