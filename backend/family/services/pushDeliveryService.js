const MAX_BATCH_SIZE = 100;

export function createPushDeliveryService({
  notificationRepository,
  sosNotificationService,
  pushProvider
}) {
  const providerName = pushProvider?.name ?? "abstract";

  const batchSize = (limit = 100) => {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_BATCH_SIZE) {
      throw new RangeError("INVALID_BATCH_SIZE");
    }
    return parsed;
  };

  const isInvalidToken = (error) =>
    ["INVALID_TOKEN", "NOT_REGISTERED", "UNREGISTERED"].includes(error?.code);

  const compactError = (error) =>
    String(error?.code ?? error?.message ?? "DELIVERY_FAILED").slice(0, 255);

  const log = (job, status, error = null) =>
    notificationRepository.createDeliveryLog(job.id, providerName, status, error);

  return {
    async processPendingNotifications({ limit = 100 } = {}) {
      const jobs = await notificationRepository.getPendingJobs({
        includeFailed: true,
        limit: batchSize(limit)
      });
      const result = { sent: 0, failed: 0, skipped: 0 };

      for (const job of jobs) {
        if (job.sos_event_status !== "ACTIVE") {
          await notificationRepository.markFailed(job.id, { retryable: false });
          await log(job, "SKIPPED", "SOS_EVENT_NOT_ACTIVE");
          result.skipped++;
          continue;
        }

        const authorized = await sosNotificationService.isAuthorizedSOSRecipient(
          job.patient_id,
          job.recipient_user_id
        );
        if (!authorized) {
          await notificationRepository.markFailed(job.id, { retryable: false });
          await log(job, "SKIPPED", "RECIPIENT_ACCESS_REVOKED");
          result.skipped++;
          continue;
        }

        const devices = await notificationRepository.findActivePushDevices(job.recipient_user_id);
        if (!devices.length) {
          await notificationRepository.markFailed(job.id, { retryable: true });
          await log(job, "FAILED", "NO_ACTIVE_PUSH_TOKEN");
          result.failed++;
          continue;
        }

        let delivered = false;
        let terminalFailure = false;
        for (const device of devices) {
          try {
            if (!pushProvider?.send) throw new Error("PUSH_PROVIDER_UNAVAILABLE");
            await pushProvider.send({
              token: device.push_token,
              platform: device.platform,
              data: { type: "family_sos", event_id: String(job.sos_event_id) }
            });
            await log(job, "SUCCESS");
            delivered = true;
          } catch (error) {
            const invalidToken = isInvalidToken(error);
            if (invalidToken) await notificationRepository.revokePushToken(device.id);
            await log(job, invalidToken ? "INVALID_TOKEN" : "TEMP_ERROR", compactError(error));
            if (invalidToken) terminalFailure = true;
          }
        }

        if (delivered) {
          await notificationRepository.markSent(job.id);
          result.sent++;
        } else {
          await notificationRepository.markFailed(job.id, { retryable: !terminalFailure });
          result.failed++;
        }
      }
      return result;
    }
  };
}
