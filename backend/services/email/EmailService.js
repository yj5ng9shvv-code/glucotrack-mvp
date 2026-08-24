import { familyInvitationTemplate } from './templates/familyInvitationTemplate.js';
import { supportReplyTemplate } from './templates/supportReplyTemplate.js';
import { escapeHtml } from './utils/htmlEscape.js';

export class EmailService {
  constructor(adapter) {
    this.adapter = adapter;
  }

  sendVerificationEmail({ email, verificationUrl }) {
    return this.adapter.send({
      to: email,
      subject: 'GlucoTrack',
      text: verificationUrl,
      html: `<p><a href="${escapeHtml(verificationUrl)}">GlucoTrack</a></p>`,
      template: 'verification'
    });
  }

  sendPasswordResetEmail({ email, resetUrl }) {
    return this.adapter.send({
      to: email,
      subject: 'GlucoTrack',
      text: resetUrl,
      html: `<p><a href="${escapeHtml(resetUrl)}">GlucoTrack</a></p>`,
      template: 'password_reset'
    });
  }

  sendFamilyInvitationEmail({ email, patientId, patientName, message, inviteCode, invitationUrl, applicationUrl }) {
    return this.adapter.send({
      to: email,
      template: 'family_invitation',
      patientId,
      patientName,
      ...familyInvitationTemplate({ message, inviteCode, invitationUrl, applicationUrl })
    });
  }

  sendSupportReply({ email, subject, ticketId, reply }) {
    return this.adapter.send({
      to: email,
      template: 'support_reply',
      ...supportReplyTemplate({ subject, ticketId, reply })
    });
  }
}
