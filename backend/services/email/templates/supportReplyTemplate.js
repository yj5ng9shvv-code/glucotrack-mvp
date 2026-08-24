import { escapeHtml } from '../utils/htmlEscape.js';
export function supportReplyTemplate({ subject, ticketId, reply }) {
  return { subject: `GlucoTrack Support: ${subject || `ticket #${ticketId}`}`, text: `${reply}\n\n---\nGlucoTrack Support\nTicket #${ticketId}`, html: `<p>${escapeHtml(reply).replace(/\n/g, '<br>')}</p><hr><p>GlucoTrack Support<br>Ticket #${escapeHtml(ticketId)}</p>` };
}
