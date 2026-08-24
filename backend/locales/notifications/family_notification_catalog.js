import keys from './family_notification_keys.json' with { type: 'json' };
import locales from './supported_locales.json' with { type: 'json' };

export const familyNotificationKeys = Object.freeze(keys);
export const familyNotificationLocales = Object.freeze(locales);

/// A deliberately non-fallback catalogue. Until medical copy is approved, a
/// missing text stays visible to validation as TRANSLATION_REQUIRED instead of
/// silently sending English or Russian to another locale.
export function pendingFamilyNotificationCatalog(locale) {
  if (!familyNotificationLocales.includes(locale)) {
    throw new Error(`Unsupported Family notification locale: ${locale}`);
  }
  return Object.fromEntries(keys.map((key) => [key, {
    value: '',
    status: 'TRANSLATION_REQUIRED',
  }]));
}

export function preferredNotificationLocale(user, fallbackLocale = 'en') {
  const candidate = String(user?.preferred_locale ?? '').trim().toLowerCase().split(/[-_]/)[0];
  const fallback = String(fallbackLocale).trim().toLowerCase().split(/[-_]/)[0];
  return familyNotificationLocales.includes(candidate)
    ? candidate
    : (familyNotificationLocales.includes(fallback) ? fallback : 'en');
}

export function notificationEnvelope({ key, recipient, params = {}, fallbackLocale }) {
  if (!familyNotificationKeys.includes(key)) throw new Error(`Unknown Family notification key: ${key}`);
  return {
    key,
    locale: preferredNotificationLocale(recipient, fallbackLocale),
    params: { ...params },
    translationStatus: 'TRANSLATION_REQUIRED',
  };
}
