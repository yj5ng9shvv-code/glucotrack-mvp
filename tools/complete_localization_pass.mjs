import fs from 'node:fs';

const path = 'lib/l10n/profile_extra_translations.dart';
let text = fs.readFileSync(path, 'utf8');

const extraEn = {
  'about.support.title': 'Contact support',
  'about.support.email': 'Email',
  'about.support.subject': 'Subject',
  'about.support.message': 'Message',
  'about.support.send': 'Send',
  'about.support.sent': 'Message sent',
  'about.support.error': 'Could not send. Try again.',
  'about.support.close': 'Close',
  'about.offline': 'About GlukoTrack is not available offline yet.',
  'about.retry': 'Retry',
  'notifications.title': 'Notifications',
  'notifications.refresh': 'Refresh',
  'notifications.close': 'Close',
  'notifications.delete': 'Delete',
  'notifications.deleted': 'Notification deleted',
  'notifications.retry': 'Retry',
  'notifications.errorTitle': 'Could not load',
  'notifications.errorText': 'Check the connection and try again.',
  'notifications.emptyTitle': 'No notifications',
  'notifications.emptyText': 'Messages from GlukoTrack will appear here.',
  'referral.title': 'Referral program',
  'referral.loadError': 'Could not load referral data.',
  'referral.retry': 'Retry',
  'referral.inviteCode': 'Your invite code',
  'referral.copyLink': 'Copy link',
  'referral.copyCode': 'Copy code',
  'referral.rewardNote':
      'Reward is granted after the invited user verifies email and completes the first real Premium payment.',
  'referral.total': 'Total',
  'referral.rewards': 'Rewards',
  'referral.review': 'Review',
  'referral.history': 'History',
  'referral.empty': 'No referrals yet.',
  'referral.copied': 'Copied',
  'referral.status.email_pending': 'Email confirmation pending',
  'referral.status.awaiting_payment': 'Awaiting payment',
  'referral.status.payment_pending': 'Reward pending',
  'referral.status.qualified': 'Qualified',
  'referral.status.manual_review': 'In review',
  'referral.status.rewarded': 'Reward granted',
  'referral.status.rejected': 'Rejected',
  'referral.status.revoked': 'Revoked',
};

const extraRu = {
  'about.support.title': 'Связаться с поддержкой',
  'about.support.email': 'Email',
  'about.support.subject': 'Тема',
  'about.support.message': 'Сообщение',
  'about.support.send': 'Отправить',
  'about.support.sent': 'Сообщение отправлено',
  'about.support.error': 'Не удалось отправить. Попробуйте еще раз.',
  'about.support.close': 'Закрыть',
  'about.offline': 'Раздел О GlukoTrack пока недоступен офлайн.',
  'about.retry': 'Повторить',
  'notifications.title': 'Уведомления',
  'notifications.refresh': 'Обновить',
  'notifications.close': 'Закрыть',
  'notifications.delete': 'Удалить',
  'notifications.deleted': 'Уведомление удалено',
  'notifications.retry': 'Повторить',
  'notifications.errorTitle': 'Не удалось загрузить',
  'notifications.errorText': 'Проверьте интернет и попробуйте снова.',
  'notifications.emptyTitle': 'Уведомлений нет',
  'notifications.emptyText': 'Здесь появятся сообщения от GlukoTrack.',
  'referral.title': 'Реферальная программа',
  'referral.loadError': 'Не удалось загрузить реферальные данные.',
  'referral.retry': 'Повторить',
  'referral.inviteCode': 'Ваш код приглашения',
  'referral.copyLink': 'Скопировать ссылку',
  'referral.copyCode': 'Скопировать код',
  'referral.rewardNote':
      'Награда начисляется после подтверждения email и первой реальной оплаты Premium приглашенным пользователем.',
  'referral.total': 'Всего',
  'referral.rewards': 'Наград',
  'referral.review': 'Проверка',
  'referral.history': 'История',
  'referral.empty': 'Приглашений пока нет.',
  'referral.copied': 'Скопировано',
  'referral.status.email_pending': 'Ожидает подтверждения email',
  'referral.status.awaiting_payment': 'Ожидает оплату',
  'referral.status.payment_pending': 'Ожидает начисления',
  'referral.status.qualified': 'Условия выполнены',
  'referral.status.manual_review': 'На проверке',
  'referral.status.rewarded': 'Награда начислена',
  'referral.status.rejected': 'Отклонено',
  'referral.status.revoked': 'Отозвано',
};

function parseBlocks(source) {
  const headers = [...source.matchAll(/^  '([a-z]{2})': \{/gm)];
  return headers.map((match, index) => ({
    locale: match[1],
    start: match.index,
    end: index + 1 < headers.length ? headers[index + 1].index : source.lastIndexOf('};'),
  }));
}

function blockKeys(block) {
  return new Set([...block.matchAll(/^    '([^']+)':/gm)].map((match) => match[1]));
}

function dartString(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function linesFor(values, keys) {
  return keys.map((key) => `    '${key}': '${dartString(values[key])}',`).join('\n') + '\n';
}

const enBlock = parseBlocks(text).find((block) => block.locale === 'en');
const enText = text.slice(enBlock.start, enBlock.end);
const existingEnKeys = [...blockKeys(enText)];
const enValues = {};
for (const key of existingEnKeys) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = enText.match(new RegExp(`^    '${escaped}': '([^']*)',`, 'm'));
  enValues[key] = match ? match[1] : key;
}

const fallbackValues = {...enValues, ...extraEn};
const keyOrder = [
  ...existingEnKeys,
  ...Object.keys(extraEn).filter((key) => !existingEnKeys.includes(key)),
];

for (const block of parseBlocks(text).reverse()) {
  let chunk = text.slice(block.start, block.end);
  const existing = blockKeys(chunk);
  const values = block.locale === 'ru' ? {...fallbackValues, ...extraRu} : fallbackValues;
  const missing = keyOrder.filter((key) => !existing.has(key));
  if (!missing.length) continue;
  const insertAt = chunk.lastIndexOf('  },');
  chunk = chunk.slice(0, insertAt) + linesFor(values, missing) + chunk.slice(insertAt);
  text = text.slice(0, block.start) + chunk + text.slice(block.end);
}

fs.writeFileSync(path, text, 'utf8');
