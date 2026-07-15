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
  admin: null
};

const sections = [
  ["dashboard", "section.dashboard", "dashboard:read"],
  ["users", "section.users", "users:read"],
  ["subscriptions", "section.subscriptions", "subscriptions:read"],
  ["payments", "section.payments", "payments:read"],
  ["devices", "section.devices", "devices:read"],
  ["trials", "section.trials", "subscriptions:read"],
  ["family", "section.family", "users:read"],
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

const columns = {
  users: ["id", "email", "fullName", "subscriptionStatus", "premiumPlan", "emailVerified", "createdAt"],
  subscriptions: ["id", "user_id", "email", "provider", "plan", "status", "expires_at", "updated_at"],
  payments: ["id", "email", "amount_minor", "currency", "status", "created_at"],
  devices: ["id", "email", "device_name", "platform", "last_seen_at", "revoked_at"],
  trials: ["id", "email", "started_at", "ends_at", "status", "device_hash"],
  family: ["id", "owner_email", "invite_email", "status", "member_count", "expires_at", "accepted_at"],
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
  backups: ["id", "backup_type", "status", "file_size_bytes", "duration_ms", "created_by", "started_at", "finished_at"],
  gdpr: ["publicId", "user_id", "email", "requestType", "status", "subject", "dueAt", "assignedAdminEmail", "daysRemaining"],
  versions: ["platform", "current_version", "minimum_version", "recommended_version", "force_update", "rollout_percent", "status", "updated_at"],
  admins: ["id", "email", "displayName", "isActive", "twoFactorEnabled", "roles", "directPermissions", "lastLoginAt"],
  audit: ["id", "admin_email", "action", "entity_type", "entity_id", "ip_address", "created_at"],
  "login-attempts": ["id", "email", "ip_address", "success", "failure_reason", "locked_until", "attempted_at"],
  settings: ["setting_key", "setting_value", "is_secret", "updated_at"]
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
    qs("#loginError").textContent = error.code || error.message;
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
  state.route = sections.some(([name]) => name === route) ? route : "dashboard";
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
      const data = await api(`/${state.route}?page=${state.page}&limit=25&q=${encodeURIComponent(state.q)}`);
      renderTable(state.route, data);
    }
  } catch (error) {
    qs("#content").innerHTML = `<div class="panel empty">${escapeHtml(error.status === 403 ? t("forbidden") : error.code || error.message)}</div>`;
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

function actionButtons(route) {
  const buttons = [];
  if (["users", "subscriptions", "payments", "devices", "audit", "security", "referrals"].includes(route)) {
    buttons.push(`<button class="button ghost" data-export="${route}">${t("export")}</button>`);
  }
  if (route === "admins" && can("admins:write")) buttons.push(`<button class="button primary" data-create="admin">${t("createAdmin")}</button>`);
  if (route === "support" && can("support:write")) buttons.push(`<button class="button primary" data-create="ticket">${t("createTicket")}</button>`);
  if (route === "notifications" && can("notifications:write")) buttons.push(`<button class="button primary" data-create="campaign">${t("createCampaign")}</button>`);
  if (route === "help" && can("help:write")) buttons.push(`<button class="button primary" data-create="help">${t("createHelpArticle")}</button>`);
  if (route === "settings" && can("settings:write")) buttons.push(`<button class="button primary" data-create="setting">${t("createSetting")}</button>`);
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
  if (route === "notifications") return `<div class="row-actions">
    <button class="button ghost" data-campaign="${row.id}">${t("details")}</button>
    ${can("notifications:write") && row.status !== "sent" ? `<button class="button primary" data-send-campaign="${row.id}">${t("sendNow")}</button>` : ""}
  </div>`;
  if (route === "referrals") return `<button class="button ghost" data-referral="${row.id}">${t("details")}</button>`;
  if (route === "help") return `<button class="button ghost" data-help="${row.id}">${t("details")}</button>`;
  if (route === "about") return `<button class="button ghost" data-about="${row.id}" data-locale="${escapeHtml(row.locale || state.lang)}">${t("details")}</button>`;
  if (route === "gdpr") return `<button class="button ghost" data-gdpr="${row.id}">${t("details")}</button>`;
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
  if (/created|updated|expires|seen|until|at$/i.test(key)) return `<td>${formatDate(value)}</td>`;
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
  qsa("[data-campaign]").forEach((button) => button.addEventListener("click", () => openCampaign(button.dataset.campaign).catch(showActionError)));
  qsa("[data-send-campaign]").forEach((button) => button.addEventListener("click", () => sendCampaign(button.dataset.sendCampaign).catch(showActionError)));
  qsa("[data-referral]").forEach((button) => button.addEventListener("click", () => openReferral(button.dataset.referral).catch(showActionError)));
  qsa("[data-help]").forEach((button) => button.addEventListener("click", () => openHelpArticle(button.dataset.help).catch(showActionError)));
  qsa("[data-about]").forEach((button) => button.addEventListener("click", () => openAboutBlock(button.dataset.about, button.dataset.locale).catch(showActionError)));
  qsa("[data-gdpr]").forEach((button) => button.addEventListener("click", () => openGdpr(button.dataset.gdpr).catch(showActionError)));
  qsa("[data-export]").forEach((button) => button.addEventListener("click", () => exportSection(button.dataset.export)));
  qsa("[data-create]").forEach((button) => button.addEventListener("click", () => openCreateForm(button.dataset.create)));
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
  const revoke = qs("#revokeSessions");
  if (revoke) revoke.addEventListener("click", async () => {
    if (!confirm(t("confirmRevoke"))) return;
    await api(`/users/${id}/revoke-sessions`, { method: "POST" });
    notice(t("success"));
    closeModal();
  });
  const block = qs("#blockUser");
  if (block) block.addEventListener("click", async () => {
    const reason = prompt(t("blockReason"));
    if (!reason) return;
    await api(`/users/${id}/block`, { method: "POST", body: { reason } });
    notice(t("success"));
    closeModal();
    loadRoute();
  });
  const unblock = qs("#unblockUser");
  if (unblock) unblock.addEventListener("click", async () => {
    if (!confirm(t("unblockConfirm"))) return;
    await api(`/users/${id}/unblock`, { method: "POST" });
    notice(t("success"));
    closeModal();
    loadRoute();
  });
  const verify = qs("#verifyEmail");
  if (verify) verify.addEventListener("click", async () => {
    if (!confirm(t("verifyEmailConfirm"))) return;
    await api(`/users/${id}/verify-email`, { method: "POST" });
    notice(t("success"));
    closeModal();
    loadRoute();
  });
  const medical = qs("#viewMedical");
  if (medical) medical.addEventListener("click", async () => {
    const reason = "Admin panel profile details";
    const data = await api(`/users/${id}/medical`, { method: "POST", body: { reason, anonymized: true } });
    openModal(renderMedicalCard(data));
  });
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
  qs("#extendSubscriptionForm").addEventListener("submit", async (event) => {
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
  });
}

function renderMedicalCard(data) {
  const payload = data.snapshot?.payload || {};
  const profile = payload.profile || {};
  const emergency = payload.emergency || {};
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
          ${detail(t("age"), profile.age || "-")}
          ${detail(t("weight"), profile.weightKg ? `${round(profile.weightKg)} kg` : "-")}
          ${detail(t("height"), profile.heightCm ? `${round(profile.heightCm)} cm` : "-")}
          ${detail(t("language"), profile.languageCode || "-")}
          ${detail(t("diabetesType"), profile.diabetesType || "-")}
        </div>
      </div>
      <div class="medical-section">
        <h3>${t("medicalMetrics")}</h3>
        <div class="detail-grid">
          ${detail(t("currentGlucose"), glucoseValue(profile.glucoseMmol))}
          ${detail(t("targetGlucose"), glucoseValue(profile.targetGlucoseMmol))}
          ${detail("Insulin/carb", profile.insulinToCarbRatio ?? "-")}
          ${detail("Correction", profile.correctionFactor ? round(profile.correctionFactor) : "-")}
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
        ${entries.length ? `<div class="medical-list">${entries.map(medicalEntry).join("")}</div>` : `<div class="empty">${t("noEntries")}</div>`}
      </div>
    </section>`;
}

function medicalEntry(entry) {
  return `<article class="medical-entry">
    <strong>${escapeHtml(entry.title || entry.type || "entry")}</strong>
    <span>${formatDate(entry.time || entry.created_at || entry.createdAt)}</span>
    <div>${glucoseValue(entry.glucoseMmol)} · ${escapeHtml(entry.carbs ?? 0)} carbs · ${escapeHtml(entry.insulinUnits ?? 0)} insulin</div>
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
  const rows = data.rows || [];
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
  qsa("[data-gdpr-action]").forEach((button) => button.addEventListener("click", async () => {
    const form = new FormData(qs("#gdprForm"));
    const action = button.dataset.gdprAction;
    const comment = form.get("comment") || "";
    if (["reject", "anonymize", "delete-account"].includes(action) && !confirm(t("deleteTicketConfirm"))) return;
    const payload = action === "status"
      ? { status: form.get("status"), comment }
      : action === "comment"
        ? { visibility: form.get("visibility"), comment }
        : action === "reject"
          ? { reason: comment || "Rejected by administrator" }
          : { comment };
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
    setting: `<h2>${t("createSetting")}</h2><form id="createForm" class="form-grid">
      <label>${t("key")}<input name="key" placeholder="feature.example" required></label>
      <label>${t("jsonValue")}<textarea name="value" rows="5" required>{"enabled":true}</textarea></label>
      <label><input name="isSecret" type="checkbox"> ${t("secret")}</label>
      <button class="button primary" type="submit">${t("save")}</button></form>`,
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
        <option>data_access</option>
        <option>data_export</option>
        <option>data_rectification</option>
        <option>account_deletion</option>
        <option>data_anonymization</option>
        <option>processing_restriction</option>
        <option>consent_withdrawal</option>
        <option>processing_objection</option>
        <option>data_portability</option>
        <option>other</option>
      </select></label>
      <label>${t("locale")}<input name="locale" value="${escapeHtml(state.lang || "en")}"></label>
      <label>${t("subject")}<input name="subject" required></label>
      <label>${t("reason")}<textarea name="description" rows="4" required></textarea></label>
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
  if (type === "setting") {
    let value;
    try { value = JSON.parse(form.get("value")); } catch { value = form.get("value"); }
    return api(`/settings/${encodeURIComponent(form.get("key"))}`, { method: "PUT", body: { value, isSecret: form.has("isSecret") } });
  }
  if (type === "localization") {
    return api("/localizations", { method: "POST", body: { locale: form.get("locale"), versionLabel: form.get("versionLabel"), payload: JSON.parse(form.get("payload")) } });
  }
  if (type === "backup") return api("/backups", { method: "POST", body: { type: "database" } });
  if (type === "gdpr") return api("/gdpr", { method: "POST", body: { userId: form.get("userId"), requestType: form.get("requestType"), subject: form.get("subject"), description: form.get("description"), locale: form.get("locale") } });
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

function showActionError(error) {
  notice(error?.code || error?.message || "Action failed", true);
}

function t(key) {
  const dict = dictionaries[state.lang] || dictionaries.ru;
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

function round(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits).replace(/\.0+$/, "") : "-";
}

function glucoseValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${round(number, 1)} mmol/L` : "-";
}

function debounce(fn, delay) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

