import { checkSmsLimits, providerConnectionStatus } from "../../notification-provider-settings-service.js";

const MAX_BATCH_SIZE = 100;
const SOS_ANDROID_ALARM_CHANNEL_ID = "glukotrack_sos_alarm_v1";

function safeError(error) {
  return String(error?.code ?? error?.message ?? "DELIVERY_FAILED").replace(/[^A-Za-z0-9._:-]/g, "_").slice(0, 64);
}

function mysqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function createPushDeliveryService({
  notificationRepository,
  sosNotificationService,
  pushProvider = null,
  tokenCipher = null,
  settingsService = null,
  notificationProviderSettingsService = null,
  workerId = `sos-worker-${process.pid}`
}) {
  const providerName = pushProvider?.name ?? "dry-run";
  const settings = async () => settingsService?.effectiveSettings ? settingsService.effectiveSettings({ refresh: true }) : {};
  const notificationSettings = async () => notificationProviderSettingsService?.settings ? notificationProviderSettingsService.settings() : null;

  const batchSize = (limit = 100) => {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_BATCH_SIZE) {
      throw new RangeError("INVALID_BATCH_SIZE");
    }
    return parsed;
  };

  const isInvalidToken = (error) =>
    ["TOKEN_INVALID", "INVALID_TOKEN", "NOT_REGISTERED", "UNREGISTERED"].includes(error?.code);

  const log = (job, status, error = null, provider = providerName) =>
    notificationRepository.createDeliveryLog(job.id, provider, status, error);

  const eventIsActive = (job) => String(job.sos_event_status || "").toUpperCase() === "ACTIVE";

  const allowedBySettings = (job, activeSettings) => {
    if (activeSettings.sos_enabled === false) return false;
    if (job.channel === "in_app") return activeSettings.sos_in_app_enabled !== false;
    if (job.channel === "push") return activeSettings.sos_push_enabled === true;
    if (job.channel === "sms") return activeSettings.sos_sms_enabled === true && activeSettings.sos_sms_type === "external_reserved";
    if (job.channel === "mms") return false;
    return false;
  };

  const scheduleRepeat = async (job, activeSettings) => {
    if (job.notification_type === "escalation") return;
    if (activeSettings.sos_repeat_notifications !== true) return;
    const maxRepeats = Number(activeSettings.sos_max_notification_repeats || 0);
    const current = Number(job.sequence || 0);
    if (!Number.isInteger(maxRepeats) || current >= maxRepeats) return;
    const interval = Math.max(1, Number(activeSettings.sos_repeat_interval_minutes || 1));
    await notificationRepository.createNotificationJob(job.sos_event_id, job.recipient_user_id, {
      channel: job.channel,
      notificationType: "repeat",
      sequence: current + 1,
      scheduledAt: mysqlDate(new Date(Date.now() + interval * 60 * 1000))
    });
  };

  const scheduleEscalation = async (job, activeSettings) => {
    if (activeSettings.sos_escalation_enabled !== true) return;
    if (job.notification_type === "escalation") return;
    const delay = Math.max(1, Number(activeSettings.sos_escalation_after_minutes || 1));
    const start = job.sos_created_at ? new Date(job.sos_created_at).getTime() : Date.now();
    await notificationRepository.createNotificationJob(job.sos_event_id, job.recipient_user_id, {
      channel: job.channel,
      notificationType: "escalation",
      sequence: 0,
      scheduledAt: mysqlDate(new Date(start + delay * 60 * 1000))
    });
  };

  const deliverDryRun = async (job, activeSettings) => {
    const provider = job.channel === "in_app" ? "in_app_dry_run" : `${job.channel}_dry_run`;
    await log(job, activeSettings.sos_test_mode ? "DRY_RUN" : "SIMULATED", null, provider);
    await notificationRepository.markSent(job.id, { resultCode: activeSettings.sos_test_mode ? "DRY_RUN" : "SIMULATED" });
  };

  const deliverSms = async (job, activeSettings) => {
    const config = await notificationSettings();
    if (!config) throw Object.assign(new Error("SMS_PROVIDER_NOT_CONFIGURED"), { code: "SMS_PROVIDER_NOT_CONFIGURED" });
    const provider = config.settings.notification_sms_provider || "disabled";
    const status = providerConnectionStatus(provider, config.settings, config.secrets || {});
    if (provider === "disabled" || status === "DISABLED") {
      await notificationRepository.markSkipped(job.id, { reason: "SMS_DISABLED" });
      await log(job, "SKIPPED", "SMS_DISABLED", "sms_disabled");
      return;
    }
    const limits = await checkSmsLimits(notificationRepository.query || (() => { throw new Error("SMS_LIMIT_QUERY_UNAVAILABLE"); }), { patientId: job.patient_id, settings: config.settings });
    if (!limits.allowed) {
      await notificationRepository.markSkipped(job.id, { reason: limits.reason });
      await log(job, "SKIPPED", limits.reason, "sms_limit");
      return;
    }
    if (status === "DRY RUN" || status === "NOT CONFIGURED") {
      await log(job, "DRY_RUN", status === "NOT CONFIGURED" ? "NOT_CONFIGURED" : null, `${provider}_dry_run`);
      await notificationRepository.markSent(job.id, { resultCode: "DRY_RUN" });
      return;
    }
    throw Object.assign(new Error("SMS_REAL_DELIVERY_DISABLED"), { code: "SMS_REAL_DELIVERY_DISABLED" });
  };

  const deliverPush = async (job) => {
    const devices = await notificationRepository.findActivePushDevices(job.recipient_user_id);
    if (!devices.length) throw Object.assign(new Error("NO_ACTIVE_PUSH_TOKEN"), { code: "NO_ACTIVE_PUSH_TOKEN" });
    let delivered = false;
    let terminalFailure = false;
    const deliveredTokens = new Set();
    const eventId = String(job.sos_event_id);
    const idempotencyKey = `sos:${eventId}:${job.recipient_user_id}:${job.notification_type}:${job.sequence}`;
    const deepLink = `glukotrack://sos/${encodeURIComponent(eventId)}`;
    for (const device of devices) {
      try {
        if (!pushProvider?.send) throw Object.assign(new Error("PUSH_PROVIDER_NOT_CONFIGURED"), { code: "PUSH_PROVIDER_NOT_CONFIGURED" });
        const token = device.push_token_encrypted
          ? tokenCipher?.decrypt(device.push_token_encrypted)
          : device.push_token;
        if (!token) throw Object.assign(new Error("PUSH_TOKEN_DECRYPTION_UNAVAILABLE"), { code: "PUSH_TOKEN_DECRYPTION_UNAVAILABLE" });
        const tokenKey = `${String(device.platform || "").toLowerCase()}:${token}`;
        if (deliveredTokens.has(tokenKey)) continue;
        deliveredTokens.add(tokenKey);
        await pushProvider.send({
          token,
          platform: device.platform,
          title: "Family Watch emergency alert",
          body: "Open GlucoTrack to check the current SOS status.",
          data: {
            type: "family_sos",
            event_id: eventId,
            notification_type: String(job.notification_type),
            sequence: String(job.sequence),
            idempotency_key: idempotencyKey,
            deep_link: deepLink,
            android_channel_id: SOS_ANDROID_ALARM_CHANNEL_ID,
            apns_thread_id: `glukotrack-sos-${eventId}`,
            apns_collapse_id: idempotencyKey,
            critical_alert_status: "REQUIRES_APPLE_APPROVAL"
          }
        });
        await log(job, "SUCCESS");
        delivered = true;
      } catch (error) {
        const invalidToken = isInvalidToken(error);
        if (invalidToken) await notificationRepository.revokePushToken(device.id);
        await log(job, invalidToken ? "INVALID_TOKEN" : "TEMP_ERROR", safeError(error));
        if (invalidToken) terminalFailure = true;
      }
    }
    if (!delivered) throw Object.assign(new Error(terminalFailure ? "PUSH_TERMINAL_FAILURE" : "PUSH_TEMP_FAILURE"), { code: terminalFailure ? "PUSH_TERMINAL_FAILURE" : "PUSH_TEMP_FAILURE" });
    await notificationRepository.markSent(job.id, { resultCode: "PUSH_SENT" });
  };

  return {
    async processPendingNotifications({ limit = 100 } = {}) {
      const activeSettings = await settings();
      const lockId = `${workerId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const jobs = await notificationRepository.claimDueJobs({
        limit: batchSize(limit),
        workerId: lockId,
        maxAttempts: 5
      });
      const result = { sent: 0, failed: 0, skipped: 0, scheduled: 0 };

      for (const job of jobs) {
        try {
          if (!eventIsActive(job)) {
            await notificationRepository.markSkipped(job.id, { reason: "SOS_EVENT_NOT_ACTIVE" });
            await notificationRepository.cancelPendingForEvent(job.sos_event_id, { reason: "SOS_EVENT_NOT_ACTIVE" });
            await log(job, "SKIPPED", "SOS_EVENT_NOT_ACTIVE");
            result.skipped++;
            continue;
          }

          const authorized = await sosNotificationService.isAuthorizedSOSRecipient(job.patient_id, job.recipient_user_id);
          if (!authorized) {
            await notificationRepository.markSkipped(job.id, { reason: "RECIPIENT_ACCESS_REVOKED" });
            await log(job, "SKIPPED", "RECIPIENT_ACCESS_REVOKED");
            result.skipped++;
            continue;
          }

          if (!allowedBySettings(job, activeSettings)) {
            await notificationRepository.markSkipped(job.id, { reason: "CHANNEL_DISABLED" });
            await log(job, "SKIPPED", "CHANNEL_DISABLED");
            result.skipped++;
            continue;
          }

          if (activeSettings.sos_test_mode || job.channel === "in_app") {
            await deliverDryRun(job, activeSettings);
          } else if (job.channel === "push") {
            await deliverPush(job);
          } else if (job.channel === "sms") {
            await deliverSms(job, activeSettings);
          } else {
            throw Object.assign(new Error(`${job.channel.toUpperCase()}_PROVIDER_NOT_CONFIGURED`), { code: `${job.channel.toUpperCase()}_PROVIDER_NOT_CONFIGURED` });
          }

          if (eventIsActive(job)) {
            await scheduleRepeat(job, activeSettings);
            await scheduleEscalation(job, activeSettings);
          }
          result.sent++;
        } catch (error) {
          await notificationRepository.markFailed(job.id, { retryable: true, errorCode: safeError(error) });
          await log(job, "FAILED", safeError(error));
          result.failed++;
        }
      }
      return result;
    }
  };
}
