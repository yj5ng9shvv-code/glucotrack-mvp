const API_BASE = `${location.origin}/api/admin`;
const tokenKey = "glukotrack_admin_token";
const csrfKey = "glukotrack_admin_csrf";
const state = {
  token: sessionStorage.getItem(tokenKey) || "",
  csrfToken: sessionStorage.getItem(csrfKey) || "",
  route: "dashboard",
  page: 1,
  q: "",
  lang: localStorage.getItem("gt_admin_lang") || "ru",
  theme: localStorage.getItem("gt_admin_theme") || "light",
  admin: null,
  settingsModule: ""
};

const sections = [
  ["dashboard", "section.dashboard", "dashboard:read"],
  ["users", "section.users", "users:read"],
  ["subscriptions", "section.subscriptions", "subscriptions:read"],
  ["payments", "section.payments", "payments:read"],
  ["devices", "section.devices", "devices:read"],
  ["trials", "section.trials", "subscriptions:read"],
  ["family", "section.familyAccess", "users:read"],
  ["sos", "section.sos", "security:read"],
  ["ai", "section.ai", "audit:read"],
  ["notifications", "section.notifications", "notifications:read"],
  ["referrals", "section.referrals", "referrals:read"],
  ["help", "section.help", "help:read"],
  ["about", "section.about", "about:read"],
  ["localizations", "section.localizations", "localizations:read"],
  ["support", "section.support", "support:write"],
  ["security", "section.security", "security:read"],
  ["errors", "section.errors", "errors:read"],
  ["backups", "section.backups", "backups:read"],
  ["gdpr", "section.gdpr", "gdpr.view"],
  ["versions", "section.versions", "versions:read"],
  ["admins", "section.admins", "admins:write"],
  ["audit", "section.audit", "audit:read"],
  ["login-attempts", "section.loginAttempts", "audit:read"],
  ["settings", "section.settings", "settings:read"]
];


const SETTINGS_MODULES = [
  "gdpr",
  "backup",
  "sos",
  "familyAccess",
  "notifications",
  "notificationProviders",
  "glucose",
  "aiSettings",
  "security",
  "administrators",
  "audit",
  "errors",
  "appVersions",
  "localization",
  "support",
  "integrations"
];

const GDPR_SETTING_FIELDS = [
  {
    key: "gdpr_due_days",
    titleKey: "settings.gdpr.due.title",
    descriptionKey: "settings.gdpr.due.description",
    unitKey: "settings.unit.days",
    hintKey: "settings.gdpr.due.hint",
    validationKey: "settings.validation.positiveInteger"
  },
  {
    key: "gdpr_draft_retention_days",
    titleKey: "settings.gdpr.draftRetention.title",
    descriptionKey: "settings.gdpr.draftRetention.description",
    unitKey: "settings.unit.days",
    hintKey: "settings.gdpr.draftRetention.hint",
    validationKey: "settings.validation.positiveInteger"
  },
  {
    key: "gdpr_export_retention_days",
    titleKey: "settings.gdpr.exportRetention.title",
    descriptionKey: "settings.gdpr.exportRetention.description",
    unitKey: "settings.unit.days",
    hintKey: "settings.gdpr.exportRetention.hint",
    validationKey: "settings.validation.positiveInteger"
  }
];

const SOS_SETTINGS_SECTIONS = [
  { id: "general", fields: ["sos_enabled","sos_test_mode","sos_create_roles","sos_view_roles","sos_cancel_roles","sos_close_roles","sos_audit_actions_enabled"] },
  { id: "card", fields: ["sos_show_patient_card","sos_show_family_card","sos_activation_mode","sos_require_activation_confirmation","sos_accidental_cancel_seconds","sos_card_display_priority"] },
  { id: "lifecycle", fields: ["sos_stale_after_minutes","sos_auto_close_enabled","sos_auto_close_after_hours","sos_require_close_comment","sos_patient_cancel_enabled","sos_caregiver_close_enabled"] },
  { id: "notifications", fields: ["sos_push_enabled","sos_in_app_enabled","sos_caregiver_alarm_sound","sos_repeat_notifications","sos_repeat_interval_minutes","sos_max_notification_repeats","sos_escalation_enabled","sos_escalation_after_minutes"] },
  { id: "sms", fields: ["sos_sms_enabled","sos_sms_type","sos_sms_create_server_first","sos_sms_template","sos_sms_max_repeats","sos_sms_min_repeat_interval_minutes"] },
  { id: "geolocation", fields: ["sos_request_current_location","sos_use_last_known_location","sos_last_location_max_age_minutes","sos_location_update_interval_seconds","sos_location_tracking_max_minutes","sos_show_map_to_caregiver","sos_location_retention_days"] },
  { id: "sound", fields: ["sos_patient_activation_sound","sos_caregiver_sound","sos_vibration_enabled","sos_repeat_sound_until_ack","sos_warn_missing_sound_permission","sos_allow_sound_test_mode"] },
  { id: "safety", fields: ["sos_rate_limit_enabled","sos_rate_limit_count","sos_rate_limit_window_minutes","sos_merge_duplicate_active","sos_duplicate_window_seconds","sos_log_lifecycle_events","sos_log_settings_changes"] },
  { id: "retention", fields: ["sos_event_retention_days","sos_notification_retention_days","sos_coordinate_retention_days","sos_show_history_patient","sos_show_history_caregiver","sos_include_events_in_gdpr_export"] },
  { id: "status", fields: [] }
];

const SOS_SETTING_FIELDS = {
  sos_enabled: { type: "boolean" }, sos_test_mode: { type: "boolean" }, sos_create_roles: { type: "roles" }, sos_view_roles: { type: "roles" }, sos_cancel_roles: { type: "roles" }, sos_close_roles: { type: "roles" }, sos_audit_actions_enabled: { type: "boolean" },
  sos_show_patient_card: { type: "boolean" }, sos_show_family_card: { type: "boolean" }, sos_activation_mode: { type: "enum", options: ["manual","automatic","both"] }, sos_require_activation_confirmation: { type: "boolean" }, sos_accidental_cancel_seconds: { type: "integer", min: 0, max: 300, unit: "seconds" }, sos_card_display_priority: { type: "enum", options: ["normal","high","critical"] },
  sos_stale_after_minutes: { type: "integer", min: 1, max: 10080, unit: "minutes" }, sos_auto_close_enabled: { type: "boolean" }, sos_auto_close_after_hours: { type: "integer", min: 1, max: 168, unit: "hours", dependsOn: "sos_auto_close_enabled" }, sos_require_close_comment: { type: "boolean" }, sos_patient_cancel_enabled: { type: "boolean" }, sos_caregiver_close_enabled: { type: "boolean" },
  sos_push_enabled: { type: "boolean", statusKey: "push" }, sos_in_app_enabled: { type: "boolean" }, sos_caregiver_alarm_sound: { type: "boolean" }, sos_repeat_notifications: { type: "boolean" }, sos_repeat_interval_minutes: { type: "integer", min: 1, max: 1440, unit: "minutes", dependsOn: "sos_repeat_notifications" }, sos_max_notification_repeats: { type: "integer", min: 0, max: 50, dependsOn: "sos_repeat_notifications" }, sos_escalation_enabled: { type: "boolean" }, sos_escalation_after_minutes: { type: "integer", min: 1, max: 1440, unit: "minutes", dependsOn: "sos_escalation_enabled" },
  sos_sms_enabled: { type: "boolean" }, sos_sms_type: { type: "enum", options: ["disabled","system_composer","external_reserved"] }, sos_sms_create_server_first: { type: "boolean" }, sos_sms_template: { type: "text", rows: 4 }, sos_sms_max_repeats: { type: "integer", min: 0, max: 20 }, sos_sms_min_repeat_interval_minutes: { type: "integer", min: 1, max: 1440, unit: "minutes" },
  sos_request_current_location: { type: "boolean" }, sos_use_last_known_location: { type: "boolean" }, sos_last_location_max_age_minutes: { type: "integer", min: 1, max: 10080, unit: "minutes" }, sos_location_update_interval_seconds: { type: "integer", min: 5, max: 3600, unit: "seconds" }, sos_location_tracking_max_minutes: { type: "integer", min: 1, max: 1440, unit: "minutes" }, sos_show_map_to_caregiver: { type: "boolean" }, sos_location_retention_days: { type: "integer", min: 1, max: 3650, unit: "days" },
  sos_patient_activation_sound: { type: "boolean" }, sos_caregiver_sound: { type: "boolean" }, sos_vibration_enabled: { type: "boolean" }, sos_repeat_sound_until_ack: { type: "boolean" }, sos_warn_missing_sound_permission: { type: "boolean" }, sos_allow_sound_test_mode: { type: "boolean" },
  sos_rate_limit_enabled: { type: "boolean" }, sos_rate_limit_count: { type: "integer", min: 1, max: 100, dependsOn: "sos_rate_limit_enabled" }, sos_rate_limit_window_minutes: { type: "integer", min: 1, max: 1440, unit: "minutes", dependsOn: "sos_rate_limit_enabled" }, sos_merge_duplicate_active: { type: "boolean" }, sos_duplicate_window_seconds: { type: "integer", min: 1, max: 3600, unit: "seconds", dependsOn: "sos_merge_duplicate_active" }, sos_log_lifecycle_events: { type: "boolean" }, sos_log_settings_changes: { type: "boolean" },
  sos_event_retention_days: { type: "integer", min: 1, max: 3650, unit: "days" }, sos_notification_retention_days: { type: "integer", min: 1, max: 3650, unit: "days" }, sos_coordinate_retention_days: { type: "integer", min: 1, max: 3650, unit: "days" }, sos_show_history_patient: { type: "boolean" }, sos_show_history_caregiver: { type: "boolean" }, sos_include_events_in_gdpr_export: { type: "boolean" }
};

let sosSettingsState = null;
let sosSettingsSaving = false;
let notificationProviderState = null;
let notificationSettingsState = null;
const NOTIFICATION_SETTINGS_SECTIONS = [
  { id: "channels", fields: ["notifications_enabled","notification_push_enabled","notification_email_enabled","notification_sms_enabled","notification_in_app_enabled"] },
  { id: "rules", fields: ["notification_event_glucose_alert_enabled","notification_event_family_invite_enabled","notification_event_medication_reminder_enabled","notification_event_daily_summary_enabled","notification_event_system_broadcast_enabled"] },
  { id: "priorities", fields: ["notification_priority_glucose_alert","notification_priority_family_invite","notification_priority_medication_reminder","notification_priority_daily_summary","notification_priority_system_broadcast"] },
  { id: "limits", fields: ["notification_rate_limit_per_minute","notification_rate_limit_per_hour","notification_rate_limit_per_day"] },
  { id: "defaults", fields: ["notification_default_push","notification_default_email","notification_default_sms","notification_default_in_app"] }
];
const NOTIFICATION_SETTING_FIELDS = {
  notifications_enabled: { type: "boolean" },
  notification_push_enabled: { type: "boolean" },
  notification_email_enabled: { type: "boolean" },
  notification_sms_enabled: { type: "boolean" },
  notification_in_app_enabled: { type: "boolean" },
  notification_event_glucose_alert_enabled: { type: "boolean" },
  notification_event_family_invite_enabled: { type: "boolean" },
  notification_event_medication_reminder_enabled: { type: "boolean" },
  notification_event_daily_summary_enabled: { type: "boolean" },
  notification_event_system_broadcast_enabled: { type: "boolean" },
  notification_priority_glucose_alert: { type: "enum", options: ["low","normal","high","critical"] },
  notification_priority_family_invite: { type: "enum", options: ["low","normal","high","critical"] },
  notification_priority_medication_reminder: { type: "enum", options: ["low","normal","high","critical"] },
  notification_priority_daily_summary: { type: "enum", options: ["low","normal","high","critical"] },
  notification_priority_system_broadcast: { type: "enum", options: ["low","normal","high","critical"] },
  notification_rate_limit_per_minute: { type: "integer", min: 1, max: 120 },
  notification_rate_limit_per_hour: { type: "integer", min: 1, max: 1000 },
  notification_rate_limit_per_day: { type: "integer", min: 1, max: 10000 },
  notification_default_push: { type: "boolean" },
  notification_default_email: { type: "boolean" },
  notification_default_sms: { type: "boolean" },
  notification_default_in_app: { type: "boolean" }
};
const SOS_APP_USED_FIELDS = new Set([
  "sos_enabled","sos_test_mode","sos_show_patient_card","sos_show_family_card","sos_activation_mode",
  "sos_require_activation_confirmation","sos_accidental_cancel_seconds","sos_stale_after_minutes",
  "sos_patient_cancel_enabled","sos_sms_enabled","sos_sms_type","sos_sms_create_server_first","sos_request_current_location",
  "sos_patient_activation_sound","sos_vibration_enabled","sos_show_history_patient","sos_show_history_caregiver"
]);
const SOS_WORKER_FIELDS = new Set(["sos_push_enabled","sos_in_app_enabled","sos_repeat_notifications","sos_repeat_interval_minutes","sos_max_notification_repeats","sos_escalation_enabled","sos_escalation_after_minutes","sos_caregiver_alarm_sound","sos_repeat_sound_until_ack"]);
const SOS_PROVIDER_FIELDS = new Set(["sos_sms_max_repeats","sos_sms_min_repeat_interval_minutes"]);
const SOS_BACKEND_FIELDS = new Set(["sos_create_roles","sos_view_roles","sos_cancel_roles","sos_close_roles","sos_audit_actions_enabled","sos_auto_close_enabled","sos_auto_close_after_hours","sos_require_close_comment","sos_caregiver_close_enabled","sos_rate_limit_enabled","sos_rate_limit_count","sos_rate_limit_window_minutes","sos_merge_duplicate_active","sos_duplicate_window_seconds","sos_log_lifecycle_events","sos_log_settings_changes","sos_event_retention_days","sos_notification_retention_days","sos_coordinate_retention_days","sos_include_events_in_gdpr_export","sos_location_retention_days","sos_use_last_known_location","sos_last_location_max_age_minutes","sos_location_update_interval_seconds","sos_location_tracking_max_minutes","sos_show_map_to_caregiver","sos_warn_missing_sound_permission","sos_allow_sound_test_mode"]);

const BACKUP_SETTINGS_SECTIONS = [
  { id: "general", fields: ["backup_enabled","backup_manual_enabled","backup_auto_enabled","backup_prevent_parallel","backup_max_duration_minutes","backup_min_free_mb"] },
  { id: "schedule", fields: ["backup_schedule_frequency","backup_schedule_days","backup_schedule_time","backup_schedule_timezone"] },
  { id: "components", fields: ["backup_include_database","backup_include_frontend","backup_include_backend","backup_include_configs","backup_include_uploads","backup_include_nginx","backup_include_systemd","backup_include_env"] },
  { id: "retention", fields: ["backup_retention_daily","backup_retention_weekly","backup_retention_monthly","backup_retention_max_age_days","backup_retention_max_total_mb","backup_retention_warn_at_percent","backup_cleanup_dry_run_enabled"] },
  { id: "notifications", fields: ["backup_notify_completed","backup_notify_failed","backup_notify_low_space","backup_notify_retention_warning","backup_notify_cleanup_plan","backup_notify_cleanup_completed","backup_notify_cleanup_failed"] },
  { id: "permissions", fields: ["backup_manage_roles"] }
];
const BACKUP_SETTING_FIELDS = {
  backup_enabled: { type: "boolean" }, backup_manual_enabled: { type: "boolean" }, backup_auto_enabled: { type: "boolean" }, backup_prevent_parallel: { type: "boolean" }, backup_max_duration_minutes: { type: "integer", min: 5, max: 1440, unit: "minutes" }, backup_min_free_mb: { type: "integer", min: 50, max: 1048576, unit: "mb" },
  backup_schedule_frequency: { type: "enum", options: ["daily","weekly","monthly"] }, backup_schedule_days: { type: "days", options: ["mon","tue","wed","thu","fri","sat","sun"] }, backup_schedule_time: { type: "time" }, backup_schedule_timezone: { type: "enum", options: ["UTC","Europe/Warsaw","Europe/Kyiv","Europe/Berlin"] },
  backup_include_database: { type: "boolean" }, backup_include_frontend: { type: "boolean" }, backup_include_backend: { type: "boolean" }, backup_include_configs: { type: "boolean" }, backup_include_uploads: { type: "boolean" }, backup_include_nginx: { type: "boolean" }, backup_include_systemd: { type: "boolean" }, backup_include_env: { type: "boolean", warning: true },
  backup_retention_daily: { type: "integer", min: 1, max: 365 }, backup_retention_weekly: { type: "integer", min: 1, max: 260 }, backup_retention_monthly: { type: "integer", min: 1, max: 120 }, backup_retention_max_age_days: { type: "integer", min: 1, max: 3650, unit: "days" }, backup_retention_max_total_mb: { type: "integer", min: 100, max: 1048576, unit: "mb" }, backup_retention_warn_at_percent: { type: "integer", min: 50, max: 100, unit: "percent" }, backup_cleanup_dry_run_enabled: { type: "boolean" },
  backup_notify_completed: { type: "boolean" }, backup_notify_failed: { type: "boolean" }, backup_notify_low_space: { type: "boolean" }, backup_notify_retention_warning: { type: "boolean" }, backup_notify_cleanup_plan: { type: "boolean" }, backup_notify_cleanup_completed: { type: "boolean" }, backup_notify_cleanup_failed: { type: "boolean" },
  backup_manage_roles: { type: "roles", options: ["super_admin","security_auditor"] }
};
let backupSettingsState = null;

const AI_FEATURES = ["basic_text","medication","lab_analysis","photo_food","photo_document","doctor_report"];
const AI_PLANS = ["free","basic","premium","family"];
const AI_COUNTERS = ["normal","photo"];
let aiSettingsState = null;

const dictionaries = {
  ru: {
    adminPanel: "Админ-панель",
    secureAdmin: "Безопасный вход администратора",
    email: "Email",
    password: "Пароль",
    twoFactorCode: "Код 2FA",
    signIn: "Войти",
    logout: "Выйти",
    search: "Поиск",
    loading: "Загрузка...",
    empty: "Нет данных",
    forbidden: "Нет прав для этого раздела",
    sessionExpired: "Сессия истекла. Войдите снова.",
    invalidLogin: "Неверный email или пароль",
    requestFailed: "Не удалось выполнить запрос",
    total: "Всего",
    page: "Страница",
    previous: "Назад",
    next: "Вперёд",
    recentUsers: "Недавние пользователи",
    revokeSessions: "Завершить сессии",
    confirmRevoke: "Завершить все сессии пользователя?",
    success: "Готово",
    details: "Детали",
    createdAt: "Создано",
    create: "Создать",
    export: "Экспорт CSV",
    save: "Сохранить",
    createAdmin: "Создать администратора",
    createTicket: "Создать обращение",
    createCampaign: "Создать кампанию",
    createSetting: "Создать настройку",
    edit: "Изменить",
    gdprSettingsTitle: "GDPR-настройки",
    gdprSettingInvalid: "Введите целое положительное число",
    gdprDraftRetentionName: "Срок хранения черновиков",
    gdprDraftRetentionDescription: "Черновики GDPR-запросов отменяются после указанного числа дней.",
    gdprDueDaysName: "Срок выполнения GDPR-запроса",
    gdprDueDaysDescription: "Новый GDPR-запрос получает срок выполнения через указанное число дней.",
    gdprExportRetentionName: "Срок хранения export ZIP",
    gdprExportRetentionDescription: "Файлы экспорта GDPR доступны до истечения указанного числа дней.",
    settingsCenterTitle: "Центр настроек модулей",
    settingsCenterDescription: "Выберите модуль, чтобы открыть его настройки.",
    settingsBackToModules: "К модулям",
    settingsOpenModule: "Открыть",
    settingsSearchLabel: "Поиск по модулям",
    settingsNoModulesFound: "Модули не найдены",
    cancel: "Отмена",
    "settings.resetDefaults": "Сбросить по умолчанию",
    "settings.unit.seconds": "секунд",
    "settings.unit.minutes": "минут",
    "settings.unit.hours": "часов",
    "settings.sos.testModeBanner": "Тестовый режим включён: реальные внешние отправки не выполняются.",
    "settings.sos.unsaved": "Есть несохранённые изменения",
    "settings.sos.saved": "SOS-настройки сохранены",
    "settings.sos.resetConfirm": "Сбросить только SOS-настройки по умолчанию?",
    "settings.sos.resetDone": "SOS-настройки сброшены",
    "settings.sos.validation.integer": "Введите целое число в допустимом диапазоне",
    "settings.sos.validation.autoClose": "Для автозакрытия укажите корректный срок",
    "settings.sos.statusDisclaimer": "GlucoTrack SOS отправляет тревожное уведомление по доступным настроенным каналам и не вызывает государственные экстренные службы.",
    "settings.sos.status.push.title": "Push",
    "settings.sos.status.smsExternalProvider.title": "Внешний SMS-провайдер",
    "settings.sos.status.not_configured": "Не настроено",
    "settings.sos.status.reserved_not_configured": "Зарезервировано / не настроено",
    settingsCurrentValue: "Текущее значение",
    settingsUnit: "Единица",
    settingsModulePlaceholder: "Настройки этого модуля будут добавлены позже",
    settingsSaveError: "Не удалось сохранить настройку",
    "settings.unit.days": "дней",
    "settings.validation.positiveInteger": "Введите целое положительное число",
    "settings.module.gdpr.title": "GDPR",
    "settings.module.gdpr.description": "Сроки обработки запросов, хранения черновиков и экспортов данных.",
    "settings.module.backup.title": "Backup",
    "settings.module.backup.description": "Параметры резервного копирования базы и файлов.",
    "settings.module.sos.title": "SOS",
    "settings.module.sos.description": "Параметры экстренных сценариев и сигналов тревоги.",
    "settings.module.familyAccess.title": "Family Access",
    "settings.module.familyAccess.description": "Настройки доступа доверенных контактов и семьи.",
    "settings.module.notifications.title": "Notifications",
    "settings.module.notifications.description": "Настройки каналов и правил уведомлений.",
    "settings.notifications.section.channels": "Каналы",
    "settings.notifications.section.channels.description": "Глобальное включение и доступные каналы доставки.",
    "settings.notifications.section.rules": "Правила событий",
    "settings.notifications.section.rules.description": "Типы событий, которые могут создавать уведомления.",
    "settings.notifications.section.priorities": "Приоритеты",
    "settings.notifications.section.priorities.description": "Приоритет обработки для каждого типа события.",
    "settings.notifications.section.limits": "Ограничения частоты",
    "settings.notifications.section.limits.description": "Серверные лимиты отправки уведомлений.",
    "settings.notifications.section.defaults": "Настройки пользователя по умолчанию",
    "settings.notifications.section.defaults.description": "Каналы, включённые для нового пользователя по умолчанию.",
    "settings.notifications.campaigns": "Последние уведомления",
    "settings.notifications.campaignsDescription": "Последние кампании из существующего модуля уведомлений.",
    "settings.notifications.auditNotice": "Изменения сохраняются в системных настройках и журнале аудита.",
    "settings.notifications.saved": "Настройки Notifications сохранены",
    "settings.notifications.validation.integer": "Введите целое число в допустимом диапазоне",
    "settings.notifications.option.low": "Низкий",
    "settings.notifications.option.normal": "Обычный",
    "settings.notifications.option.high": "Высокий",
    "settings.notifications.option.critical": "Критический",
    "settings.notifications.field.notifications_enabled": "Notifications включены",
    "settings.notifications.hint.notifications_enabled": "Полностью включает или отключает общий модуль уведомлений.",
    "settings.notifications.field.notification_push_enabled": "Push уведомления",
    "settings.notifications.hint.notification_push_enabled": "Разрешает отправку push через настроенные провайдеры.",
    "settings.notifications.field.notification_email_enabled": "Email уведомления",
    "settings.notifications.hint.notification_email_enabled": "Разрешает отправку уведомлений по email.",
    "settings.notifications.field.notification_sms_enabled": "SMS уведомления",
    "settings.notifications.hint.notification_sms_enabled": "Разрешает SMS, если провайдер настроен в Notification Providers.",
    "settings.notifications.field.notification_in_app_enabled": "Системные уведомления",
    "settings.notifications.hint.notification_in_app_enabled": "Показывает уведомления внутри приложения.",
    "settings.notifications.field.notification_event_glucose_alert_enabled": "Событие: предупреждение глюкозы",
    "settings.notifications.hint.notification_event_glucose_alert_enabled": "Разрешает уведомления о критичных значениях глюкозы.",
    "settings.notifications.field.notification_event_family_invite_enabled": "Событие: семейное приглашение",
    "settings.notifications.hint.notification_event_family_invite_enabled": "Разрешает уведомления о приглашениях Family Access.",
    "settings.notifications.field.notification_event_medication_reminder_enabled": "Событие: напоминание о лекарствах",
    "settings.notifications.hint.notification_event_medication_reminder_enabled": "Разрешает уведомления о приёме лекарств.",
    "settings.notifications.field.notification_event_daily_summary_enabled": "Событие: ежедневная сводка",
    "settings.notifications.hint.notification_event_daily_summary_enabled": "Разрешает ежедневные сводные уведомления.",
    "settings.notifications.field.notification_event_system_broadcast_enabled": "Событие: системная рассылка",
    "settings.notifications.hint.notification_event_system_broadcast_enabled": "Разрешает административные системные сообщения.",
    "settings.notifications.field.notification_priority_glucose_alert": "Приоритет предупреждений глюкозы",
    "settings.notifications.hint.notification_priority_glucose_alert": "Используется при обработке очереди уведомлений.",
    "settings.notifications.field.notification_priority_family_invite": "Приоритет семейных приглашений",
    "settings.notifications.hint.notification_priority_family_invite": "Используется при обработке очереди уведомлений.",
    "settings.notifications.field.notification_priority_medication_reminder": "Приоритет напоминаний о лекарствах",
    "settings.notifications.hint.notification_priority_medication_reminder": "Используется при обработке очереди уведомлений.",
    "settings.notifications.field.notification_priority_daily_summary": "Приоритет ежедневной сводки",
    "settings.notifications.hint.notification_priority_daily_summary": "Используется при обработке очереди уведомлений.",
    "settings.notifications.field.notification_priority_system_broadcast": "Приоритет системной рассылки",
    "settings.notifications.hint.notification_priority_system_broadcast": "Используется при обработке очереди уведомлений.",
    "settings.notifications.field.notification_rate_limit_per_minute": "Лимит в минуту",
    "settings.notifications.hint.notification_rate_limit_per_minute": "Максимум уведомлений в минуту.",
    "settings.notifications.field.notification_rate_limit_per_hour": "Лимит в час",
    "settings.notifications.hint.notification_rate_limit_per_hour": "Максимум уведомлений в час.",
    "settings.notifications.field.notification_rate_limit_per_day": "Лимит в день",
    "settings.notifications.hint.notification_rate_limit_per_day": "Максимум уведомлений в день.",
    "settings.notifications.field.notification_default_push": "Push по умолчанию",
    "settings.notifications.hint.notification_default_push": "Включать push для новых пользовательских настроек.",
    "settings.notifications.field.notification_default_email": "Email по умолчанию",
    "settings.notifications.hint.notification_default_email": "Включать email для новых пользовательских настроек.",
    "settings.notifications.field.notification_default_sms": "SMS по умолчанию",
    "settings.notifications.hint.notification_default_sms": "Включать SMS для новых пользовательских настроек.",
    "settings.notifications.field.notification_default_in_app": "Системные по умолчанию",
    "settings.notifications.hint.notification_default_in_app": "Включать уведомления внутри приложения по умолчанию.",
    "settings.module.glucose.title": "Glucose",
    "settings.module.glucose.description": "Настройки порогов и отображения глюкозы.",
    "settings.module.aiSettings.title": "AI Settings",
    "settings.module.aiSettings.description": "Управление AI-функциями, моделями, fallback и пользовательскими лимитами.",
    "settings.module.security.title": "Security",
    "settings.module.security.description": "Настройки безопасности и политик доступа.",
    "settings.module.administrators.title": "Administrators",
    "settings.module.administrators.description": "Настройки администраторов и ролей.",
    "settings.module.audit.title": "Audit",
    "settings.module.audit.description": "Настройки журналирования действий.",
    "settings.module.errors.title": "Errors",
    "settings.module.errors.description": "Настройки сбора и хранения ошибок.",
    "settings.module.appVersions.title": "App Versions",
    "settings.module.appVersions.description": "Настройки версий приложений и политик обновления.",
    "settings.module.localization.title": "Localization",
    "settings.module.localization.description": "Настройки языков и переводов.",
    "settings.module.support.title": "Support",
    "settings.module.support.description": "Настройки обращений и поддержки пользователей.",
    "settings.module.integrations.title": "Integrations",
    "settings.module.integrations.description": "Настройки внешних сервисов и интеграций.",
    "settings.gdpr.due.title": "Срок выполнения GDPR-заявки",
    "settings.gdpr.due.description": "Сколько дней даётся на обработку новой GDPR-заявки.",
    "settings.gdpr.due.hint": "Используется при расчёте due date для новых заявок.",
    "settings.gdpr.draftRetention.title": "Срок хранения черновиков",
    "settings.gdpr.draftRetention.description": "Сколько дней сохраняются черновики GDPR-запросов.",
    "settings.gdpr.draftRetention.hint": "Просроченные черновики автоматически отменяются.",
    "settings.gdpr.exportRetention.title": "Срок хранения export ZIP",
    "settings.gdpr.exportRetention.description": "Сколько дней хранится файл экспорта данных.",
    "settings.gdpr.exportRetention.hint": "Просроченные ZIP-файлы удаляются из защищённого каталога.",
    "settings.sos.section.general.title": "Основные настройки",
    "settings.sos.section.general.description": "Настройки раздела SOS.",
    "settings.sos.section.card.title": "Карточка SOS",
    "settings.sos.section.card.description": "Настройки раздела SOS.",
    "settings.sos.section.lifecycle.title": "Жизненный цикл",
    "settings.sos.section.lifecycle.description": "Настройки раздела SOS.",
    "settings.sos.section.notifications.title": "Уведомления",
    "settings.sos.section.notifications.description": "Настройки раздела SOS.",
    "settings.sos.section.sms.title": "SMS-сценарий",
    "settings.sos.section.sms.description": "Настройки раздела SOS.",
    "settings.sos.section.geolocation.title": "Геолокация",
    "settings.sos.section.geolocation.description": "Настройки раздела SOS.",
    "settings.sos.section.sound.title": "Звук и тревога",
    "settings.sos.section.sound.description": "Настройки раздела SOS.",
    "settings.sos.section.safety.title": "Безопасность",
    "settings.sos.section.safety.description": "Настройки раздела SOS.",
    "settings.sos.section.retention.title": "История и хранение",
    "settings.sos.section.retention.description": "Настройки раздела SOS.",
    "settings.sos.section.status.title": "Статусы каналов",
    "settings.sos.section.status.description": "Настройки раздела SOS.",
    "settings.sos.field.sos_enabled.title": "SOS включён",
    "settings.sos.field.sos_enabled.description": "SOS включён.",
    "settings.sos.field.sos_enabled.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_test_mode.title": "Тестовый режим",
    "settings.sos.field.sos_test_mode.description": "Тестовый режим.",
    "settings.sos.field.sos_test_mode.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_create_roles.title": "Кто может создавать SOS",
    "settings.sos.field.sos_create_roles.description": "Кто может создавать SOS.",
    "settings.sos.field.sos_create_roles.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_view_roles.title": "Кто может видеть SOS",
    "settings.sos.field.sos_view_roles.description": "Кто может видеть SOS.",
    "settings.sos.field.sos_view_roles.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_cancel_roles.title": "Кто может отменять SOS",
    "settings.sos.field.sos_cancel_roles.description": "Кто может отменять SOS.",
    "settings.sos.field.sos_cancel_roles.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_close_roles.title": "Кто может закрывать SOS",
    "settings.sos.field.sos_close_roles.description": "Кто может закрывать SOS.",
    "settings.sos.field.sos_close_roles.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_audit_actions_enabled.title": "Аудит SOS-действий",
    "settings.sos.field.sos_audit_actions_enabled.description": "Аудит SOS-действий.",
    "settings.sos.field.sos_audit_actions_enabled.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_show_patient_card.title": "Показывать SOS пациенту",
    "settings.sos.field.sos_show_patient_card.description": "Показывать SOS пациенту.",
    "settings.sos.field.sos_show_patient_card.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_show_family_card.title": "Показывать SOS в Family Access",
    "settings.sos.field.sos_show_family_card.description": "Показывать SOS в Family Access.",
    "settings.sos.field.sos_show_family_card.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_activation_mode.title": "Способ активации",
    "settings.sos.field.sos_activation_mode.description": "Способ активации.",
    "settings.sos.field.sos_activation_mode.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_require_activation_confirmation.title": "Требовать подтверждение активации",
    "settings.sos.field.sos_require_activation_confirmation.description": "Требовать подтверждение активации.",
    "settings.sos.field.sos_require_activation_confirmation.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_accidental_cancel_seconds.title": "Время отмены случайного запуска",
    "settings.sos.field.sos_accidental_cancel_seconds.description": "Время отмены случайного запуска.",
    "settings.sos.field.sos_accidental_cancel_seconds.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_card_display_priority.title": "Приоритет отображения карточки",
    "settings.sos.field.sos_card_display_priority.description": "Приоритет отображения карточки.",
    "settings.sos.field.sos_card_display_priority.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_stale_after_minutes.title": "Когда SOS устаревает",
    "settings.sos.field.sos_stale_after_minutes.description": "Когда SOS устаревает.",
    "settings.sos.field.sos_stale_after_minutes.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_auto_close_enabled.title": "Автозакрытие включено",
    "settings.sos.field.sos_auto_close_enabled.description": "Автозакрытие включено.",
    "settings.sos.field.sos_auto_close_enabled.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_auto_close_after_hours.title": "Через сколько часов закрывать",
    "settings.sos.field.sos_auto_close_after_hours.description": "Через сколько часов закрывать.",
    "settings.sos.field.sos_auto_close_after_hours.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_require_close_comment.title": "Требовать комментарий при закрытии",
    "settings.sos.field.sos_require_close_comment.description": "Требовать комментарий при закрытии.",
    "settings.sos.field.sos_require_close_comment.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_patient_cancel_enabled.title": "Разрешить отмену пациентом",
    "settings.sos.field.sos_patient_cancel_enabled.description": "Разрешить отмену пациентом.",
    "settings.sos.field.sos_patient_cancel_enabled.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_caregiver_close_enabled.title": "Разрешить закрытие опекуном",
    "settings.sos.field.sos_caregiver_close_enabled.description": "Разрешить закрытие опекуном.",
    "settings.sos.field.sos_caregiver_close_enabled.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_push_enabled.title": "Push включён",
    "settings.sos.field.sos_push_enabled.description": "Push включён.",
    "settings.sos.field.sos_push_enabled.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_in_app_enabled.title": "In-app уведомления",
    "settings.sos.field.sos_in_app_enabled.description": "In-app уведомления.",
    "settings.sos.field.sos_in_app_enabled.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_caregiver_alarm_sound.title": "Звук тревоги у опекуна",
    "settings.sos.field.sos_caregiver_alarm_sound.description": "Звук тревоги у опекуна.",
    "settings.sos.field.sos_caregiver_alarm_sound.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_repeat_notifications.title": "Повторять уведомления",
    "settings.sos.field.sos_repeat_notifications.description": "Повторять уведомления.",
    "settings.sos.field.sos_repeat_notifications.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_repeat_interval_minutes.title": "Интервал повторов",
    "settings.sos.field.sos_repeat_interval_minutes.description": "Интервал повторов.",
    "settings.sos.field.sos_repeat_interval_minutes.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_max_notification_repeats.title": "Максимум повторов",
    "settings.sos.field.sos_max_notification_repeats.description": "Максимум повторов.",
    "settings.sos.field.sos_max_notification_repeats.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_escalation_enabled.title": "Эскалация включена",
    "settings.sos.field.sos_escalation_enabled.description": "Эскалация включена.",
    "settings.sos.field.sos_escalation_enabled.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_escalation_after_minutes.title": "Эскалация через",
    "settings.sos.field.sos_escalation_after_minutes.description": "Эскалация через.",
    "settings.sos.field.sos_escalation_after_minutes.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_sms_enabled.title": "SMS включён",
    "settings.sos.field.sos_sms_enabled.description": "SMS включён.",
    "settings.sos.field.sos_sms_enabled.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_sms_type.title": "Тип SMS",
    "settings.sos.field.sos_sms_type.description": "Тип SMS.",
    "settings.sos.field.sos_sms_type.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_sms_create_server_first.title": "Сначала создать SOS на сервере",
    "settings.sos.field.sos_sms_create_server_first.description": "Сначала создать SOS на сервере.",
    "settings.sos.field.sos_sms_create_server_first.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_sms_template.title": "Шаблон SMS",
    "settings.sos.field.sos_sms_template.description": "Шаблон SMS.",
    "settings.sos.field.sos_sms_template.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_sms_max_repeats.title": "Максимум SMS-повторов",
    "settings.sos.field.sos_sms_max_repeats.description": "Максимум SMS-повторов.",
    "settings.sos.field.sos_sms_max_repeats.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_sms_min_repeat_interval_minutes.title": "Минимальный интервал SMS",
    "settings.sos.field.sos_sms_min_repeat_interval_minutes.description": "Минимальный интервал SMS.",
    "settings.sos.field.sos_sms_min_repeat_interval_minutes.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_request_current_location.title": "Запрашивать текущую геолокацию",
    "settings.sos.field.sos_request_current_location.description": "Запрашивать текущую геолокацию.",
    "settings.sos.field.sos_request_current_location.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_use_last_known_location.title": "Использовать последнюю координату",
    "settings.sos.field.sos_use_last_known_location.description": "Использовать последнюю координату.",
    "settings.sos.field.sos_use_last_known_location.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_last_location_max_age_minutes.title": "Возраст последней координаты",
    "settings.sos.field.sos_last_location_max_age_minutes.description": "Возраст последней координаты.",
    "settings.sos.field.sos_last_location_max_age_minutes.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_location_update_interval_seconds.title": "Интервал обновления координат",
    "settings.sos.field.sos_location_update_interval_seconds.description": "Интервал обновления координат.",
    "settings.sos.field.sos_location_update_interval_seconds.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_location_tracking_max_minutes.title": "Максимальное отслеживание",
    "settings.sos.field.sos_location_tracking_max_minutes.description": "Максимальное отслеживание.",
    "settings.sos.field.sos_location_tracking_max_minutes.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_show_map_to_caregiver.title": "Показывать карту опекуну",
    "settings.sos.field.sos_show_map_to_caregiver.description": "Показывать карту опекуну.",
    "settings.sos.field.sos_show_map_to_caregiver.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_location_retention_days.title": "Срок хранения координат",
    "settings.sos.field.sos_location_retention_days.description": "Срок хранения координат.",
    "settings.sos.field.sos_location_retention_days.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_patient_activation_sound.title": "Звук у пациента",
    "settings.sos.field.sos_patient_activation_sound.description": "Звук у пациента.",
    "settings.sos.field.sos_patient_activation_sound.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_caregiver_sound.title": "Звук у опекуна",
    "settings.sos.field.sos_caregiver_sound.description": "Звук у опекуна.",
    "settings.sos.field.sos_caregiver_sound.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_vibration_enabled.title": "Вибрация",
    "settings.sos.field.sos_vibration_enabled.description": "Вибрация.",
    "settings.sos.field.sos_vibration_enabled.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_repeat_sound_until_ack.title": "Повторять звук до принятия",
    "settings.sos.field.sos_repeat_sound_until_ack.description": "Повторять звук до принятия.",
    "settings.sos.field.sos_repeat_sound_until_ack.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_warn_missing_sound_permission.title": "Предупреждать о разрешениях",
    "settings.sos.field.sos_warn_missing_sound_permission.description": "Предупреждать о разрешениях.",
    "settings.sos.field.sos_warn_missing_sound_permission.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_allow_sound_test_mode.title": "Проверка звука в тестовом режиме",
    "settings.sos.field.sos_allow_sound_test_mode.description": "Проверка звука в тестовом режиме.",
    "settings.sos.field.sos_allow_sound_test_mode.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_rate_limit_enabled.title": "Ограничение частоты",
    "settings.sos.field.sos_rate_limit_enabled.description": "Ограничение частоты.",
    "settings.sos.field.sos_rate_limit_enabled.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_rate_limit_count.title": "Количество SOS за период",
    "settings.sos.field.sos_rate_limit_count.description": "Количество SOS за период.",
    "settings.sos.field.sos_rate_limit_count.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_rate_limit_window_minutes.title": "Окно ограничения",
    "settings.sos.field.sos_rate_limit_window_minutes.description": "Окно ограничения.",
    "settings.sos.field.sos_rate_limit_window_minutes.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_merge_duplicate_active.title": "Объединять дубликаты",
    "settings.sos.field.sos_merge_duplicate_active.description": "Объединять дубликаты.",
    "settings.sos.field.sos_merge_duplicate_active.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_duplicate_window_seconds.title": "Окно дубликата",
    "settings.sos.field.sos_duplicate_window_seconds.description": "Окно дубликата.",
    "settings.sos.field.sos_duplicate_window_seconds.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_log_lifecycle_events.title": "Логировать жизненный цикл",
    "settings.sos.field.sos_log_lifecycle_events.description": "Логировать жизненный цикл.",
    "settings.sos.field.sos_log_lifecycle_events.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_log_settings_changes.title": "Логировать изменения настроек",
    "settings.sos.field.sos_log_settings_changes.description": "Логировать изменения настроек.",
    "settings.sos.field.sos_log_settings_changes.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_event_retention_days.title": "Срок хранения SOS-событий",
    "settings.sos.field.sos_event_retention_days.description": "Срок хранения SOS-событий.",
    "settings.sos.field.sos_event_retention_days.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_notification_retention_days.title": "Срок хранения уведомлений",
    "settings.sos.field.sos_notification_retention_days.description": "Срок хранения уведомлений.",
    "settings.sos.field.sos_notification_retention_days.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_coordinate_retention_days.title": "Срок хранения координат",
    "settings.sos.field.sos_coordinate_retention_days.description": "Срок хранения координат.",
    "settings.sos.field.sos_coordinate_retention_days.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_show_history_patient.title": "История пациенту",
    "settings.sos.field.sos_show_history_patient.description": "История пациенту.",
    "settings.sos.field.sos_show_history_patient.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_show_history_caregiver.title": "История опекуну",
    "settings.sos.field.sos_show_history_caregiver.description": "История опекуну.",
    "settings.sos.field.sos_show_history_caregiver.hint": "Используется существующим SOS-модулем.",
    "settings.sos.field.sos_include_events_in_gdpr_export.title": "Включать SOS в GDPR export",
    "settings.sos.field.sos_include_events_in_gdpr_export.description": "Включать SOS в GDPR export.",
    "settings.sos.field.sos_include_events_in_gdpr_export.hint": "Используется существующим SOS-модулем.",
    "settings.sos.role.super_admin": "Super Admin",
    "settings.sos.role.support": "Поддержка",
    "settings.sos.role.medical_data_reviewer": "Медицинский ревьюер",
    "settings.sos.role.security_auditor": "Аудитор безопасности",
    "settings.sos.option.manual": "Вручную",
    "settings.sos.option.automatic": "Автоматически",
    "settings.sos.option.both": "Оба варианта",
    "settings.sos.option.normal": "Обычный",
    "settings.sos.option.high": "Высокий",
    "settings.sos.option.critical": "Критический",
    "settings.sos.option.disabled": "Отключено",
    "settings.sos.option.system_composer": "Системный SMS-композер",
    "settings.sos.option.external_reserved": "Внешний провайдер зарезервирован",
    createLocalization: "Создать локализацию",
    editAdmin: "Изменить администратора",
    reset2fa: "Сбросить 2FA",
    block: "Заблокировать",
    unblock: "Разблокировать",
    verifyEmail: "Подтвердить email",
    extendSubscription: "Продлить подписку",
    extendSubscriptionTitle: "Продление подписки",
    plan: "Тариф",
    days: "Дней",
    daysLeft: "осталось {days} дн.",
    expiresToday: "истекает сегодня",
    expired: "истёк",
    noExpiry: "без срока",
    noMembers: "нет участников",
    subscriptionExtended: "Подписка продлена",
    medicalData: "Анонимизированные медданные",
    blockReason: "Причина блокировки аккаунта",
    unblockConfirm: "Разблокировать аккаунт?",
    verifyEmailConfirm: "Отметить email подтверждённым?",
    medicalReason: "Причина доступа к медицинским данным",
    medicalProfile: "Профиль",
    medicalMetrics: "Показатели",
    medicalEmergency: "SOS и лечение",
    medicalDiary: "Последние записи",
    currentGlucose: "Текущая глюкоза",
    targetGlucose: "Целевая глюкоза",
    diabetesType: "Тип диабета",
    age: "Возраст",
    weight: "Вес",
    height: "Рост",
    language: "Язык",
    phone: "Телефон",
    contact: "Контакт",
    bloodType: "Группа крови",
    insulin: "Инсулин",
    medications: "Лекарства",
    diagnoses: "Диагнозы",
    instructions: "Инструкции",
    noEntries: "Записей нет",
    displayName: "Отображаемое имя",
    roles: "Роли",
    directPermissions: "Прямые права",
    active: "Активен",
    ticket: "Обращение",
    status: "Статус",
    priority: "Приоритет",
    message: "Сообщение",
    replyMessage: "Ответ пользователю",
    saveAndSend: "Сохранить и отправить",
    replySent: "Ответ отправлен",
    deleteTicket: "Удалить письмо",
    deleteTicketConfirm: "Удалить это письмо из поддержки?",
    deleteError: "Удалить",
    deleteErrorConfirm: "Удалить эту запись об ошибке?",
    errorDeleted: "Запись об ошибке удалена",
    errorNotFound: "Запись об ошибке не найдена",
    userId: "ID пользователя",
    subject: "Тема",
    title: "Заголовок",
    body: "Текст",
    locale: "Язык",
    key: "Ключ",
    jsonValue: "JSON значение",
    jsonPayload: "JSON payload",
    version: "Версия",
    backupTitle: "Backup базы данных",
    backupText: "Будет создан серверный дамп MySQL, результат появится в истории backup.",
    gdprType: "Тип",
    gdprAssignMe: "Назначить мне",
    gdprSaveStatus: "Сохранить статус",
    gdprAddComment: "Добавить комментарий",
    gdprVerifyIdentity: "Подтвердить личность",
    gdprGenerateExport: "Создать экспорт",
    gdprDeleteAccount: "Удалить аккаунт",
    gdprExportFiles: "Файлы экспорта",
    gdprAuditTrail: "История аудита",
    gdprDataActions: "Действия с данными",
    gdprUser: "Пользователь",
    gdprIdentity: "Личность",
    gdprNotVerified: "не подтверждена",
    gdprRequest: "Запрос",
    gdprVisibility: "Видимость",
    gdprInternal: "внутренний",
    gdprUserVisible: "пользователю",
    gdprJobs: "Задачи экспорта",
    gdprAnonymize: "Анонимизировать",
    gdprComplete: "Завершить",
    gdprPreviewErasure: "Предпросмотр удаления",
    gdprRestrict: "Ограничить обработку",
    gdprObject: "Возражение",
    gdprRectify: "Исправить данные",
    gdprDownload: "Скачать",
    gdprActionDone: "GDPR-действие выполнено",
    gdprReasonRequired: "Укажите причину",
    reason: "Причина",
    platform: "Платформа",
    currentVersion: "Текущая версия",
    minimumVersion: "Минимальная версия",
    recommendedVersion: "Рекомендуемая версия",
    rolloutPercent: "Rollout %",
    forceUpdate: "Принудительное обновление",
    downloadUrl: "URL загрузки",
    changelog: "Список изменений",
    runBackup: "Запустить backup БД",
    deleteBackup: "Удалить",
    deleteBackupConfirm: "Удалить этот backup?",
    backupStarted: "Backup запущен",
    backupCompleted: "Backup создан",
    backupDeleted: "Backup удалён",
    backupAlreadyRunning: "Backup уже выполняется",
    backupLastDeleteForbidden: "Нельзя удалить последний успешно проверенный backup",
    backupRunningDeleteForbidden: "Нельзя удалить выполняющийся backup",
    backupNotFound: "Backup не найден",
    createGdpr: "Создать GDPR-запрос",
    setVersionPolicy: "Настроить версии",
    enable2fa: "Включить 2FA",
    superAdmin2fa: "Для Super Admin требуется подтверждённый код приложения-аутентификатора.",
    secret: "Секрет",
    yes: "Да",
    no: "Нет",
    statUsers: "Пользователи",
    statPremium: "Premium",
    statActiveTrials: "Активные trial",
    statDevices: "Устройства",
    statAiRequests7d: "AI-запросы за 7 дней",
    statSosScans7d: "SOS-сканы за 7 дней",
    statPaidPayments: "Оплаченные платежи",
    statRevenue: "Выручка",
    chartRegistrations: "Регистрации",
    chartPlans: "Тарифы",
    chartPlatforms: "Платформы",
    chartLocales: "Языки",
    section: {
      dashboard: "Дашборд",
      users: "Пользователи",
      subscriptions: "Подписки",
      payments: "Платежи",
      devices: "Устройства",
      trials: "Trial",
      family: "Семья",
      sos: "SOS",
      ai: "ИИ",
      notifications: "Уведомления",
      localizations: "Локализация",
      support: "Поддержка",
      security: "Безопасность",
      errors: "Ошибки",
      backups: "Backup",
      gdpr: "GDPR",
      versions: "Версии приложений",
      admins: "Администраторы",
      audit: "Аудит",
      loginAttempts: "Попытки входа",
      settings: "Настройки"
    },
    columns: {
      id: "ID",
      email: "Email",
      fullName: "Имя",
      subscriptionStatus: "Статус подписки",
      premiumPlan: "Тариф",
      provider: "Источник",
      emailVerified: "Email подтверждён",
      createdAt: "Создано",
      plan: "Тариф",
      status: "Статус",
      expires_at: "Истекает",
      updated_at: "Обновлено",
      amount_minor: "Сумма",
      currency: "Валюта",
      created_at: "Создано",
      device_name: "Устройство",
      platform: "Платформа",
      last_seen_at: "Активность",
      revoked_at: "Отозвано",
      started_at: "Начало",
      ends_at: "Окончание",
      device_hash: "Хэш устройства",
      owner_email: "Владелец",
      invite_email: "Приглашение",
      member_count: "Участники",
      accepted_at: "Принято",
      user_id: "ID пользователя",
      public_token: "Публичный токен",
      hide_sensitive: "Скрыть чувствительное",
      scan_count: "Сканы",
      request_type: "Тип запроса",
      locale: "Язык",
      model: "Модель",
      title: "Заголовок",
      created_by: "Автор",
      scheduled_at: "Запланировано",
      version_label: "Версия",
      subject: "Тема",
      priority: "Приоритет",
      assigned_admin_id: "Назначен",
      event_type: "Событие",
      severity: "Важность",
      admin_user_id: "ID админа",
      ip_address: "IP",
      source: "Источник",
      code: "Код",
      endpoint: "Endpoint",
      occurrences: "Повторы",
      last_seen_at: "Последний раз",
      backup_type: "Тип backup",
      file_size_bytes: "Размер",
      duration_ms: "Длительность",
      finished_at: "Завершено",
      request_type: "Тип запроса",
      reason: "Причина",
      completed_at: "Завершено",
      current_version: "Текущая версия",
      minimum_version: "Минимальная версия",
      recommended_version: "Рекомендуемая версия",
      force_update: "Принудительно",
      rollout_percent: "Rollout %",
      displayName: "Имя",
      isActive: "Активен",
      twoFactorEnabled: "2FA",
      roles: "Роли",
      directPermissions: "Права",
      lastLoginAt: "Последний вход",
      admin_email: "Админ",
      action: "Действие",
      entity_type: "Сущность",
      entity_id: "ID сущности",
      success: "Успех",
      failure_reason: "Причина ошибки",
      locked_until: "Блокировка до",
      attempted_at: "Попытка",
      setting_key: "Ключ",
      setting_value: "Значение",
      is_secret: "Секрет"
    }
  },
  en: {
    adminPanel: "Admin panel",
    secureAdmin: "Secure admin access",
    email: "Email",
    password: "Password",
    twoFactorCode: "2FA code",
    signIn: "Sign in",
    logout: "Logout",
    search: "Search",
    loading: "Loading...",
    empty: "No data",
    forbidden: "No permission for this section",
    sessionExpired: "Session expired. Please sign in again.",
    invalidLogin: "Invalid email or password",
    requestFailed: "Request failed",
    total: "Total",
    page: "Page",
    previous: "Previous",
    next: "Next",
    recentUsers: "Recent users",
    revokeSessions: "Revoke sessions",
    confirmRevoke: "Revoke all user sessions?",
    success: "Done",
    details: "Details",
    createdAt: "Created",
    create: "Create",
    export: "Export CSV",
    save: "Save",
    createAdmin: "Create admin",
    createTicket: "Create ticket",
    createCampaign: "Create campaign",
    createSetting: "Create setting",
    edit: "Edit",
    gdprSettingsTitle: "GDPR settings",
    gdprSettingInvalid: "Enter a positive whole number",
    gdprDraftRetentionName: "Draft retention period",
    gdprDraftRetentionDescription: "Draft GDPR requests are cancelled after this number of days.",
    gdprDueDaysName: "GDPR request due period",
    gdprDueDaysDescription: "New GDPR requests receive a due date this many days ahead.",
    gdprExportRetentionName: "Export ZIP retention period",
    gdprExportRetentionDescription: "GDPR export files are available until this number of days expires.",
    settingsCenterTitle: "Module settings center",
    settingsCenterDescription: "Choose a module to open its settings.",
    settingsBackToModules: "Back to modules",
    settingsOpenModule: "Open",
    settingsSearchLabel: "Search modules",
    settingsNoModulesFound: "No modules found",
    cancel: "Cancel",
    "settings.resetDefaults": "Reset to defaults",
    "settings.unit.seconds": "seconds",
    "settings.unit.minutes": "minutes",
    "settings.unit.hours": "hours",
    "settings.sos.testModeBanner": "Test mode is enabled: real external sends are not performed.",
    "settings.sos.unsaved": "Unsaved changes",
    "settings.sos.saved": "SOS settings saved",
    "settings.sos.resetConfirm": "Reset only SOS settings to defaults?",
    "settings.sos.resetDone": "SOS settings reset",
    "settings.sos.validation.integer": "Enter a whole number in the allowed range",
    "settings.sos.validation.autoClose": "Set a valid period for auto-close",
    "settings.sos.statusDisclaimer": "GlucoTrack SOS sends an alert through available configured channels and does not call government emergency services.",
    "settings.sos.status.push.title": "Push",
    "settings.sos.status.smsExternalProvider.title": "External SMS provider",
    "settings.sos.status.not_configured": "Not configured",
    "settings.sos.status.reserved_not_configured": "Reserved / Not configured",
    settingsCurrentValue: "Current value",
    settingsUnit: "Unit",
    settingsModulePlaceholder: "Settings for this module will be added later",
    settingsSaveError: "Unable to save setting",
    "settings.unit.days": "days",
    "settings.validation.positiveInteger": "Enter a positive whole number",
    "settings.module.gdpr.title": "GDPR",
    "settings.module.gdpr.description": "Request processing, draft retention, and data export retention periods.",
    "settings.module.backup.title": "Backup",
    "settings.module.backup.description": "Database and file backup settings.",
    "settings.module.sos.title": "SOS",
    "settings.module.sos.description": "Emergency workflows and alert settings.",
    "settings.module.familyAccess.title": "Family Access",
    "settings.module.familyAccess.description": "Trusted contact and family access settings.",
    "settings.module.notifications.title": "Notifications",
    "settings.module.notifications.description": "Notification channel and rule settings.",
    "settings.notifications.section.channels": "Channels",
    "settings.notifications.section.channels.description": "Global switch and available delivery channels.",
    "settings.notifications.section.rules": "Event rules",
    "settings.notifications.section.rules.description": "Event types that can create notifications.",
    "settings.notifications.section.priorities": "Priorities",
    "settings.notifications.section.priorities.description": "Processing priority for each event type.",
    "settings.notifications.section.limits": "Rate limits",
    "settings.notifications.section.limits.description": "Server-side notification delivery limits.",
    "settings.notifications.section.defaults": "Default user settings",
    "settings.notifications.section.defaults.description": "Channels enabled for a new user by default.",
    "settings.notifications.campaigns": "Recent notifications",
    "settings.notifications.campaignsDescription": "Recent campaigns from the existing notifications module.",
    "settings.notifications.auditNotice": "Changes are stored in system settings and the audit log.",
    "settings.notifications.saved": "Notifications settings saved",
    "settings.notifications.validation.integer": "Enter an integer within the allowed range",
    "settings.notifications.option.low": "Low",
    "settings.notifications.option.normal": "Normal",
    "settings.notifications.option.high": "High",
    "settings.notifications.option.critical": "Critical",
    "settings.notifications.field.notifications_enabled": "Notifications enabled",
    "settings.notifications.hint.notifications_enabled": "Fully enables or disables the shared notifications module.",
    "settings.notifications.field.notification_push_enabled": "Push notifications",
    "settings.notifications.hint.notification_push_enabled": "Allows push delivery through configured providers.",
    "settings.notifications.field.notification_email_enabled": "Email notifications",
    "settings.notifications.hint.notification_email_enabled": "Allows notification delivery by email.",
    "settings.notifications.field.notification_sms_enabled": "SMS notifications",
    "settings.notifications.hint.notification_sms_enabled": "Allows SMS when a provider is configured in Notification Providers.",
    "settings.notifications.field.notification_in_app_enabled": "System notifications",
    "settings.notifications.hint.notification_in_app_enabled": "Shows notifications inside the application.",
    "settings.notifications.field.notification_event_glucose_alert_enabled": "Event: glucose alert",
    "settings.notifications.hint.notification_event_glucose_alert_enabled": "Allows notifications for critical glucose values.",
    "settings.notifications.field.notification_event_family_invite_enabled": "Event: family invitation",
    "settings.notifications.hint.notification_event_family_invite_enabled": "Allows notifications for Family Access invitations.",
    "settings.notifications.field.notification_event_medication_reminder_enabled": "Event: medication reminder",
    "settings.notifications.hint.notification_event_medication_reminder_enabled": "Allows medication reminder notifications.",
    "settings.notifications.field.notification_event_daily_summary_enabled": "Event: daily summary",
    "settings.notifications.hint.notification_event_daily_summary_enabled": "Allows daily summary notifications.",
    "settings.notifications.field.notification_event_system_broadcast_enabled": "Event: system broadcast",
    "settings.notifications.hint.notification_event_system_broadcast_enabled": "Allows administrative system messages.",
    "settings.notifications.field.notification_priority_glucose_alert": "Glucose alert priority",
    "settings.notifications.hint.notification_priority_glucose_alert": "Used by notification queue processing.",
    "settings.notifications.field.notification_priority_family_invite": "Family invitation priority",
    "settings.notifications.hint.notification_priority_family_invite": "Used by notification queue processing.",
    "settings.notifications.field.notification_priority_medication_reminder": "Medication reminder priority",
    "settings.notifications.hint.notification_priority_medication_reminder": "Used by notification queue processing.",
    "settings.notifications.field.notification_priority_daily_summary": "Daily summary priority",
    "settings.notifications.hint.notification_priority_daily_summary": "Used by notification queue processing.",
    "settings.notifications.field.notification_priority_system_broadcast": "System broadcast priority",
    "settings.notifications.hint.notification_priority_system_broadcast": "Used by notification queue processing.",
    "settings.notifications.field.notification_rate_limit_per_minute": "Limit per minute",
    "settings.notifications.hint.notification_rate_limit_per_minute": "Maximum notifications per minute.",
    "settings.notifications.field.notification_rate_limit_per_hour": "Limit per hour",
    "settings.notifications.hint.notification_rate_limit_per_hour": "Maximum notifications per hour.",
    "settings.notifications.field.notification_rate_limit_per_day": "Limit per day",
    "settings.notifications.hint.notification_rate_limit_per_day": "Maximum notifications per day.",
    "settings.notifications.field.notification_default_push": "Default push",
    "settings.notifications.hint.notification_default_push": "Enable push for new user settings.",
    "settings.notifications.field.notification_default_email": "Default email",
    "settings.notifications.hint.notification_default_email": "Enable email for new user settings.",
    "settings.notifications.field.notification_default_sms": "Default SMS",
    "settings.notifications.hint.notification_default_sms": "Enable SMS for new user settings.",
    "settings.notifications.field.notification_default_in_app": "Default system notifications",
    "settings.notifications.hint.notification_default_in_app": "Enable in-app notifications by default.",
    "settings.module.glucose.title": "Glucose",
    "settings.module.glucose.description": "Glucose threshold and display settings.",
    "settings.module.aiSettings.title": "AI Settings",
    "settings.module.aiSettings.description": "Manage AI features, models, fallback, and user limits.",
    "settings.module.security.title": "Security",
    "settings.module.security.description": "Security and access policy settings.",
    "settings.module.administrators.title": "Administrators",
    "settings.module.administrators.description": "Administrator and role settings.",
    "settings.module.audit.title": "Audit",
    "settings.module.audit.description": "Action logging settings.",
    "settings.module.errors.title": "Errors",
    "settings.module.errors.description": "Error collection and retention settings.",
    "settings.module.appVersions.title": "App Versions",
    "settings.module.appVersions.description": "Application version and update policy settings.",
    "settings.module.localization.title": "Localization",
    "settings.module.localization.description": "Language and translation settings.",
    "settings.module.support.title": "Support",
    "settings.module.support.description": "Support ticket and user support settings.",
    "settings.module.integrations.title": "Integrations",
    "settings.module.integrations.description": "External service and integration settings.",
    "settings.gdpr.due.title": "GDPR request due period",
    "settings.gdpr.due.description": "How many days are allowed to process a new GDPR request.",
    "settings.gdpr.due.hint": "Used to calculate the due date for new requests.",
    "settings.gdpr.draftRetention.title": "Draft retention period",
    "settings.gdpr.draftRetention.description": "How many days GDPR request drafts are kept.",
    "settings.gdpr.draftRetention.hint": "Expired drafts are cancelled automatically.",
    "settings.gdpr.exportRetention.title": "Export ZIP retention period",
    "settings.gdpr.exportRetention.description": "How many days a data export file is kept.",
    "settings.gdpr.exportRetention.hint": "Expired ZIP files are removed from the protected directory.",
    "settings.sos.section.general.title": "General settings",
    "settings.sos.section.general.description": "SOS module settings.",
    "settings.sos.section.card.title": "SOS card",
    "settings.sos.section.card.description": "SOS module settings.",
    "settings.sos.section.lifecycle.title": "Lifecycle",
    "settings.sos.section.lifecycle.description": "SOS module settings.",
    "settings.sos.section.notifications.title": "Notifications",
    "settings.sos.section.notifications.description": "SOS module settings.",
    "settings.sos.section.sms.title": "SMS scenario",
    "settings.sos.section.sms.description": "SOS module settings.",
    "settings.sos.section.geolocation.title": "Geolocation",
    "settings.sos.section.geolocation.description": "SOS module settings.",
    "settings.sos.section.sound.title": "Sound and alarm",
    "settings.sos.section.sound.description": "SOS module settings.",
    "settings.sos.section.safety.title": "Safety",
    "settings.sos.section.safety.description": "SOS module settings.",
    "settings.sos.section.retention.title": "History and retention",
    "settings.sos.section.retention.description": "SOS module settings.",
    "settings.sos.section.status.title": "Channel status",
    "settings.sos.section.status.description": "SOS module settings.",
    "settings.sos.field.sos_enabled.title": "SOS enabled",
    "settings.sos.field.sos_enabled.description": "SOS enabled.",
    "settings.sos.field.sos_enabled.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_test_mode.title": "Test mode",
    "settings.sos.field.sos_test_mode.description": "Test mode.",
    "settings.sos.field.sos_test_mode.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_create_roles.title": "Who can create SOS",
    "settings.sos.field.sos_create_roles.description": "Who can create SOS.",
    "settings.sos.field.sos_create_roles.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_view_roles.title": "Who can view SOS",
    "settings.sos.field.sos_view_roles.description": "Who can view SOS.",
    "settings.sos.field.sos_view_roles.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_cancel_roles.title": "Who can cancel SOS",
    "settings.sos.field.sos_cancel_roles.description": "Who can cancel SOS.",
    "settings.sos.field.sos_cancel_roles.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_close_roles.title": "Who can close SOS",
    "settings.sos.field.sos_close_roles.description": "Who can close SOS.",
    "settings.sos.field.sos_close_roles.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_audit_actions_enabled.title": "Audit SOS actions",
    "settings.sos.field.sos_audit_actions_enabled.description": "Audit SOS actions.",
    "settings.sos.field.sos_audit_actions_enabled.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_show_patient_card.title": "Show SOS to patient",
    "settings.sos.field.sos_show_patient_card.description": "Show SOS to patient.",
    "settings.sos.field.sos_show_patient_card.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_show_family_card.title": "Show SOS in Family Access",
    "settings.sos.field.sos_show_family_card.description": "Show SOS in Family Access.",
    "settings.sos.field.sos_show_family_card.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_activation_mode.title": "Activation mode",
    "settings.sos.field.sos_activation_mode.description": "Activation mode.",
    "settings.sos.field.sos_activation_mode.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_require_activation_confirmation.title": "Require activation confirmation",
    "settings.sos.field.sos_require_activation_confirmation.description": "Require activation confirmation.",
    "settings.sos.field.sos_require_activation_confirmation.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_accidental_cancel_seconds.title": "Accidental launch cancel time",
    "settings.sos.field.sos_accidental_cancel_seconds.description": "Accidental launch cancel time.",
    "settings.sos.field.sos_accidental_cancel_seconds.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_card_display_priority.title": "Card display priority",
    "settings.sos.field.sos_card_display_priority.description": "Card display priority.",
    "settings.sos.field.sos_card_display_priority.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_stale_after_minutes.title": "When SOS becomes stale",
    "settings.sos.field.sos_stale_after_minutes.description": "When SOS becomes stale.",
    "settings.sos.field.sos_stale_after_minutes.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_auto_close_enabled.title": "Auto-close enabled",
    "settings.sos.field.sos_auto_close_enabled.description": "Auto-close enabled.",
    "settings.sos.field.sos_auto_close_enabled.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_auto_close_after_hours.title": "Auto-close after hours",
    "settings.sos.field.sos_auto_close_after_hours.description": "Auto-close after hours.",
    "settings.sos.field.sos_auto_close_after_hours.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_require_close_comment.title": "Require close comment",
    "settings.sos.field.sos_require_close_comment.description": "Require close comment.",
    "settings.sos.field.sos_require_close_comment.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_patient_cancel_enabled.title": "Allow patient cancellation",
    "settings.sos.field.sos_patient_cancel_enabled.description": "Allow patient cancellation.",
    "settings.sos.field.sos_patient_cancel_enabled.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_caregiver_close_enabled.title": "Allow caregiver close",
    "settings.sos.field.sos_caregiver_close_enabled.description": "Allow caregiver close.",
    "settings.sos.field.sos_caregiver_close_enabled.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_push_enabled.title": "Push enabled",
    "settings.sos.field.sos_push_enabled.description": "Push enabled.",
    "settings.sos.field.sos_push_enabled.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_in_app_enabled.title": "In-app notifications",
    "settings.sos.field.sos_in_app_enabled.description": "In-app notifications.",
    "settings.sos.field.sos_in_app_enabled.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_caregiver_alarm_sound.title": "Caregiver alarm sound",
    "settings.sos.field.sos_caregiver_alarm_sound.description": "Caregiver alarm sound.",
    "settings.sos.field.sos_caregiver_alarm_sound.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_repeat_notifications.title": "Repeat notifications",
    "settings.sos.field.sos_repeat_notifications.description": "Repeat notifications.",
    "settings.sos.field.sos_repeat_notifications.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_repeat_interval_minutes.title": "Repeat interval",
    "settings.sos.field.sos_repeat_interval_minutes.description": "Repeat interval.",
    "settings.sos.field.sos_repeat_interval_minutes.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_max_notification_repeats.title": "Maximum repeats",
    "settings.sos.field.sos_max_notification_repeats.description": "Maximum repeats.",
    "settings.sos.field.sos_max_notification_repeats.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_escalation_enabled.title": "Escalation enabled",
    "settings.sos.field.sos_escalation_enabled.description": "Escalation enabled.",
    "settings.sos.field.sos_escalation_enabled.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_escalation_after_minutes.title": "Escalate after",
    "settings.sos.field.sos_escalation_after_minutes.description": "Escalate after.",
    "settings.sos.field.sos_escalation_after_minutes.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_sms_enabled.title": "SMS enabled",
    "settings.sos.field.sos_sms_enabled.description": "SMS enabled.",
    "settings.sos.field.sos_sms_enabled.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_sms_type.title": "SMS type",
    "settings.sos.field.sos_sms_type.description": "SMS type.",
    "settings.sos.field.sos_sms_type.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_sms_create_server_first.title": "Create server SOS first",
    "settings.sos.field.sos_sms_create_server_first.description": "Create server SOS first.",
    "settings.sos.field.sos_sms_create_server_first.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_sms_template.title": "SMS template",
    "settings.sos.field.sos_sms_template.description": "SMS template.",
    "settings.sos.field.sos_sms_template.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_sms_max_repeats.title": "Maximum SMS repeats",
    "settings.sos.field.sos_sms_max_repeats.description": "Maximum SMS repeats.",
    "settings.sos.field.sos_sms_max_repeats.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_sms_min_repeat_interval_minutes.title": "Minimum SMS interval",
    "settings.sos.field.sos_sms_min_repeat_interval_minutes.description": "Minimum SMS interval.",
    "settings.sos.field.sos_sms_min_repeat_interval_minutes.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_request_current_location.title": "Request current location",
    "settings.sos.field.sos_request_current_location.description": "Request current location.",
    "settings.sos.field.sos_request_current_location.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_use_last_known_location.title": "Use last known location",
    "settings.sos.field.sos_use_last_known_location.description": "Use last known location.",
    "settings.sos.field.sos_use_last_known_location.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_last_location_max_age_minutes.title": "Last location max age",
    "settings.sos.field.sos_last_location_max_age_minutes.description": "Last location max age.",
    "settings.sos.field.sos_last_location_max_age_minutes.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_location_update_interval_seconds.title": "Location update interval",
    "settings.sos.field.sos_location_update_interval_seconds.description": "Location update interval.",
    "settings.sos.field.sos_location_update_interval_seconds.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_location_tracking_max_minutes.title": "Maximum tracking time",
    "settings.sos.field.sos_location_tracking_max_minutes.description": "Maximum tracking time.",
    "settings.sos.field.sos_location_tracking_max_minutes.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_show_map_to_caregiver.title": "Show map to caregiver",
    "settings.sos.field.sos_show_map_to_caregiver.description": "Show map to caregiver.",
    "settings.sos.field.sos_show_map_to_caregiver.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_location_retention_days.title": "Location retention",
    "settings.sos.field.sos_location_retention_days.description": "Location retention.",
    "settings.sos.field.sos_location_retention_days.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_patient_activation_sound.title": "Patient activation sound",
    "settings.sos.field.sos_patient_activation_sound.description": "Patient activation sound.",
    "settings.sos.field.sos_patient_activation_sound.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_caregiver_sound.title": "Caregiver sound",
    "settings.sos.field.sos_caregiver_sound.description": "Caregiver sound.",
    "settings.sos.field.sos_caregiver_sound.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_vibration_enabled.title": "Vibration",
    "settings.sos.field.sos_vibration_enabled.description": "Vibration.",
    "settings.sos.field.sos_vibration_enabled.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_repeat_sound_until_ack.title": "Repeat sound until acknowledged",
    "settings.sos.field.sos_repeat_sound_until_ack.description": "Repeat sound until acknowledged.",
    "settings.sos.field.sos_repeat_sound_until_ack.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_warn_missing_sound_permission.title": "Warn about missing permissions",
    "settings.sos.field.sos_warn_missing_sound_permission.description": "Warn about missing permissions.",
    "settings.sos.field.sos_warn_missing_sound_permission.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_allow_sound_test_mode.title": "Sound test in test mode",
    "settings.sos.field.sos_allow_sound_test_mode.description": "Sound test in test mode.",
    "settings.sos.field.sos_allow_sound_test_mode.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_rate_limit_enabled.title": "Rate limit",
    "settings.sos.field.sos_rate_limit_enabled.description": "Rate limit.",
    "settings.sos.field.sos_rate_limit_enabled.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_rate_limit_count.title": "SOS count per period",
    "settings.sos.field.sos_rate_limit_count.description": "SOS count per period.",
    "settings.sos.field.sos_rate_limit_count.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_rate_limit_window_minutes.title": "Rate limit window",
    "settings.sos.field.sos_rate_limit_window_minutes.description": "Rate limit window.",
    "settings.sos.field.sos_rate_limit_window_minutes.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_merge_duplicate_active.title": "Merge duplicates",
    "settings.sos.field.sos_merge_duplicate_active.description": "Merge duplicates.",
    "settings.sos.field.sos_merge_duplicate_active.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_duplicate_window_seconds.title": "Duplicate window",
    "settings.sos.field.sos_duplicate_window_seconds.description": "Duplicate window.",
    "settings.sos.field.sos_duplicate_window_seconds.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_log_lifecycle_events.title": "Log lifecycle",
    "settings.sos.field.sos_log_lifecycle_events.description": "Log lifecycle.",
    "settings.sos.field.sos_log_lifecycle_events.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_log_settings_changes.title": "Log settings changes",
    "settings.sos.field.sos_log_settings_changes.description": "Log settings changes.",
    "settings.sos.field.sos_log_settings_changes.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_event_retention_days.title": "SOS event retention",
    "settings.sos.field.sos_event_retention_days.description": "SOS event retention.",
    "settings.sos.field.sos_event_retention_days.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_notification_retention_days.title": "Notification retention",
    "settings.sos.field.sos_notification_retention_days.description": "Notification retention.",
    "settings.sos.field.sos_notification_retention_days.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_coordinate_retention_days.title": "Coordinate retention",
    "settings.sos.field.sos_coordinate_retention_days.description": "Coordinate retention.",
    "settings.sos.field.sos_coordinate_retention_days.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_show_history_patient.title": "Show history to patient",
    "settings.sos.field.sos_show_history_patient.description": "Show history to patient.",
    "settings.sos.field.sos_show_history_patient.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_show_history_caregiver.title": "Show history to caregiver",
    "settings.sos.field.sos_show_history_caregiver.description": "Show history to caregiver.",
    "settings.sos.field.sos_show_history_caregiver.hint": "Used by the existing SOS module.",
    "settings.sos.field.sos_include_events_in_gdpr_export.title": "Include SOS in GDPR export",
    "settings.sos.field.sos_include_events_in_gdpr_export.description": "Include SOS in GDPR export.",
    "settings.sos.field.sos_include_events_in_gdpr_export.hint": "Used by the existing SOS module.",
    "settings.sos.role.super_admin": "Super Admin",
    "settings.sos.role.support": "Support",
    "settings.sos.role.medical_data_reviewer": "Medical reviewer",
    "settings.sos.role.security_auditor": "Security auditor",
    "settings.sos.option.manual": "Manual",
    "settings.sos.option.automatic": "Automatic",
    "settings.sos.option.both": "Both",
    "settings.sos.option.normal": "Normal",
    "settings.sos.option.high": "High",
    "settings.sos.option.critical": "Critical",
    "settings.sos.option.disabled": "Disabled",
    "settings.sos.option.system_composer": "System SMS composer",
    "settings.sos.option.external_reserved": "External provider reserved",
    createLocalization: "Create localization",
    editAdmin: "Edit admin",
    reset2fa: "Reset 2FA",
    block: "Block",
    unblock: "Unblock",
    verifyEmail: "Verify email",
    extendSubscription: "Extend subscription",
    extendSubscriptionTitle: "Subscription extension",
    plan: "Plan",
    days: "Days",
    daysLeft: "{days} days left",
    expiresToday: "expires today",
    expired: "expired",
    noExpiry: "no expiry",
    noMembers: "no members",
    subscriptionExtended: "Subscription extended",
    medicalData: "Anonymized medical data",
    blockReason: "Reason for blocking this account",
    unblockConfirm: "Unblock this account?",
    verifyEmailConfirm: "Mark email as verified?",
    medicalReason: "Reason for medical data access",
    medicalProfile: "Profile",
    medicalMetrics: "Metrics",
    medicalEmergency: "SOS and treatment",
    medicalDiary: "Recent entries",
    currentGlucose: "Current glucose",
    targetGlucose: "Target glucose",
    diabetesType: "Diabetes type",
    age: "Age",
    weight: "Weight",
    height: "Height",
    language: "Language",
    phone: "Phone",
    contact: "Contact",
    bloodType: "Blood type",
    insulin: "Insulin",
    medications: "Medications",
    diagnoses: "Diagnoses",
    instructions: "Instructions",
    noEntries: "No entries",
    displayName: "Display name",
    roles: "Roles",
    directPermissions: "Direct permissions",
    active: "Active",
    ticket: "Ticket",
    status: "Status",
    priority: "Priority",
    message: "Message",
    replyMessage: "Reply to user",
    saveAndSend: "Save and send",
    replySent: "Reply sent",
    deleteTicket: "Delete message",
    deleteTicketConfirm: "Delete this support message?",
    deleteError: "Delete",
    deleteErrorConfirm: "Delete this error record?",
    errorDeleted: "Error record deleted",
    errorNotFound: "Error record not found",
    userId: "User ID",
    subject: "Subject",
    title: "Title",
    body: "Body",
    locale: "Locale",
    key: "Key",
    jsonValue: "JSON value",
    jsonPayload: "JSON payload",
    version: "Version",
    backupTitle: "Run database backup",
    backupText: "This creates a server-side MySQL dump and records the result in backup history.",
    gdprType: "Type",
    gdprAssignMe: "Assign me",
    gdprSaveStatus: "Save status",
    gdprAddComment: "Add comment",
    gdprVerifyIdentity: "Verify identity",
    gdprGenerateExport: "Generate export",
    gdprDeleteAccount: "Delete account",
    gdprExportFiles: "Export files",
    gdprAuditTrail: "Audit trail",
    gdprDataActions: "Data actions",
    gdprUser: "User",
    gdprIdentity: "Identity",
    gdprNotVerified: "not verified",
    gdprRequest: "Request",
    gdprVisibility: "Visibility",
    gdprInternal: "internal",
    gdprUserVisible: "user",
    gdprJobs: "Export jobs",
    gdprAnonymize: "Anonymize",
    gdprComplete: "Complete",
    gdprPreviewErasure: "Preview erasure",
    gdprRestrict: "Restrict processing",
    gdprObject: "Objection",
    gdprRectify: "Rectify data",
    gdprDownload: "Download",
    gdprActionDone: "GDPR action completed",
    gdprReasonRequired: "Reason is required",
    reason: "Reason",
    platform: "Platform",
    currentVersion: "Current version",
    minimumVersion: "Minimum version",
    recommendedVersion: "Recommended version",
    rolloutPercent: "Rollout percent",
    forceUpdate: "Force update",
    downloadUrl: "Download URL",
    changelog: "Changelog",
    runBackup: "Run DB backup",
    deleteBackup: "Delete",
    deleteBackupConfirm: "Delete this backup?",
    backupStarted: "Backup started",
    backupCompleted: "Backup created",
    backupDeleted: "Backup deleted",
    backupAlreadyRunning: "Backup is already running",
    backupLastDeleteForbidden: "The latest verified backup cannot be deleted",
    backupRunningDeleteForbidden: "A running backup cannot be deleted",
    backupNotFound: "Backup not found",
    createGdpr: "Create GDPR request",
    setVersionPolicy: "Set version policy",
    enable2fa: "Enable 2FA",
    superAdmin2fa: "Super Admin access requires a verified authenticator code.",
    secret: "Secret",
    yes: "Yes",
    no: "No",
    statUsers: "Users",
    statPremium: "Premium",
    statActiveTrials: "Active trials",
    statDevices: "Devices",
    statAiRequests7d: "AI requests 7d",
    statSosScans7d: "SOS scans 7d",
    statPaidPayments: "Paid payments",
    statRevenue: "Revenue",
    chartRegistrations: "Registrations",
    chartPlans: "Plans",
    chartPlatforms: "Platforms",
    chartLocales: "Locales",
    section: {
      dashboard: "Dashboard",
      users: "Users",
      subscriptions: "Subscriptions",
      payments: "Payments",
      devices: "Devices",
      trials: "Trial",
      family: "Family",
      sos: "SOS",
      ai: "AI",
      notifications: "Notifications",
      localizations: "Localizations",
      support: "Support",
      security: "Security",
      errors: "Errors",
      backups: "Backups",
      gdpr: "GDPR",
      versions: "App versions",
      admins: "Admins",
      audit: "Audit",
      loginAttempts: "Login attempts",
      settings: "Settings"
    },
    columns: {}
  }
};

Object.assign(dictionaries.ru, {
  audience: "Аудитория",
  audienceAll: "Все пользователи",
  audienceUser: "Конкретный пользователь",
  audienceLocale: "По языку",
  audiencePlan: "По тарифу",
  audienceSubscription: "По статусу подписки",
  campaign: "Кампания",
  delivered: "Доставлено",
  preview: "Предпросмотр",
  recipients: "Получатели",
  scheduledAt: "Запланировано",
  sendCampaignConfirm: "Отправить эту кампанию пользователям?",
  sendNow: "Отправить сейчас",
  subscriptionStatus: "Статус подписки"
});

Object.assign(dictionaries.ru.columns, {
  audience_filter: "Аудитория",
  created_by_email: "Автор",
  delivered_count: "Доставлено",
  recipient_count: "Получатели",
  sent_at: "Отправлено"
});

Object.assign(dictionaries.en, {
  audience: "Audience",
  audienceAll: "All users",
  audienceUser: "Specific user",
  audienceLocale: "By locale",
  audiencePlan: "By plan",
  audienceSubscription: "By subscription status",
  campaign: "Campaign",
  delivered: "Delivered",
  preview: "Preview",
  recipients: "Recipients",
  scheduledAt: "Scheduled at",
  sendCampaignConfirm: "Send this campaign to users?",
  sendNow: "Send now",
  subscriptionStatus: "Subscription status"
});

Object.assign(dictionaries.en.columns, {
  audience_filter: "Audience",
  created_by_email: "Author",
  delivered_count: "Delivered",
  recipient_count: "Recipients",
  sent_at: "Sent"
});

dictionaries.ru.section.referrals = "Рефералы";
dictionaries.en.section.referrals = "Referrals";
dictionaries.ru.section.help = "Help Center";
dictionaries.en.section.help = "Help Center";
dictionaries.ru.section.about = "О GlukoTrack";
dictionaries.en.section.about = "About GlukoTrack";

Object.assign(dictionaries.ru, {
  editAbout: "Редактировать блок",
  aboutSaved: "Раздел сохранён",
  subtitle: "Подзаголовок",
  content: "Содержание",
  translationStatus: "Статус перевода"
});

Object.assign(dictionaries.en, {
  editAbout: "Edit block",
  aboutSaved: "About section saved",
  subtitle: "Subtitle",
  content: "Content",
  translationStatus: "Translation status"
});

Object.assign(dictionaries.ru, {
  referrals: "Рефералы",
  referral: "Реферал",
  rewards: "Награды",
  fraudChecks: "Антифрод",
  approve: "Одобрить",
  reject: "Отклонить",
  revoke: "Отозвать",
  restore: "Восстановить"
});

Object.assign(dictionaries.en, {
  referrals: "Referrals",
  referral: "Referral",
  rewards: "Rewards",
  fraudChecks: "Fraud checks",
  approve: "Approve",
  reject: "Reject",
  revoke: "Revoke",
  restore: "Restore"
});

Object.assign(dictionaries.ru.columns, {
  referrer_email: "Пригласил",
  referred_email: "Приглашён",
  rejection_reason: "Причина",
  registered_at: "Регистрация",
  email_verified_at: "Email подтв.",
  qualified_at: "Квалиф.",
  rewarded_at: "Награда",
  granted_days: "Дни",
  publicId: "ID запроса",
  user_id: "ID пользователя",
  requestType: "Тип запроса",
  dueAt: "Срок",
  assignedAdminEmail: "Назначен",
  daysRemaining: "Дней осталось"
});

Object.assign(dictionaries.en.columns, {
  referrer_email: "Referrer",
  referred_email: "Referred",
  rejection_reason: "Reason",
  registered_at: "Registered",
  email_verified_at: "Email verified",
  qualified_at: "Qualified",
  rewarded_at: "Rewarded",
  granted_days: "Days",
  publicId: "Request ID",
  user_id: "User ID",
  requestType: "Request type",
  dueAt: "Due",
  assignedAdminEmail: "Assigned",
  daysRemaining: "Days remaining"
});

Object.assign(dictionaries.ru, {
  createHelpArticle: "Create Help article",
  editHelpArticle: "Edit Help article",
  publish: "Publish",
  archive: "Archive",
  translateAll: "Translate all",
  summary: "Summary",
  category: "Category",
  slug: "Slug",
  featured: "Featured",
  content: "Content",
  helpArticleSaved: "Help article saved"
});

Object.assign(dictionaries.en, {
  createHelpArticle: "Create Help article",
  editHelpArticle: "Edit Help article",
  publish: "Publish",
  archive: "Archive",
  translateAll: "Translate all",
  summary: "Summary",
  category: "Category",
  slug: "Slug",
  featured: "Featured",
  content: "Content",
  helpArticleSaved: "Help article saved"
});

Object.assign(dictionaries.ru.columns, {
  category: "Category",
  translation_status: "Translation",
  languages: "Languages",
  view_count: "Views"
});

Object.assign(dictionaries.en.columns, {
  category: "Category",
  translation_status: "Translation",
  languages: "Languages",
  view_count: "Views"
});

Object.assign(dictionaries.ru, {
  "section.familyAccess": "Family Access",
  familyAccessEnable: "Включить доступ",
  familyAccessDisable: "Отключить доступ",
  familyAccessPending: "Вернуть в ожидание"
,
  "familyAccess.permissions.glucose": "Просмотр сахара",
  "familyAccess.permissions.history": "История данных",
  "familyAccess.permissions.emergency": "Экстренные уведомления"
,
  "familyAccess.table.role": "Роль",
  "familyAccess.table.permissions": "Разрешения",
  "familyAccess.table.emailSent": "Email отправлен",
  "familyAccess.table.emailError": "Ошибка Email",
  "familyAccess.userBlock.title": "Family Access",
  "familyAccess.userBlock.description": "Семейные связи, доверенные контакты, приглашения и права доступа.",
  "familyAccess.userBlock.empty": "Семейные связи не найдены",
  "familyAccess.userBlock.savePermissions": "Изменить разрешения",
  "familyAccess.userBlock.permissionsSaved": "Разрешения Family Access сохранены",
  "familyAccess.userBlock.owner": "Владелец",
  "familyAccess.userBlock.contact": "Контакт"});
Object.assign(dictionaries.en, {
  "section.familyAccess": "Family Access",
  familyAccessEnable: "Enable access",
  familyAccessDisable: "Disable access",
  familyAccessPending: "Set pending"
,
  "familyAccess.permissions.glucose": "Glucose view",
  "familyAccess.permissions.history": "Data history",
  "familyAccess.permissions.emergency": "Emergency notifications"
,
  "familyAccess.table.role": "Role",
  "familyAccess.table.permissions": "Permissions",
  "familyAccess.table.emailSent": "Email sent",
  "familyAccess.table.emailError": "Email error",
  "familyAccess.userBlock.title": "Family Access",
  "familyAccess.userBlock.description": "Family links, trusted contacts, invitations, and access permissions.",
  "familyAccess.userBlock.empty": "No family links found",
  "familyAccess.userBlock.savePermissions": "Change permissions",
  "familyAccess.userBlock.permissionsSaved": "Family Access permissions saved",
  "familyAccess.userBlock.owner": "Owner",
  "familyAccess.userBlock.contact": "Contact"});

Object.assign(dictionaries.ru, {
  "settings.familyAccess.family_access_enabled": "Family Access включён",
  "settings.familyAccess.family_trusted_contacts_enabled": "Доверенные контакты разрешены",
  "settings.familyAccess.family_invites_enabled": "Приглашения разрешены",
  "settings.familyAccess.maxMembers": "Максимум связей на пользователя",
  "settings.familyAccess.links": "Семейные связи",
  "settings.familyAccess.linksDescription": "Связанные пользователи, доверенные контакты, приглашения и статусы доступа.",
  "settings.familyAccess.auditNotice": "Изменения настроек и статусов записываются в аудит.",
  "settings.familyAccess.saved": "Настройки Family Access сохранены"
});
Object.assign(dictionaries.en, {
  "settings.familyAccess.family_access_enabled": "Family Access enabled",
  "settings.familyAccess.family_trusted_contacts_enabled": "Trusted contacts allowed",
  "settings.familyAccess.family_invites_enabled": "Invitations allowed",
  "settings.familyAccess.maxMembers": "Maximum links per user",
  "settings.familyAccess.links": "Family links",
  "settings.familyAccess.linksDescription": "Linked users, trusted contacts, invitations, and access statuses.",
  "settings.familyAccess.auditNotice": "Settings and status changes are recorded in audit.",
  "settings.familyAccess.saved": "Family Access settings saved"
});
const columns = {
  users: ["id", "email", "fullName", "subscriptionStatus", "premiumPlan", "emailVerified", "createdAt"],
  subscriptions: ["id", "user_id", "email", "provider", "plan", "status", "expires_at", "updated_at"],
  payments: ["id", "email", "amount_minor", "currency", "status", "created_at"],
  devices: ["id", "email", "device_name", "platform", "last_seen_at", "revoked_at"],
  trials: ["id", "email", "started_at", "ends_at", "status", "device_hash"],
  family: ["id", "owner_email", "invite_email", "caregiver_name", "role", "status", "permissions", "email_sent", "email_error", "member_count", "expires_at", "accepted_at"],
  sos: ["user_id", "email", "public_token", "hide_sensitive", "scan_count", "updated_at"],
  ai: ["id", "email", "request_type", "locale", "status", "model", "created_at"],
  notifications: ["id", "title", "locale", "status", "recipient_count", "delivered_count", "created_at", "scheduled_at", "sent_at"],
  referrals: ["id", "code", "referrer_email", "referred_email", "status", "rejection_reason", "registered_at", "email_verified_at", "qualified_at", "rewarded_at", "granted_days"],
  help: ["id", "slug", "category", "title", "status", "translation_status", "languages", "view_count", "updated_at"],
  about: ["id", "section_key", "content_type", "locale", "title", "translation_status", "is_active", "updated_at"],
  localizations: ["locale", "version_label", "created_at", "created_by"],
  support: ["id", "email", "subject", "status", "priority", "assigned_admin_id", "updated_at"],
  security: ["id", "event_type", "severity", "user_id", "admin_user_id", "ip_address", "created_at"],
  errors: ["id", "source", "severity", "code", "endpoint", "status", "occurrences", "last_seen_at"],
  backups: ["id", "backup_type", "status", "file_size_bytes", "sha256", "duration_ms", "created_by", "started_at", "finished_at", "verified_at"],
  gdpr: ["publicId", "user_id", "email", "requestType", "status", "subject", "dueAt", "assignedAdminEmail", "daysRemaining"],
  versions: ["platform", "current_version", "minimum_version", "recommended_version", "force_update", "rollout_percent", "status", "updated_at"],
  admins: ["id", "email", "displayName", "isActive", "twoFactorEnabled", "roles", "directPermissions", "lastLoginAt"],
  audit: ["id", "admin_email", "action", "entity_type", "entity_id", "ip_address", "created_at"],
  "login-attempts": ["id", "email", "ip_address", "success", "failure_reason", "locked_until", "attempted_at"],
  settings: ["name", "description", "setting_value", "updated_at"]
};

document.documentElement.dataset.theme = state.theme;
document.addEventListener("DOMContentLoaded", boot);

async function boot() {
  bindUi();
  applyI18n();
  if (state.token) {
    try {
      const me = await api("/auth/me");
      state.admin = me.admin;
      showApp();
      renderNav();
      await navigate(location.hash.replace("#", "") || "dashboard");
      return;
    } catch {
      clearSession();
    }
  }
  showLogin();
}

function bindUi() {
  qs("#loginForm").addEventListener("submit", login);
  qs("#logoutButton").addEventListener("click", logout);
  qs("#themeButton").addEventListener("click", toggleTheme);
  qs("#languageSelect").value = state.lang;
  qs("#languageSelect").addEventListener("change", (event) => {
    state.lang = event.target.value;
    localStorage.setItem("gt_admin_lang", state.lang);
    applyI18n();
    renderNav();
    setTitle(state.route);
    if (!qs("#app").classList.contains("hidden")) loadRoute();
  });
  qs("#globalSearch").addEventListener("input", debounce((event) => {
    state.q = event.target.value.trim();
    state.page = 1;
    loadRoute();
  }, 250));
  qs("#menuButton").addEventListener("click", () => qs(".sidebar").classList.toggle("open"));
  qs("#modalClose").addEventListener("click", closeModal);
  qs("#modal").addEventListener("click", (event) => {
    if (event.target.id === "modal") closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
  window.addEventListener("hashchange", () => navigate(location.hash.replace("#", "") || "dashboard"));
}

async function login(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  qs("#loginError").textContent = "";
  try {
    const result = await api("/auth/login", { method: "POST", body: Object.fromEntries(form.entries()) });
    state.token = result.token;
    state.csrfToken = result.csrfToken || "";
    state.admin = result.admin;
    sessionStorage.setItem(tokenKey, state.token);
    if (state.csrfToken) sessionStorage.setItem(csrfKey, state.csrfToken);
    if (result.twoFactorSetupRequired) {
      await showTwoFactorSetup();
      return;
    }
    showApp();
    renderNav();
    await navigate("dashboard");
  } catch (error) {
    if (error.code === "ADMIN_2FA_REQUIRED") {
      qs("#codeField").classList.remove("hidden");
      qs("[name=code]").focus();
    }
    qs("#loginError").textContent = error.code === "UNAUTHORIZED" ? t("invalidLogin") : readableError(error);
  }
}

async function showTwoFactorSetup() {
  const setup = await api("/auth/2fa/setup", { method: "POST" });
  qs("#loginView").classList.add("hidden");
  openModal(`
    <form id="twoFactorSetupForm" class="modal-form">
      <h2>${t("enable2fa")}</h2>
      <p class="muted">${t("superAdmin2fa")}</p>
      <label>${t("secret")}<input readonly value="${escapeHtml(setup.secret)}"></label>
      <label>Code<input name="code" inputmode="numeric" autocomplete="one-time-code" required></label>
      <div class="modal-actions"><button>${t("save")}</button></div>
    </form>
  `);
  qs("#twoFactorSetupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/auth/2fa/verify", { method: "POST", body: { code: form.get("code") } });
      closeModal();
      const me = await api("/auth/me");
      state.admin = me.admin;
      showApp();
      renderNav();
      await navigate("dashboard");
    } catch (error) {
      notice(error.code || error.message, true);
    }
  });
}

async function logout() {
  try { await api("/auth/logout", { method: "POST" }); } catch {}
  clearSession();
  showLogin();
}

function clearSession() {
  state.token = "";
  state.csrfToken = "";
  state.admin = null;
  sessionStorage.removeItem(tokenKey);
  sessionStorage.removeItem(csrfKey);
}

function showLogin() {
  qs("#app").classList.add("hidden");
  qs("#loginView").classList.remove("hidden");
}

function showApp() {
  qs("#loginView").classList.add("hidden");
  qs("#app").classList.remove("hidden");
}

function renderNav() {
  const nav = qs("#nav");
  nav.innerHTML = "";
  for (const [route, labelKey, permission] of sections) {
    if (!can(permission)) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = t(labelKey);
    button.className = route === state.route ? "active" : "";
    button.addEventListener("click", () => {
      location.hash = route;
      qs(".sidebar").classList.remove("open");
    });
    nav.append(button);
  }
}

async function navigate(route) {
  const [baseRoute, rawModuleId] = String(route || "").split("/");
  const moduleId = rawModuleId === "assistant" ? "aiSettings" : rawModuleId;
  state.route = sections.some(([name]) => name === baseRoute) ? baseRoute : "dashboard";
  state.settingsModule = state.route === "settings" && SETTINGS_MODULES.includes(moduleId) ? moduleId : "";
  state.page = 1;
  setTitle(state.route);
  renderNav();
  await loadRoute();
}

async function loadRoute() {
  setTitle(state.route);
  qs("#content").innerHTML = `<div class="panel loading">${t("loading")}</div>`;
  try {
    if (state.route === "dashboard") {
      renderDashboard(await api("/dashboard"));
    } else {
      const data = state.route === "settings" && state.settingsModule === "familyAccess"
        ? await api("/settings/family-access")
        : state.route === "settings" && state.settingsModule === "sos"
        ? await api("/settings/sos")
        : state.route === "settings" && state.settingsModule === "backup"
          ? await api("/settings/backup")
          : state.route === "settings" && state.settingsModule === "aiSettings"
            ? await api("/settings/ai")
            : state.route === "settings" && state.settingsModule === "notifications"
              ? await api("/settings/notifications")
            : state.route === "settings" && state.settingsModule === "notificationProviders"
              ? await api("/settings/notification-providers")
              : await api(`/${state.route}?page=${state.page}&limit=25&q=${encodeURIComponent(state.q)}`);
      renderTable(state.route, data);
    }
  } catch (error) {
    if (error.status === 401) {
      handleAuthExpired();
      return;
    }
    qs("#content").innerHTML = `<div class="panel empty">${escapeHtml(readableError(error))}</div>`;
  }
}

function renderDashboard(data) {
  const stats = data.stats || {};
  qs("#content").innerHTML = `
    <section class="stats-grid">
      ${stat(t("statUsers"), stats.users)}
      ${stat(t("statPremium"), stats.premium)}
      ${stat(t("statActiveTrials"), stats.activeTrials)}
      ${stat(t("statDevices"), stats.activeDevices)}
      ${stat(t("statAiRequests7d"), stats.aiRequests7d)}
      ${stat(t("statSosScans7d"), stats.sosScans7d)}
      ${stat(t("statPaidPayments"), stats.paidPayments)}
      ${stat(t("statRevenue"), money(stats.revenueMinor))}
    </section>
    <section class="stats-grid">
      ${chart(t("chartRegistrations"), data.charts?.registrations || [], "day")}
      ${chart(t("chartPlans"), data.charts?.plans || [], "label")}
      ${chart(t("chartPlatforms"), data.charts?.platforms || [], "label")}
      ${chart(t("chartLocales"), data.charts?.locales || [], "label")}
    </section>
    <section class="panel">
      <div class="panel-header"><h2>${t("recentUsers")}</h2></div>
      ${tableHtml(["id", "email", "fullName", "subscriptionStatus", "createdAt"], data.recentUsers || [], "users")}
    </section>`;
  bindRowActions();
}

function chart(title, rows, labelKey) {
  const max = Math.max(...rows.map((row) => Number(row.count || 0)), 1);
  return `<div class="panel chart-panel"><div class="panel-header"><h2>${escapeHtml(title)}</h2></div>
    <div class="chart-bars">${rows.length ? rows.map((row) => {
      const count = Number(row.count || 0);
      const width = Math.max((count / max) * 100, 4);
      return `<div class="chart-row"><span>${escapeHtml(row[labelKey] || "-")}</span><div><i style="width:${width}%"></i></div><strong>${count}</strong></div>`;
    }).join("") : `<div class="empty">${t("empty")}</div>`}</div></div>`;
}

function stat(label, value) {
  return `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? 0)}</strong></div>`;
}

function renderTable(route, data) {
  if (route === "settings") return renderSettings(data);
  const rows = data.rows || [];
  const cols = columns[route] || Object.keys(rows[0] || {});
  qs("#content").innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2>${sectionTitle(route)}</h2>
        <div class="panel-actions">${actionButtons(route)}<span class="muted">${t("total")}: ${Number(data.total || 0)}</span></div>
      </div>
      ${rows.length ? tableHtml(cols, rows, route) : `<div class="empty">${t("empty")}</div>`}
      ${pagination(data)}
    </section>`;
  bindRowActions();
}

function settingsModuleMeta(moduleId) {
  return {
    title: t(`settings.module.${moduleId}.title`),
    description: t(`settings.module.${moduleId}.description`),
    permission: moduleId === "aiSettings" ? "ai.manage" : moduleId === "notificationProviders" ? "*" : "settings:read"
  };
}

function gdprSettingMeta(key) {
  const defs = Object.fromEntries(GDPR_SETTING_FIELDS.map((field) => [field.key, field]));
  const field = defs[key];
  if (!field) return null;
  return {
    title: t(field.titleKey),
    description: t(field.descriptionKey),
    unit: t(field.unitKey),
    hint: t(field.hintKey),
    validation: t(field.validationKey)
  };
}

function renderSettings(data) {
  if (state.settingsModule) return renderSettingsModule(state.settingsModule, data);
  const query = state.q.trim().toLowerCase();
  const modules = SETTINGS_MODULES.filter((moduleId) => {
    const meta = settingsModuleMeta(moduleId);
    return (can("*") || can(meta.permission)) && (!query || `${meta.title} ${meta.description}`.toLowerCase().includes(query));
  });
  qs("#content").innerHTML = `
    <section class="panel settings-center-panel">
      <div class="panel-header settings-center-header">
        <div>
          <h2>${t("settingsCenterTitle")}</h2>
          <p class="muted">${t("settingsCenterDescription")}</p>
        </div>
        <span class="muted">${t("settingsSearchLabel")}</span>
      </div>
      ${modules.length ? `<div class="settings-module-grid">
        ${modules.map((moduleId) => settingsModuleCard(moduleId)).join("")}
      </div>` : `<div class="empty settings-empty">${t("settingsNoModulesFound")}</div>`}
    </section>`;
  bindRowActions();
}

function settingsModuleCard(moduleId) {
  const meta = settingsModuleMeta(moduleId);
  return `<article class="settings-module-card">
    <div class="settings-module-copy">
      <h3>${escapeHtml(meta.title)}</h3>
      <p>${escapeHtml(meta.description)}</p>
    </div>
    <button class="button ghost settings-module-open" data-settings-module="${escapeHtml(moduleId)}">${t("settingsOpenModule")}</button>
  </article>`;
}

function renderSettingsModule(moduleId, data) {
  const meta = settingsModuleMeta(moduleId);
  qs("#content").innerHTML = `
    <section class="panel settings-module-screen">
      <div class="panel-header settings-center-header">
        <div>
          <h2>${escapeHtml(meta.title)}</h2>
          <p class="muted">${escapeHtml(meta.description)}</p>
        </div>
        <div class="panel-actions"><button class="button ghost" data-settings-back>${t("settingsBackToModules")}</button></div>
      </div>
      ${moduleId === "gdpr" ? renderGdprSettings(data.rows || []) : moduleId === "familyAccess" ? renderFamilyAccessSettings(data) : moduleId === "sos" ? renderSosSettings(data) : moduleId === "backup" ? renderBackupSettings(data) : moduleId === "aiSettings" ? renderAiSettings(data) : moduleId === "notifications" ? renderNotificationSettings(data) : moduleId === "notificationProviders" ? renderNotificationProviderSettings(data) : renderEmptySettingsModule()}
    </section>`;
  bindRowActions();
}

function renderFamilyAccessSettings(data) {
  const settings = data.settings || {};
  return `<form id="familyAccessSettingsForm" class="sos-settings-form">
    <div class="backup-status-grid">
      ${familyAccessToggle("family_access_enabled", settings.family_access_enabled !== false)}
      ${familyAccessToggle("family_trusted_contacts_enabled", settings.family_trusted_contacts_enabled !== false)}
      ${familyAccessToggle("family_invites_enabled", settings.family_invites_enabled !== false)}
      <label class="sos-setting-field"><span>${t("settings.familyAccess.maxMembers")}</span><input type="number" min="1" max="20" name="family_max_members" value="${escapeHtml(settings.family_max_members ?? 5)}"></label>
    </div>
    <div class="settings-actions"><button class="button primary" id="familyAccessSaveSettings">${t("save")}</button><span class="muted">${t("settings.familyAccess.auditNotice")}</span></div>
  </form>`;
}

function familyAccessToggle(key, value) {
  return `<label class="sos-setting-field"><span>${t(`settings.familyAccess.${key}`)}</span><input type="checkbox" name="${key}" ${value ? "checked" : ""}></label>`;
}

function familyAccessLinksTable(rows) {
  const cols = ["id", "owner_email", "invite_email", "caregiver_name", "role", "status", "permissions", "email_sent", "email_error", "expires_at", "accepted_at"];
  return `<div class="table-wrap family-access-links-table"><table><thead><tr>${cols.map((col) => `<th class="family-access-col-${escapeHtml(col)}">${escapeHtml(familyAccessColumnTitle(col))}</th>`).join("")}<th></th></tr></thead><tbody>
    ${rows.map((row) => `<tr>${cols.map((col) => col === "permissions" ? familyAccessPermissionsCell(row[col]) : familyAccessCell(row[col], col, row)).join("")}<td>${familyAccessSettingsActions(row)}</td></tr>`).join("")}
  </tbody></table></div>`;
}

function familyAccessColumnTitle(col) {
  const keys = {
    role: "familyAccess.table.role",
    permissions: "familyAccess.table.permissions",
    email_sent: "familyAccess.table.emailSent",
    email_error: "familyAccess.table.emailError"
  };
  return keys[col] ? t(keys[col]) : columnTitle(col);
}

function familyAccessCell(value, key, row = {}) {
  const html = cell(value, key, row);
  if (key !== "email_sent" && key !== "email_error") return html;
  return html.replace("<td", `<td class="family-access-cell-${key}"`);
}
function familyAccessPermissionsCell(value) {
  const permissionMeta = [
    ["glucose", "💧"],
    ["history", "📊"],
    ["emergency", "🔔"]
  ];
  let permissions = value || {};
  if (typeof permissions === "string") {
    try { permissions = JSON.parse(permissions); } catch { permissions = {}; }
  }
  return `<td class="family-permissions-cell"><div class="family-permissions-list">
    ${permissionMeta.map(([key, icon]) => {
      const enabled = permissions?.[key] === true;
      return `<div class="family-permission-row ${enabled ? "is-enabled" : "is-disabled"}"><span class="family-permission-icon" aria-hidden="true">${icon}</span><span class="family-permission-name">${escapeHtml(t(`familyAccess.permissions.${key}`))}</span><span class="family-permission-status ${enabled ? "ok" : "warn"}">${enabled ? "&#10003;" : "-"}</span></div>`;
    }).join("")}
  </div></td>`;
}
function familyAccessSettingsActions(row, className = "row-actions") {
  if (!/^\d+$/.test(String(row.id))) return "";
  return `<div class="${escapeHtml(className)}">
    ${row.status !== "accepted" ? `<button type="button" class="button primary" data-family-status="${row.id}" data-status="accepted">${t("familyAccessEnable")}</button>` : ""}
    ${row.status !== "pending" ? `<button type="button" class="button ghost" data-family-status="${row.id}" data-status="pending">${t("familyAccessPending")}</button>` : ""}
    ${row.status !== "revoked" ? `<button type="button" class="button danger" data-family-status="${row.id}" data-status="revoked">${t("familyAccessDisable")}</button>` : ""}
  </div>`;
}

function bindFamilyAccessSettingsForm() {
  const form = qs("#familyAccessSettingsForm");
  if (!form) return;
  form.addEventListener("submit", saveFamilyAccessSettings);
}

async function saveFamilyAccessSettings(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await api("/settings/family-access", {
    method: "PUT",
    body: {
      settings: {
        family_access_enabled: form.get("family_access_enabled") === "on",
        family_trusted_contacts_enabled: form.get("family_trusted_contacts_enabled") === "on",
        family_invites_enabled: form.get("family_invites_enabled") === "on",
        family_max_members: Number(form.get("family_max_members") || 5)
      }
    }
  });
  notice(t("settings.familyAccess.saved"));
  await loadRoute();
}
function renderNotificationSettings(data) {
  notificationSettingsState = { settings: { ...(data.settings || {}) }, schema: data.schema || {}, rows: data.rows || [] };
  return `<form id="notificationSettingsForm" class="sos-settings-form">
    ${NOTIFICATION_SETTINGS_SECTIONS.map((section) => renderNotificationSettingsSection(section)).join("")}
    <div class="settings-actions"><button class="button primary" id="notificationSettingsSave">${t("save")}</button><span class="muted">${t("settings.notifications.auditNotice")}</span></div>
    <div class="panel-header settings-center-header"><div><h3>${t("settings.notifications.campaigns")}</h3><p class="muted">${t("settings.notifications.campaignsDescription")}</p></div><span class="muted">${t("total")}: ${Number(data.total || notificationSettingsState.rows.length)}</span></div>
    ${notificationSettingsState.rows.length ? notificationCampaignRows(notificationSettingsState.rows) : `<div class="empty">${t("empty")}</div>`}
  </form>`;
}

function renderNotificationSettingsSection(section) {
  return `<details class="sos-settings-section" open><summary><span>${t(`settings.notifications.section.${section.id}`)}</span><small>${t(`settings.notifications.section.${section.id}.description`)}</small></summary><div class="sos-settings-grid">
    ${section.fields.map((key) => renderNotificationSettingsField(key)).join("")}
  </div></details>`;
}

function renderNotificationSettingsField(key) {
  const def = { ...(NOTIFICATION_SETTING_FIELDS[key] || {}), ...(notificationSettingsState.schema[key] || {}) };
  const value = notificationSettingsState.settings[key];
  const label = t(`settings.notifications.field.${key}`);
  const hint = t(`settings.notifications.hint.${key}`);
  let control = "";
  if (def.type === "boolean") control = `<label class="toggle-row"><input type="checkbox" data-notification-key="${escapeHtml(key)}" ${value ? "checked" : ""}> <span>${t(value ? "yes" : "no")}</span></label>`;
  else if (def.type === "enum") control = `<select data-notification-key="${escapeHtml(key)}">${(def.values || def.options || []).map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${t(`settings.notifications.option.${option}`)}</option>`).join("")}</select>`;
  else control = `<input type="number" data-notification-key="${escapeHtml(key)}" min="${escapeHtml(def.min ?? 1)}" max="${escapeHtml(def.max ?? 10000)}" value="${escapeHtml(value ?? def.min ?? 1)}">`;
  return `<label class="sos-setting-card"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(hint)}</span>${control}</label>`;
}

function notificationCampaignRows(rows) {
  const cols = ["id", "title", "locale", "status", "recipient_count", "delivered_count", "created_at", "scheduled_at", "sent_at"];
  return `<div class="table-wrap"><table><thead><tr>${cols.map((col) => `<th>${escapeHtml(columnTitle(col))}</th>`).join("")}</tr></thead><tbody>
    ${rows.map((row) => `<tr>${cols.map((col) => cell(row[col], col, row)).join("")}</tr>`).join("")}
  </tbody></table></div>`;
}

function bindNotificationSettingsForm() {
  const form = qs("#notificationSettingsForm");
  if (!form) return;
  form.addEventListener("submit", saveNotificationSettings);
}

async function saveNotificationSettings(event) {
  event.preventDefault();
  const settings = {};
  for (const [key, def] of Object.entries(NOTIFICATION_SETTING_FIELDS)) {
    const input = qs(`[data-notification-key="${key}"]`);
    if (!input) continue;
    if (def.type === "boolean") settings[key] = input.checked === true;
    else if (def.type === "integer") {
      const numeric = Number(input.value);
      if (!Number.isInteger(numeric) || numeric < def.min || numeric > def.max) return notice(t("settings.notifications.validation.integer"), true);
      settings[key] = numeric;
    } else settings[key] = input.value;
  }
  await api("/settings/notifications", { method: "PUT", body: { settings } });
  notice(t("settings.notifications.saved"));
  await loadRoute();
}
function renderEmptySettingsModule() {
  return `<div class="empty">${t("settingsModulePlaceholder")}</div>`;
}


const NOTIFICATION_PROVIDER_SECRET_FIELDS = [
  "custom_api_key",
  "twilio_account_sid",
  "twilio_auth_token",
  "twilio_from_number",
  "twilio_messaging_service_sid",
  "vonage_api_key",
  "vonage_api_secret"
];
const NOTIFICATION_PROVIDER_SETTING_FIELDS = [
  "notification_sms_provider",
  "notification_custom_sms_endpoint",
  "notification_custom_sms_sender_name",
  "notification_custom_sms_dry_run",
  "notification_custom_sms_timeout_seconds",
  "notification_twilio_sender_name",
  "notification_twilio_dry_run",
  "notification_vonage_sender_name",
  "notification_vonage_dry_run",
  "notification_sms_daily_per_patient",
  "notification_sms_monthly_per_patient",
  "notification_sms_global_daily_limit",
  "notification_sms_global_daily_budget_minor",
  "notification_sms_budget_currency",
  "notification_sms_estimated_cost_minor",
  "notification_manual_sos_cooldown_minutes"
];

function renderNotificationProviderSettings(data) {
  notificationProviderState = { settings: { ...(data.settings || {}) }, secrets: { ...(data.secrets || {}) }, status: data.status || {}, schema: data.schema || {}, providers: data.providers || ["disabled","custom","twilio","vonage"] };
  return `<form id="notificationProviderForm" class="sos-settings-form">
    <div class="backup-status-grid">
      ${notificationProviderStatusCard("disabled")}
      ${notificationProviderStatusCard("custom")}
      ${notificationProviderStatusCard("twilio")}
      ${notificationProviderStatusCard("vonage")}
      <div class="sos-status-card"><strong>${t("settings.notification.iosCritical")}</strong><span>REQUIRES APPLE APPROVAL</span></div>
    </div>
    <details class="sos-settings-section" open><summary><span>${t("settings.notification.section.provider")}</span><small>${t("settings.notification.section.provider.description")}</small></summary><div class="sos-settings-grid">
      ${renderNotificationSettingField("notification_sms_provider", "enum", ["disabled","custom","twilio","vonage"])}
    </div></details>
    <details class="sos-settings-section" open><summary><span>Custom SMS API</span><small>${t("settings.notification.section.custom.description")}</small></summary><div class="sos-settings-grid">
      ${renderNotificationSettingField("notification_custom_sms_endpoint", "url")}
      ${renderNotificationSecretField("custom_api_key")}
      ${renderNotificationSettingField("notification_custom_sms_sender_name", "text")}
      ${renderNotificationSettingField("notification_custom_sms_dry_run", "boolean")}
      ${renderNotificationSettingField("notification_custom_sms_timeout_seconds", "integer")}
    </div></details>
    <details class="sos-settings-section"><summary><span>Twilio</span><small>${t("settings.notification.section.twilio.description")}</small></summary><div class="sos-settings-grid">
      ${renderNotificationSecretField("twilio_account_sid")}
      ${renderNotificationSecretField("twilio_auth_token")}
      ${renderNotificationSecretField("twilio_from_number")}
      ${renderNotificationSecretField("twilio_messaging_service_sid")}
      ${renderNotificationSettingField("notification_twilio_sender_name", "text")}
      ${renderNotificationSettingField("notification_twilio_dry_run", "boolean")}
    </div></details>
    <details class="sos-settings-section"><summary><span>Vonage</span><small>${t("settings.notification.section.vonage.description")}</small></summary><div class="sos-settings-grid">
      ${renderNotificationSecretField("vonage_api_key")}
      ${renderNotificationSecretField("vonage_api_secret")}
      ${renderNotificationSettingField("notification_vonage_sender_name", "text")}
      ${renderNotificationSettingField("notification_vonage_dry_run", "boolean")}
    </div></details>
    <details class="sos-settings-section" open><summary><span>${t("settings.notification.section.limits")}</span><small>${t("settings.notification.section.limits.description")}</small></summary><div class="sos-settings-grid">
      ${["notification_sms_daily_per_patient","notification_sms_monthly_per_patient","notification_sms_global_daily_limit","notification_sms_global_daily_budget_minor","notification_sms_budget_currency","notification_sms_estimated_cost_minor","notification_manual_sos_cooldown_minutes"].map((key) => renderNotificationSettingField(key, notificationProviderState.schema[key]?.type || "integer")).join("")}
    </div></details>
    <div class="form-actions sos-settings-actions">
      <button class="button ghost" type="button" id="notificationTestConnection">${t("settings.notification.testConnection")}</button>
      <button class="button ghost" type="button" id="notificationTestSend">${t("settings.notification.testSend")}</button>
      <button class="button primary" type="submit">${t("save")}</button>
    </div>
  </form>`;
}

function notificationProviderStatusCard(provider) {
  return `<div class="sos-status-card"><strong>${notificationProviderLabel(provider)}</strong><span class="badge ${statusClass(notificationProviderState.status[provider] || "NOT CONFIGURED")}">${escapeHtml(notificationProviderState.status[provider] || "NOT CONFIGURED")}</span></div>`;
}

function notificationProviderLabel(provider) {
  return t(`settings.notification.provider.${provider}`);
}

function renderNotificationSettingField(key, type, options = []) {
  const value = notificationProviderState.settings[key];
  const schema = notificationProviderState.schema[key] || {};
  const label = t(`settings.notification.field.${key}`);
  const hint = t(`settings.notification.hint.${key}`);
  let control = "";
  if (type === "boolean") control = `<label class="toggle-row"><input type="checkbox" name="${escapeHtml(key)}" ${value ? "checked" : ""}> <span>${t("yes")}</span></label>`;
  else if (type === "enum") control = `<select name="${escapeHtml(key)}">${options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${notificationProviderLabel(option)}</option>`).join("")}</select>`;
  else if (type === "integer") control = `<input type="number" name="${escapeHtml(key)}" min="${escapeHtml(schema.min ?? 0)}" max="${escapeHtml(schema.max ?? 100000000)}" value="${escapeHtml(value ?? 0)}">`;
  else control = `<input name="${escapeHtml(key)}" value="${escapeHtml(value ?? "")}" ${type === "url" ? "inputmode=\"url\"" : ""}>`;
  return `<label class="sos-setting-card"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(hint)}</span>${control}</label>`;
}

function renderNotificationSecretField(field) {
  const info = notificationProviderState.secrets[field] || {};
  return `<label class="sos-setting-card"><strong>${escapeHtml(t(`settings.notification.secret.${field}`))}</strong><span>${escapeHtml(info.configured ? `${t("settings.notification.secretConfigured")}: ${info.masked}` : t("settings.notification.secretNotConfigured"))}</span><input type="password" name="secret_${escapeHtml(field)}" autocomplete="new-password" placeholder="${escapeHtml(t("settings.notification.secretKeep"))}"><label class="toggle-row"><input type="checkbox" name="clear_${escapeHtml(field)}"> <span>${t("settings.notification.secretClear")}</span></label></label>`;
}

function renderGdprSettings(rows) {
  const byKey = Object.fromEntries(rows.map((row) => [row.setting_key, row]));
  return `<div class="panel-list settings-gdpr-list">
    ${GDPR_SETTING_FIELDS.map((field) => renderGdprSettingField(field, byKey[field.key])).join("")}
  </div>`;
}

function renderGdprSettingField(field, row = {}) {
  const meta = gdprSettingMeta(field.key);
  return `<article class="list-row settings-gdpr-row">
    <div>
      <strong>${escapeHtml(meta.title)}</strong>
      <span>${escapeHtml(meta.description)}</span>
      <small class="muted">${escapeHtml(meta.hint)}</small>
    </div>
    <span>${escapeHtml(row.setting_value || "")}</span>
    <span class="muted">${escapeHtml(meta.unit)}</span>
    <button class="button ghost" data-setting="${escapeHtml(field.key)}">${t("edit")}</button>
  </article>`;
}

function renderBackupSettings(data) {
  backupSettingsState = { settings: { ...(data.settings || {}) }, defaults: { ...(data.defaults || {}) }, modes: data.modes || {}, status: data.status || {}, rows: data.rows || [] };
  return `<form id="backupSettingsForm" class="backup-settings-form">
    <div class="backup-status-grid">
      <div class="sos-status-card"><strong>${t("settings.backup.storage")}</strong><span>${escapeHtml(backupSettingsState.status.backupDir || "-")}</span></div>
      <div class="sos-status-card"><strong>${t("settings.backup.freeSpace")}</strong><span>${formatBytes(backupSettingsState.status.freeBytes || 0)}</span></div>
      <div class="sos-status-card"><strong>${t("settings.backup.running")}</strong><span>${backupSettingsState.status.running ? `#${escapeHtml(backupSettingsState.status.running.id)}` : t("no")}</span></div>
    </div>
    ${BACKUP_SETTINGS_SECTIONS.map((section, index) => renderBackupSection(section, index === 0)).join("")}
    <details class="sos-settings-section" open><summary><span>${t("settings.backup.section.modes.title")}</span><small>${t("settings.backup.section.modes.description")}</small></summary>${renderBackupModes()}</details>
    <details class="sos-settings-section" open><summary><span>${t("settings.backup.section.copies.title")}</span><small>${t("settings.backup.section.copies.description")}</small></summary>${renderBackupCopies()}</details>
    <details class="sos-settings-section"><summary><span>${t("settings.backup.section.cleanup.title")}</span><small>${t("settings.backup.section.cleanup.description")}</small></summary><div id="backupCleanupPlan" class="backup-plan empty">${t("settings.backup.cleanupEmpty")}</div></details>
    <div class="form-actions sos-settings-actions">
      <button class="button ghost" type="button" id="backupCancelSettings">${t("cancel")}</button>
      <button class="button ghost" type="button" id="backupResetDefaults">${t("settings.resetDefaults")}</button>
      <button class="button ghost" type="button" id="backupCleanupDryRun">${t("settings.backup.cleanupDryRun")}</button>
      <button class="button primary" type="button" id="backupRunNow">${t("settings.backup.runNow")}</button>
      <button class="button primary" type="submit" id="backupSaveSettings">${t("save")}</button>
    </div>
  </form>`;
}

function renderBackupSection(section, open) {
  return `<details class="sos-settings-section" ${open ? "open" : ""}>
    <summary><span>${t(`settings.backup.section.${section.id}.title`)}</span><small>${t(`settings.backup.section.${section.id}.description`)}</small></summary>
    <div class="sos-settings-grid">${section.fields.map(renderBackupField).join("")}</div>
  </details>`;
}

function renderBackupField(key) {
  const def = BACKUP_SETTING_FIELDS[key];
  const value = backupSettingsState.settings[key];
  const title = t(`settings.backup.field.${key}.title`);
  const desc = t(`settings.backup.field.${key}.description`);
  let control = "";
  if (def.type === "boolean") control = `<label class="switch"><input type="checkbox" name="${key}" ${value ? "checked" : ""}><span></span></label>`;
  else if (def.type === "integer") control = `<input type="number" name="${key}" min="${def.min}" max="${def.max}" step="1" value="${escapeHtml(value)}">`;
  else if (def.type === "time") control = `<input type="time" name="${key}" value="${escapeHtml(value)}">`;
  else if (def.type === "enum") control = `<select name="${key}">${def.options.map((item) => `<option value="${item}" ${item === value ? "selected" : ""}>${t(`settings.backup.option.${item}`)}</option>`).join("")}</select>`;
  else if (def.type === "days") control = `<div class="sos-role-list">${def.options.map((day) => `<label><input type="checkbox" name="${key}" value="${day}" ${(value || []).includes(day) ? "checked" : ""}> ${t(`settings.backup.day.${day}`)}</label>`).join("")}</div>`;
  else if (def.type === "roles") control = `<div class="sos-role-list">${def.options.map((role) => `<label><input type="checkbox" name="${key}" value="${role}" ${(value || []).includes(role) ? "checked" : ""}> ${t(`settings.backup.role.${role}`)}</label>`).join("")}</div>`;
  return `<label class="sos-setting-field ${def.warning ? "backup-warning-field" : ""}"><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(desc)}</small></span>${control}${def.unit ? `<em>${t(`settings.unit.${def.unit}`)}</em>` : ""}</label>`;
}

function renderBackupModes() {
  return `<div class="backup-mode-grid">${Object.entries(backupSettingsState.modes || {}).map(([mode, info]) => `<article class="sos-status-card"><strong>${t(`settings.backup.mode.${mode}`)}</strong><span>${(info.components || []).map((item) => t(`settings.backup.component.${item}`)).join(", ") || "-"}</span></article>`).join("")}</div>`;
}

function renderBackupCopies() {
  const rows = backupSettingsState.rows || [];
  if (!rows.length) return `<div class="empty">${t("empty")}</div>`;
  return `<div class="backup-copy-list">${rows.map((row) => `<article class="list-row backup-copy-row"><div><strong>#${escapeHtml(row.id)} ${backupModeLabel(row.mode || row.backup_type)}</strong><span>${backupStatusLabel(row.status)} <span aria-hidden="true">&middot;</span> ${formatBytes(row.file_size_bytes || 0)} <span aria-hidden="true">&middot;</span> ${formatDate(row.started_at)}</span><small>${escapeHtml(row.sha256 || "")}</small></div><span class="badge ${statusClass(row.status)}">${backupStatusLabel(row.verification_status || row.status)}</span><button class="button ghost" type="button" data-backup-verify="${escapeHtml(row.id)}">${t("settings.backup.verify")}</button><button class="button ghost" type="button" data-backup-protect="${escapeHtml(row.id)}" data-protect="${row.is_protected ? "0" : "1"}">${row.is_protected ? t("settings.backup.unprotect") : t("settings.backup.protect")}</button></article>`).join("")}</div>`;
}

function backupModeLabel(value) {
  if (!value) return "-";
  const key = `settings.backup.mode.${value}`;
  const label = t(key);
  return escapeHtml(label === key ? value : label);
}

function backupStatusLabel(value) {
  if (!value) return "-";
  const key = `settings.backup.status.${value}`;
  const label = t(key);
  return escapeHtml(label === key ? value : label);
}

function backupCleanupReasonLabel(value) {
  if (!value) return "-";
  const key = `settings.backup.cleanupReason.${value}`;
  const label = t(key);
  return escapeHtml(label === key ? value : label);
}

function bindBackupSettingsForm() {
  const form = qs("#backupSettingsForm");
  if (!form || !backupSettingsState) return;
  form.addEventListener("submit", async (event) => { event.preventDefault(); await saveBackupSettings(); });
  qs("#backupCancelSettings")?.addEventListener("click", () => loadRoute());
  qs("#backupResetDefaults")?.addEventListener("click", async () => { if (!confirm(t("settings.backup.resetConfirm"))) return; await api("/settings/backup/reset", { method: "POST" }); notice(t("settings.backup.resetDone")); await loadRoute(); });
  qs("#backupRunNow")?.addEventListener("click", async () => { const mode = prompt(t("settings.backup.modePrompt"), "database") || "database"; notice(t("backupStarted")); await api("/backups", { method: "POST", body: { mode } }); notice(t("backupCompleted")); await loadRoute(); });
  qs("#backupCleanupDryRun")?.addEventListener("click", async () => { const result = await api("/backups/dry-run", { method: "POST" }); qs("#backupCleanupPlan").innerHTML = renderBackupCleanupPlan(result.plan || {}); });
  qsa("[data-backup-verify]").forEach((button) => button.addEventListener("click", async () => { await api(`/backups/${button.dataset.backupVerify}/verify`, { method: "POST" }); notice(t("settings.backup.verified")); await loadRoute(); }));
  qsa("[data-backup-protect]").forEach((button) => button.addEventListener("click", async () => { await api(`/backups/${button.dataset.backupProtect}/protect`, { method: "POST", body: { protect: button.dataset.protect === "1" } }); notice(t("success")); await loadRoute(); }));
}

function collectBackupSettings() {
  const form = qs("#backupSettingsForm");
  const settings = { ...backupSettingsState.settings };
  for (const [key, def] of Object.entries(BACKUP_SETTING_FIELDS)) {
    if (def.type === "boolean") settings[key] = Boolean(form.elements[key]?.checked);
    else if (def.type === "integer") settings[key] = Number(form.elements[key]?.value);
    else if (def.type === "time" || def.type === "enum") settings[key] = String(form.elements[key]?.value || "");
    else if (def.type === "days" || def.type === "roles") settings[key] = qsa(`[name="${key}"]:checked`).map((item) => item.value);
  }
  return settings;
}

async function saveBackupSettings() {
  await api("/settings/backup", { method: "PUT", body: { settings: collectBackupSettings() } });
  notice(t("settings.backup.saved"));
  await loadRoute();
}

function renderBackupCleanupPlan(plan) {
  const rows = plan.delete || [];
  if (!rows.length) return `<div class="empty">${t("settings.backup.cleanupNothing")}</div>`;
  return `<div class="backup-copy-list">${rows.map((row) => `<article class="list-row"><div><strong>#${escapeHtml(row.id)} ${backupModeLabel(row.mode)}</strong><span>${backupCleanupReasonLabel(row.reason)} <span aria-hidden="true">&middot;</span> ${formatBytes(row.sizeBytes || 0)}</span><small>${escapeHtml(row.path || "")}</small></div></article>`).join("")}<p class="muted">${t("settings.backup.reclaim")}: ${formatBytes(plan.reclaimBytes || 0)}</p></div>`;
}


function renderAiSettings(data) {
  aiSettingsState = { settings: { ...(data.settings || {}) }, defaults: { ...(data.defaults || {}) }, features: data.features || AI_FEATURES, plans: data.plans || AI_PLANS, apiKey: data.apiKey || {}, stats: data.stats || [] };
  return `<form id="aiSettingsForm" class="backup-settings-form ai-settings-form">
    <details class="sos-settings-section" open><summary><span>${t("settings.ai.section.connection.title")}</span><small>${t("settings.ai.section.connection.description")}</small></summary>
      <div class="backup-status-grid">
        <div class="sos-status-card"><strong>${t("settings.ai.apiStatus")}</strong><span>${aiSettingsState.apiKey.configured ? t("settings.ai.connected") : t("settings.ai.notConfigured")}</span></div>
        <div class="sos-status-card"><strong>${t("settings.ai.apiKey")}</strong><span>${escapeHtml(aiSettingsState.apiKey.masked || "-")}</span></div>
      </div>
      <div class="sos-settings-grid"><label class="sos-setting-field"><span><strong>${t("settings.ai.newApiKey")}</strong><small>${t("settings.ai.newApiKeyDescription")}</small></span><input type="password" name="aiApiKey" autocomplete="off"></label></div>
    </details>
    <details class="sos-settings-section" open><summary><span>${t("settings.ai.section.models.title")}</span><small>${t("settings.ai.section.models.description")}</small></summary>
      <div class="sos-settings-grid"><label class="sos-setting-field"><span><strong>${t("settings.ai.modelsAvailable")}</strong><small>${t("settings.ai.modelsAvailableDescription")}</small></span><textarea name="ai_models_available" rows="3">${escapeHtml((aiSettingsState.settings.ai_models_available || []).join("\n"))}</textarea></label><label class="sos-setting-field"><span><strong>${t("settings.ai.enabled")}</strong><small>${t("settings.ai.enabledDescription")}</small></span><label class="switch"><input type="checkbox" name="ai_enabled" ${aiSettingsState.settings.ai_enabled ? "checked" : ""}><span></span></label></label></div>
    </details>
    <details class="sos-settings-section" open><summary><span>${t("settings.ai.section.routing.title")}</span><small>${t("settings.ai.section.routing.description")}</small></summary>${renderAiFeatureTable()}</details>
    <details class="sos-settings-section" open><summary><span>${t("settings.ai.section.limits.title")}</span><small>${t("settings.ai.section.limits.description")}</small></summary>${renderAiLimitTable()}</details>
    <details class="sos-settings-section"><summary><span>${t("settings.ai.section.stats.title")}</span><small>${t("settings.ai.section.stats.description")}</small></summary>${renderAiStats()}</details>
    <details class="sos-settings-section"><summary><span>${t("settings.ai.section.audit.title")}</span><small>${t("settings.ai.section.audit.description")}</small></summary><div class="empty">${t("settings.ai.auditNotice")}</div></details>
    <div class="form-actions sos-settings-actions"><button class="button ghost" type="button" id="aiResetDefaults">${t("settings.resetDefaults")}</button><button class="button ghost" type="button" id="aiTestConnection">${t("settings.ai.testConnection")}</button><button class="button primary" type="submit">${t("save")}</button></div>
  </form>`;
}
function renderAiFeatureTable() {
  const models = aiSettingsState.settings.ai_models_available || [];
  return `<div class="table-wrap"><table><thead><tr><th>${t("settings.ai.feature")}</th><th>${t("settings.ai.enabled")}</th><th>${t("settings.ai.primaryModel")}</th><th>${t("settings.ai.fallbackModel")}</th><th>${t("settings.ai.fallback")}</th><th>${t("settings.ai.maxTokens")}</th><th>${t("settings.ai.counter")}</th></tr></thead><tbody>${aiSettingsState.features.map((f) => `<tr><td>${t(`settings.ai.feature.${f}`)}</td><td><input type="checkbox" name="ai_feature_${f}_enabled" ${aiSettingsState.settings[`ai_feature_${f}_enabled`] ? "checked" : ""}></td><td>${aiModelSelect(`ai_feature_${f}_primary_model`, aiSettingsState.settings[`ai_feature_${f}_primary_model`], models)}</td><td>${aiModelSelect(`ai_feature_${f}_fallback_model`, aiSettingsState.settings[`ai_feature_${f}_fallback_model`], models)}</td><td><input type="checkbox" name="ai_feature_${f}_fallback_enabled" ${aiSettingsState.settings[`ai_feature_${f}_fallback_enabled`] ? "checked" : ""}></td><td><input type="number" name="ai_feature_${f}_max_tokens" min="128" max="8000" value="${escapeHtml(aiSettingsState.settings[`ai_feature_${f}_max_tokens`])}"></td><td><select name="ai_feature_${f}_counter">${AI_COUNTERS.map((c) => `<option value="${c}" ${aiSettingsState.settings[`ai_feature_${f}_counter`] === c ? "selected" : ""}>${t(`settings.ai.counter.${c}`)}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>`;
}
function aiModelSelect(name, value, models) { return `<select name="${name}">${models.map((m) => `<option value="${escapeHtml(m)}" ${m === value ? "selected" : ""}>${escapeHtml(m)}</option>`).join("")}</select>`; }
function renderAiLimitTable() { return `<div class="table-wrap"><table><thead><tr><th>${t("settings.ai.plan")}</th><th>${t("settings.ai.counter.normal")}</th><th>${t("settings.ai.counter.photo")}</th></tr></thead><tbody>${AI_PLANS.map((p) => `<tr><td>${t(`settings.ai.plan.${p}`)}</td><td><input type="number" name="ai_limit_${p}_normal" min="0" max="10000" value="${escapeHtml(aiSettingsState.settings[`ai_limit_${p}_normal`])}"></td><td><input type="number" name="ai_limit_${p}_photo" min="0" max="10000" value="${escapeHtml(aiSettingsState.settings[`ai_limit_${p}_photo`])}"></td></tr>`).join("")}</tbody></table></div>`; }
function renderAiStats() { return (aiSettingsState.stats || []).length ? `<div class="panel-list">${aiSettingsState.stats.map((row) => `<article class="list-row"><div><strong>${aiFeatureLabel(row.request_type)} / ${aiCounterLabel(row.counter_type)}</strong><span>${aiStatusLabel(row.status)}: ${escapeHtml(row.count)}</span></div></article>`).join("")}</div>` : `<div class="empty">${t("empty")}</div>`; }
function aiFeatureLabel(value) { if (!value) return "-"; const key = `settings.ai.feature.${value}`; const label = t(key); return escapeHtml(label === key ? value : label); }
function aiCounterLabel(value) { if (!value) return "-"; const key = `settings.ai.counter.${value}`; const label = t(key); return escapeHtml(label === key ? value : label); }
function aiStatusLabel(value) { if (!value) return "-"; const key = `settings.ai.status.${value}`; const label = t(key); return escapeHtml(label === key ? value : label); }
function bindAiSettingsForm() {
  const form = qs("#aiSettingsForm"); if (!form || !aiSettingsState) return;
  form.addEventListener("submit", async (event) => { event.preventDefault(); await saveAiSettings(); });
  qs("#aiResetDefaults")?.addEventListener("click", async () => { if (!confirm(t("settings.ai.resetConfirm"))) return; await api("/settings/ai/reset", { method:"POST" }); notice(t("settings.ai.resetDone")); await loadRoute(); });
  qs("#aiTestConnection")?.addEventListener("click", async () => { await api("/settings/ai/test", { method:"POST" }); notice(t("settings.ai.connectionOk")); await loadRoute(); });
}
function collectAiSettings() {
  const form = qs("#aiSettingsForm"); const s = { ...aiSettingsState.settings };
  s.ai_enabled = Boolean(form.elements.ai_enabled?.checked);
  s.ai_models_available = String(form.elements.ai_models_available?.value || "").split(/\n|,/).map((x) => x.trim()).filter(Boolean);
  for (const f of aiSettingsState.features) { s[`ai_feature_${f}_enabled`] = Boolean(form.elements[`ai_feature_${f}_enabled`]?.checked); s[`ai_feature_${f}_primary_model`] = form.elements[`ai_feature_${f}_primary_model`]?.value; s[`ai_feature_${f}_fallback_model`] = form.elements[`ai_feature_${f}_fallback_model`]?.value; s[`ai_feature_${f}_fallback_enabled`] = Boolean(form.elements[`ai_feature_${f}_fallback_enabled`]?.checked); s[`ai_feature_${f}_max_tokens`] = Number(form.elements[`ai_feature_${f}_max_tokens`]?.value); s[`ai_feature_${f}_counter`] = form.elements[`ai_feature_${f}_counter`]?.value; }
  for (const p of AI_PLANS) { s[`ai_limit_${p}_normal`] = Number(form.elements[`ai_limit_${p}_normal`]?.value); s[`ai_limit_${p}_photo`] = Number(form.elements[`ai_limit_${p}_photo`]?.value); }
  return s;
}
async function saveAiSettings() {
  const form = qs("#aiSettingsForm");
  const apiKey = String(form.elements.aiApiKey?.value || "").trim();
  await api("/settings/ai", { method:"PUT", body:{ settings: collectAiSettings() } });
  if (apiKey) await api("/settings/ai/api-key", { method:"POST", body:{ apiKey } });
  notice(t("settings.ai.saved")); await loadRoute();
}

function renderSosSettings(data) {
  sosSettingsState = { settings: { ...(data.settings || {}) }, defaults: { ...(data.defaults || {}) }, schema: data.schema || {}, metadata: data.metadata || {}, roles: data.roles || [], channelStatus: data.channelStatus || {} };
  return `<form id="sosSettingsForm" class="sos-settings-form">
    <div class="notice ${sosSettingsState.settings.sos_test_mode ? "" : "hidden"}">${t("settings.sos.testModeBanner")}</div>
    ${SOS_SETTINGS_SECTIONS.map((section, index) => renderSosSection(section, index === 0)).join("")}
    <div class="form-actions sos-settings-actions">
      <span class="muted hidden" id="sosUnsaved">${t("settings.sos.unsaved")}</span>
      <button class="button ghost" type="button" id="sosCancelSettings">${t("cancel")}</button>
      <button class="button ghost" type="button" id="sosResetDefaults">${t("settings.resetDefaults")}</button>
      <button class="button primary" type="submit" id="sosSaveSettings">${t("save")}</button>
    </div>
  </form>`;
}

function renderSosSection(section, open) {
  return `<details class="sos-settings-section" ${open ? "open" : ""}>
    <summary><span>${t(`settings.sos.section.${section.id}.title`)}</span><small>${t(`settings.sos.section.${section.id}.description`)}</small></summary>
    ${section.id === "status" ? renderSosStatusSection() : `<div class="sos-settings-grid">${section.fields.map(renderSosField).join("")}</div>`}
  </details>`;
}

function renderSosStatusSection() {
  return `<div class="sos-status-grid">
    ${sosStatus("push", sosSettingsState.channelStatus.push)}
    ${sosStatus("smsExternalProvider", sosSettingsState.channelStatus.smsExternalProvider)}
    <div class="muted">${t("settings.sos.statusDisclaimer")}</div>
  </div>`;
}

function sosStatus(key, value) {
  return `<div class="sos-status-card"><strong>${t(`settings.sos.status.${key}.title`)}</strong><span>${t(`settings.sos.status.${value || "not_configured"}`)}</span></div>`;
}

function renderSosField(key) {
  const def = SOS_SETTING_FIELDS[key];
  const value = sosSettingsState.settings[key];
  const disabled = def.dependsOn && !sosSettingsState.settings[def.dependsOn];
  const common = `data-sos-key="${escapeHtml(key)}" ${disabled ? "disabled" : ""}`;
  const control = def.type === "boolean" ? `<label class="switch"><input type="checkbox" ${common} ${value ? "checked" : ""}><span></span></label>`
    : def.type === "integer" ? `<input type="number" ${common} min="${def.min}" max="${def.max}" step="1" value="${escapeHtml(value)}">`
    : def.type === "roles" ? `<div class="sos-role-list">${sosSettingsState.roles.map((role) => `<label><input type="checkbox" ${common} value="${escapeHtml(role)}" ${Array.isArray(value) && value.includes(role) ? "checked" : ""}> ${t(`settings.sos.role.${role}`)}</label>`).join("")}</div>`
    : def.type === "text" ? `<textarea ${common} rows="${def.rows || 3}">${escapeHtml(value || "")}</textarea>`
    : `<select ${common}>${def.options.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? "selected" : ""}>${t(`settings.sos.option.${option}`)}</option>`).join("")}</select>`;
  return `<label class="sos-setting-field ${disabled ? "is-disabled" : ""}">
    <span>${t(`settings.sos.field.${key}.title`)}</span>
    <small>${t(`settings.sos.field.${key}.description`)}</small>
    ${control}
    <em>${t(`settings.sos.field.${key}.hint`)}${def.unit ? ` · ${t(`settings.unit.${def.unit}`)}` : ""}</em>
    ${renderSosFieldRuntime(key, value, def)}
  </label>`;
}

function renderSosFieldRuntime(key, value, def) {
  const runtime = sosRuntimeFor(key, def);
  const updatedAt = sosSettingsState.metadata?.[key]?.updatedAt;
  return `<div class="sos-field-runtime">
    <span><b>${t("settings.sos.meta.saved")}</b> ${escapeHtml(formatSosValue(value, def))}</span>
    <span><b>${t("settings.sos.meta.effective")}</b> ${escapeHtml(formatSosValue(value, def))}</span>
    <span><b>${t("settings.sos.meta.connection")}</b> ${t(runtime.connectionKey)}</span>
    <span><b>${t("settings.sos.meta.impact")}</b> ${t(runtime.impactKey)}</span>
    <span><b>${t("settings.sos.meta.updated")}</b> ${updatedAt ? escapeHtml(formatDate(updatedAt)) : t("settings.sos.meta.notUpdated")}</span>
  </div>`;
}

function sosRuntimeFor(key, def) {
  if (key === "sos_sms_type" || key === "sos_sms_enabled" || key === "sos_sms_create_server_first") return { connectionKey: "settings.sos.connection.dryRun", impactKey: "settings.sos.impact.app" };
  if (SOS_PROVIDER_FIELDS.has(key)) return { connectionKey: "settings.sos.connection.providerRequired", impactKey: "settings.sos.impact.provider" };
  if (SOS_WORKER_FIELDS.has(key)) {
    const connected = sosSettingsState.channelStatus.notificationWorker === "configured";
    return { connectionKey: connected ? "settings.sos.connection.workerConfigured" : "settings.sos.connection.worker", impactKey: "settings.sos.impact.worker" };
  }
  if (SOS_APP_USED_FIELDS.has(key) || sosSettingsState.schema?.[key]?.app === true) return { connectionKey: "settings.sos.connection.app", impactKey: "settings.sos.impact.app" };
  if (SOS_BACKEND_FIELDS.has(key) || sosSettingsState.schema?.[key]?.wired === true) return { connectionKey: "settings.sos.connection.backend", impactKey: "settings.sos.impact.backend" };
  return { connectionKey: "settings.sos.connection.savedOnly", impactKey: "settings.sos.impact.savedOnly" };
}

function formatSosValue(value, def) {
  if (def.type === "boolean") return t(value ? "yes" : "no");
  if (Array.isArray(value)) return value.map((role) => t(`settings.sos.role.${role}`)).join(", ");
  if (def.options && def.options.includes(value)) return t(`settings.sos.option.${value}`);
  return String(value ?? "");
}

function bindSosSettingsForm() {
  const form = qs("#sosSettingsForm");
  if (!form) return;
  const markDirty = () => qs("#sosUnsaved")?.classList.remove("hidden");
  form.addEventListener("input", () => { markDirty(); updateSosDependentFields(); });
  form.addEventListener("change", () => { markDirty(); updateSosDependentFields(); });
  form.addEventListener("submit", saveSosSettings);
  qs("#sosCancelSettings")?.addEventListener("click", () => loadRoute());
  qs("#sosResetDefaults")?.addEventListener("click", resetSosSettings);
  updateSosDependentFields();
}

function updateSosDependentFields() {
  if (!sosSettingsState) return;
  const current = collectSosSettings(false);
  for (const [key, def] of Object.entries(SOS_SETTING_FIELDS)) {
    if (!def.dependsOn) continue;
    qsa(`[data-sos-key="${key}"]`).forEach((input) => {
      input.disabled = !current[def.dependsOn];
      input.closest(".sos-setting-field")?.classList.toggle("is-disabled", !current[def.dependsOn]);
    });
  }
}

function collectSosSettings(validate = true) {
  const result = {};
  for (const [key, def] of Object.entries(SOS_SETTING_FIELDS)) {
    const nodes = qsa(`[data-sos-key="${key}"]`);
    if (def.type === "boolean") result[key] = nodes[0]?.checked === true;
    else if (def.type === "roles") result[key] = nodes.filter((node) => node.checked).map((node) => node.value);
    else if (def.type === "integer") {
      const value = Number(nodes[0]?.value);
      if (validate && (!Number.isInteger(value) || value < def.min || value > def.max)) throw new Error(t("settings.sos.validation.integer"));
      result[key] = Number.isInteger(value) ? value : def.min;
    } else result[key] = nodes[0]?.value || "";
  }
  if (validate && result.sos_auto_close_enabled && !result.sos_auto_close_after_hours) throw new Error(t("settings.sos.validation.autoClose"));
  return result;
}

async function saveSosSettings(event) {
  event.preventDefault();
  if (sosSettingsSaving) return;
  try {
    sosSettingsSaving = true;
    qs("#sosSaveSettings").disabled = true;
    await api("/settings/sos", { method: "PUT", body: { settings: collectSosSettings(true) } });
    notice(t("settings.sos.saved"));
    await loadRoute();
  } catch (error) {
    notice(error.message || readableError(error), true);
  } finally {
    sosSettingsSaving = false;
    const button = qs("#sosSaveSettings");
    if (button) button.disabled = false;
  }
}

async function resetSosSettings() {
  if (!confirm(t("settings.sos.resetConfirm"))) return;
  await api("/settings/sos/reset", { method: "POST", body: {} });
  notice(t("settings.sos.resetDone"));
  await loadRoute();
}

async function editGdprSetting(key) {
  const row = (await api("/settings")).rows.find((item) => item.setting_key === key);
  const meta = gdprSettingMeta(key);
  if (!row || !meta) return notice(t("requestFailed"), true);
  const next = prompt(`${meta.title}\n${meta.description}\n${t("settingsUnit")}: ${meta.unit}`, row.setting_value);
  if (next == null) return;
  const value = Number(next);
  if (!Number.isInteger(value) || value <= 0) return notice(meta.validation, true);
  try {
    await api(`/settings/${encodeURIComponent(key)}`, { method: "PUT", body: { value } });
    notice(t("success"));
    await loadRoute();
  } catch (error) {
    notice(readableError(error) || t("settingsSaveError"), true);
  }
}


function actionButtons(route) {
  const buttons = [];
  if (["users", "subscriptions", "payments", "devices", "audit", "security", "referrals"].includes(route)) {
    buttons.push(`<button class="button ghost" data-export="${route}">${t("export")}</button>`);
  }
  if (route === "admins" && can("admins:write")) buttons.push(`<button class="button primary" data-create="admin">${t("createAdmin")}</button>`);
  if (route === "support" && can("support:write")) buttons.push(`<button class="button primary" data-create="ticket">${t("createTicket")}</button>`);
  if (route === "notifications" && can("notifications:write")) buttons.push(`<button class="button primary" data-create="campaign">${t("createCampaign")}</button>`);
  if (route === "help" && can("help:write")) buttons.push(`<button class="button primary" data-create="help">${t("createHelpArticle")}</button>`);
  if (route === "localizations" && can("localizations:write")) buttons.push(`<button class="button primary" data-create="localization">${t("createLocalization")}</button>`);
  if (route === "backups" && can("backups:write")) buttons.push(`<button class="button primary" data-create="backup">${t("runBackup")}</button>`);
  if (route === "gdpr" && can("gdpr.create")) buttons.push(`<button class="button primary" data-create="gdpr">${t("createGdpr")}</button>`);
  if (route === "versions" && can("versions:write")) buttons.push(`<button class="button primary" data-create="version">${t("setVersionPolicy")}</button>`);
  return buttons.join("");
}

function tableHtml(cols, rows, route = "users") {
  return `<div class="table-wrap"><table><thead><tr>${cols.map((col) => `<th>${escapeHtml(columnTitle(col))}</th>`).join("")}<th></th></tr></thead><tbody>
    ${rows.map((row) => `<tr>${cols.map((col) => cell(row[col], col, row)).join("")}<td>${rowActions(route, row)}</td></tr>`).join("")}
  </tbody></table></div>`;
}

function rowActions(route, row) {
  if (route === "admins") return `<button class="button ghost" data-admin="${row.id}" data-roles="${escapeHtml((row.roles || []).join(","))}">${t("editAdmin")}</button>`;
  if (route === "support") return `<div class="row-actions">
    <button class="button ghost" data-ticket="${row.id}">${t("details")}</button>
    <button class="button danger" data-delete-ticket="${row.id}">${t("deleteTicket")}</button>
  </div>`;
  if (route === "family" && /^\d+$/.test(String(row.id))) return `<div class="row-actions">
    ${row.status !== "accepted" ? `<button class="button primary" data-family-status="${row.id}" data-status="accepted">${t("familyAccessEnable")}</button>` : ""}
    ${row.status !== "pending" ? `<button class="button ghost" data-family-status="${row.id}" data-status="pending">${t("familyAccessPending")}</button>` : ""}
    ${row.status !== "revoked" ? `<button class="button danger" data-family-status="${row.id}" data-status="revoked">${t("familyAccessDisable")}</button>` : ""}
  </div>`;
  if (route === "notifications") return `<div class="row-actions">
    <button class="button ghost" data-campaign="${row.id}">${t("details")}</button>
    ${can("notifications:write") && row.status !== "sent" ? `<button class="button primary" data-send-campaign="${row.id}">${t("sendNow")}</button>` : ""}
  </div>`;
  if (route === "backups" && can("*")) return `<button class="button danger" data-delete-backup="${row.id}">${t("deleteBackup")}</button>`;
  if (route === "errors" && can("*")) return `<button class="button danger" data-delete-error="${row.id}">${t("deleteError")}</button>`;
  if (route === "referrals") return `<button class="button ghost" data-referral="${row.id}">${t("details")}</button>`;
  if (route === "help") return `<button class="button ghost" data-help="${row.id}">${t("details")}</button>`;
  if (route === "about") return `<button class="button ghost" data-about="${row.id}" data-locale="${escapeHtml(row.locale || state.lang)}">${t("details")}</button>`;
  if (route === "gdpr") return `<button class="button ghost" data-gdpr="${row.id}">${t("details")}</button>`;
  if (route === "settings" && can("*")) return `<button class="button ghost" data-setting="${escapeHtml(row.setting_key)}">${t("edit")}</button>`;
  if (row.id && (route === "users" || row.email)) return `<button class="button ghost" data-user="${row.user_id || row.id}">${t("details")}</button>`;
  return "";
}

function cell(value, key, row = {}) {
  if (value == null) return "<td></td>";
  if (key === "premiumPlan") return premiumPlanCell(value, row);
  if (Array.isArray(value)) return `<td>${escapeHtml(value.join(", "))}</td>`;
  if (typeof value === "boolean") return `<td><span class="badge ${value ? "ok" : "warn"}">${value ? t("yes") : t("no")}</span></td>`;
  if (/status|severity/i.test(key)) return `<td><span class="badge ${statusClass(value)}">${escapeHtml(statusLabel(value))}</span></td>`;
  if (/amount_minor/.test(key)) return `<td>${money(value)}</td>`;
  if (/file_size_bytes/i.test(key)) return `<td>${formatBytes(value)}</td>`;
  if (/duration_ms/i.test(key)) return `<td>${formatDuration(value)}</td>`;
  if (/sha256/i.test(key)) return `<td><code>${escapeHtml(shortHash(value))}</code></td>`;
  if (/created|updated|expires|seen|until|at$/i.test(key)) return `<td>${value ? formatDate(value) : ""}</td>`;
  if (typeof value === "object") return `<td>${escapeHtml(JSON.stringify(value))}</td>`;
  return `<td>${escapeHtml(String(value))}</td>`;
}

function premiumPlanCell(value, row) {
  return `<td><span>${escapeHtml(String(value || "-"))}</span><small class="cell-subtext">${escapeHtml(subscriptionDaysLeft(row.subscriptionExpiresAt))}</small></td>`;
}

function subscriptionDaysLeft(value) {
  if (!value) return t("noExpiry");
  const expires = new Date(value).getTime();
  if (!Number.isFinite(expires)) return t("noExpiry");
  const diffDays = Math.ceil((expires - Date.now()) / 86400000);
  if (diffDays < 0) return t("expired");
  if (diffDays === 0) return t("expiresToday");
  return t("daysLeft").replace("{days}", String(diffDays));
}

function statusClass(value) {
  const normalized = String(value).toLowerCase();
  if (["active", "succeeded", "paid", "accepted", "success", "info", "resolved", "sent", "delivered"].includes(normalized)) return "ok";
  if (["inactive", "revoked", "failed", "expired", "refunded", "critical", "closed"].includes(normalized)) return "danger";
  return "warn";
}

function statusLabel(value) {
  return String(value) === "no_members" ? t("noMembers") : String(value);
}

function pagination(data) {
  const page = Number(data.page || 1);
  const pages = Math.max(Math.ceil(Number(data.total || 0) / Number(data.limit || 25)), 1);
  return `<div class="pagination">
    <button class="button ghost" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>${t("previous")}</button>
    <span>${t("page")} ${page} / ${pages}</span>
    <button class="button ghost" data-page="${page + 1}" ${page >= pages ? "disabled" : ""}>${t("next")}</button>
  </div>`;
}

function bindRowActions() {
  qsa("[data-page]").forEach((button) => button.addEventListener("click", () => {
    state.page = Number(button.dataset.page);
    loadRoute();
  }));
  qsa("[data-user]").forEach((button) => button.addEventListener("click", () => openUser(button.dataset.user).catch(showActionError)));
  qsa("[data-admin]").forEach((button) => button.addEventListener("click", () => openAdmin(button)));
  qsa("[data-ticket]").forEach((button) => button.addEventListener("click", () => openTicket(button.dataset.ticket)));
  qsa("[data-delete-ticket]").forEach((button) => button.addEventListener("click", () => deleteTicket(button.dataset.deleteTicket).catch(showActionError)));
  qsa("[data-delete-error]").forEach((button) => button.addEventListener("click", () => deleteError(button.dataset.deleteError).catch(showActionError)));
  qsa("[data-delete-backup]").forEach((button) => button.addEventListener("click", () => deleteBackup(button.dataset.deleteBackup).catch(showActionError)));
  qsa("[data-campaign]").forEach((button) => button.addEventListener("click", () => openCampaign(button.dataset.campaign).catch(showActionError)));
  qsa("[data-family-status]").forEach((button) => button.addEventListener("click", () => updateFamilyStatus(button.dataset.familyStatus, button.dataset.status).catch(showActionError)));
  qsa("[data-send-campaign]").forEach((button) => button.addEventListener("click", () => sendCampaign(button.dataset.sendCampaign).catch(showActionError)));
  qsa("[data-referral]").forEach((button) => button.addEventListener("click", () => openReferral(button.dataset.referral).catch(showActionError)));
  qsa("[data-help]").forEach((button) => button.addEventListener("click", () => openHelpArticle(button.dataset.help).catch(showActionError)));
  qsa("[data-about]").forEach((button) => button.addEventListener("click", () => openAboutBlock(button.dataset.about, button.dataset.locale).catch(showActionError)));
  qsa("[data-gdpr]").forEach((button) => button.addEventListener("click", () => openGdpr(button.dataset.gdpr).catch(showActionError)));
  qsa("[data-setting]").forEach((button) => button.addEventListener("click", () => editGdprSetting(button.dataset.setting).catch(showActionError)));
  qsa("[data-settings-module]").forEach((button) => button.addEventListener("click", () => { location.hash = `settings/${button.dataset.settingsModule}`; }));
  qsa("[data-settings-back]").forEach((button) => button.addEventListener("click", () => { location.hash = "settings"; }));
  bindFamilyAccessSettingsForm();
  bindNotificationSettingsForm();
  bindSosSettingsForm();
  bindBackupSettingsForm();
  bindAiSettingsForm();
  bindNotificationProviderForm();
  qsa("[data-export]").forEach((button) => button.addEventListener("click", () => exportSection(button.dataset.export)));
  qsa("[data-create]").forEach((button) => button.addEventListener("click", () => openCreateForm(button.dataset.create)));
}


function bindNotificationProviderForm() {
  const form = qs("#notificationProviderForm");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = collectNotificationProviderPayload(form);
    const result = await api("/settings/notification-providers", { method: "PUT", body: payload });
    notificationProviderState = { settings: result.settings || {}, secrets: result.secrets || {}, status: result.status || {}, schema: result.schema || {}, providers: result.providers || [] };
    notice(t("settings.notification.saved"));
    await loadRoute();
  });
  const testConnection = qs("#notificationTestConnection");
  if (testConnection) testConnection.addEventListener("click", async () => {
    const provider = form.elements.notification_sms_provider?.value || notificationProviderState.settings.notification_sms_provider;
    const result = await api("/settings/notification-providers/test-connection", { method: "POST", body: { provider } });
    notice(`${t("settings.notification.connectionStatus")}: ${result.status}`);
  });
  const testSend = qs("#notificationTestSend");
  if (testSend) testSend.addEventListener("click", async () => {
    if (!confirm(t("settings.notification.testSendConfirm"))) return;
    const provider = form.elements.notification_sms_provider?.value || notificationProviderState.settings.notification_sms_provider;
    const phone = prompt(t("settings.notification.testPhonePrompt")) || "";
    const result = await api("/settings/notification-providers/test-send", { method: "POST", body: { provider, phone } });
    notice(`${t("settings.notification.testSendResult")}: ${result.status}${result.outboxId ? ` #${result.outboxId}` : ""}`);
  });
}

function collectNotificationProviderPayload(form) {
  const settings = {};
  for (const key of NOTIFICATION_PROVIDER_SETTING_FIELDS) {
    const input = form.elements[key];
    if (!input) continue;
    const schema = notificationProviderState.schema[key] || {};
    if (schema.type === "boolean") settings[key] = Boolean(input.checked);
    else if (schema.type === "integer") settings[key] = Number(input.value || 0);
    else settings[key] = String(input.value || "").trim();
  }
  const secrets = {};
  for (const field of NOTIFICATION_PROVIDER_SECRET_FIELDS) {
    const clear = form.elements[`clear_${field}`]?.checked;
    const value = String(form.elements[`secret_${field}`]?.value || "").trim();
    secrets[field] = clear ? { action: "clear" } : value ? { action: "replace", value } : { action: "keep" };
  }
  return { settings, secrets };
}

function renderUserFamilyAccessBlock(rows, userId) {
  return `<section class="user-family-access-block"><div class="panel-header settings-center-header"><div><h3>${t("familyAccess.userBlock.title")}</h3><p class="muted">${t("familyAccess.userBlock.description")}</p></div><span class="muted">${t("total")}: ${rows.length}</span></div>
    ${rows.length ? rows.map((row) => renderUserFamilyAccessLink(row, userId)).join("") : `<div class="empty">${t("familyAccess.userBlock.empty")}</div>`}
  </section>`;
}

function renderUserFamilyAccessLink(row, userId) {
  const partner = String(row.owner_user_id) === String(userId) ? (row.invite_email || row.caregiver_name || "-") : (row.owner_email || row.owner_name || "-");
  return `<article class="user-family-access-link" data-family-link="${escapeHtml(row.id)}">
    <div class="user-family-access-main"><strong>${escapeHtml(partner)}</strong><span>${t("familyAccess.userBlock.owner")}: ${escapeHtml(row.owner_email || "-")}</span><span>${t("familyAccess.userBlock.contact")}: ${escapeHtml(row.invite_email || row.caregiver_name || "-")}</span><div class="user-family-access-meta"><span class="badge ${statusClass(row.status)}">${escapeHtml(statusLabel(row.status))}</span><span class="badge">${escapeHtml(row.role || "guardian")}</span></div></div>
    ${familyAccessPermissionsEditor(row.permissions, row.id)}
    ${familyAccessSettingsActions(row, "user-family-access-actions")}
  </article>`;
}

function familyAccessPermissionsEditor(value, id) {
  const keys = ["glucose", "history", "emergency"];
  let permissions = value || {};
  if (typeof permissions === "string") { try { permissions = JSON.parse(permissions); } catch { permissions = {}; } }
  return `<div class="user-family-permissions-editor">${keys.map((key) => `<label class="family-permission-row ${permissions?.[key] === true ? "is-enabled" : "is-disabled"}"><span class="family-permission-name">${escapeHtml(t(`familyAccess.permissions.${key}`))}</span><input type="checkbox" data-family-permission="${escapeHtml(id)}" data-permission-key="${key}" ${permissions?.[key] === true ? "checked" : ""}></label>`).join("")}<button type="button" class="button ghost" data-family-save-permissions="${escapeHtml(id)}">${t("familyAccess.userBlock.savePermissions")}</button></div>`;
}

function bindUserFamilyAccessActions(userId) {
  const block = qs(".user-family-access-block");
  if (!block) return;
  block.querySelectorAll("[data-family-status]").forEach((button) => button.addEventListener("click", () => withActionError(async () => {
    await api(`/family/${encodeURIComponent(button.dataset.familyStatus)}/status`, { method: "PATCH", body: { status: button.dataset.status } });
    notice(t("success"));
    await openUser(userId);
  })));
  block.querySelectorAll("[data-family-save-permissions]").forEach((button) => button.addEventListener("click", () => withActionError(async () => {
    const id = button.dataset.familySavePermissions;
    const permissions = {};
    block.querySelectorAll(`[data-family-permission="${id}"]`).forEach((input) => { permissions[input.dataset.permissionKey] = input.checked === true; });
    await api(`/family/${encodeURIComponent(id)}/permissions`, { method: "PATCH", body: { permissions } });
    notice(t("familyAccess.userBlock.permissionsSaved"));
    await openUser(userId);
  })));
}
async function openUser(id) {
  const data = await api(`/users/${id}`);
  const user = data.user;
  openModal(`
    <h2>${escapeHtml(user.fullName || user.email)}</h2>
    <div class="detail-grid">
      ${detail(columnTitle("id"), user.id)}
      ${detail(columnTitle("email"), user.email)}
      ${detail(columnTitle("status"), user.subscriptionStatus)}
      ${detail(columnTitle("createdAt"), formatDate(user.createdAt))}
      ${detail(t("section.devices"), data.devices.length)}
      ${detail(t("section.subscriptions"), data.subscriptions.length)}
      ${detail(t("section.trials"), data.trials.length)}
      ${detail(t("section.sos"), data.sos ? t("yes") : t("no"))}
    </div>
    ${renderUserFamilyAccessBlock(data.familyLinks || [], user.id)}
    <div class="user-actions">
      ${can("payments:write") ? `<button class="button primary" id="extendSubscription">${t("extendSubscription")}</button>` : ""}
      ${can("users:write") ? `
        <button class="button danger" id="revokeSessions">${t("revokeSessions")}</button>
        <button class="button danger" id="blockUser">${t("block")}</button>
        <button class="button ghost" id="unblockUser">${t("unblock")}</button>
        <button class="button ghost" id="verifyEmail">${t("verifyEmail")}</button>
      ` : ""}
      ${can("medical:read") ? `<button class="button ghost wide" id="viewMedical">${t("medicalData")}</button>` : ""}
    </div>`);
  bindUserFamilyAccessActions(user.id);
  const revoke = qs("#revokeSessions");
  if (revoke) revoke.addEventListener("click", () => withActionError(async () => {
    if (!confirm(t("confirmRevoke"))) return;
    await api(`/users/${id}/revoke-sessions`, { method: "POST" });
    notice(t("success"));
    closeModal();
  }));
  const block = qs("#blockUser");
  if (block) block.addEventListener("click", () => withActionError(async () => {
    const reason = prompt(t("blockReason"));
    if (!reason) return;
    await api(`/users/${id}/block`, { method: "POST", body: { reason } });
    notice(t("success"));
    closeModal();
    loadRoute();
  }));
  const unblock = qs("#unblockUser");
  if (unblock) unblock.addEventListener("click", () => withActionError(async () => {
    if (!confirm(t("unblockConfirm"))) return;
    await api(`/users/${id}/unblock`, { method: "POST" });
    notice(t("success"));
    closeModal();
    loadRoute();
  }));
  const verify = qs("#verifyEmail");
  if (verify) verify.addEventListener("click", () => withActionError(async () => {
    if (!confirm(t("verifyEmailConfirm"))) return;
    await api(`/users/${id}/verify-email`, { method: "POST" });
    notice(t("success"));
    closeModal();
    loadRoute();
  }));
  const medical = qs("#viewMedical");
  if (medical) medical.addEventListener("click", () => withActionError(async () => {
    const reason = "Admin panel profile details";
    const data = await api(`/users/${id}/medical`, { method: "POST", body: { reason, anonymized: true } });
    data.user = { ...user, ...(data.user || {}) };
    openModal(renderMedicalCard(data));
  }));
  const extend = qs("#extendSubscription");
  if (extend) extend.addEventListener("click", () => openSubscriptionExtension(id, user));
}

function openSubscriptionExtension(id, user) {
  openModal(`
    <h2>${t("extendSubscriptionTitle")}</h2>
    <form id="extendSubscriptionForm" class="form-grid">
      <p class="muted">${escapeHtml(user.email)} · ${escapeHtml(user.subscriptionStatus || "-")}</p>
      <label>${t("plan")}<select name="plan">
        <option value="premium">premium</option>
        <option value="monthly">monthly</option>
        <option value="yearly">yearly</option>
        <option value="family">family</option>
      </select></label>
      <label>${t("days")}<input name="days" type="number" min="1" max="3650" value="30" required></label>
      <button class="button primary" type="submit">${t("extendSubscription")}</button>
    </form>`);
  qs("#extendSubscriptionForm").addEventListener("submit", (event) => withActionError(async () => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api(`/users/${id}/subscription/extend`, {
      method: "POST",
      body: {
        plan: form.get("plan"),
        days: Number(form.get("days"))
      }
    });
    notice(t("subscriptionExtended"));
    closeModal();
    loadRoute();
  }));
}

function parseMedicalObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function medicalNumberFrom(source, keys) {
  if (!source || typeof source !== "object") return null;
  for (const key of keys) {
    const raw = source[key];
    if (raw === undefined || raw === null) continue;
    if (typeof raw === "string" && raw.trim() === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function medicalTextFrom(source, keys) {
  if (!source || typeof source !== "object") return "";
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return "";
}

function normalizeMedicalProfile(payload, data) {
  const profile = parseMedicalObject(payload.profile);
  const user = parseMedicalObject(data.user);
  return {
    ...profile,
    fullName: medicalTextFrom(profile, ["fullName", "full_name", "name"]) || medicalTextFrom(user, ["fullName", "full_name", "name"]),
    email: medicalTextFrom(profile, ["email"]) || medicalTextFrom(user, ["email"]),
    phone: medicalTextFrom(profile, ["phone", "phoneNumber", "contactPhone"]),
    age: medicalNumberFrom(profile, ["age"]),
    weightKg: medicalNumberFrom(profile, ["weightKg", "weight_kg", "weight", "user_weight"]),
    heightCm: medicalNumberFrom(profile, ["heightCm", "height_cm", "height", "user_height"]),
    languageCode: medicalTextFrom(profile, ["languageCode", "language_code", "locale"]),
    diabetesType: medicalTextFrom(profile, ["diabetesType", "diabetes_type"]),
    glucoseUnit: normalizeGlucoseUnit(
      medicalTextFrom(profile, ["glucoseUnit", "glucose_unit", "glucoseUnits", "glucoseUnitPreference"]) ||
      medicalTextFrom(user, ["glucoseUnit", "glucose_unit", "glucoseUnits", "glucoseUnitPreference"])
    ),
    glucoseMmol: medicalNumberFrom(profile, ["glucoseMmol", "currentGlucoseMmol", "current_glucose", "glucose", "glucose_mmol"]),
    targetGlucoseMmol: medicalNumberFrom(profile, ["targetGlucoseMmol", "targetGlucose", "target_glucose", "glucose_target", "target_glucose_mmol", "target"]),
    insulinToCarbRatio: medicalNumberFrom(profile, ["insulinToCarbRatio", "insulin_carb_ratio", "insulin_to_carb_ratio", "insulinCarb", "carbRatio", "carb_ratio"]),
    correctionFactor: medicalNumberFrom(profile, ["correctionFactor", "correction_factor", "correction"]),
  };
}

function normalizeMedicalEmergency(payload) {
  const emergency = parseMedicalObject(payload.emergency);
  return {
    ...emergency,
    contactName: medicalTextFrom(emergency, ["contactName", "contact_name", "name"]),
    contactPhone: medicalTextFrom(emergency, ["contactPhone", "contact_phone", "phone"]),
    bloodType: medicalTextFrom(emergency, ["bloodType", "blood_type"]),
    insulinName: medicalTextFrom(emergency, ["insulinName", "insulin_name", "insulin"]),
    medications: medicalTextFrom(emergency, ["medications"]),
    importantDiagnoses: medicalTextFrom(emergency, ["importantDiagnoses", "important_diagnoses", "diagnoses"]),
    emergencyInstructions: medicalTextFrom(emergency, ["emergencyInstructions", "emergency_instructions", "instructions"]),
  };
}

function renderMedicalCard(data) {
  const payload = parseMedicalObject(data.snapshot?.payload);
  const profile = normalizeMedicalProfile(payload, data);
  const emergency = normalizeMedicalEmergency(payload);
  const entries = [
    ...(Array.isArray(data.glucose) ? data.glucose : []),
    ...(Array.isArray(payload.diaryEntries) ? payload.diaryEntries : [])
  ].slice(0, 12);
  return `
    <h2>${t("medicalData")}</h2>
    <section class="medical-card">
      <div class="medical-section">
        <h3>${t("medicalProfile")}</h3>
        <div class="detail-grid">
          ${detail(t("displayName"), profile.fullName || "-")}
          ${detail(t("email"), profile.email || "-")}
          ${detail(t("phone"), profile.phone || "-")}
          ${detail(t("age"), profile.age ?? "-")}
          ${detail(t("weight"), profile.weightKg != null ? `${round(profile.weightKg)} kg` : "-")}
          ${detail(t("height"), profile.heightCm != null ? `${round(profile.heightCm)} cm` : "-")}
          ${detail(t("language"), profile.languageCode || "-")}
          ${detail(t("diabetesType"), profile.diabetesType || "-")}
        </div>
      </div>
      <div class="medical-section">
        <h3>${t("medicalMetrics")}</h3>
        <div class="detail-grid">
          ${detail(t("currentGlucose"), glucoseValue(profile.glucoseMmol, profile.glucoseUnit))}
          ${detail(t("targetGlucose"), glucoseValue(profile.targetGlucoseMmol, profile.glucoseUnit))}
          ${detail("Insulin/carb", profile.insulinToCarbRatio ?? "-")}
          ${detail("Correction", profile.correctionFactor != null ? round(profile.correctionFactor) : "-")}
        </div>
      </div>
      <div class="medical-section">
        <h3>${t("medicalEmergency")}</h3>
        <div class="detail-grid">
          ${detail(t("contact"), [emergency.contactName, emergency.contactPhone].filter(Boolean).join(" / ") || "-")}
          ${detail(t("bloodType"), emergency.bloodType || "-")}
          ${detail(t("insulin"), emergency.insulinName || "-")}
          ${detail(t("medications"), emergency.medications || "-")}
          ${detail(t("diagnoses"), emergency.importantDiagnoses || "-")}
          ${detail(t("instructions"), emergency.emergencyInstructions || "-")}
        </div>
      </div>
      <div class="medical-section">
        <h3>${t("medicalDiary")}</h3>
        ${entries.length ? `<div class="medical-list">${entries.map((entry) => medicalEntry(entry, profile.glucoseUnit)).join("")}</div>` : `<div class="empty">${t("noEntries")}</div>`}
      </div>
    </section>`;
}

function medicalEntry(entry, glucoseUnit) {
  return `<article class="medical-entry">
    <strong>${escapeHtml(entry.title || entry.type || "entry")}</strong>
    <span>${formatDate(entry.time || entry.created_at || entry.createdAt)}</span>
    <div>${glucoseValue(entry.glucoseMmol, glucoseUnit)} · ${escapeHtml(entry.carbs ?? 0)} carbs · ${escapeHtml(entry.insulinUnits ?? 0)} insulin</div>
    ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}
  </article>`;
}

async function openCampaign(id) {
  const data = await api(`/notifications/${id}`);
  const campaign = data.campaign || {};
  const stats = Object.fromEntries((data.stats || []).map((row) => [row.status, Number(row.count || 0)]));
  openModal(`
    <h2>${escapeHtml(campaign.title || `${t("campaign")} #${id}`)}</h2>
    <section class="campaign-card">
      <div class="detail-grid">
        ${detail(columnTitle("status"), statusLabel(campaign.status || "-"))}
        ${detail(t("audience"), audienceLabel(campaign.audience_filter))}
        ${detail(t("recipients"), campaign.recipient_count ?? 0)}
        ${detail(t("delivered"), campaign.delivered_count ?? stats.delivered ?? 0)}
        ${detail(columnTitle("created_at"), formatDate(campaign.created_at))}
        ${detail(columnTitle("sent_at"), formatDate(campaign.sent_at))}
      </div>
      <div class="message-preview">
        <strong>${t("message")}</strong>
        <p>${escapeHtml(campaign.body || "")}</p>
      </div>
      <div class="panel-list">
        ${(data.deliveries || []).length ? (data.deliveries || []).map((row) => `
          <article class="list-row">
            <div><strong>${escapeHtml(row.email || row.user_id)}</strong><span>${escapeHtml(row.full_name || "")}</span></div>
            <span class="badge ${statusClass(row.status)}">${escapeHtml(statusLabel(row.status))}</span>
            <span>${formatDate(row.delivered_at)}</span>
          </article>`).join("") : `<div class="empty">${t("empty")}</div>`}
      </div>
      ${can("notifications:write") && campaign.status !== "sent" ? `<button class="button primary" id="sendCampaignNow">${t("sendNow")}</button>` : ""}
    </section>`);
  const sendButton = qs("#sendCampaignNow");
  if (sendButton) sendButton.addEventListener("click", () => sendCampaign(id));
}

async function sendCampaign(id) {
  if (!confirm(t("sendCampaignConfirm"))) return;
  const result = await api(`/notifications/${id}/send`, { method: "POST" });
  notice(`${t("delivered")}: ${result.deliveredCount || 0}`);
  closeModal();
  loadRoute();
}

async function openHelpArticle(id) {
  const data = await api(`/help/articles/${id}`);
  const article = data.article || {};
  const translations = data.translations || [];
  const current = translations.find((item) => item.locale === state.lang) || translations.find((item) => item.locale === "ru") || translations.find((item) => item.locale === "en") || {};
  const localeOptions = (data.locales || ["en", "ru"]).map((locale) => `<option value="${locale}" ${locale === current.locale ? "selected" : ""}>${locale}</option>`).join("");
  openModal(`
    <h2>${t("editHelpArticle")}</h2>
    <form id="helpArticleForm" class="form-grid">
      <label>${t("category")}<input name="category" value="${escapeHtml(article.category || "")}" disabled></label>
      <label>${t("slug")}<input name="slug" value="${escapeHtml(article.slug || "")}" required></label>
      <label>${t("locale")}<select name="locale" id="helpLocale">${localeOptions}</select></label>
      <label>${t("status")}<select name="status">
        ${["draft", "review", "published", "archived"].map((status) => `<option value="${status}" ${status === article.status ? "selected" : ""}>${status}</option>`).join("")}
      </select></label>
      <label>${t("category")} ID<input name="categoryId" value="${escapeHtml(article.category_id || "")}" inputmode="numeric" required></label>
      <label>${t("title")}<input name="title" value="${escapeHtml(current.title || "")}" required></label>
      <label>${t("summary")}<textarea name="summary" rows="3">${escapeHtml(current.summary || "")}</textarea></label>
      <label>${t("content")}<textarea name="content" rows="12" required>${escapeHtml(current.content || "")}</textarea></label>
      <label><input name="featured" type="checkbox" ${article.is_featured ? "checked" : ""}> ${t("featured")}</label>
      <label>${columnTitle("translation_status")}<select name="translationStatus">
        ${["approved", "needs_review", "machine_translated", "outdated", "missing"].map((status) => `<option value="${status}" ${status === current.translation_status ? "selected" : ""}>${status}</option>`).join("")}
      </select></label>
      <div class="form-actions help-actions">
        <button class="button primary" type="submit">${t("save")}</button>
        <button class="button ghost" type="button" id="publishHelp">${t("publish")}</button>
        <button class="button ghost" type="button" id="translateHelp">${t("translateAll")}</button>
        <button class="button danger" type="button" id="archiveHelp">${t("archive")}</button>
      </div>
    </form>`);
  const byLocale = Object.fromEntries(translations.map((item) => [item.locale, item]));
  qs("#helpLocale").addEventListener("change", (event) => {
    const row = byLocale[event.target.value] || {};
    qs("[name=title]").value = row.title || "";
    qs("[name=summary]").value = row.summary || "";
    qs("[name=content]").value = row.content || "";
    qs("[name=translationStatus]").value = row.translation_status || "needs_review";
  });
  qs("#helpArticleForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveHelpArticle(id, new FormData(event.currentTarget));
  });
  qs("#publishHelp").addEventListener("click", async () => helpArticleAction(id, "publish"));
  qs("#archiveHelp").addEventListener("click", async () => helpArticleAction(id, "archive"));
  qs("#translateHelp").addEventListener("click", async () => helpArticleAction(id, "translate"));
}

async function saveHelpArticle(id, form) {
  await api(`/help/articles/${id}`, {
    method: "PUT",
    body: {
      categoryId: form.get("categoryId"),
      slug: form.get("slug"),
      locale: form.get("locale"),
      status: form.get("status"),
      title: form.get("title"),
      summary: form.get("summary"),
      content: form.get("content"),
      translationStatus: form.get("translationStatus"),
      featured: form.has("featured")
    }
  });
  notice(t("helpArticleSaved"));
  closeModal();
  loadRoute();
}

async function helpArticleAction(id, action) {
  await api(`/help/articles/${id}/${action}`, { method: "POST" });
  notice(t("success"));
  closeModal();
  loadRoute();
}

async function openAboutBlock(id, locale) {
  const data = await api(`/about?page=1&limit=500`);
  const row = rows.find((item) => String(item.id) === String(id) && item.locale === locale) ||
    rows.find((item) => String(item.id) === String(id)) || {};
  const locales = data.locales || ["en", "ru"];
  openModal(`
    <h2>${t("editAbout")}</h2>
    <form id="aboutForm" class="form-grid">
      <label>ID<input name="id" value="${escapeHtml(id)}" disabled></label>
      <label>${columnTitle("section_key")}<input value="${escapeHtml(row.section_key || "")}" disabled></label>
      <label>${t("locale")}<select name="locale">
        ${locales.map((item) => `<option value="${item}" ${item === (row.locale || locale) ? "selected" : ""}>${item}</option>`).join("")}
      </select></label>
      <label>${t("title")}<input name="title" value="${escapeHtml(row.title || "")}" required></label>
      <label>${t("subtitle")}<textarea name="subtitle" rows="3">${escapeHtml(row.subtitle || "")}</textarea></label>
      <label>${t("content")}<textarea name="content" rows="12">${escapeHtml(row.content || "")}</textarea></label>
      <label>${t("translationStatus")}<select name="translationStatus">
        ${["draft", "machine_translated", "needs_review", "approved", "outdated", "published"].map((status) => `<option value="${status}" ${status === (row.translation_status || "published") ? "selected" : ""}>${status}</option>`).join("")}
      </select></label>
      <label><input name="isActive" type="checkbox" ${row.is_active ? "checked" : ""}> ${t("active")}</label>
      <div class="form-actions">
        <button class="button primary" type="submit">${t("save")}</button>
      </div>
    </form>`);
  qs("#aboutForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api(`/about/${id}`, {
      method: "PUT",
      body: {
        locale: form.get("locale"),
        title: form.get("title"),
        subtitle: form.get("subtitle"),
        content: form.get("content"),
        translationStatus: form.get("translationStatus"),
        isActive: form.has("isActive")
      }
    });
    notice(t("aboutSaved"));
    closeModal();
    loadRoute();
  });
}

async function openReferral(id) {
  const data = await api(`/referrals/${id}`);
  const referral = data.referral || {};
  openModal(`
    <h2>${t("referral")} #${escapeHtml(referral.id || id)}</h2>
    <section class="campaign-card">
      <div class="detail-grid">
        ${detail(columnTitle("code"), referral.code || "-")}
        ${detail(columnTitle("status"), statusLabel(referral.status || "-"))}
        ${detail(columnTitle("referrer_email"), referral.referrer_email || "-")}
        ${detail(columnTitle("referred_email"), referral.referred_email || "-")}
        ${detail(columnTitle("registered_at"), formatDate(referral.registered_at))}
        ${detail(columnTitle("email_verified_at"), formatDate(referral.email_verified_at))}
        ${detail(columnTitle("qualified_at"), formatDate(referral.qualified_at))}
        ${detail(columnTitle("rewarded_at"), formatDate(referral.rewarded_at))}
        ${detail(columnTitle("rejection_reason"), referral.rejection_reason || "-")}
      </div>
      <h3>${t("rewards")}</h3>
      <div class="panel-list">
        ${(data.rewards || []).length ? data.rewards.map((row) => `
          <article class="list-row">
            <div><strong>${escapeHtml(row.reward_type || "-")}</strong><span>${escapeHtml(row.beneficiary_user_id || "-")}</span></div>
            <span>${escapeHtml(row.reward_days || 0)} ${t("days")}</span>
            <span class="badge ${statusClass(row.status)}">${escapeHtml(statusLabel(row.status))}</span>
          </article>`).join("") : `<div class="empty">${t("empty")}</div>`}
      </div>
      <h3>${t("fraudChecks")}</h3>
      <div class="panel-list">
        ${(data.fraud || []).length ? data.fraud.map((row) => `
          <article class="list-row">
            <div><strong>${escapeHtml(row.check_type || "-")}</strong><span>${formatDate(row.created_at)}</span></div>
            <span>${escapeHtml(row.risk_score ?? 0)}</span>
            <span class="badge ${statusClass(row.result)}">${escapeHtml(statusLabel(row.result))}</span>
          </article>`).join("") : `<div class="empty">${t("empty")}</div>`}
      </div>
      ${can("referrals:write") ? `<div class="user-actions compact-actions">
        <button class="button primary" data-referral-action="approve">${t("approve")}</button>
        <button class="button danger" data-referral-action="reject">${t("reject")}</button>
        <button class="button danger" data-referral-action="revoke">${t("revoke")}</button>
        <button class="button ghost" data-referral-action="restore">${t("restore")}</button>
      </div>` : ""}
    </section>`);
  qsa("[data-referral-action]").forEach((button) => button.addEventListener("click", async () => {
    const action = button.dataset.referralAction;
    const reason = ["reject", "revoke"].includes(action) ? prompt(t("reason")) : "";
    if (["reject", "revoke"].includes(action) && !reason) return;
    await api(`/referrals/${id}/${action}`, { method: "POST", body: reason ? { reason } : {} });
    notice(t("success"));
    await openReferral(id);
    loadRoute();
  }));
}

function audienceLabel(filter = {}) {
  if (typeof filter === "string") {
    try { filter = JSON.parse(filter); } catch { filter = {}; }
  }
  const audience = filter?.audience || "all";
  if (audience === "user") return `${t("audienceUser")} #${filter.userId || "-"}`;
  if (audience === "locale") return `${t("locale")}: ${filter.locale || "-"}`;
  if (audience === "plan") return `${t("plan")}: ${filter.plan || "-"}`;
  if (audience === "subscription_status") return `${t("subscriptionStatus")}: ${filter.subscriptionStatus || "-"}`;
  return t("audienceAll");
}

function openAdmin(button) {
  const id = button.dataset.admin;
  const cells = [...button.closest("tr").children].map((cell) => cell.textContent.trim());
  openModal(`
    <h2>${t("editAdmin")}</h2>
    <form id="adminEditForm" class="form-grid">
      <label>${t("displayName")}<input name="displayName" value="${escapeHtml(cells[2] || "")}"></label>
      <label>${t("roles")}<input name="roles" placeholder="super_admin,support" value="${escapeHtml(button.dataset.roles || "")}"></label>
      <label>${t("directPermissions")}<input name="permissions" placeholder="medical:read,backups:write" value="${escapeHtml(cells[6] || "")}"></label>
      <label><input name="isActive" type="checkbox" ${[t("yes"), "yes"].includes(cells[3]) ? "checked" : ""}> ${t("active")}</label>
      <label><input name="resetTwoFactor" type="checkbox"> ${t("reset2fa")}</label>
      <button class="button primary" type="submit">${t("save")}</button>
    </form>`);
  qs("#adminEditForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api(`/admins/${id}`, {
      method: "PATCH",
      body: {
        displayName: form.get("displayName"),
        roles: String(form.get("roles") || "").split(",").map((role) => role.trim()).filter(Boolean),
        permissions: String(form.get("permissions") || "").split(",").map((permission) => permission.trim()).filter(Boolean),
        isActive: form.has("isActive"),
        resetTwoFactor: form.has("resetTwoFactor")
      }
    });
    closeModal();
    notice(t("success"));
    loadRoute();
  });
}

async function openTicket(id) {
  const data = await api(`/support/${id}`);
  const ticket = data.ticket || {};
  const messages = data.messages || [];
  openModal(`
    <h2>${t("ticket")} #${escapeHtml(id)}</h2>
    <section class="campaign-card">
      <div class="detail-grid">
        ${detail(t("email"), ticket.email || "-")}
        ${detail(t("subject"), ticket.subject || "-")}
        ${detail(t("status"), statusLabel(ticket.status || "-"))}
        ${detail(t("priority"), ticket.priority || "-")}
      </div>
      <h3>${t("message")}</h3>
      <div class="panel-list">
        ${messages.length ? messages.map((message) => `
          <article>
            <strong>${escapeHtml(message.admin_email || ticket.email || "-")}</strong>
            <span class="muted">${formatDate(message.created_at)}</span>
            <pre class="json-box">${escapeHtml(message.body || "")}</pre>
          </article>`).join("") : `<div class="empty">${t("empty")}</div>`}
      </div>
    </section>
    <form id="ticketForm" class="form-grid">
      <label>${t("status")}<select name="status"><option>open</option><option>pending</option><option>resolved</option><option>closed</option></select></label>
      <label>${t("priority")}<select name="priority"><option>normal</option><option>low</option><option>high</option><option>urgent</option></select></label>
      <label>${t("replyMessage")}<textarea name="body" rows="5"></textarea></label>
      <button class="button primary" type="submit">${t("saveAndSend")}</button>
      <button class="button danger" type="button" id="deleteTicket">${t("deleteTicket")}</button>
    </form>`);
  qs("[name=status]").value = ticket.status || "open";
  qs("[name=priority]").value = ticket.priority || "normal";
  qs("#ticketForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const form = new FormData(event.currentTarget);
      await api(`/support/${id}`, { method: "PATCH", body: { status: form.get("status"), priority: form.get("priority") } });
      if (String(form.get("body") || "").trim()) {
        await api(`/support/${id}/messages`, { method: "POST", body: { body: form.get("body") } });
      }
      closeModal();
      notice(String(form.get("body") || "").trim() ? t("replySent") : t("success"));
      loadRoute();
    } catch (error) {
      showActionError(error);
    }
  });
  qs("#deleteTicket").addEventListener("click", () => deleteTicket(id).catch(showActionError));
}

async function deleteTicket(id) {
  if (!confirm(t("deleteTicketConfirm"))) return;
  await api(`/support/${id}`, { method: "DELETE" });
  closeModal();
  notice(t("success"));
  loadRoute();
}

async function deleteError(id) {
  if (!confirm(t("deleteErrorConfirm"))) return;
  await api(`/errors/${id}`, { method: "DELETE" });
  notice(t("errorDeleted"));
  await loadRoute();
}

async function deleteBackup(id) {
  if (!confirm(t("deleteBackupConfirm"))) return;
  await api(`/backups/${id}`, { method: "DELETE" });
  notice(t("backupDeleted"));
  await loadRoute();
}

async function openGdpr(id) {
  const data = await api(`/gdpr/${id}`);
  const request = data.request || {};
  const events = data.events || [];
  const files = data.files || [];
  const jobs = data.exportJobs || [];
  const actions = data.actions || [];
  openModal(`
    <h2>${escapeHtml(request.publicId || request.id || "GDPR")}</h2>
    <div class="detail-grid">
      ${detail(t("gdprUser"), request.email || request.userId || "")}
      ${detail(t("gdprType"), request.requestType || request.request_type || "")}
      ${detail(t("status"), request.status || "")}
      ${detail(columnTitle("dueAt"), formatDate(request.dueAt))}
      ${detail(columnTitle("assignedAdminEmail"), request.assignedAdminEmail || request.assignedAdminId || "")}
      ${detail(t("gdprIdentity"), request.identityVerifiedAt ? formatDate(request.identityVerifiedAt) : t("gdprNotVerified"))}
    </div>
    <section class="modal-section">
      <h3>${t("gdprRequest")}</h3>
      <p class="pre-line">${escapeHtml(request.subject || "")}</p>
      <p class="pre-line">${escapeHtml(request.description || "")}</p>
      ${request.rejectionReason ? `<p class="pre-line danger-text">${escapeHtml(request.rejectionReason)}</p>` : ""}
    </section>
    <form id="gdprForm" class="form-grid">
      <label>${t("status")}<select name="status">
        ${["submitted","identity_verification_required","verified","in_review","in_progress","waiting_for_user","approved","rejected","completed","cancelled","expired"].map((status) => `<option value="${status}" ${status === request.status ? "selected" : ""}>${status}</option>`).join("")}
      </select></label>
      <label>${t("message")}<textarea name="comment" rows="4"></textarea></label>
      <label>${t("gdprVisibility")}<select name="visibility"><option value="internal">${t("gdprInternal")}</option><option value="user">${t("gdprUserVisible")}</option></select></label>
      <div class="form-actions gdpr-actions">
        <button class="button ghost" type="button" data-gdpr-action="assign">${t("gdprAssignMe")}</button>
        <button class="button ghost" type="button" data-gdpr-action="status">${t("gdprSaveStatus")}</button>
        <button class="button ghost" type="button" data-gdpr-action="comment">${t("gdprAddComment")}</button>
        <button class="button ghost" type="button" data-gdpr-action="verify">${t("gdprVerifyIdentity")}</button>
        <button class="button primary" type="button" data-gdpr-action="approve">${t("approve")}</button>
        <button class="button danger" type="button" data-gdpr-action="reject">${t("reject")}</button>
        <button class="button primary" type="button" data-gdpr-action="generate-export">${t("gdprGenerateExport")}</button>
        <button class="button danger" type="button" data-gdpr-action="anonymize">${t("gdprAnonymize")}</button>
        <button class="button danger" type="button" data-gdpr-action="delete-account">${t("gdprDeleteAccount")}</button>
        <button class="button ghost" type="button" data-gdpr-action="preview-erasure">${t("gdprPreviewErasure")}</button>
        <button class="button ghost" type="button" data-gdpr-action="restrict">${t("gdprRestrict")}</button>
        <button class="button ghost" type="button" data-gdpr-action="object">${t("gdprObject")}</button>
        <button class="button ghost" type="button" data-gdpr-action="rectify">${t("gdprRectify")}</button>
        <button class="button primary" type="button" data-gdpr-action="complete">${t("gdprComplete")}</button>
      </div>
    </form>
    <section class="modal-section">
      <h3>${t("gdprExportFiles")}</h3>
      ${files.length ? files.map((file) => `<div class="detail-row">${escapeHtml(file.original_name || file.id)} <span>${escapeHtml(String(file.size_bytes || ""))}</span> <span>${file.expires_at ? formatDate(file.expires_at) : ""}</span></div>`).join("") : `<p class="muted">${t("empty")}</p>`}
    </section>
    <section class="modal-section">
      <h3>${t("gdprJobs")}</h3>
      ${jobs.length ? jobs.map((job) => `<div class="detail-row">${escapeHtml(job.status)} <span>${Number(job.progress || 0)}%</span> <span>${job.error_message ? escapeHtml(job.error_message) : ""}</span></div>`).join("") : `<p class="muted">${t("empty")}</p>`}
    </section>
    <section class="modal-section">
      <h3>${t("gdprAuditTrail")}</h3>
      ${events.length ? events.map((event) => `<div class="timeline-item"><strong>${escapeHtml(event.event_type)}</strong> <span>${formatDate(event.created_at)}</span><p class="pre-line">${escapeHtml(event.comment || "")}</p></div>`).join("") : `<p class="muted">${t("empty")}</p>`}
      ${actions.length ? `<h3>${t("gdprDataActions")}</h3>${actions.map((action) => `<div class="timeline-item"><strong>${escapeHtml(action.action_type)}</strong> <span>${formatDate(action.executed_at)}</span><p>${escapeHtml(action.action_result || "")}</p></div>`).join("")}` : ""}
    </section>
  `);
  qsa("[data-gdpr-download]").forEach((button) => button.addEventListener("click", () => {
    window.open(`${API_BASE}/gdpr/${id}/download/${button.dataset.gdprDownload}`, "_blank", "noopener");
  }));
  qsa("[data-gdpr-action]").forEach((button) => button.addEventListener("click", async () => {
    const form = new FormData(qs("#gdprForm"));
    const action = button.dataset.gdprAction;
    const comment = form.get("comment") || "";
    if (["reject", "anonymize", "delete-account"].includes(action) && !confirm(t("deleteTicketConfirm"))) return;
    let payload = action === "status"
      ? { status: form.get("status"), comment }
      : action === "comment"
        ? { visibility: form.get("visibility"), comment }
        : action === "reject"
          ? { reason: comment || "Rejected by administrator" }
          : { comment };
    if (action === "restrict" || action === "object") payload = { reason: comment || "GDPR action requested" };
    if (action === "rectify") {
      const fullName = prompt(t("fullName") || "Full name", "");
      const preferredLocale = prompt(t("locale") || "Locale", state.lang || "en");
      payload = { fullName: fullName || undefined, preferredLocale: preferredLocale || undefined, reason: comment };
    }
    const path = action === "status" ? `/gdpr/${id}/status` : `/gdpr/${id}/${action}`;
    await api(path, { method: "POST", body: payload });
    notice(t("success"));
    await openGdpr(id);
    loadRoute();
  }));
}

function openCreateForm(type) {
  const forms = {
    admin: `<h2>${t("createAdmin")}</h2><form id="createForm" class="form-grid">
      <label>${t("email")}<input name="email" type="email" required></label>
      <label>${t("password")}<input name="password" type="password" minlength="12" required></label>
      <label>${t("displayName")}<input name="displayName"></label>
      <label>${t("roles")}<select name="role"><option>support</option><option>billing_manager</option><option>content_manager</option><option>security_auditor</option><option>medical_data_reviewer</option><option>super_admin</option></select></label>
      <button class="button primary" type="submit">${t("create")}</button></form>`,
    ticket: `<h2>${t("createTicket")}</h2><form id="createForm" class="form-grid">
      <label>${t("userId")}<input name="userId" inputmode="numeric"></label>
      <label>${t("subject")}<input name="subject" required></label>
      <label>${t("priority")}<select name="priority"><option>normal</option><option>low</option><option>high</option><option>urgent</option></select></label>
      <button class="button primary" type="submit">${t("create")}</button></form>`,
    campaign: `<h2>${t("createCampaign")}</h2><form id="createForm" class="form-grid">
      <label>${t("title")}<input name="title" required></label>
      <label>${t("locale")}<input name="locale" placeholder="ru"></label>
      <label>${t("status")}<select name="status"><option value="draft">draft</option><option value="scheduled">scheduled</option><option value="send_now">${t("sendNow")}</option></select></label>
      <label>${t("scheduledAt")}<input name="scheduledAt" type="datetime-local"></label>
      <label>${t("audience")}<select name="audience" id="campaignAudience">
        <option value="all">${t("audienceAll")}</option>
        <option value="user">${t("audienceUser")}</option>
        <option value="locale">${t("audienceLocale")}</option>
        <option value="plan">${t("audiencePlan")}</option>
        <option value="subscription_status">${t("audienceSubscription")}</option>
      </select></label>
      <label data-audience-field="user" class="hidden">${t("userId")}<input name="userId" inputmode="numeric"></label>
      <label data-audience-field="locale" class="hidden">${t("locale")}<input name="audienceLocale" placeholder="ru"></label>
      <label data-audience-field="plan" class="hidden">${t("plan")}<select name="plan"><option value="premium">premium</option><option value="family">family</option><option value="monthly">monthly</option><option value="yearly">yearly</option><option value="free">free</option></select></label>
      <label data-audience-field="subscription_status" class="hidden">${t("subscriptionStatus")}<select name="subscriptionStatus"><option value="active">active</option><option value="inactive">inactive</option><option value="expired">expired</option><option value="trial">trial</option><option value="cancelled">cancelled</option></select></label>
      <label>${t("body")}<textarea name="body" rows="6" required></textarea></label>
      <div class="form-actions">
        <button class="button ghost" type="button" id="previewCampaign">${t("preview")}</button>
        <button class="button primary" type="submit">${t("create")}</button>
      </div>
      <div class="preview-box hidden" id="campaignPreview"></div>
    </form>`,
    help: `<h2>${t("createHelpArticle")}</h2><form id="createForm" class="form-grid">
      <label>${t("category")} ID<input name="categoryId" inputmode="numeric" required></label>
      <label>${t("slug")}<input name="slug" placeholder="how-to-use-glukotrack" required></label>
      <label>${t("locale")}<input name="locale" value="en" required></label>
      <label>${t("status")}<select name="status"><option>draft</option><option>review</option><option selected>published</option><option>archived</option></select></label>
      <label>${t("title")}<input name="title" required></label>
      <label>${t("summary")}<textarea name="summary" rows="3"></textarea></label>
      <label>${t("content")}<textarea name="content" rows="10" required></textarea></label>
      <label><input name="featured" type="checkbox"> ${t("featured")}</label>
      <button class="button primary" type="submit">${t("create")}</button></form>`,
    localization: `<h2>${t("createLocalization")}</h2><form id="createForm" class="form-grid">
      <label>${t("locale")}<input name="locale" placeholder="ru" required></label>
      <label>${t("version")}<input name="versionLabel" placeholder="2026-07-14" required></label>
      <label>${t("jsonPayload")}<textarea name="payload" rows="7" required>{}</textarea></label>
      <button class="button primary" type="submit">${t("create")}</button></form>`,
    backup: `<h2>${t("backupTitle")}</h2><form id="createForm" class="form-grid">
      <p class="muted">${t("backupText")}</p>
      <button class="button primary" type="submit">${t("runBackup")}</button></form>`,
    gdpr: `<h2>${t("createGdpr")}</h2><form id="createForm" class="form-grid">
      <label>${t("userId")}<input name="userId" inputmode="numeric" required></label>
      <label>${t("gdprType")}<select name="requestType">
        <option value="access">access</option>
        <option value="export">export</option>
        <option value="rectification">rectification</option>
        <option value="erasure">erasure</option>
        <option value="restriction">restriction</option>
        <option value="objection">objection</option>
        <option value="portability">portability</option>
      </select></label>
      <label>${t("email")}<input name="email" type="email"></label>
      <label>${t("locale")}<input name="locale" value="${escapeHtml(state.lang || "en")}"></label>
      <label>${t("subject")}<input name="subject" required></label>
      <label>${t("channel")}<input name="receivedChannel" value="admin_panel"></label>
      <label>${t("gdprVerifyIdentity")}<input name="identityVerificationMethod" value="manual"></label>
      <label>${t("reason")}<textarea name="description" rows="4" required></textarea></label>
      <label>${t("comment")}<textarea name="adminComment" rows="3"></textarea></label>
      <button class="button primary" type="submit">${t("create")}</button></form>`,
    version: `<h2>${t("setVersionPolicy")}</h2><form id="createForm" class="form-grid">
      <label>${t("platform")}<select name="platform"><option>web</option><option>android</option><option>ios</option><option>windows</option><option>macos</option></select></label>
      <label>${t("currentVersion")}<input name="currentVersion" required></label>
      <label>${t("minimumVersion")}<input name="minimumVersion"></label>
      <label>${t("recommendedVersion")}<input name="recommendedVersion"></label>
      <label>${t("rolloutPercent")}<input name="rolloutPercent" type="number" min="0" max="100" value="100"></label>
      <label><input name="forceUpdate" type="checkbox"> ${t("forceUpdate")}</label>
      <label>${t("downloadUrl")}<input name="downloadUrl"></label>
      <label>${t("changelog")}<textarea name="changelog" rows="4"></textarea></label>
      <button class="button primary" type="submit">${t("save")}</button></form>`
  };
  openModal(forms[type] || "");
  if (type === "campaign") bindCampaignForm();
  qs("#createForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitCreate(type, new FormData(event.currentTarget));
    closeModal();
    notice(t("success"));
    loadRoute();
  });
}

function bindCampaignForm() {
  const audienceSelect = qs("#campaignAudience");
  const updateFields = () => {
    qsa("[data-audience-field]").forEach((field) => {
      field.classList.toggle("hidden", field.dataset.audienceField !== audienceSelect.value);
    });
  };
  audienceSelect.addEventListener("change", updateFields);
  updateFields();
  qs("#previewCampaign").addEventListener("click", async () => {
    const form = new FormData(qs("#createForm"));
    const preview = await api("/notifications/preview", { method: "POST", body: campaignPayload(form) });
    qs("#campaignPreview").classList.remove("hidden");
    qs("#campaignPreview").innerHTML = `
      <strong>${t("recipients")}: ${Number(preview.total || 0)}</strong>
      ${(preview.sample || []).length ? `<div>${preview.sample.map((row) => `<span>${escapeHtml(row.email)}</span>`).join("")}</div>` : `<p>${t("empty")}</p>`}`;
  });
}

function campaignPayload(form) {
  return {
    title: form.get("title"),
    locale: form.get("locale"),
    status: form.get("status"),
    scheduledAt: form.get("scheduledAt") || null,
    audience: form.get("audience"),
    userId: form.get("userId") || null,
    audienceLocale: form.get("audienceLocale") || null,
    plan: form.get("plan") || null,
    subscriptionStatus: form.get("subscriptionStatus") || null,
    body: form.get("body")
  };
}

async function submitCreate(type, form) {
  if (type === "admin") return api("/admins", { method: "POST", body: Object.fromEntries(form.entries()) });
  if (type === "ticket") return api("/support", { method: "POST", body: { userId: form.get("userId") || null, subject: form.get("subject"), priority: form.get("priority") } });
  if (type === "campaign") return api("/notifications/campaigns", { method: "POST", body: campaignPayload(form) });
  if (type === "help") {
    return api("/help/articles", {
      method: "POST",
      body: {
        categoryId: form.get("categoryId"),
        slug: form.get("slug"),
        locale: form.get("locale"),
        status: form.get("status"),
        title: form.get("title"),
        summary: form.get("summary"),
        content: form.get("content"),
        translationStatus: "approved",
        featured: form.has("featured")
      }
    });
  }
  if (type === "localization") {
    return api("/localizations", { method: "POST", body: { locale: form.get("locale"), versionLabel: form.get("versionLabel"), payload: JSON.parse(form.get("payload")) } });
  }
  if (type === "backup") {
    notice(t("backupStarted"));
    const result = await api("/backups", { method: "POST", body: { type: "database" } });
    closeModal();
    notice(t("backupCompleted"));
    await loadRoute();
    return result;
  }
  if (type === "gdpr") return api("/gdpr", { method: "POST", body: { userId: form.get("userId"), email: form.get("email"), requestType: form.get("requestType"), subject: form.get("subject"), description: form.get("description"), receivedChannel: form.get("receivedChannel"), identityVerificationMethod: form.get("identityVerificationMethod"), adminComment: form.get("adminComment"), locale: form.get("locale") } });
  if (type === "version") {
    const platform = form.get("platform");
    return api(`/versions/${platform}`, {
      method: "PUT",
      body: {
        currentVersion: form.get("currentVersion"),
        minimumVersion: form.get("minimumVersion"),
        recommendedVersion: form.get("recommendedVersion"),
        rolloutPercent: form.get("rolloutPercent"),
        forceUpdate: form.has("forceUpdate"),
        downloadUrl: form.get("downloadUrl"),
        changelog: form.get("changelog")
      }
    });
  }
}

async function updateFamilyStatus(id, status) {
  await api(`/family/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status } });
  notice(t("success"));
  await loadRoute();
}

function exportSection(section) {
  const url = `${API_BASE}/export/${encodeURIComponent(section)}`;
  fetch(url, { headers: adminHeaders() })
    .then((response) => response.ok ? response.blob() : Promise.reject(new Error(response.statusText)))
    .then((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `glukotrack-${section}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch((error) => notice(error.message, true));
}

function detail(label, value) {
  return `<div class="detail-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "")}</strong></div>`;
}

function openModal(html) {
  qs("#modalBody").innerHTML = html;
  qs("#modal").classList.remove("hidden");
}

function closeModal() {
  qs("#modal").classList.add("hidden");
  qs("#modalBody").innerHTML = "";
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers: adminHeaders(),
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.code || response.statusText);
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

function adminHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    ...(state.csrfToken ? { "X-Admin-CSRF": state.csrfToken } : {})
  };
}

function can(permission) {
  const permissions = state.admin?.permissions || [];
  return permissions.includes("*") || permissions.includes(permission);
}

function sectionTitle(route) {
  const labelKey = sections.find(([name]) => name === route)?.[1];
  return labelKey ? t(labelKey) : route;
}

function setTitle(route) {
  qs("#pageTitle").textContent = sectionTitle(route);
  qs("#pageHint").textContent = state.admin ? `${state.admin.email} - ${state.admin.roles.join(", ")}` : "";
}

function applyI18n() {
  document.documentElement.lang = state.lang;
  qsa("[data-i18n]").forEach((node) => node.textContent = t(node.dataset.i18n));
  qsa("[data-i18n-placeholder]").forEach((node) => node.placeholder = t(node.dataset.i18nPlaceholder));
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem("gt_admin_theme", state.theme);
  document.documentElement.dataset.theme = state.theme;
}

function notice(message, error = false) {
  const box = qs("#notice");
  box.textContent = message;
  box.className = `notice ${error ? "error" : ""}`;
  setTimeout(() => box.classList.add("hidden"), 3500);
}

function withActionError(action) {
  return action().catch(showActionError);
}

function showActionError(error) {
  if (error?.status === 401) {
    handleAuthExpired();
    return;
  }
  notice(readableError(error), true);
}

function handleAuthExpired() {
  clearSession();
  showLogin();
  notice(t("sessionExpired"), true);
}

function readableError(error) {
  if (error?.status === 401) return t("sessionExpired");
  if (error?.status === 403 || error?.code === "ADMIN_SUPER_ADMIN_REQUIRED") return t("forbidden");
  if (error?.code === "ADMIN_ERROR_NOT_FOUND") return t("errorNotFound");
  if (error?.code === "ADMIN_BACKUP_ALREADY_RUNNING") return t("backupAlreadyRunning");
  if (error?.code === "ADMIN_BACKUP_LAST_DELETE_FORBIDDEN") return t("backupLastDeleteForbidden");
  if (error?.code === "ADMIN_BACKUP_RUNNING_DELETE_FORBIDDEN") return t("backupRunningDeleteForbidden");
  if (error?.code === "ADMIN_BACKUP_NOT_FOUND" || error?.code === "ADMIN_BACKUP_FILE_NOT_FOUND") return t("backupNotFound");
  return error?.code || error?.message || t("requestFailed");
}


// BACKUP_I18N_INSTALLED
Object.assign(dictionaries.ru, {
  "settings.backup.storage": "Каталог хранения",
  "settings.backup.freeSpace": "Свободное место",
  "settings.backup.running": "Выполняется",
  "settings.backup.runNow": "Запустить backup сейчас",
  "settings.backup.cleanupDryRun": "Предпросмотр очистки",
  "settings.backup.cleanupEmpty": "Предпросмотр очистки ещё не запускался",
  "settings.backup.cleanupNothing": "Нет кандидатов на удаление",
  "settings.backup.reclaim": "Будет освобождено",
  "settings.backup.verify": "Проверить",
  "settings.backup.verified": "Backup проверен",
  "settings.backup.protect": "Защитить",
  "settings.backup.unprotect": "Снять защиту",
  "settings.backup.saved": "Настройки Backup сохранены",
  "settings.backup.resetConfirm": "Сбросить только настройки Backup?",
  "settings.backup.resetDone": "Настройки Backup сброшены",
  "settings.backup.modePrompt": "Режим backup: full, database, files, pre-deploy, pre-wipe",
  "settings.unit.mb": "МБ",
  "settings.unit.percent": "%",
  "settings.backup.section.general.title": "Основные настройки",
  "settings.backup.section.general.description": "Включение, ручной запуск, блокировки и лимиты.",
  "settings.backup.section.schedule.title": "Расписание",
  "settings.backup.section.schedule.description": "Параметры автоматического запуска backup.",
  "settings.backup.section.components.title": "Состав backup",
  "settings.backup.section.components.description": "Компоненты production, которые входят в backup.",
  "settings.backup.section.retention.title": "Хранение",
  "settings.backup.section.retention.description": "Политика хранения и безопасный предпросмотр очистки.",
  "settings.backup.section.notifications.title": "Уведомления",
  "settings.backup.section.notifications.description": "Внутренние уведомления о событиях backup.",
  "settings.backup.section.permissions.title": "Доступ",
  "settings.backup.section.permissions.description": "Роли, которым разрешено управлять backup.",
  "settings.backup.section.modes.title": "Режимы",
  "settings.backup.section.modes.description": "Состав backup для каждого режима.",
  "settings.backup.section.copies.title": "Копии",
  "settings.backup.section.copies.description": "Последние созданные и проверенные backup.",
  "settings.backup.section.cleanup.title": "Предпросмотр очистки",
  "settings.backup.section.cleanup.description": "План удаления без фактического удаления файлов.",
  "settings.backup.mode.full": "Полный backup",
  "settings.backup.mode.database": "Только база данных",
  "settings.backup.mode.files": "Только файлы",
  "settings.backup.mode.pre-deploy": "Перед деплоем",
  "settings.backup.mode.pre-wipe": "Перед очисткой",
  "settings.backup.component.database": "База данных",
  "settings.backup.component.frontend": "Frontend",
  "settings.backup.component.backend": "Backend",
  "settings.backup.component.configs": "Конфигурации",
  "settings.backup.component.uploads": "Загрузки",
  "settings.backup.component.nginx": "Nginx",
  "settings.backup.component.systemd": "systemd",
  "settings.backup.component.env": "Env и секреты",
  "settings.backup.day.mon": "Пн",
  "settings.backup.day.tue": "Вт",
  "settings.backup.day.wed": "Ср",
  "settings.backup.day.thu": "Чт",
  "settings.backup.day.fri": "Пт",
  "settings.backup.day.sat": "Сб",
  "settings.backup.day.sun": "Вс",
  "settings.backup.role.super_admin": "Super Admin",
  "settings.backup.role.security_auditor": "Security Auditor",
  "settings.backup.option.daily": "Ежедневно",
  "settings.backup.option.weekly": "Еженедельно",
  "settings.backup.option.monthly": "Ежемесячно",
  "settings.backup.option.UTC": "UTC",
  "settings.backup.option.Europe/Warsaw": "Europe/Warsaw",
  "settings.backup.option.Europe/Kyiv": "Europe/Kyiv",
  "settings.backup.option.Europe/Berlin": "Europe/Berlin",
  "settings.backup.status.pending": "Ожидает запуска",
  "settings.backup.status.running": "Выполняется",
  "settings.backup.status.completed": "Завершён",
  "settings.backup.status.failed": "Ошибка",
  "settings.backup.status.verified": "Проверен",
  "settings.backup.status.missing": "Файл отсутствует",
  "settings.backup.status.protected": "Защищён",
  "settings.backup.cleanupReason.max_age": "Превышен срок хранения",
  "settings.backup.cleanupReason.retention": "Превышен лимит хранения",
  "settings.backup.cleanupReason.total_size": "Превышен общий размер",
  "settings.backup.cleanupReason.unverified": "Backup не проверен",
  "settings.backup.field.backup_enabled.title": "Backup включён",
  "settings.backup.field.backup_enabled.description": "Разрешает работу модуля Backup.",
  "settings.backup.field.backup_manual_enabled.title": "Ручной запуск",
  "settings.backup.field.backup_manual_enabled.description": "Позволяет запускать backup вручную из админки.",
  "settings.backup.field.backup_auto_enabled.title": "Автоматический backup",
  "settings.backup.field.backup_auto_enabled.description": "Включает запуск backup по расписанию.",
  "settings.backup.field.backup_prevent_parallel.title": "Запрет параллельного запуска",
  "settings.backup.field.backup_prevent_parallel.description": "Не позволяет запустить второй backup, пока первый выполняется.",
  "settings.backup.field.backup_max_duration_minutes.title": "Максимальная длительность",
  "settings.backup.field.backup_max_duration_minutes.description": "Предельное время выполнения одного backup.",
  "settings.backup.field.backup_min_free_mb.title": "Минимум свободного места",
  "settings.backup.field.backup_min_free_mb.description": "Backup не запускается, если на диске меньше указанного объёма.",
  "settings.backup.field.backup_schedule_frequency.title": "Частота расписания",
  "settings.backup.field.backup_schedule_frequency.description": "Как часто запускать автоматический backup.",
  "settings.backup.field.backup_schedule_days.title": "Дни запуска",
  "settings.backup.field.backup_schedule_days.description": "Дни недели для автоматического backup.",
  "settings.backup.field.backup_schedule_time.title": "Время запуска",
  "settings.backup.field.backup_schedule_time.description": "Время суток для автоматического backup.",
  "settings.backup.field.backup_schedule_timezone.title": "Часовой пояс",
  "settings.backup.field.backup_schedule_timezone.description": "Часовой пояс расписания backup.",
  "settings.backup.field.backup_include_database.title": "Включать базу данных",
  "settings.backup.field.backup_include_database.description": "Добавляет полный dump базы данных в backup.",
  "settings.backup.field.backup_include_frontend.title": "Включать frontend",
  "settings.backup.field.backup_include_frontend.description": "Добавляет frontend-файлы и сборку сайта.",
  "settings.backup.field.backup_include_backend.title": "Включать backend",
  "settings.backup.field.backup_include_backend.description": "Добавляет backend-код и связанные файлы.",
  "settings.backup.field.backup_include_configs.title": "Включать конфигурации",
  "settings.backup.field.backup_include_configs.description": "Добавляет конфигурации приложения.",
  "settings.backup.field.backup_include_uploads.title": "Включать загрузки",
  "settings.backup.field.backup_include_uploads.description": "Добавляет пользовательские uploads/storage.",
  "settings.backup.field.backup_include_nginx.title": "Включать Nginx",
  "settings.backup.field.backup_include_nginx.description": "Добавляет конфигурации Nginx, относящиеся к сайту.",
  "settings.backup.field.backup_include_systemd.title": "Включать systemd",
  "settings.backup.field.backup_include_systemd.description": "Добавляет service unit, относящийся к backend.",
  "settings.backup.field.backup_include_env.title": "Включать .env",
  "settings.backup.field.backup_include_env.description": "Добавляет защищённые env-файлы без вывода секретов в интерфейс.",
  "settings.backup.field.backup_retention_daily.title": "Дневные копии",
  "settings.backup.field.backup_retention_daily.description": "Сколько дневных backup хранить.",
  "settings.backup.field.backup_retention_weekly.title": "Недельные копии",
  "settings.backup.field.backup_retention_weekly.description": "Сколько недельных backup хранить.",
  "settings.backup.field.backup_retention_monthly.title": "Месячные копии",
  "settings.backup.field.backup_retention_monthly.description": "Сколько месячных backup хранить.",
  "settings.backup.field.backup_retention_max_age_days.title": "Максимальный возраст",
  "settings.backup.field.backup_retention_max_age_days.description": "Удалять кандидаты старше указанного количества дней.",
  "settings.backup.field.backup_retention_max_total_mb.title": "Максимальный общий размер",
  "settings.backup.field.backup_retention_max_total_mb.description": "Лимит места, которое могут занимать backup.",
  "settings.backup.field.backup_retention_warn_at_percent.title": "Порог предупреждения",
  "settings.backup.field.backup_retention_warn_at_percent.description": "Когда показывать предупреждение о заполнении лимита.",
  "settings.backup.field.backup_cleanup_dry_run_enabled.title": "Только предпросмотр очистки",
  "settings.backup.field.backup_cleanup_dry_run_enabled.description": "Позволяет строить план очистки без удаления файлов.",
  "settings.backup.field.backup_notify_completed.title": "Уведомлять об успехе",
  "settings.backup.field.backup_notify_completed.description": "Отправлять уведомление после успешного backup.",
  "settings.backup.field.backup_notify_failed.title": "Уведомлять об ошибке",
  "settings.backup.field.backup_notify_failed.description": "Отправлять уведомление при ошибке backup.",
  "settings.backup.field.backup_notify_low_space.title": "Уведомлять о нехватке места",
  "settings.backup.field.backup_notify_low_space.description": "Сообщать, когда свободного места недостаточно.",
  "settings.backup.field.backup_notify_retention_warning.title": "Уведомлять о лимите хранения",
  "settings.backup.field.backup_notify_retention_warning.description": "Сообщать о приближении к лимиту хранения.",
  "settings.backup.field.backup_notify_cleanup_plan.title": "Уведомлять о плане очистки",
  "settings.backup.field.backup_notify_cleanup_plan.description": "Сообщать о сформированном плане очистки.",
  "settings.backup.field.backup_notify_cleanup_completed.title": "Уведомлять об очистке",
  "settings.backup.field.backup_notify_cleanup_completed.description": "Сообщать после успешной очистки backup.",
  "settings.backup.field.backup_notify_cleanup_failed.title": "Уведомлять об ошибке очистки",
  "settings.backup.field.backup_notify_cleanup_failed.description": "Сообщать, если очистка backup завершилась ошибкой.",
  "settings.backup.field.backup_manage_roles.title": "Роли управления",
  "settings.backup.field.backup_manage_roles.description": "Роли, которым разрешено изменять настройки Backup."
});
Object.assign(dictionaries.en, {
  "settings.backup.storage": "Storage directory",
  "settings.backup.freeSpace": "Free space",
  "settings.backup.running": "Running",
  "settings.backup.runNow": "Run backup now",
  "settings.backup.cleanupDryRun": "Cleanup preview",
  "settings.backup.cleanupEmpty": "Cleanup preview has not been run yet",
  "settings.backup.cleanupNothing": "No deletion candidates",
  "settings.backup.reclaim": "Reclaim",
  "settings.backup.verify": "Verify",
  "settings.backup.verified": "Backup verified",
  "settings.backup.protect": "Protect",
  "settings.backup.unprotect": "Unprotect",
  "settings.backup.saved": "Backup settings saved",
  "settings.backup.resetConfirm": "Reset Backup settings only?",
  "settings.backup.resetDone": "Backup settings reset",
  "settings.backup.modePrompt": "Backup mode: full, database, files, pre-deploy, pre-wipe",
  "settings.unit.mb": "MB",
  "settings.unit.percent": "%",
  "settings.backup.section.general.title": "General settings",
  "settings.backup.section.general.description": "Enablement, manual launch, locks and limits.",
  "settings.backup.section.schedule.title": "Schedule",
  "settings.backup.section.schedule.description": "Automatic backup launch settings.",
  "settings.backup.section.components.title": "Composition",
  "settings.backup.section.components.description": "Production components included in backup.",
  "settings.backup.section.retention.title": "Retention",
  "settings.backup.section.retention.description": "Retention policy and safe cleanup preview.",
  "settings.backup.section.notifications.title": "Notifications",
  "settings.backup.section.notifications.description": "In-app notifications for backup events.",
  "settings.backup.section.permissions.title": "Permissions",
  "settings.backup.section.permissions.description": "Roles allowed to manage backups.",
  "settings.backup.section.modes.title": "Modes",
  "settings.backup.section.modes.description": "Backup composition for each mode.",
  "settings.backup.section.copies.title": "Copies",
  "settings.backup.section.copies.description": "Recently created and verified backups.",
  "settings.backup.section.cleanup.title": "Cleanup preview",
  "settings.backup.section.cleanup.description": "Deletion plan without deleting files.",
  "settings.backup.mode.full": "Full backup",
  "settings.backup.mode.database": "Database only",
  "settings.backup.mode.files": "Files only",
  "settings.backup.mode.pre-deploy": "Pre-deploy",
  "settings.backup.mode.pre-wipe": "Pre-wipe",
  "settings.backup.component.database": "Database",
  "settings.backup.component.frontend": "Frontend",
  "settings.backup.component.backend": "Backend",
  "settings.backup.component.configs": "Configurations",
  "settings.backup.component.uploads": "Uploads",
  "settings.backup.component.nginx": "Nginx",
  "settings.backup.component.systemd": "systemd",
  "settings.backup.component.env": "Env and secrets",
  "settings.backup.day.mon": "Mon",
  "settings.backup.day.tue": "Tue",
  "settings.backup.day.wed": "Wed",
  "settings.backup.day.thu": "Thu",
  "settings.backup.day.fri": "Fri",
  "settings.backup.day.sat": "Sat",
  "settings.backup.day.sun": "Sun",
  "settings.backup.role.super_admin": "Super Admin",
  "settings.backup.role.security_auditor": "Security Auditor",
  "settings.backup.option.daily": "Daily",
  "settings.backup.option.weekly": "Weekly",
  "settings.backup.option.monthly": "Monthly",
  "settings.backup.option.UTC": "UTC",
  "settings.backup.option.Europe/Warsaw": "Europe/Warsaw",
  "settings.backup.option.Europe/Kyiv": "Europe/Kyiv",
  "settings.backup.option.Europe/Berlin": "Europe/Berlin",
  "settings.backup.status.pending": "Pending",
  "settings.backup.status.running": "Running",
  "settings.backup.status.completed": "Completed",
  "settings.backup.status.failed": "Failed",
  "settings.backup.status.verified": "Verified",
  "settings.backup.status.missing": "File missing",
  "settings.backup.status.protected": "Protected",
  "settings.backup.cleanupReason.max_age": "Retention age exceeded",
  "settings.backup.cleanupReason.retention": "Retention count exceeded",
  "settings.backup.cleanupReason.total_size": "Total size exceeded",
  "settings.backup.cleanupReason.unverified": "Backup is not verified",
  "settings.backup.field.backup_enabled.title": "Backup enabled",
  "settings.backup.field.backup_enabled.description": "Allows the Backup module to run.",
  "settings.backup.field.backup_manual_enabled.title": "Manual launch",
  "settings.backup.field.backup_manual_enabled.description": "Allows backups to be started manually from admin.",
  "settings.backup.field.backup_auto_enabled.title": "Automatic backup",
  "settings.backup.field.backup_auto_enabled.description": "Enables scheduled backup runs.",
  "settings.backup.field.backup_prevent_parallel.title": "Prevent parallel runs",
  "settings.backup.field.backup_prevent_parallel.description": "Prevents starting a second backup while one is running.",
  "settings.backup.field.backup_max_duration_minutes.title": "Maximum duration",
  "settings.backup.field.backup_max_duration_minutes.description": "Maximum allowed duration for a single backup.",
  "settings.backup.field.backup_min_free_mb.title": "Minimum free space",
  "settings.backup.field.backup_min_free_mb.description": "Backup will not start when disk free space is below this value.",
  "settings.backup.field.backup_schedule_frequency.title": "Schedule frequency",
  "settings.backup.field.backup_schedule_frequency.description": "How often automatic backup should run.",
  "settings.backup.field.backup_schedule_days.title": "Run days",
  "settings.backup.field.backup_schedule_days.description": "Weekdays for automatic backup.",
  "settings.backup.field.backup_schedule_time.title": "Run time",
  "settings.backup.field.backup_schedule_time.description": "Time of day for automatic backup.",
  "settings.backup.field.backup_schedule_timezone.title": "Time zone",
  "settings.backup.field.backup_schedule_timezone.description": "Time zone used by the backup schedule.",
  "settings.backup.field.backup_include_database.title": "Include database",
  "settings.backup.field.backup_include_database.description": "Adds a full database dump to the backup.",
  "settings.backup.field.backup_include_frontend.title": "Include frontend",
  "settings.backup.field.backup_include_frontend.description": "Adds frontend files and site build.",
  "settings.backup.field.backup_include_backend.title": "Include backend",
  "settings.backup.field.backup_include_backend.description": "Adds backend code and related files.",
  "settings.backup.field.backup_include_configs.title": "Include configurations",
  "settings.backup.field.backup_include_configs.description": "Adds application configuration files.",
  "settings.backup.field.backup_include_uploads.title": "Include uploads",
  "settings.backup.field.backup_include_uploads.description": "Adds user uploads and storage files.",
  "settings.backup.field.backup_include_nginx.title": "Include Nginx",
  "settings.backup.field.backup_include_nginx.description": "Adds Nginx configuration related to the site.",
  "settings.backup.field.backup_include_systemd.title": "Include systemd",
  "settings.backup.field.backup_include_systemd.description": "Adds the service unit related to the backend.",
  "settings.backup.field.backup_include_env.title": "Include .env",
  "settings.backup.field.backup_include_env.description": "Adds protected env files without exposing secrets in the interface.",
  "settings.backup.field.backup_retention_daily.title": "Daily copies",
  "settings.backup.field.backup_retention_daily.description": "How many daily backups to keep.",
  "settings.backup.field.backup_retention_weekly.title": "Weekly copies",
  "settings.backup.field.backup_retention_weekly.description": "How many weekly backups to keep.",
  "settings.backup.field.backup_retention_monthly.title": "Monthly copies",
  "settings.backup.field.backup_retention_monthly.description": "How many monthly backups to keep.",
  "settings.backup.field.backup_retention_max_age_days.title": "Maximum age",
  "settings.backup.field.backup_retention_max_age_days.description": "Deletion candidates older than this number of days.",
  "settings.backup.field.backup_retention_max_total_mb.title": "Maximum total size",
  "settings.backup.field.backup_retention_max_total_mb.description": "Storage limit for backup files.",
  "settings.backup.field.backup_retention_warn_at_percent.title": "Warning threshold",
  "settings.backup.field.backup_retention_warn_at_percent.description": "When to warn about approaching the storage limit.",
  "settings.backup.field.backup_cleanup_dry_run_enabled.title": "Cleanup preview only",
  "settings.backup.field.backup_cleanup_dry_run_enabled.description": "Allows building a cleanup plan without deleting files.",
  "settings.backup.field.backup_notify_completed.title": "Notify on success",
  "settings.backup.field.backup_notify_completed.description": "Send a notification after a successful backup.",
  "settings.backup.field.backup_notify_failed.title": "Notify on failure",
  "settings.backup.field.backup_notify_failed.description": "Send a notification when backup fails.",
  "settings.backup.field.backup_notify_low_space.title": "Notify on low space",
  "settings.backup.field.backup_notify_low_space.description": "Notify when free disk space is insufficient.",
  "settings.backup.field.backup_notify_retention_warning.title": "Notify on retention warning",
  "settings.backup.field.backup_notify_retention_warning.description": "Notify when backup storage approaches the limit.",
  "settings.backup.field.backup_notify_cleanup_plan.title": "Notify on cleanup plan",
  "settings.backup.field.backup_notify_cleanup_plan.description": "Notify when a cleanup plan is generated.",
  "settings.backup.field.backup_notify_cleanup_completed.title": "Notify on cleanup success",
  "settings.backup.field.backup_notify_cleanup_completed.description": "Notify after backup cleanup succeeds.",
  "settings.backup.field.backup_notify_cleanup_failed.title": "Notify on cleanup failure",
  "settings.backup.field.backup_notify_cleanup_failed.description": "Notify when backup cleanup fails.",
  "settings.backup.field.backup_manage_roles.title": "Management roles",
  "settings.backup.field.backup_manage_roles.description": "Roles allowed to change Backup settings."
});
// AI_I18N_INSTALLED
Object.assign(dictionaries.ru, {
  "settings.module.aiSettings.title": "AI Settings",
  "settings.module.aiSettings.description": "Управление AI-функциями, моделями, fallback и пользовательскими лимитами.",
  "settings.ai.section.connection.title": "Подключение",
  "settings.ai.section.connection.description": "API-ключ хранится только на сервере и никогда не показывается полностью.",
  "settings.ai.section.models.title": "Модели",
  "settings.ai.section.models.description": "Список моделей, доступных для маршрутизации AI-функций.",
  "settings.ai.section.routing.title": "Маршрутизация функций",
  "settings.ai.section.routing.description": "Основная модель, fallback, размер ответа и тип счётчика для каждой функции.",
  "settings.ai.section.limits.title": "Лимиты по тарифам",
  "settings.ai.section.limits.description": "Два независимых суточных лимита: обычные запросы и фото-запросы.",
  "settings.ai.section.stats.title": "Состояние и статистика",
  "settings.ai.section.stats.description": "Безопасные метаданные последних AI-запросов без prompt, ответа и медицинских данных.",
  "settings.ai.section.audit.title": "Аудит",
  "settings.ai.section.audit.description": "Изменения настроек и использование fallback фиксируются в общем журнале аудита.",
  "settings.ai.auditNotice": "AI-события записываются в раздел Audit. API-ключи, изображения, медицинские данные, полный prompt и полный ответ модели не сохраняются.",
  "settings.ai.apiStatus": "Статус",
  "settings.ai.connected": "Подключено",
  "settings.ai.notConfigured": "Не настроено",
  "settings.ai.apiKey": "API-ключ",
  "settings.ai.newApiKey": "Новый API-ключ",
  "settings.ai.newApiKeyDescription": "Полное значение будет зашифровано на сервере и больше не будет показано.",
  "settings.ai.modelsAvailable": "Доступные модели",
  "settings.ai.modelsAvailableDescription": "Одна модель на строку. Модели используются настройками функций и не меняют пользовательские лимиты.",
  "settings.ai.enabled": "Включено",
  "settings.ai.enabledDescription": "Глобальный переключатель AI-функций.",
  "settings.ai.feature": "Функция",
  "settings.ai.primaryModel": "Основная модель",
  "settings.ai.fallbackModel": "Запасная модель",
  "settings.ai.fallback": "Fallback",
  "settings.ai.maxTokens": "Макс. ответ",
  "settings.ai.counter": "Счётчик",
  "settings.ai.plan": "Тариф",
  "settings.ai.testConnection": "Проверить подключение",
  "settings.ai.saved": "AI-настройки сохранены",
  "settings.ai.resetConfirm": "Сбросить AI-настройки?",
  "settings.ai.resetDone": "AI-настройки сброшены",
  "settings.ai.connectionOk": "Подключение проверено",
  "settings.ai.counter.normal": "Обычные AI-запросы",
  "settings.ai.counter.photo": "Фото-запросы",
  "settings.ai.plan.free": "Free",
  "settings.ai.plan.basic": "Basic",
  "settings.ai.plan.premium": "Premium",
  "settings.ai.plan.family": "Family",
  "settings.ai.feature.basic_text": "Базовый текстовый запрос",
  "settings.ai.feature.medication": "Лекарства",
  "settings.ai.feature.lab_analysis": "Анализы",
  "settings.ai.feature.photo_food": "Фото еды",
  "settings.ai.feature.photo_document": "Фото документа",
  "settings.ai.feature.doctor_report": "Отчёт для врача",
  "settings.ai.status.reserved": "Зарезервировано",
  "settings.ai.status.completed": "Завершено",
  "settings.ai.status.failed": "Ошибка",
  "settings.ai.status.cancelled": "Отменено"
});
Object.assign(dictionaries.en, {
  "settings.module.aiSettings.title": "AI Settings",
  "settings.module.aiSettings.description": "Manage AI features, models, fallback, and user limits.",
  "settings.ai.section.connection.title": "Connection",
  "settings.ai.section.connection.description": "The API key is stored only on the server and is never shown in full.",
  "settings.ai.section.models.title": "Models",
  "settings.ai.section.models.description": "Models available for AI feature routing.",
  "settings.ai.section.routing.title": "Feature routing",
  "settings.ai.section.routing.description": "Primary model, fallback, response size, and counter type for every feature.",
  "settings.ai.section.limits.title": "Plan limits",
  "settings.ai.section.limits.description": "Two independent daily limits: regular requests and photo requests.",
  "settings.ai.section.stats.title": "Status and statistics",
  "settings.ai.section.stats.description": "Safe metadata for recent AI requests without prompts, responses, or medical data.",
  "settings.ai.section.audit.title": "Audit",
  "settings.ai.section.audit.description": "Settings changes and fallback usage are recorded in the shared audit log.",
  "settings.ai.auditNotice": "AI events are recorded in the Audit section. API keys, images, medical data, full prompts, and full model responses are not stored.",
  "settings.ai.apiStatus": "Status",
  "settings.ai.connected": "Connected",
  "settings.ai.notConfigured": "Not configured",
  "settings.ai.apiKey": "API key",
  "settings.ai.newApiKey": "New API key",
  "settings.ai.newApiKeyDescription": "The full value will be encrypted on the server and will not be shown again.",
  "settings.ai.modelsAvailable": "Available models",
  "settings.ai.modelsAvailableDescription": "One model per line. Models are used by feature settings and do not change user limits.",
  "settings.ai.enabled": "Enabled",
  "settings.ai.enabledDescription": "Global AI feature switch.",
  "settings.ai.feature": "Feature",
  "settings.ai.primaryModel": "Primary model",
  "settings.ai.fallbackModel": "Fallback model",
  "settings.ai.fallback": "Fallback",
  "settings.ai.maxTokens": "Max response",
  "settings.ai.counter": "Counter",
  "settings.ai.plan": "Plan",
  "settings.ai.testConnection": "Test connection",
  "settings.ai.saved": "AI settings saved",
  "settings.ai.resetConfirm": "Reset AI settings?",
  "settings.ai.resetDone": "AI settings reset",
  "settings.ai.connectionOk": "Connection verified",
  "settings.ai.counter.normal": "Regular AI requests",
  "settings.ai.counter.photo": "Photo requests",
  "settings.ai.plan.free": "Free",
  "settings.ai.plan.basic": "Basic",
  "settings.ai.plan.premium": "Premium",
  "settings.ai.plan.family": "Family",
  "settings.ai.feature.basic_text": "Basic text request",
  "settings.ai.feature.medication": "Medication",
  "settings.ai.feature.lab_analysis": "Lab analysis",
  "settings.ai.feature.photo_food": "Food photo",
  "settings.ai.feature.photo_document": "Document photo",
  "settings.ai.feature.doctor_report": "Doctor report",
  "settings.ai.status.reserved": "Reserved",
  "settings.ai.status.completed": "Completed",
  "settings.ai.status.failed": "Failed",
  "settings.ai.status.cancelled": "Cancelled"
});
function t(key) {
  const dict = dictionaries[state.lang] || dictionaries.ru;
  if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
  if (Object.prototype.hasOwnProperty.call(dictionaries.en, key)) return dictionaries.en[key];
  return key.split(".").reduce((value, part) => value?.[part], dict) ??
    key.split(".").reduce((value, part) => value?.[part], dictionaries.en) ??
    key;
}

function columnTitle(key) {
  return t(`columns.${key}`) === `columns.${key}` ? key : t(`columns.${key}`);
}

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return [...document.querySelectorAll(selector)];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleString(state.lang);
}

function money(value) {
  const amount = Number(value || 0) / 100;
  return amount.toLocaleString(state.lang, { style: "currency", currency: "EUR" });
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${round(size, size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDuration(value) {
  const ms = Number(value || 0);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  if (ms < 1000) return `${ms} ms`;
  return `${round(ms / 1000, 1)} s`;
}

function shortHash(value) {
  const hash = String(value || "");
  return hash.length > 16 ? `${hash.slice(0, 12)}...${hash.slice(-8)}` : hash;
}

function round(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits).replace(/\.0+$/, "") : "-";
}

function normalizeGlucoseUnit(value) {
  const unit = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
  if (unit === "mgdl" || unit === "mgd") return "mg/dL";
  if (unit === "mmoll" || unit === "mmol") return "mmol/L";
  return "mmol/L";
}

function glucoseValue(value, unit = "mmol/L") {
  if (value === undefined || value === null) return "-";
  if (typeof value === "string" && value.trim() === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "-";
  const normalizedUnit = normalizeGlucoseUnit(unit);
  if (normalizedUnit === "mg/dL") return `${round(number * 18.0182, 0)} mg/dL`;
  return `${round(number, 1)} mmol/L`;
}

function debounce(fn, delay) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}






// NOTIFICATION_PROVIDERS_I18N_INSTALLED
Object.assign(dictionaries.ru, {
  "settings.module.notificationProviders.title": "Notification Providers",
  "settings.module.notificationProviders.description": "Провайдеры SMS, dry-run, лимиты и статусы каналов.",
  "settings.notification.provider.disabled": "Disabled",
  "settings.notification.provider.custom": "Custom SMS API",
  "settings.notification.provider.twilio": "Twilio",
  "settings.notification.provider.vonage": "Vonage",
  "settings.notification.iosCritical": "iOS Critical Alerts",
  "settings.notification.section.provider": "Выбор провайдера",
  "settings.notification.section.provider.description": "Реальная внешняя доставка включается только после настройки credentials.",
  "settings.notification.section.custom.description": "HTTPS endpoint, API key, sender name, timeout и dry-run.",
  "settings.notification.section.twilio.description": "Account SID, Auth Token, From Number или Messaging Service SID.",
  "settings.notification.section.vonage.description": "API Key, API Secret, From/Sender Name и dry-run.",
  "settings.notification.section.limits": "Лимиты и cooldown",
  "settings.notification.section.limits.description": "Лимиты SMS не блокируют push и in-app уведомления.",
  "settings.notification.testConnection": "Проверить подключение",
  "settings.notification.testSend": "Тестовая отправка",
  "settings.notification.testSendConfirm": "Запустить тестовую отправку в dry-run без внешнего SMS?",
  "settings.notification.testPhonePrompt": "Тестовый номер телефона",
  "settings.notification.testSendResult": "Результат dry-run",
  "settings.notification.connectionStatus": "Статус подключения",
  "settings.notification.saved": "Настройки Notification Providers сохранены",
  "settings.notification.secretConfigured": "Настроено",
  "settings.notification.secretNotConfigured": "Не настроено",
  "settings.notification.secretKeep": "Оставить текущий секрет без изменений",
  "settings.notification.secretClear": "Очистить секрет",
  "settings.notification.field.notification_sms_provider": "SMS provider",
  "settings.notification.field.notification_custom_sms_endpoint": "HTTPS API endpoint",
  "settings.notification.field.notification_custom_sms_sender_name": "Sender name",
  "settings.notification.field.notification_custom_sms_dry_run": "Custom dry-run",
  "settings.notification.field.notification_custom_sms_timeout_seconds": "Timeout, seconds",
  "settings.notification.field.notification_twilio_sender_name": "Twilio sender name",
  "settings.notification.field.notification_twilio_dry_run": "Twilio dry-run",
  "settings.notification.field.notification_vonage_sender_name": "Vonage sender name",
  "settings.notification.field.notification_vonage_dry_run": "Vonage dry-run",
  "settings.notification.field.notification_sms_daily_per_patient": "SMS в сутки на пациента",
  "settings.notification.field.notification_sms_monthly_per_patient": "SMS в месяц на пациента",
  "settings.notification.field.notification_sms_global_daily_limit": "Глобальный дневной лимит SMS",
  "settings.notification.field.notification_sms_global_daily_budget_minor": "Глобальный дневной бюджет, minor units",
  "settings.notification.field.notification_sms_budget_currency": "Валюта бюджета",
  "settings.notification.field.notification_sms_estimated_cost_minor": "Оценочная стоимость SMS, minor units",
  "settings.notification.field.notification_manual_sos_cooldown_minutes": "Cooldown ручного SOS, минут",
  "settings.notification.hint.notification_sms_provider": "Disabled отключает только SMS; push и in-app продолжают работать.",
  "settings.notification.hint.notification_custom_sms_endpoint": "Только HTTPS endpoint; private/local адреса отклоняются сервером.",
  "settings.notification.hint.notification_custom_sms_sender_name": "Имя отправителя, если поддерживается провайдером.",
  "settings.notification.hint.notification_custom_sms_dry_run": "Dry-run не вызывает внешний Custom SMS API.",
  "settings.notification.hint.notification_custom_sms_timeout_seconds": "Максимальное время ожидания backend проверки.",
  "settings.notification.hint.notification_twilio_sender_name": "Опциональное имя отправителя.",
  "settings.notification.hint.notification_twilio_dry_run": "Dry-run не вызывает Twilio API.",
  "settings.notification.hint.notification_vonage_sender_name": "From/Sender Name для Vonage.",
  "settings.notification.hint.notification_vonage_dry_run": "Dry-run не вызывает Vonage API.",
  "settings.notification.hint.notification_sms_daily_per_patient": "0 означает немедленно блокировать SMS для этого лимита.",
  "settings.notification.hint.notification_sms_monthly_per_patient": "Месячный лимит считается по accepted/dry-run SMS jobs.",
  "settings.notification.hint.notification_sms_global_daily_limit": "Глобальный лимит за UTC-день.",
  "settings.notification.hint.notification_sms_global_daily_budget_minor": "0 отключает денежный бюджет.",
  "settings.notification.hint.notification_sms_budget_currency": "ISO 4217, например EUR или USD.",
  "settings.notification.hint.notification_sms_estimated_cost_minor": "Используется для бюджета, если провайдер не вернул цену.",
  "settings.notification.hint.notification_manual_sos_cooldown_minutes": "Применяется только к повторному ручному SOS.",
  "settings.notification.secret.custom_api_key": "Custom API key",
  "settings.notification.secret.twilio_account_sid": "Twilio Account SID",
  "settings.notification.secret.twilio_auth_token": "Twilio Auth Token",
  "settings.notification.secret.twilio_from_number": "Twilio From Number",
  "settings.notification.secret.twilio_messaging_service_sid": "Twilio Messaging Service SID",
  "settings.notification.secret.vonage_api_key": "Vonage API Key",
  "settings.notification.secret.vonage_api_secret": "Vonage API Secret"
});
Object.assign(dictionaries.en, {
  "settings.module.notificationProviders.title": "Notification Providers",
  "settings.module.notificationProviders.description": "SMS providers, dry-run, limits, and channel statuses.",
  "settings.notification.provider.disabled": "Disabled",
  "settings.notification.provider.custom": "Custom SMS API",
  "settings.notification.provider.twilio": "Twilio",
  "settings.notification.provider.vonage": "Vonage",
  "settings.notification.iosCritical": "iOS Critical Alerts",
  "settings.notification.section.provider": "Provider selection",
  "settings.notification.section.provider.description": "Real external delivery starts only after credentials are configured.",
  "settings.notification.section.custom.description": "HTTPS endpoint, API key, sender name, timeout, and dry-run.",
  "settings.notification.section.twilio.description": "Account SID, Auth Token, From Number or Messaging Service SID.",
  "settings.notification.section.vonage.description": "API Key, API Secret, From/Sender Name, and dry-run.",
  "settings.notification.section.limits": "Limits and cooldown",
  "settings.notification.section.limits.description": "SMS limits do not block push and in-app notifications.",
  "settings.notification.testConnection": "Test connection",
  "settings.notification.testSend": "Test send",
  "settings.notification.testSendConfirm": "Run a dry-run test send without external SMS?",
  "settings.notification.testPhonePrompt": "Test phone number",
  "settings.notification.testSendResult": "Dry-run result",
  "settings.notification.connectionStatus": "Connection status",
  "settings.notification.saved": "Notification Providers settings saved",
  "settings.notification.secretConfigured": "Configured",
  "settings.notification.secretNotConfigured": "Not configured",
  "settings.notification.secretKeep": "Keep current secret unchanged",
  "settings.notification.secretClear": "Clear secret",
  "settings.notification.field.notification_sms_provider": "SMS provider",
  "settings.notification.field.notification_custom_sms_endpoint": "HTTPS API endpoint",
  "settings.notification.field.notification_custom_sms_sender_name": "Sender name",
  "settings.notification.field.notification_custom_sms_dry_run": "Custom dry-run",
  "settings.notification.field.notification_custom_sms_timeout_seconds": "Timeout, seconds",
  "settings.notification.field.notification_twilio_sender_name": "Twilio sender name",
  "settings.notification.field.notification_twilio_dry_run": "Twilio dry-run",
  "settings.notification.field.notification_vonage_sender_name": "Vonage sender name",
  "settings.notification.field.notification_vonage_dry_run": "Vonage dry-run",
  "settings.notification.field.notification_sms_daily_per_patient": "Daily SMS per patient",
  "settings.notification.field.notification_sms_monthly_per_patient": "Monthly SMS per patient",
  "settings.notification.field.notification_sms_global_daily_limit": "Global daily SMS limit",
  "settings.notification.field.notification_sms_global_daily_budget_minor": "Global daily budget, minor units",
  "settings.notification.field.notification_sms_budget_currency": "Budget currency",
  "settings.notification.field.notification_sms_estimated_cost_minor": "Estimated SMS cost, minor units",
  "settings.notification.field.notification_manual_sos_cooldown_minutes": "Manual SOS cooldown, minutes",
  "settings.notification.hint.notification_sms_provider": "Disabled turns off SMS only; push and in-app continue.",
  "settings.notification.hint.notification_custom_sms_endpoint": "HTTPS endpoint only; private/local addresses are rejected server-side.",
  "settings.notification.hint.notification_custom_sms_sender_name": "Sender name if supported by the provider.",
  "settings.notification.hint.notification_custom_sms_dry_run": "Dry-run does not call external Custom SMS API.",
  "settings.notification.hint.notification_custom_sms_timeout_seconds": "Maximum backend check timeout.",
  "settings.notification.hint.notification_twilio_sender_name": "Optional sender name.",
  "settings.notification.hint.notification_twilio_dry_run": "Dry-run does not call Twilio API.",
  "settings.notification.hint.notification_vonage_sender_name": "From/Sender Name for Vonage.",
  "settings.notification.hint.notification_vonage_dry_run": "Dry-run does not call Vonage API.",
  "settings.notification.hint.notification_sms_daily_per_patient": "0 means immediately block SMS for this limit.",
  "settings.notification.hint.notification_sms_monthly_per_patient": "Monthly limit counts accepted/dry-run SMS jobs.",
  "settings.notification.hint.notification_sms_global_daily_limit": "Global limit for the UTC day.",
  "settings.notification.hint.notification_sms_global_daily_budget_minor": "0 disables the money budget.",
  "settings.notification.hint.notification_sms_budget_currency": "ISO 4217, for example EUR or USD.",
  "settings.notification.hint.notification_sms_estimated_cost_minor": "Used for the budget when provider does not return price.",
  "settings.notification.hint.notification_manual_sos_cooldown_minutes": "Applies only to repeated manual SOS.",
  "settings.notification.secret.custom_api_key": "Custom API key",
  "settings.notification.secret.twilio_account_sid": "Twilio Account SID",
  "settings.notification.secret.twilio_auth_token": "Twilio Auth Token",
  "settings.notification.secret.twilio_from_number": "Twilio From Number",
  "settings.notification.secret.twilio_messaging_service_sid": "Twilio Messaging Service SID",
  "settings.notification.secret.vonage_api_key": "Vonage API Key",
  "settings.notification.secret.vonage_api_secret": "Vonage API Secret"
});
