import test from 'node:test';
import assert from 'node:assert/strict';
import {
  familyNotificationKeys,
  familyNotificationLocales,
  notificationEnvelope,
  pendingFamilyNotificationCatalog,
  preferredNotificationLocale,
} from '../locales/notifications/family_notification_catalog.js';

test('Family/SOS notification catalogue prepares every supported locale and key', () => {
  assert.equal(familyNotificationLocales.length, 30);
  for (const locale of familyNotificationLocales) {
    const catalogue = pendingFamilyNotificationCatalog(locale);
    assert.deepEqual(Object.keys(catalogue), familyNotificationKeys);
    for (const entry of Object.values(catalogue)) {
      assert.equal(entry.status, 'TRANSLATION_REQUIRED');
      assert.equal(entry.value, '');
    }
  }
});

test('notification envelope always takes the recipient preferred locale', () => {
  const notice = notificationEnvelope({
    key: 'sos.alert.created',
    recipient: { preferred_locale: 'pl-PL' },
    params: { patientName: 'Jan' },
    fallbackLocale: 'ru',
  });
  assert.equal(notice.locale, 'pl');
  assert.equal(notice.params.patientName, 'Jan');
  assert.equal(notice.translationStatus, 'TRANSLATION_REQUIRED');
  assert.equal(preferredNotificationLocale({ preferred_locale: 'de' }, 'ru'), 'de');
});
