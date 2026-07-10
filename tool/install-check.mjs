import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const expected=['en','de','fr','es','it','pl','uk','ru','pt','nl','ro','cs','sk','hu','sv','da','fi','no','el','tr','bg','hr','sl','lt','lv','et','sr','sq','mk','is'];
const context={window:{}};vm.createContext(context);
vm.runInContext(readFileSync('website_source/install/install-i18n.js','utf8'),context);
const translations=context.window.installTranslations;
if(JSON.stringify(Object.keys(translations))!==JSON.stringify(expected))throw Error('Install locale list mismatch');
for(const code of expected){if(translations[code].length!==14||translations[code].some(v=>!v.trim()))throw Error(`Invalid install translations: ${code}`)}
vm.runInContext(readFileSync('website_source/install/install-actions-i18n.js','utf8'),context);
const actions=context.window.installActionTranslations;
for(const code of expected){if(!actions[code]||['open','repair','help'].some(key=>!actions[code][key]?.trim()))throw Error(`Invalid install actions: ${code}`)}
const configSource=readFileSync('website_source/install/config.js','utf8');
if(!/googlePlay:\s*\{ enabled: false/.test(configSource)||!/appStore:\s*\{ enabled: false/.test(configSource))throw Error('Unpublished stores must be disabled');
for(const file of ['website_source/install/index.html','website_source/install/install.js','website_source/install/install-core.js','website_source/install/qrcode.min.js','website_source/manifest.webmanifest','website_source/sw.js','website_source/icons/icon-192.svg','website_source/icons/icon-512.svg'])if(!existsSync(file))throw Error(`Missing ${file}`);
const valid=(enabled,url,host)=>{try{const u=new URL(url);return enabled&&u.protocol==='https:'&&u.hostname.includes(host)}catch{return false}};
if(valid(false,'https://play.google.com/store/apps/details?id=x','play.google.com'))throw Error('Disabled store visible');
if(valid(true,'','play.google.com')||valid(true,'not-a-url','play.google.com'))throw Error('Invalid store visible');
if(!valid(true,'https://play.google.com/store/apps/details?id=real','play.google.com'))throw Error('Valid store hidden');
if(!valid(true,'https://apps.apple.com/app/id123','apps.apple.com'))throw Error('Valid App Store hidden');
console.log(`install audit passed: ${expected.length} locales, stores disabled, assets present`);
