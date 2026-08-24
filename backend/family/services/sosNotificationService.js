export class SosNotificationAccessDeniedError extends Error {}
export class SosNotificationValidationError extends Error {}

const MAX_BATCH_SIZE = 100;

export function createSosNotificationService({
  familyRepository,
  permissionRepository,
  sosRepository,
  notificationRepository,
  sender = null,
  settingsService = null
}) {
  const isSameUser = (left, right) => String(left) === String(right);
  const settings = async () => settingsService?.effectiveSettings ? settingsService.effectiveSettings() : {};

  const requireAuthenticated = (userId) => {
    if (userId === null || userId === undefined || userId === "") {
      throw new SosNotificationAccessDeniedError("FORBIDDEN");
    }
  };

  const batchSize = (limit = 100) => {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_BATCH_SIZE) {
      throw new SosNotificationValidationError("INVALID_BATCH_SIZE");
    }
    return parsed;
  };

  const authorizedCaregivers = async (patientId) => {
    const family = await familyRepository.findGroupByPatient(patientId);
    if (!family || family.status !== "active") return [];
    const members = await familyRepository.members(family.id);
    const recipients = [];
    for (const member of members) {
      if (member.role !== "caregiver" || member.status !== "active") continue;
      const permissions = await permissionRepository.get(member.id);
      if (permissions?.can_view_sos) recipients.push(member.user_id);
    }
    return [...new Set(recipients.map(String))];
  };

  const channelsForSettings = (activeSettings) => {
    const channels = [];
    if (activeSettings.sos_in_app_enabled !== false) channels.push("in_app");
    if (activeSettings.sos_push_enabled === true) channels.push("push");
    if (activeSettings.sos_sms_enabled === true && activeSettings.sos_sms_type === "external_reserved") channels.push("sms");
    return [...new Set(channels)];
  };

  return {
    channelsForSettings,

    async createSOSNotifications(requesterId, sosEventId, activeSettings = null) {
      requireAuthenticated(requesterId);
      const event = await sosRepository.getById(sosEventId);
      if (!event || !isSameUser(event.patient_id, requesterId)) {
        throw new SosNotificationAccessDeniedError("FORBIDDEN");
      }
      if (event.status !== "ACTIVE") return [];
      const effective = activeSettings || await settings();
      if (effective.sos_enabled === false) return [];
      const recipients = await authorizedCaregivers(event.patient_id);
      const channels = channelsForSettings(effective);
      for (const recipientId of recipients) {
        for (const channel of channels) {
          await notificationRepository.createNotificationJob(event.id, recipientId, {
            channel,
            notificationType: "initial",
            sequence: 0
          });
        }
      }
      return recipients;
    },

    async isAuthorizedSOSRecipient(patientId, caregiverId) {
      const recipients = await authorizedCaregivers(patientId);
      return recipients.some((recipientId) => isSameUser(recipientId, caregiverId));
    },

    cancelPendingForEvent(sosEventId, options = {}) {
      return notificationRepository.cancelPendingForEvent(sosEventId, options);
    },

    async retryFailedNotifications({ limit = 100 } = {}) {
      const jobs = await notificationRepository.getPendingJobs({
        includeFailed: true,
        limit: batchSize(limit)
      });
      const result = { sent: 0, failed: 0 };
      for (const job of jobs) {
        try {
          if (!sender) throw new Error("SOS notification sender is unavailable");
          await sender.send(job);
          await notificationRepository.markSent(job.id);
          result.sent++;
        } catch {
          await notificationRepository.markFailed(job.id);
          result.failed++;
        }
      }
      return result;
    }
  };
}
