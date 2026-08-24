const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const entries = {
  'auth.action.login': 'Login',
  'auth.action.signUp': 'Sign up',
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
  'auth.invalid_email': 'Enter a valid email.',
  'auth.error.invalidCredentials': 'Incorrect email or password.',
  'auth.error.invalidRequest': 'Check the entered information and try again.',
  'auth.error.forbidden': 'Access is denied for this account.',
  'auth.error.googleConfig': 'Google sign-in is not configured.',
  'auth.error.googleToken': 'Google sign-in could not be completed.',
  'auth.error.notFound': 'The requested account service was not found.',
  'auth.error.tooManyRequests': 'Too many attempts. Try again later.',
  'auth.error.serverUnavailable': 'The account service is unavailable. Try again later.',
  'about.support.title': 'Contact support',
  'about.support.email': 'Email',
  'about.support.subject': 'Subject',
  'about.support.message': 'Message',
  'about.support.send': 'Send',
  'about.support.sent': 'Message sent',
  'about.support.error': 'Could not send. Try again.',
  'about.support.close': 'Close',
  'about.offline': 'About GlukoTrack is not available offline yet.',
  'about.retry': 'Retry',
};

const languages = ['en', 'de', 'fr', 'es', 'it', 'pl', 'uk', 'ru', 'pt', 'nl', 'ro', 'cs', 'sk', 'hu', 'sv', 'da', 'fi', 'no', 'el', 'tr', 'bg', 'hr', 'sl', 'lt', 'lv', 'et', 'sr', 'sq', 'mk', 'is'];
const marker = ' ZZZXQZ ';

function request(language, text) {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'en');
  url.searchParams.set('tl', language);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => body += chunk);
      response.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data[0].map((part) => part[0]).join(''));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function translate(language, source) {
  if (language === 'en') return source;
  const batch = (await request(language, source.join(marker))).split('ZZZXQZ').map((value) => value.trim());
  if (batch.length === source.length) return batch;
  return Promise.all(source.map((value) => request(language, value)));
}

async function main() {
  const keys = Object.keys(entries);
  const source = Object.values(entries);
  const output = ['const Map<String, Map<String, String>> authAboutTranslations = {'];
  for (const language of languages) {
    const values = await translate(language, source);
    if (values.length !== keys.length) throw new Error(`${language}: incomplete translation`);
    output.push(`  '${language}': {`);
    for (let index = 0; index < keys.length; index += 1) {
      output.push(`    '${keys[index]}': ${JSON.stringify(values[index])},`);
    }
    output.push('  },');
  }
  output.push('};', '');
  const target = path.join(process.cwd(), 'lib', 'l10n', 'auth_about_translations.dart');
  fs.writeFileSync(target, output.join('\n'), 'utf8');
  console.log(`written ${target}: ${fs.statSync(target).size} bytes`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
