import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const docsDir = path.join(root, "docs");
const reportsDir = path.join(root, "reports");
const testsDir = path.join(root, "tests", "localization");
const screenshotsDir = path.join(root, "screenshots", "localization");

for (const dir of [docsDir, reportsDir, testsDir, screenshotsDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

const allowlist = [
  /^GlukoTrack$/,
  /^SOS$/,
  /^AI$/,
  /^GDPR$/,
  /^mg\/dL$/,
  /^mmol\/L$/,
  /^URL$/,
  /^API$/,
  /^CSV$/,
  /^JSON$/,
  /^HTML$/,
  /^PDF$/,
  /^iOS$/,
  /^Android$/,
  /^Windows$/,
  /^macOS$/,
  /^Premium$/,
  /^[A-Z0-9_:-]+$/,
  /^https?:\/\//,
  /^[/.#?&=_a-zA-Z0-9-]+$/,
];

const cyrillicLocales = new Set(["ru", "uk", "bg", "sr", "mk"]);
const latinLocales = new Set([
  "en", "de", "fr", "es", "it", "pl", "pt", "nl", "ro", "cs", "sk", "hu",
  "sv", "da", "fi", "no", "tr", "hr", "sl", "lt", "lv", "et", "sq", "is"
]);
const englishStopWords = /\b(the|and|with|without|your|you|please|save|cancel|delete|request|settings|profile|error|success|failed|required|download|create|close|next|back|sign in|sign out)\b/i;
const localeSuffixes = {
  En: "en", Ru: "ru", Uk: "uk", De: "de", Fr: "fr", Es: "es", It: "it",
  Pl: "pl", Pt: "pt", Nl: "nl", Ro: "ro", Cs: "cs", Sk: "sk", Hu: "hu",
  Sv: "sv", Da: "da", Fi: "fi", No: "no", El: "el", Tr: "tr", Bg: "bg",
  Hr: "hr", Sl: "sl", Lt: "lt", Lv: "lv", Et: "et", Sr: "sr", Sq: "sq",
  Mk: "mk", Is: "is"
};

const excludedPathParts = [
  ".git",
  "build",
  "node_modules",
  ".dart_tool",
  ".gradle",
  "website_source/app/canvaskit",
  "website_source/app/flutter.js",
  "website_source/app/flutter_service_worker.js",
  "website_source/app/main.dart.js",
  "website_source/app/assets/NOTICES",
];

const scanExtensions = new Set([
  ".dart",
  ".js",
  ".html",
  ".css",
  ".kt",
  ".swift",
  ".xml",
  ".plist",
  ".json",
  ".yaml",
  ".yml",
  ".md",
]);

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function walk(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const normalized = rel(full);
    if (excludedPathParts.some((part) => normalized.includes(part))) continue;
    if (entry.isDirectory()) {
      result.push(...walk(full));
    } else if (scanExtensions.has(path.extname(entry.name))) {
      result.push(full);
    }
  }
  return result;
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function dartStringValue(source) {
  return [...source.matchAll(/'([^']*)'/g)].map((match) => match[1]).join("");
}

function extractDartStringMapEntries(body) {
  const entries = [];
  for (const match of body.matchAll(/'([^']+)'\s*:\s*((?:'[^']*'\s*)+)/g)) {
    entries.push({ key: match[1], value: dartStringValue(match[2]), index: match.index });
  }
  return entries;
}

function isAllowedLiteral(value) {
  const text = value.trim();
  if (!text || text.length < 2) return true;
  if (/^[{}()[\].,;:+*/%<>=!?|-]+$/.test(text)) return true;
  if (/^\d+([.,:]\d+)*$/.test(text)) return true;
  return allowlist.some((rule) => rule.test(text));
}

function localeCodes() {
  const appState = read(path.join(root, "lib", "models", "app_state.dart"));
  return [...appState.matchAll(/AppLanguage\(\s*code:\s*'([^']+)'/g)].map((m) => m[1]);
}

function routeInventory() {
  const rows = [];
  const mainPath = path.join(root, "lib", "main.dart");
  const main = read(mainPath);
  for (const match of main.matchAll(/'([^']+)'\s*:\s*\(_\)\s*=>\s*(?:const\s+)?([\s\S]*?)(?=,\n\s*'|,\n\s*}\s*,)/g)) {
    const route = match[1];
    const body = match[2].replace(/\s+/g, " ");
    const screenMatch = body.match(/([A-Z][A-Za-z0-9_]+Screen)\s*\(/);
    const gate = body.includes("PremiumGate") ? "premium-gated" : "normal";
    rows.push({
      id: `APP-${String(rows.length + 1).padStart(3, "0")}`,
      platform: "Flutter app/web/Windows/macOS",
      route,
      screen: screenMatch?.[1] ?? "Startup/navigation wrapper",
      state: gate,
      file: "lib/main.dart",
      opener: "MaterialApp.routes / AppNavigator.pushNamed",
      source: "Flutter AppLocalizations + split translation maps",
      auth: route === "/auth" || route === "/" ? "mixed" : "app session",
      testData: gate === "premium-gated" ? "premium and non-premium users" : "authenticated and empty-data fixtures",
    });
  }

  const websiteFiles = [
    ["SITE-001", "Public website", "/", "Marketing landing", "normal", "website_source/index.html", "browser URL", "marketing-translations.js"],
    ["SITE-002", "Public website", "/install/", "Install page", "QR/install states", "website_source/install/index.html", "install CTA / QR", "install-i18n.js"],
    ["SITE-003", "Public website", "/help/", "Help center public", "list/detail/search", "website_source/help/index.html", "browser URL", "help.js + API"],
    ["SITE-004", "Public website", "/about/", "About GlukoTrack public", "content blocks", "website_source/about/index.html", "browser URL", "about.js + API"],
    ["SITE-005", "Public website", "/r/:code", "Referral landing", "code valid/invalid", "website_source/r/index.html", "referral deep link", "marketing/referral JS"],
    ["SITE-006", "Public website", "/sos/:token", "Public SOS card", "public/private/PIN/scan", "backend/server.js", "QR/deep link", "server renderer + SOS labels"],
  ];
  for (const item of websiteFiles) {
    rows.push({
      id: item[0],
      platform: item[1],
      route: item[2],
      screen: item[3],
      state: item[4],
      file: item[5],
      opener: item[6],
      source: item[7],
      auth: "public/mixed",
      testData: "localized URL, empty/error fixtures",
    });
  }

  const adminPath = path.join(root, "website_source", "admin", "admin.js");
  if (fs.existsSync(adminPath)) {
    const admin = read(adminPath);
    const navMatch = admin.match(/const navItems\s*=\s*\[([\s\S]*?)\];/);
    if (navMatch) {
      let index = 1;
      for (const match of navMatch[1].matchAll(/\["([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\]/g)) {
        rows.push({
          id: `ADM-${String(index++).padStart(3, "0")}`,
          platform: "Admin panel",
          route: `/admin/#${match[1]}`,
          screen: match[2],
          state: "list/detail/create/error/empty/pagination",
          file: "website_source/admin/admin.js",
          opener: "admin sidebar navItems",
          source: "admin dictionaries + API codes",
          auth: match[3],
          testData: "admin role with permission, empty and populated tables",
        });
      }
    }
  }

  const nativeRows = [
    ["NAT-001", "Android", "launcher/splash", "Launch screen", "cold start", "android/app/src/main/res/values/strings.xml", "OS launch", "Android resources"],
    ["NAT-002", "Android", "EmergencyAlertActivity", "Lock-screen SOS", "filled/missing permission/error", "android/app/src/main/kotlin/com/glukotrack/app/EmergencyAlertActivity.kt", "native emergency intent", "Flutter data + native text"],
    ["NAT-003", "iOS", "LaunchScreen", "Launch screen", "cold start", "ios/Runner/Base.lproj/LaunchScreen.storyboard", "OS launch", "storyboard resources"],
    ["NAT-004", "Windows", "runner", "Desktop shell", "window/menu/errors", "windows/runner", "desktop executable", "Win32 resources + Flutter"],
    ["NAT-005", "macOS", "runner", "Desktop shell", "window/menu/errors", "macos/Runner", "desktop executable", "macOS resources + Flutter"],
    ["NAT-006", "Backend/email", "password reset", "Email template", "success/expired/error", "backend/server.js", "email link", "server template + locale"],
    ["NAT-007", "Backend/export", "CSV/HTML/ZIP", "Exported documents", "generated/download/error", "lib/screens/export_screen.dart, backend/gdpr.js", "export buttons", "client/server generated text"],
    ["NAT-008", "Notifications", "push/in-app/local", "Notifications", "campaign/status/system", "backend/admin.js, lib/screens/notifications_screen.dart", "notification center", "API codes + l10n"],
  ];
  for (const item of nativeRows) {
    rows.push({
      id: item[0],
      platform: item[1],
      route: item[2],
      screen: item[3],
      state: item[4],
      file: item[5],
      opener: item[6],
      source: item[7],
      auth: "mixed",
      testData: "platform fixture required",
    });
  }

  return rows;
}

function staticAudit(files, locales) {
  const findings = [];
  const translationKeys = new Map(locales.map((locale) => [locale, new Map()]));
  const usedKeys = new Set();
  const mojibake = /(Ð[\x80-\xBF]?|Ã[\x80-\xBF]?|вЂ[^\s]?|Рџ|Р”|РЎ|Рё|Р°|СЃ|СЋ|СЏ|С‚|СЊ|С‹|С‡|С€)/;
  const cyrillic = /[А-Яа-яЁё]/;
  const latinWord = /[A-Za-z]{3,}/;

  const literalPatterns = [
    { kind: "dart-text", re: /\bText\s*\(\s*(['"`])([^'"`\n]{2,})\1/g },
    { kind: "dart-labelText", re: /\blabelText\s*:\s*(['"`])([^'"`\n]{2,})\1/g },
    { kind: "dart-hintText", re: /\bhintText\s*:\s*(['"`])([^'"`\n]{2,})\1/g },
    { kind: "dart-tooltip", re: /\btooltip\s*:\s*(['"`])([^'"`\n]{2,})\1/g },
    { kind: "js-alert", re: /\b(?:alert|confirm|prompt)\s*\(\s*(['"`])([^'"`\n]{2,})\1/g },
    { kind: "html-text", re: />([^<>{}\n]{2,})</g },
    { kind: "html-attr", re: /\b(?:placeholder|title|aria-label|alt)=["']([^"']{2,})["']/g },
  ];

  const corePath = path.join(root, "assets", "translations", "core.json");
  if (fs.existsSync(corePath)) {
    try {
      const core = JSON.parse(read(corePath));
      for (const section of Object.values(core)) {
        if (!section || typeof section !== "object") continue;
        for (const locale of locales) {
          const values = section[locale];
          if (!values || typeof values !== "object") continue;
          for (const [key, value] of Object.entries(values)) {
            if (typeof value === "string") {
              translationKeys.get(locale)?.set(key, { value, file: "assets/translations/core.json" });
            }
          }
        }
      }
    } catch (error) {
      findings.push({
        id: `JSON-${findings.length + 1}`,
        severity: "high",
        kind: "invalid-core-json",
        file: "assets/translations/core.json",
        message: error.message,
      });
    }
  }

  for (const file of files) {
    const relative = rel(file);
    const text = read(file);
    if (relative.startsWith("lib/") && !relative.startsWith("lib/l10n/")) {
      for (const match of text.matchAll(/\bl10n\.t\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        if (!match[1].includes("${")) usedKeys.add(match[1]);
      }
      for (const match of text.matchAll(/\bcontext\.l10n\.t\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        if (!match[1].includes("${")) usedKeys.add(match[1]);
      }
    }
    if (mojibake.test(text)) {
      findings.push({
        id: `MOJ-${findings.length + 1}`,
        severity: "high",
        kind: "mojibake",
        file: relative,
        line: lineOf(text, text.search(mojibake)),
        message: "Potential UTF-8 mojibake marker found",
      });
    }

    if (relative.startsWith("lib/l10n/")) {
      for (const localeMatch of text.matchAll(/'([a-z]{2})'\s*:\s*\{([\s\S]*?)\n\s*\},/g)) {
        const locale = localeMatch[1];
        if (!translationKeys.has(locale)) continue;
        const body = localeMatch[2];
        for (const keyMatch of extractDartStringMapEntries(body)) {
          const key = keyMatch.key;
          const value = keyMatch.value;
          translationKeys.get(locale).set(key, { value, file: relative });
          if (!value.trim()) {
            findings.push({ id: `EMP-${findings.length + 1}`, severity: "high", kind: "empty-translation", file: relative, line: lineOf(text, localeMatch.index + keyMatch.index), locale, key });
          }
          if (value === key) {
            findings.push({ id: `KEY-${findings.length + 1}`, severity: "high", kind: "key-as-value", file: relative, line: lineOf(text, localeMatch.index + keyMatch.index), locale, key });
          }
          if (!cyrillicLocales.has(locale) && cyrillic.test(value)) {
            findings.push({ id: `CYR-${findings.length + 1}`, severity: "medium", kind: "cyrillic-in-non-ru", file: relative, line: lineOf(text, localeMatch.index + keyMatch.index), locale, key, value });
          }
          if (locale !== "en" && latinLocales.has(locale) && englishStopWords.test(value) && !isAllowedLiteral(value)) {
            findings.push({ id: `ENG-${findings.length + 1}`, severity: "medium", kind: "english-looking-translation", file: relative, line: lineOf(text, localeMatch.index + keyMatch.index), locale, key, value });
          }
          if (mojibake.test(value)) {
            findings.push({ id: `MOJ-${findings.length + 1}`, severity: "high", kind: "mojibake-translation", file: relative, line: lineOf(text, localeMatch.index + keyMatch.index), locale, key, value });
          }
        }
      }
      for (const constMatch of text.matchAll(/(?:const|final)\s+_\w+(En|Ru|Uk|De|Fr|Es|It|Pl|Pt|Nl|Ro|Cs|Sk|Hu|Sv|Da|Fi|No|El|Tr|Bg|Hr|Sl|Lt|Lv|Et|Sr|Sq|Mk|Is)\s*=\s*<String,\s*String>\s*\{([\s\S]*?)\n\};/g)) {
        const locale = localeSuffixes[constMatch[1]];
        if (!translationKeys.has(locale)) continue;
        const body = constMatch[2];
        for (const keyMatch of extractDartStringMapEntries(body)) {
          const key = keyMatch.key;
          const value = keyMatch.value;
          translationKeys.get(locale).set(key, { value, file: relative });
          if (!value.trim()) {
            findings.push({ id: `EMP-${findings.length + 1}`, severity: "high", kind: "empty-translation", file: relative, line: lineOf(text, constMatch.index + keyMatch.index), locale, key });
          }
          if (value === key) {
            findings.push({ id: `KEY-${findings.length + 1}`, severity: "high", kind: "key-as-value", file: relative, line: lineOf(text, constMatch.index + keyMatch.index), locale, key });
          }
          if (!cyrillicLocales.has(locale) && cyrillic.test(value)) {
            findings.push({ id: `CYR-${findings.length + 1}`, severity: "medium", kind: "cyrillic-in-non-ru", file: relative, line: lineOf(text, constMatch.index + keyMatch.index), locale, key, value });
          }
          if (locale !== "en" && latinLocales.has(locale) && englishStopWords.test(value) && !isAllowedLiteral(value)) {
            findings.push({ id: `ENG-${findings.length + 1}`, severity: "medium", kind: "english-looking-translation", file: relative, line: lineOf(text, constMatch.index + keyMatch.index), locale, key, value });
          }
          if (mojibake.test(value)) {
            findings.push({ id: `MOJ-${findings.length + 1}`, severity: "high", kind: "mojibake-translation", file: relative, line: lineOf(text, constMatch.index + keyMatch.index), locale, key, value });
          }
        }
      }
    }

    if (!relative.startsWith("lib/l10n/")) {
      for (const pattern of literalPatterns) {
        for (const match of text.matchAll(pattern.re)) {
          const value = (pattern.kind === "html-text" ? match[1] : match[2] ?? match[1]).trim();
          if (isAllowedLiteral(value)) continue;
          if (/^\$\{|^l10n\.|^context\.l10n/.test(value)) continue;
          findings.push({
            id: `HARD-${findings.length + 1}`,
            severity: "medium",
            kind: "hardcoded-ui-string",
            subtype: pattern.kind,
            file: relative,
            line: lineOf(text, match.index),
            value,
          });
        }
      }
    }
  }

  const allKeys = new Set();
  for (const map of translationKeys.values()) for (const key of map.keys()) allKeys.add(key);
  const requiredKeys = usedKeys.size ? usedKeys : allKeys;
  for (const locale of locales) {
    const keys = translationKeys.get(locale) ?? new Map();
    for (const key of requiredKeys) {
      if (!keys.has(key)) {
        findings.push({
          id: `MISS-${findings.length + 1}`,
          severity: "high",
          kind: "missing-translation-key",
          locale,
          key,
          message: `Locale ${locale} is missing ${key}`,
        });
      }
    }
  }

  const suspiciousSame = [];
  const en = translationKeys.get("en") ?? new Map();
  for (const [key, entry] of en.entries()) {
    const same = [];
    for (const locale of locales.filter((l) => l !== "en")) {
      const value = translationKeys.get(locale)?.get(key)?.value;
      if (value && value === entry.value && !isAllowedLiteral(value)) same.push(locale);
    }
    if (same.length >= 3) {
      suspiciousSame.push({ key, value: entry.value, locales: same });
      findings.push({
        id: `SAME-${findings.length + 1}`,
        severity: "low",
        kind: "same-as-english-many-locales",
        key,
        locales: same,
        value: entry.value,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    locales,
    filesScanned: files.map(rel),
    summary: {
      filesScanned: files.length,
      locales: locales.length,
      keysTotal: allKeys.size,
      usedKeys: usedKeys.size,
      findingsTotal: findings.length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
      missingKeys: findings.filter((f) => f.kind === "missing-translation-key").length,
      hardcodedStrings: findings.filter((f) => f.kind === "hardcoded-ui-string").length,
      mojibake: findings.filter((f) => f.kind.includes("mojibake")).length,
    },
    findings,
    suspiciousSame,
  };
}

function writeInventory(rows) {
  const lines = [
    "# GlukoTrack Localization Screen Inventory",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Scope: Flutter mobile app, Flutter web app, Windows desktop, macOS desktop, public website, public SOS/referral/help/about pages, backend-rendered documents/messages, and admin panel.",
    "",
    "| ID | Platform | Route | Screen | State | File | Opened by | Text source | Auth/Test data |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of rows) {
    lines.push(`| ${row.id} | ${row.platform} | \`${row.route}\` | ${row.screen} | ${row.state} | \`${row.file}\` | ${row.opener} | ${row.source} | ${row.auth}; ${row.testData} |`);
  }
  lines.push("");
  lines.push("Required state coverage per row: loading, loaded with data, empty data, API error, offline, validation error, success snackbar, destructive confirmation, permission denied, long localized text, and modal/bottom sheet/dropdown states where applicable.");
  fs.writeFileSync(path.join(docsDir, "localization-screen-inventory.md"), lines.join("\n"), "utf8");
}

function writeReports(audit, inventoryRows) {
  fs.writeFileSync(path.join(reportsDir, "localization-static-audit.json"), JSON.stringify(audit, null, 2), "utf8");
  fs.writeFileSync(path.join(reportsDir, "localization-failures.json"), JSON.stringify(audit.findings, null, 2), "utf8");
  const byKind = Object.entries(Object.groupBy(audit.findings, (f) => f.kind))
    .sort((a, b) => b[1].length - a[1].length);
  const md = [
    "# GlukoTrack Localization Static Audit",
    "",
    `Generated: ${audit.generatedAt}`,
    "",
    "## Scope",
    "",
    "- Flutter app: Android, iOS, Web, Windows, macOS from shared Dart UI.",
    "- Public website: `website_source` pages and JavaScript.",
    "- Admin panel: `website_source/admin`.",
    "- Backend-rendered UI: SOS public page, password reset, email/document/export generators.",
    "- Native shells: Android resources/Kotlin, iOS storyboard/Swift, Windows/macOS runners.",
    "",
    "## Summary",
    "",
    `- Inventory rows: ${inventoryRows.length}`,
    `- Files scanned: ${audit.summary.filesScanned}`,
    `- Locales detected: ${audit.summary.locales}`,
    `- Translation keys union: ${audit.summary.keysTotal}`,
    `- Used keys detected in Flutter UI: ${audit.summary.usedKeys}`,
    `- Findings total: ${audit.summary.findingsTotal}`,
    `- High: ${audit.summary.high}`,
    `- Medium: ${audit.summary.medium}`,
    `- Low: ${audit.summary.low}`,
    `- Missing keys: ${audit.summary.missingKeys}`,
    `- Hardcoded UI strings: ${audit.summary.hardcodedStrings}`,
    `- Mojibake findings: ${audit.summary.mojibake}`,
    "",
    "## Findings By Kind",
    "",
    ...byKind.map(([kind, rows]) => `- ${kind}: ${rows.length}`),
    "",
    "## First 200 Findings",
    "",
    "| ID | Severity | Kind | File | Line | Locale/Key | Value |",
    "| --- | --- | --- | --- | ---: | --- | --- |",
    ...audit.findings.slice(0, 200).map((f) => `| ${f.id} | ${f.severity} | ${f.kind} | ${f.file ?? ""} | ${f.line ?? ""} | ${[f.locale, f.key].filter(Boolean).join(" / ")} | ${(f.value ?? f.message ?? "").toString().replaceAll("|", "\\|").slice(0, 160)} |`),
    "",
    "Full machine-readable report: `reports/localization-static-audit.json`.",
    "",
    "This report is not a claim that localization is fixed. It is the controlled queue for the correction phase.",
  ];
  fs.writeFileSync(path.join(reportsDir, "localization-static-audit.md"), md.join("\n"), "utf8");

  const html = `<!doctype html><meta charset="utf-8"><title>GlukoTrack localization matrix</title>
<style>body{font-family:Arial,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f4f8fc}.fail{color:#b42318;font-weight:700}.todo{color:#92400e;font-weight:700}</style>
<h1>GlukoTrack Localization Screen Matrix</h1>
<p>Generated: ${new Date().toISOString()}</p>
<p>This matrix is initialized from the inventory. E2E PASS requires a later automated route walk with screenshots.</p>
<table><thead><tr><th>ID</th><th>Platform</th><th>Route</th><th>Screen</th><th>State</th><th>Status</th><th>Screenshot</th></tr></thead><tbody>
${inventoryRows.map((row) => `<tr><td>${row.id}</td><td>${row.platform}</td><td><code>${row.route}</code></td><td>${row.screen}</td><td>${row.state}</td><td class="todo">NOT_RUN_STATIC_ONLY</td><td>screenshots/localization/${row.id}.png</td></tr>`).join("\n")}
</tbody></table>`;
  fs.writeFileSync(path.join(reportsDir, "localization-screen-matrix.html"), html, "utf8");

  const ci = `# Localization CI gate

Run:

\`\`\`bash
node tools/localization_audit.mjs --fail-on-findings
\`\`\`

Current repository still has findings, so the default command writes reports without failing. Enable the flag when the correction queue reaches zero.
`;
  fs.writeFileSync(path.join(testsDir, "README.md"), ci, "utf8");
}

const locales = localeCodes();
const inventory = routeInventory();
const files = [
  ...walk(path.join(root, "lib")),
  ...walk(path.join(root, "website_source")),
  ...walk(path.join(root, "web")),
  ...walk(path.join(root, "android")),
  ...walk(path.join(root, "ios")),
  ...walk(path.join(root, "windows")),
  ...walk(path.join(root, "macos")),
  ...walk(path.join(root, "backend")),
];
const audit = staticAudit(files, locales);
writeInventory(inventory);
writeReports(audit, inventory);

console.log(JSON.stringify({
  inventoryRows: inventory.length,
  filesScanned: audit.summary.filesScanned,
  locales: audit.summary.locales,
  findings: audit.summary.findingsTotal,
  high: audit.summary.high,
  medium: audit.summary.medium,
  low: audit.summary.low,
}, null, 2));

if (process.argv.includes("--fail-on-findings") && audit.findings.length > 0) {
  process.exitCode = 1;
}
