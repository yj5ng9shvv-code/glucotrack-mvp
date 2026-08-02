export class SosNotificationAccessDeniedError extends Error {}
export class SosNotificationValidationError extends Error {}

const MAX_BATCH_SIZE = 100;

export function createSosNotificationService({
  familyRepository,
  permissionRepository,
  sosRepository,
  notificationRepository,
  sender = null
}) {
  const isSameUser = (left, right) => String(left) === String(right);

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

  return {
    async createSOSNotifications(requesterId, sosEventId) {
      requireAuthenticated(requesterId);
      const event = await sosRepository.getById(sosEventId);
      if (!event || !isSameUser(event.patient_id, requesterId)) {
        throw new SosNotificationAccessDeniedError("FORBIDDEN");
      }
      if (event.status !== "ACTIVE") return [];
      const recipients = await authorizedCaregivers(event.patient_id);
      await Promise.all(recipients.map((recipientId) =>
        notificationRepository.createNotificationJob(event.id, recipientId)
      ));
      return recipients;
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
