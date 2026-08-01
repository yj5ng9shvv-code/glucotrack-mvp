/// Authentication labels must not use legacy ui.text keys because those old
/// generated values can contain mojibake on Android.
final authActionTranslations = <String, Map<String, String>>{
  'en': {
    'auth.action.login': 'Login',
    'auth.action.signUp': 'Sign up',
    'continueWithGoogle': 'Continue with Google',
    'continueWithApple': 'Continue with Apple',
    'auth.name': 'Name',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.passwordHelp': 'At least 8 characters',
    'auth.confirmPassword': 'Confirm password',
    'auth.nameInvalid': 'Enter your name',
    'auth.emailInvalid': 'Enter a valid email',
    'auth.passwordInvalid': 'Password must be at least 8 characters',
    'auth.passwordMismatch': 'Passwords do not match',
    'auth.acceptTerms': 'I accept the terms and privacy policy',
    'auth.accountStoredNotice': 'Account saved on this device.',
    'auth.registration_hint': 'Create an account to access app features.',
    'auth.login_hint': 'Enter your account details.',
    'auth.consent_required': 'Confirm consent to data processing.',
    'socialLoginNotConfigured': 'Social login is not configured.',
  },
  'ru': {
    'auth.action.login': '\u0412\u0445\u043E\u0434',
    'auth.action.signUp':
        '\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F',
    'continueWithGoogle':
        '\u0412\u043E\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Google',
    'continueWithApple':
        '\u0412\u043E\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Apple',
    'auth.name': '\u0418\u043C\u044F',
    'auth.email': 'Email',
    'auth.password': '\u041F\u0430\u0440\u043E\u043B\u044C',
    'auth.passwordHelp':
        '\u041C\u0438\u043D\u0438\u043C\u0443\u043C 8 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432',
    'auth.confirmPassword':
        '\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u0430\u0440\u043E\u043B\u044C',
    'auth.nameInvalid':
        '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043C\u044F',
    'auth.emailInvalid':
        '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 email',
    'auth.passwordInvalid':
        '\u041F\u0430\u0440\u043E\u043B\u044C \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043D\u0435 \u043A\u043E\u0440\u043E\u0447\u0435 8 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432',
    'auth.passwordMismatch':
        '\u041F\u0430\u0440\u043E\u043B\u0438 \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0442',
    'auth.acceptTerms':
        '\u042F \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u044E \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0438 \u043F\u043E\u043B\u0438\u0442\u0438\u043A\u0443 \u043A\u043E\u043D\u0444\u0438\u0434\u0435\u043D\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u0438',
    'auth.accountStoredNotice':
        '\u0410\u043A\u043A\u0430\u0443\u043D\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D \u043D\u0430 \u044D\u0442\u043E\u043C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435.',
    'auth.registration_hint':
        '\u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0430\u043A\u043A\u0430\u0443\u043D\u0442, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u0444\u0443\u043D\u043A\u0446\u0438\u044F\u043C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F.',
    'auth.login_hint':
        '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430.',
    'auth.consent_required':
        '\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0441\u043E\u0433\u043B\u0430\u0441\u0438\u0435 \u043D\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0443 \u0434\u0430\u043D\u043D\u044B\u0445.',
    'socialLoginNotConfigured':
        '\u0421\u043E\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0439 \u0432\u0445\u043E\u0434 \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D.',
  },
};
