import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = new URL('../', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const locales = [
  'en',
  'de',
  'fr',
  'es',
  'it',
  'pl',
  'uk',
  'ru',
  'pt',
  'nl',
  'ro',
  'cs',
  'sk',
  'hu',
  'sv',
  'da',
  'fi',
  'no',
  'el',
  'tr',
  'bg',
  'hr',
  'sl',
  'lt',
  'lv',
  'et',
  'sr',
  'sq',
  'mk',
  'is',
];
const failures = [];

function files(dir, extensions) {
  const result = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) result.push(...files(path, extensions));
    else if (extensions.has(extname(path))) result.push(path);
  }
  return result;
}

function source(path) {
  return readFileSync(path, 'utf8');
}

function fail(path, reason) {
  failures.push(`${relative(root, path)}: ${reason}`);
}

function failIfMojibake(path, text) {
  if (/(?:вЂ|Рљ|FranГ|EspaГ|PortuguГ|Рџ|рџ)/u.test(text)) {
    fail(path, 'mojibake / broken UTF-8 text');
  }
}

function allowedNonUiTextFile(rel) {
  return (
    rel === 'lib/models/app_state.dart' ||
    rel === 'lib/services/voice_intent_service.dart' ||
    rel === 'lib/services/diary_command_service.dart'
  );
}

function validateCoreTranslations() {
  const corePath = join(root, 'assets/translations/core.json');
  const core = JSON.parse(source(corePath));
  const expectedLocales = [...locales].sort();

  for (const [groupName, group] of Object.entries(core)) {
    if (groupName === 'networkError' || groupName === 'uiKeySources') continue;
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      fail(corePath, `${groupName} is not a locale map`);
      continue;
    }

    const groupLocales = Object.keys(group).sort();
    if (groupLocales.length === 0) {
      continue;
    }
    for (const locale of groupLocales) {
      if (!expectedLocales.includes(locale)) {
        fail(corePath, `${groupName}.${locale} is not a supported locale`);
      }
    }

    const referenceLocale = group.en ? 'en' : groupLocales[0];
    const referenceKeys = Object.keys(group[referenceLocale] ?? {}).sort();
    for (const locale of groupLocales) {
      const translations = group[locale] ?? {};
      const keys = Object.keys(translations).sort();
      if (keys.join(',') !== referenceKeys.join(',')) {
        fail(corePath, `${groupName}.${locale} keys differ from ${referenceLocale}`);
      }
      for (const [key, value] of Object.entries(translations)) {
        if (typeof value !== 'string' || value.trim() === '') {
          fail(corePath, `${groupName}.${locale}.${key} is empty`);
        }
      }
    }
  }
}

function validateDartLocaleMap(path, mapName) {
  const text = source(path);
  const localeBlocks = new Map();
  const localeHeader = /^\s*'([a-z]{2})':\s*\{/gm;
  const matches = [...text.matchAll(localeHeader)];
  for (let index = 0; index < matches.length; index += 1) {
    const locale = matches[index][1];
    const blockStart = matches[index].index + matches[index][0].length;
    const blockEnd =
      index + 1 < matches.length ? matches[index + 1].index : text.lastIndexOf('};');
    const block = text.slice(blockStart, blockEnd);
    const keys = [...block.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]);
    localeBlocks.set(locale, keys.sort());
  }

  for (const locale of locales) {
    if (!localeBlocks.has(locale)) {
      fail(path, `${mapName} misses ${locale}`);
    }
  }

  const reference = localeBlocks.get('en') ?? [];
  for (const [locale, keys] of localeBlocks.entries()) {
    if (!locales.includes(locale)) {
      fail(path, `${mapName}.${locale} is not a supported locale`);
    }
    if (keys.join(',') !== reference.join(',')) {
      fail(path, `${mapName}.${locale} keys differ from en`);
    }
  }
}

const appStatePath = join(root, 'lib/models/app_state.dart');
const appState = source(appStatePath);
const configured = [
  ...appState.matchAll(/AppLanguage\(\s*code:\s*'([a-z]{2})'/g),
].map((match) => match[1]);
if (configured.join(',') !== locales.join(',')) {
  fail(appStatePath, `locale list differs: ${configured.join(',')}`);
}
validateCoreTranslations();
validateDartLocaleMap(
  join(root, 'lib/l10n/critical_module_translations.dart'),
  'criticalModuleTranslations',
);
validateDartLocaleMap(
  join(root, 'lib/l10n/ai_assistant_translations.dart'),
  'aiAssistantTranslations',
);
validateDartLocaleMap(
  join(root, 'lib/l10n/patient_card_translations.dart'),
  'patientCardTranslations',
);
validateDartLocaleMap(
  join(root, 'lib/l10n/navigation_translations.dart'),
  'navigationTranslations',
);
validateDartLocaleMap(
  join(root, 'lib/l10n/sos_public_card_translations.dart'),
  'sosPublicCardTranslations',
);
validateDartLocaleMap(
  join(root, 'lib/l10n/sos_notice_translations.dart'),
  'sosNoticeTranslations',
);
validateDartLocaleMap(
  join(root, 'lib/l10n/family_access_translations.dart'),
  'familyAccessTranslations',
);
validateDartLocaleMap(
  join(root, 'lib/l10n/profile_extra_translations.dart'),
  'profileExtraTranslations',
);
validateDartLocaleMap(
  join(root, 'lib/l10n/profile_translations.dart'),
  'profileTranslations',
);

const serverPath = join(root, 'backend/server.js');
const server = source(serverPath);
failIfMojibake(serverPath, server);
for (const locale of locales) {
  if (!new RegExp(`^\\s*${locale}:\\s*\\[`, 'm').test(server)) {
    fail(serverPath, `password page misses ${locale}`);
  }
}
if (/res\.send\(\s*["'`]\s*[A-Za-zА-Яа-яЁё]/u.test(server)) {
  fail(serverPath, 'literal user-facing res.send text');
}
if (/status\.textContent\s*=\s*["'`]/.test(server)) {
  fail(serverPath, 'literal status text');
}
if (/subject:\s*["'`](?!GlucoTrack["'`])/.test(server)) {
  fail(serverPath, 'non-keyed email subject');
}

const sosKeysMatch = server.match(/const SOS_LABEL_KEYS = \[([\s\S]*?)\];/);
const sosServerLabelKeys = new Set(
  sosKeysMatch
    ? [...sosKeysMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1])
    : [],
);
if (!sosServerLabelKeys.size) {
  fail(serverPath, 'SOS_LABEL_KEYS could not be parsed');
}
const sosPublicServicePath = join(root, 'lib/services/sos_public_service.dart');
const sosPublicService = source(sosPublicServicePath);
failIfMojibake(sosPublicServicePath, sosPublicService);
const flutterLabelsMatch = sosPublicService.match(/'labels':\s*\{([\s\S]*?)^\s*\},/m);
const flutterSosLabelKeys = new Set(
  flutterLabelsMatch
    ? [...flutterLabelsMatch[1].matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1])
    : [],
);
if (!flutterSosLabelKeys.size) {
  fail(sosPublicServicePath, 'public SOS labels could not be parsed');
}
for (const key of sosServerLabelKeys) {
  if (!flutterSosLabelKeys.has(key)) {
    fail(sosPublicServicePath, `public SOS payload misses ${key}`);
  }
}
for (const key of flutterSosLabelKeys) {
  if (!sosServerLabelKeys.has(key)) {
    fail(sosPublicServicePath, `public SOS payload sends unknown ${key}`);
  }
}

const dartFiles = files(join(root, 'lib'), new Set(['.dart']));
const criticalLocalizedFiles = new Set([
  'lib/screens/cloud_sync_screen.dart',
  'lib/screens/doctor_report_screen.dart',
  'lib/services/doctor_report_service.dart',
]);
for (const path of dartFiles) {
  const rel = relative(root, path).replaceAll('\\', '/');
  const text = source(path);
  failIfMojibake(path, text);
  if (rel.startsWith('lib/l10n/')) continue;

  if (/(?<![A-Za-z])Text\(\s*['"](?!\$)/m.test(text)) {
    fail(path, 'direct Text literal');
  }
  if (/\b(?:labelText|hintText|helperText|tooltip|semanticLabel)[ \t]*:[ \t]*['"]/m.test(text)) {
    fail(path, 'direct UI property literal');
  }
  if (/[А-Яа-яЁёІіЇїЄєҐґ]/u.test(text) && !allowedNonUiTextFile(rel)) {
    fail(path, 'Cyrillic outside translation or voice grammar');
  }
  if (
    /(?:languageCode|locale)\s*==\s*['"][a-z]{2}['"]/.test(text) &&
    !allowedNonUiTextFile(rel)
  ) {
    fail(path, 'manual locale equality in app code');
  }
  if (/_strings\[['"]ru['"]\]/.test(text)) {
    fail(path, 'Russian fallback');
  }
  if (/Map\s*<\s*String\s*,\s*String\s*>\s*[{=]/.test(text) && rel.startsWith('lib/screens/')) {
    fail(path, 'local string dictionary inside screen');
  }
  if (
    criticalLocalizedFiles.has(rel) &&
    (/ui\.text\./.test(text) ||
      /Localized(?:Selectable)?Text\(/.test(text) ||
      /\bliteral\(/.test(text))
  ) {
    fail(path, 'critical screen uses legacy localization fallback');
  }
}

const androidFiles = files(join(root, 'android/app/src/main'), new Set(['.kt', '.java', '.xml']));
for (const path of androidFiles) {
  if (/[А-Яа-яЁёІіЇїЄєҐґ]/u.test(source(path))) {
    fail(path, 'hardcoded Cyrillic');
  }
}

if (process.argv.includes('--check')) {
  const translationFiles = files(join(root, 'lib/l10n'), new Set(['.dart']));
  for (const path of translationFiles) {
    const text = source(path);
    if (/['"]\s*:\s*['"]\s*['"]/.test(text)) {
      fail(path, 'empty translation');
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`i18n audit passed: ${dartFiles.length} Dart files, ${locales.length} locales`);
