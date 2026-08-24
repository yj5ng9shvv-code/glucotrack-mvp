const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const sourceFile = path.join(process.cwd(), 'lib', 'l10n', 'profile_extra_translations.dart');
const source = fs.readFileSync(sourceFile, 'utf8');
const englishBlock = source.match(/'en':\s*\{([\s\S]*?)\n  \},\n  'de':/);
if (!englishBlock) throw new Error('English profile translations block was not found.');

const entries = {};
for (const match of englishBlock[1].matchAll(/'((?:gdpr\.)[^']+)':\s*'([^']*)'/g)) {
  entries[match[1]] = match[2];
}
if (Object.keys(entries).length === 0) throw new Error('No GDPR keys were found.');

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
          resolve(JSON.parse(body)[0].map((part) => part[0]).join(''));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function translate(language, values) {
  if (language === 'en') return values;
  const batch = (await request(language, values.join(marker))).split('ZZZXQZ').map((value) => value.trim());
  return batch.length === values.length ? batch : Promise.all(values.map((value) => request(language, value)));
}

async function main() {
  const keys = Object.keys(entries);
  const values = Object.values(entries);
  const output = ['const Map<String, Map<String, String>> gdprTranslations = {'];
  for (const language of languages) {
    const translated = await translate(language, values);
    if (translated.length !== keys.length) throw new Error(`${language}: incomplete translation`);
    output.push(`  '${language}': {`);
    keys.forEach((key, index) => output.push(`    '${key}': ${JSON.stringify(translated[index])},`));
    output.push('  },');
  }
  output.push('};', '');
  const target = path.join(process.cwd(), 'lib', 'l10n', 'gdpr_translations.dart');
  fs.writeFileSync(target, output.join('\n'), 'utf8');
  console.log(`keys=${keys.length} bytes=${fs.statSync(target).size}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
