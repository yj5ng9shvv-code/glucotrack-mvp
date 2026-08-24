#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(__dirname, "../../public_html/admin/admin.js");

const source = fs.readFileSync(adminPath, "utf8");
const errors = [];
const dictionaries = { ru: {}, en: {} };
const requiredLanguages = ["ru", "en"];
const requiredPrefixes = ["settings.backup", "settings.ai"];

const backupFields = [
  "backup_enabled", "backup_manual_enabled", "backup_auto_enabled", "backup_prevent_parallel", "backup_max_duration_minutes", "backup_min_free_mb",
  "backup_schedule_frequency", "backup_schedule_days", "backup_schedule_time", "backup_schedule_timezone",
  "backup_include_database", "backup_include_frontend", "backup_include_backend", "backup_include_configs", "backup_include_uploads", "backup_include_nginx", "backup_include_systemd", "backup_include_env",
  "backup_retention_daily", "backup_retention_weekly", "backup_retention_monthly", "backup_retention_max_age_days", "backup_retention_max_total_mb", "backup_retention_warn_at_percent", "backup_cleanup_dry_run_enabled",
  "backup_notify_completed", "backup_notify_failed", "backup_notify_low_space", "backup_notify_retention_warning", "backup_notify_cleanup_plan", "backup_notify_cleanup_completed", "backup_notify_cleanup_failed",
  "backup_manage_roles"
];
const backupSections = ["general", "schedule", "components", "retention", "notifications", "permissions", "modes", "copies", "cleanup"];
const backupModes = ["full", "database", "files", "pre-deploy", "pre-wipe"];
const backupComponents = ["database", "frontend", "backend", "configs", "uploads", "nginx", "systemd", "env"];
const backupDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const backupOptions = ["daily", "weekly", "monthly", "UTC", "Europe/Warsaw", "Europe/Kyiv", "Europe/Berlin"];
const backupRoles = ["super_admin", "security_auditor"];
const backupStatuses = ["pending", "running", "completed", "failed", "verified", "missing", "protected"];
const backupCleanupReasons = ["max_age", "retention", "total_size", "unverified"];
const aiFeatures = ["basic_text", "medication", "lab_analysis", "photo_food", "photo_document", "doctor_report"];
const aiPlans = ["free", "basic", "premium", "family"];
const aiCounters = ["normal", "photo"];
const aiStatuses = ["reserved", "completed", "failed", "cancelled"];
const aiSections = ["connection", "models", "routing", "limits", "stats", "audit"];

const requiredBackupKeys = [
  "settings.backup.storage", "settings.backup.freeSpace", "settings.backup.running", "settings.backup.runNow", "settings.backup.cleanupDryRun", "settings.backup.cleanupEmpty", "settings.backup.cleanupNothing", "settings.backup.reclaim", "settings.backup.verify", "settings.backup.verified", "settings.backup.protect", "settings.backup.unprotect", "settings.backup.saved", "settings.backup.resetConfirm", "settings.backup.resetDone", "settings.backup.modePrompt",
  ...backupSections.flatMap((id) => [`settings.backup.section.${id}.title`, `settings.backup.section.${id}.description`]),
  ...backupFields.flatMap((key) => [`settings.backup.field.${key}.title`, `settings.backup.field.${key}.description`]),
  ...backupModes.map((id) => `settings.backup.mode.${id}`),
  ...backupComponents.map((id) => `settings.backup.component.${id}`),
  ...backupDays.map((id) => `settings.backup.day.${id}`),
  ...backupOptions.map((id) => `settings.backup.option.${id}`),
  ...backupRoles.map((id) => `settings.backup.role.${id}`),
  ...backupStatuses.map((id) => `settings.backup.status.${id}`),
  ...backupCleanupReasons.map((id) => `settings.backup.cleanupReason.${id}`),
  "settings.unit.mb", "settings.unit.percent"
];
const requiredAiKeys = [
  ...aiSections.flatMap((id) => [`settings.ai.section.${id}.title`, `settings.ai.section.${id}.description`]),
  "settings.module.aiSettings.title", "settings.module.aiSettings.description",
  "settings.ai.auditNotice", "settings.ai.apiStatus", "settings.ai.connected", "settings.ai.notConfigured", "settings.ai.apiKey", "settings.ai.newApiKey", "settings.ai.newApiKeyDescription", "settings.ai.modelsAvailable", "settings.ai.modelsAvailableDescription", "settings.ai.enabled", "settings.ai.enabledDescription", "settings.ai.feature", "settings.ai.primaryModel", "settings.ai.fallbackModel", "settings.ai.fallback", "settings.ai.maxTokens", "settings.ai.counter", "settings.ai.plan", "settings.ai.testConnection", "settings.ai.saved", "settings.ai.resetConfirm", "settings.ai.resetDone", "settings.ai.connectionOk",
  ...aiFeatures.map((id) => `settings.ai.feature.${id}`),
  ...aiPlans.map((id) => `settings.ai.plan.${id}`),
  ...aiCounters.map((id) => `settings.ai.counter.${id}`),
  ...aiStatuses.map((id) => `settings.ai.status.${id}`)
];

function addError(file, key, message) {
  errors.push(`${file}: ${key}: ${message}`);
}

function extractObjectLiteral(startIndex) {
  const open = source.indexOf("{", startIndex);
  if (open === -1) return "";
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return "";
}

for (const lang of requiredLanguages) {
  const pattern = new RegExp(`Object\\.assign\\(dictionaries\\.${lang}\\s*,`, "g");
  let match;
  while ((match = pattern.exec(source))) {
    const objectLiteral = extractObjectLiteral(match.index);
    if (!objectLiteral) {
      addError(adminPath, lang, "cannot extract dictionary object literal");
      continue;
    }
    try {
      Object.assign(dictionaries[lang], Function(`"use strict"; return (${objectLiteral});`)());
    } catch (error) {
      addError(adminPath, lang, `cannot parse dictionary object: ${error.message}`);
    }
  }
}

function placeholders(value) {
  return [...String(value).matchAll(/\{[a-zA-Z0-9_]+\}|%\{[a-zA-Z0-9_]+\}/g)].map((item) => item[0]).sort();
}

function hasCorruption(value) {
  const text = String(value);
  return text.includes("???") || text.includes("�") || /Р[ђЂЃѓЄєЅѕІіЇїЈјЉљЊњЋћЌќЎўЏџ]/.test(text);
}

for (const key of [...requiredBackupKeys, ...requiredAiKeys]) {
  for (const lang of requiredLanguages) {
    const value = dictionaries[lang][key];
    if (value === undefined) addError(adminPath, key, `missing ${lang} translation`);
    else if (String(value).trim() === "") addError(adminPath, key, `${lang} translation is empty`);
    else if (String(value) === key) addError(adminPath, key, `${lang} exposes raw key`);
    else if (hasCorruption(value)) addError(adminPath, key, `${lang} translation looks corrupted`);
  }
  if (dictionaries.ru[key] !== undefined && dictionaries.en[key] !== undefined) {
    const ruPlaceholders = placeholders(dictionaries.ru[key]).join(",");
    const enPlaceholders = placeholders(dictionaries.en[key]).join(",");
    if (ruPlaceholders !== enPlaceholders) addError(adminPath, key, `placeholder mismatch ru=[${ruPlaceholders}] en=[${enPlaceholders}]`);
  }
}

for (const prefix of requiredPrefixes) {
  const ruKeys = Object.keys(dictionaries.ru).filter((key) => key.startsWith(prefix)).sort();
  const enKeys = Object.keys(dictionaries.en).filter((key) => key.startsWith(prefix)).sort();
  for (const key of ruKeys) if (!enKeys.includes(key)) addError(adminPath, key, "missing en key for ru key");
  for (const key of enKeys) if (!ruKeys.includes(key)) addError(adminPath, key, "missing ru key for en key");
}

const backupRegion = source.slice(source.indexOf("function renderBackupSettings"), source.indexOf("function formatBytes"));
const forbiddenBackupPatterns = [
  [/\?\s*\$\{formatBytes|\?\s*\$\{formatDate/, "literal question-mark separator in Backup Settings UI"],
  [/Backup module setting\./, "generic fallback field description"],
  [/settings\.backup\.field\.\$\{key\}/, "unverified dynamic Backup field key without required dictionary coverage"]
];
for (const [pattern, message] of forbiddenBackupPatterns) {
  if (pattern.test(backupRegion) && message !== "unverified dynamic Backup field key without required dictionary coverage") {
    addError(adminPath, "BackupSettings", message);
  }
}

if (errors.length) {
  console.error("i18n check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`i18n check passed: ${requiredBackupKeys.length} Backup Settings keys and ${requiredAiKeys.length} AI Settings keys verified for ru/en in ${adminPath}`);
