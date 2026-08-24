export const SOS_ROLE_OPTIONS = ["super_admin","support","medical_data_reviewer","security_auditor"];

export const SOS_SETTING_DEFS = {
  sos_enabled: { type: "boolean", defaultValue: true, app: true, group: "module", wired: true },
  sos_test_mode: { type: "boolean", defaultValue: true, app: true, group: "module", wired: true },
  sos_create_roles: { type: "roles", defaultValue: ["super_admin","support","medical_data_reviewer"], group: "permissions", wired: false },
  sos_view_roles: { type: "roles", defaultValue: ["super_admin","support","medical_data_reviewer","security_auditor"], group: "permissions", wired: false },
  sos_cancel_roles: { type: "roles", defaultValue: ["super_admin","support","medical_data_reviewer"], group: "permissions", wired: false },
  sos_close_roles: { type: "roles", defaultValue: ["super_admin","medical_data_reviewer"], group: "permissions", wired: false },
  sos_audit_actions_enabled: { type: "boolean", defaultValue: true, group: "audit", wired: true },
  sos_show_patient_card: { type: "boolean", defaultValue: true, app: true, group: "ui", wired: true },
  sos_show_family_card: { type: "boolean", defaultValue: true, app: true, group: "ui", wired: true },
  sos_activation_mode: { type: "enum", values: ["manual","automatic","both"], defaultValue: "both", app: true, group: "activation", wired: true },
  sos_require_activation_confirmation: { type: "boolean", defaultValue: true, app: true, group: "activation", wired: true },
  sos_accidental_cancel_seconds: { type: "integer", min: 0, max: 300, defaultValue: 15, app: true, group: "activation", wired: true },
  sos_card_display_priority: { type: "enum", values: ["normal","high","critical"], defaultValue: "high", app: true, group: "ui", wired: true },
  sos_stale_after_minutes: { type: "integer", min: 1, max: 10080, defaultValue: 240, app: true, group: "lifecycle", wired: true },
  sos_auto_close_enabled: { type: "boolean", defaultValue: false, app: true, group: "lifecycle", wired: true },
  sos_auto_close_after_hours: { type: "integer", min: 1, max: 168, defaultValue: 24, app: true, group: "lifecycle", wired: true },
  sos_require_close_comment: { type: "boolean", defaultValue: true, app: true, group: "lifecycle", wired: true },
  sos_patient_cancel_enabled: { type: "boolean", defaultValue: true, app: true, group: "permissions", wired: true },
  sos_caregiver_close_enabled: { type: "boolean", defaultValue: false, app: true, group: "permissions", wired: true },
  sos_push_enabled: { type: "boolean", defaultValue: false, app: true, group: "notifications", wired: true },
  sos_in_app_enabled: { type: "boolean", defaultValue: true, app: true, group: "notifications", wired: true },
  sos_caregiver_alarm_sound: { type: "boolean", defaultValue: true, app: true, group: "alarm", wired: true },
  sos_repeat_notifications: { type: "boolean", defaultValue: false, app: true, group: "notifications", wired: true },
  sos_repeat_interval_minutes: { type: "integer", min: 1, max: 1440, defaultValue: 5, app: true, group: "notifications", wired: true },
  sos_max_notification_repeats: { type: "integer", min: 0, max: 50, defaultValue: 3, app: true, group: "notifications", wired: true },
  sos_escalation_enabled: { type: "boolean", defaultValue: false, app: true, group: "notifications", wired: true },
  sos_escalation_after_minutes: { type: "integer", min: 1, max: 1440, defaultValue: 15, app: true, group: "notifications", wired: true },
  sos_sms_enabled: { type: "boolean", defaultValue: false, app: true, group: "sms", wired: true },
  sos_sms_type: { type: "enum", values: ["disabled","system_composer","external_reserved"], defaultValue: "disabled", app: true, group: "sms", wired: true },
  sos_sms_create_server_first: { type: "boolean", defaultValue: true, app: true, group: "sms", wired: true },
  sos_sms_template: { type: "text", max: 320, defaultValue: "SOS GlukoTrack: {user_name}. {sos_time}. {location_link}. ID {sos_id}.", group: "sms", wired: false },
  sos_sms_max_repeats: { type: "integer", min: 0, max: 20, defaultValue: 0, app: true, group: "sms", wired: true },
  sos_sms_min_repeat_interval_minutes: { type: "integer", min: 1, max: 1440, defaultValue: 10, app: true, group: "sms", wired: true },
  sos_request_current_location: { type: "boolean", defaultValue: true, app: true, group: "geolocation", wired: true },
  sos_use_last_known_location: { type: "boolean", defaultValue: true, app: true, group: "geolocation", wired: true },
  sos_last_location_max_age_minutes: { type: "integer", min: 1, max: 10080, defaultValue: 60, app: true, group: "geolocation", wired: true },
  sos_location_update_interval_seconds: { type: "integer", min: 5, max: 3600, defaultValue: 30, app: true, group: "geolocation", wired: true },
  sos_location_tracking_max_minutes: { type: "integer", min: 1, max: 1440, defaultValue: 60, app: true, group: "geolocation", wired: true },
  sos_show_map_to_caregiver: { type: "boolean", defaultValue: true, app: true, group: "geolocation", wired: true },
  sos_location_retention_days: { type: "integer", min: 1, max: 3650, defaultValue: 30, group: "geolocation", wired: false },
  sos_patient_activation_sound: { type: "boolean", defaultValue: true, app: true, group: "alarm", wired: true },
  sos_caregiver_sound: { type: "boolean", defaultValue: true, app: true, group: "alarm", wired: true },
  sos_vibration_enabled: { type: "boolean", defaultValue: true, app: true, group: "alarm", wired: true },
  sos_repeat_sound_until_ack: { type: "boolean", defaultValue: false, app: true, group: "alarm", wired: true },
  sos_warn_missing_sound_permission: { type: "boolean", defaultValue: true, app: true, group: "alarm", wired: true },
  sos_allow_sound_test_mode: { type: "boolean", defaultValue: true, app: true, group: "alarm", wired: true },
  notification_manual_sos_cooldown_minutes: { type: "integer", min: 0, max: 1440, defaultValue: 15, group: "safety", wired: true },
  sos_rate_limit_enabled: { type: "boolean", defaultValue: true, group: "safety", wired: true },
  sos_rate_limit_count: { type: "integer", min: 1, max: 100, defaultValue: 5, group: "safety", wired: true },
  sos_rate_limit_window_minutes: { type: "integer", min: 1, max: 1440, defaultValue: 60, group: "safety", wired: true },
  sos_merge_duplicate_active: { type: "boolean", defaultValue: true, group: "safety", wired: true },
  sos_duplicate_window_seconds: { type: "integer", min: 1, max: 3600, defaultValue: 120, group: "safety", wired: true },
  sos_log_lifecycle_events: { type: "boolean", defaultValue: true, group: "audit", wired: true },
  sos_log_settings_changes: { type: "boolean", defaultValue: true, group: "audit", wired: true },
  sos_event_retention_days: { type: "integer", min: 1, max: 3650, defaultValue: 365, group: "history", wired: false },
  sos_notification_retention_days: { type: "integer", min: 1, max: 3650, defaultValue: 90, group: "history", wired: false },
  sos_coordinate_retention_days: { type: "integer", min: 1, max: 3650, defaultValue: 30, group: "history", wired: false },
  sos_show_history_patient: { type: "boolean", defaultValue: true, app: true, group: "history", wired: true },
  sos_show_history_caregiver: { type: "boolean", defaultValue: true, app: true, group: "history", wired: true },
  sos_include_events_in_gdpr_export: { type: "boolean", defaultValue: true, group: "history", wired: false }
};

const CACHE_MS = 5000;
const VERSION = 1;

export function sosDefaults() {
  return Object.fromEntries(Object.entries(SOS_SETTING_DEFS).map(([key, def]) => [key, def.defaultValue]));
}

export function sosSchema() {
  return Object.fromEntries(Object.entries(SOS_SETTING_DEFS).map(([key, def]) => [key, {
    type: def.type,
    min: def.min,
    max: def.max,
    values: def.values,
    maxLength: def.max,
    group: def.group,
    wired: Boolean(def.wired)
  }]));
}

export function parseSosSetting(def, value) {
  let parsed = value;
  try { parsed = JSON.parse(value); } catch {}
  if (def.type === "boolean") return parsed === true || parsed === 1 || parsed === "1" || parsed === "true";
  if (def.type === "integer") {
    const numeric = Number(parsed);
    return Number.isInteger(numeric) && numeric >= def.min && numeric <= def.max ? numeric : def.defaultValue;
  }
  if (def.type === "enum") return def.values.includes(String(parsed)) ? String(parsed) : def.defaultValue;
  if (def.type === "roles") return Array.isArray(parsed) ? [...new Set(parsed.filter((role) => SOS_ROLE_OPTIONS.includes(role)))] : def.defaultValue;
  if (def.type === "text") {
    const text = String(parsed ?? "").trim();
    return text ? text.slice(0, def.max ?? 1000) : def.defaultValue;
  }
  return def.defaultValue;
}

export function validateSosSettings(input = {}) {
  const value = sosDefaults();
  for (const key of Object.keys(input || {})) if (!SOS_SETTING_DEFS[key]) return { error: "SOS_SETTING_UNKNOWN" };
  for (const [key, def] of Object.entries(SOS_SETTING_DEFS)) {
    const raw = Object.prototype.hasOwnProperty.call(input, key) ? input[key] : def.defaultValue;
    if (def.type === "boolean") { if (typeof raw !== "boolean") return { error: "SOS_SETTING_BOOLEAN_REQUIRED" }; value[key] = raw; }
    else if (def.type === "integer") { const n = Number(raw); if (!Number.isInteger(n) || n < def.min || n > def.max) return { error: "SOS_SETTING_INTEGER_RANGE" }; value[key] = n; }
    else if (def.type === "enum") { if (!def.values.includes(String(raw))) return { error: "SOS_SETTING_ENUM_INVALID" }; value[key] = String(raw); }
    else if (def.type === "roles") { if (!Array.isArray(raw) || raw.some((role) => !SOS_ROLE_OPTIONS.includes(role))) return { error: "SOS_SETTING_ROLE_INVALID" }; value[key] = [...new Set(raw)]; }
    else if (def.type === "text") { const text = String(raw ?? "").trim(); if (!text || text.length > def.max) return { error: "SOS_SETTING_TEXT_INVALID" }; value[key] = text; }
  }
  if (value.sos_auto_close_enabled && value.sos_auto_close_after_hours < 1) return { error: "SOS_AUTO_CLOSE_PERIOD_REQUIRED" };
  if (value.sos_repeat_notifications && value.sos_max_notification_repeats < 1) return { error: "SOS_REPEAT_COUNT_REQUIRED" };
  if (value.sos_escalation_enabled && value.sos_escalation_after_minutes < 1) return { error: "SOS_ESCALATION_PERIOD_REQUIRED" };
  if (value.sos_sms_type === "disabled" || value.sos_sms_type === "external_reserved") value.sos_sms_enabled = false;
  return { value };
}

export function createSosSettingsService(query, { cacheMs = CACHE_MS } = {}) {
  let cache = null;
  let expiresAt = 0;
  const loadRows = async () => {
    const keys = Object.keys(SOS_SETTING_DEFS);
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(",");
    const result = await query(`SELECT setting_key,setting_value,updated_at FROM system_settings WHERE setting_key IN (${placeholders})`, keys);
    return result.rows;
  };
  const effectiveSettings = async ({ refresh = false } = {}) => {
    const now = Date.now();
    if (!refresh && cache && now < expiresAt) return cache;
    const settings = sosDefaults();
    let updatedAt = null;
    for (const row of await loadRows()) {
      const def = SOS_SETTING_DEFS[row.setting_key];
      if (!def) continue;
      settings[row.setting_key] = parseSosSetting(def, row.setting_value);
      if (row.updated_at && (!updatedAt || new Date(row.updated_at) > new Date(updatedAt))) updatedAt = row.updated_at;
    }
    cache = { ...settings, _version: VERSION, _updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null };
    expiresAt = now + cacheMs;
    return cache;
  };
  const invalidate = () => { cache = null; expiresAt = 0; };
  const appConfig = async ({ refresh = false, viewer = "patient" } = {}) => {
    const s = await effectiveSettings({ refresh });
    return {
      module: { enabled: s.sos_enabled, testMode: s.sos_test_mode },
      permissions: {
        canCreate: s.sos_enabled,
        canCancel: s.sos_patient_cancel_enabled,
        canClose: viewer === "caregiver" ? s.sos_caregiver_close_enabled : s.sos_patient_cancel_enabled,
        closeCommentRequired: s.sos_require_close_comment
      },
      activation: {
        mode: s.sos_activation_mode,
        requireConfirmation: s.sos_require_activation_confirmation,
        accidentalCancelSeconds: s.sos_accidental_cancel_seconds
      },
      lifecycle: {
        staleAfterMinutes: s.sos_stale_after_minutes,
        autoCloseEnabled: s.sos_auto_close_enabled,
        autoCloseAfterHours: s.sos_auto_close_after_hours
      },
      notifications: {
        inAppEnabled: s.sos_in_app_enabled,
        pushEnabled: s.sos_push_enabled,
        repeatEnabled: s.sos_repeat_notifications,
        repeatIntervalMinutes: s.sos_repeat_interval_minutes,
        maxRepeats: s.sos_max_notification_repeats,
        escalationEnabled: s.sos_escalation_enabled,
        escalationAfterMinutes: s.sos_escalation_after_minutes
      },
      sms: {
        enabled: s.sos_sms_enabled,
        type: s.sos_sms_type,
        createServerFirst: s.sos_sms_create_server_first,
        maxRepeats: s.sos_sms_max_repeats,
        minRepeatIntervalMinutes: s.sos_sms_min_repeat_interval_minutes,
        textKey: "sos.sms.compose_body"
      },
      geolocation: {
        requestCurrent: s.sos_request_current_location,
        useLastKnown: s.sos_use_last_known_location,
        lastKnownMaxAgeMinutes: s.sos_last_location_max_age_minutes,
        updateIntervalSeconds: s.sos_location_update_interval_seconds,
        trackingMaxMinutes: s.sos_location_tracking_max_minutes,
        showMapToCaregiver: s.sos_show_map_to_caregiver
      },
      alarm: {
        patientActivationSound: s.sos_patient_activation_sound,
        caregiverSound: s.sos_caregiver_sound,
        vibrationEnabled: s.sos_vibration_enabled,
        repeatSoundUntilAck: s.sos_repeat_sound_until_ack,
        warnMissingSoundPermission: s.sos_warn_missing_sound_permission,
        allowSoundTestMode: s.sos_allow_sound_test_mode
      },
      history: {
        patientVisible: s.sos_show_history_patient,
        caregiverVisible: s.sos_show_history_caregiver
      },
      ui: {
        showPatientCard: s.sos_show_patient_card,
        showFamilyCard: s.sos_show_family_card,
        cardDisplayPriority: s.sos_card_display_priority,
        labels: {
          disabled: "sos.config.disabled",
          testMode: "sos.config.test_mode",
          confirmation: "sos.config.confirmation",
          cancelled: "sos.config.cancelled"
        }
      },
      version: s._version,
      updatedAt: s._updatedAt
    };
  };
  return { effectiveSettings, appConfig, invalidate, defaults: sosDefaults, schema: sosSchema, validate: validateSosSettings };
}
