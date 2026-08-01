import { escapeHtml } from '../utils/htmlEscape.js';
export function familyInvitationTemplate({ message, inviteCode, invitationUrl, applicationUrl }) {
  const code = escapeHtml(inviteCode);
  return {
    subject: message.subject,
    text: `${message.title}\n\n${message.body}\n\n${message.code}: ${inviteCode}\n${message.expires}\n\n${invitationUrl}`,
    html: `<main><h1>${escapeHtml(message.title)}</h1><p>${escapeHtml(message.body)}</p><p><a href="${escapeHtml(invitationUrl)}" style="display:inline-block;padding:12px 18px;background:#0b7cff;color:#fff;border-radius:8px;text-decoration:none">Принять семейный доступ</a></p><p><strong>${escapeHtml(message.code)}:</strong> ${code}</p><p>${escapeHtml(message.expires)}</p><p>${escapeHtml(applicationUrl)}</p></main>`,
  };
}
