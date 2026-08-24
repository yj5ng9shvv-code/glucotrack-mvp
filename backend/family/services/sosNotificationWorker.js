const DEFAULT_INTERVAL_SECONDS = 30;
const MAX_INTERVAL_SECONDS = 3600;

function intervalMilliseconds(value) {
  const seconds = Number(value ?? DEFAULT_INTERVAL_SECONDS);
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_INTERVAL_SECONDS) {
    throw new RangeError("SOS_WORKER_INTERVAL_SECONDS must be between 1 and 3600");
  }
  return seconds * 1000;
}

function logError(logger, message, error) {
  logger.error?.(message, {
    message: String(error?.message ?? error ?? "unknown worker error").slice(0, 160)
  });
}

export function createSosNotificationWorker({
  deliveryService,
  enabled = false,
  intervalSeconds = DEFAULT_INTERVAL_SECONDS,
  logger = console,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval
}) {
  if (!deliveryService?.processPendingNotifications) {
    throw new TypeError("deliveryService.processPendingNotifications is required");
  }

  const intervalMs = intervalMilliseconds(intervalSeconds);
  let timer = null;
  let inFlight = null;

  const runOnce = async () => {
    if (!enabled || inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const result = await deliveryService.processPendingNotifications();
        const context = {
          sent: result.sent ?? 0,
          failed: result.failed ?? 0,
          skipped: result.skipped ?? 0
        };
        if (result.scheduled) context.scheduled = result.scheduled;
        logger.info?.("SOS notification worker processed jobs", context);
        return result;
      } catch (error) {
        logError(logger, "SOS notification worker failed", error);
        return null;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };

  return {
    get enabled() { return enabled; },
    get running() { return timer !== null; },
    status() { return { enabled, running: timer !== null, intervalSeconds: intervalMs / 1000 }; },
    async start() {
      if (!enabled) {
        logger.info?.("SOS notification worker disabled");
        return false;
      }
      if (timer !== null) return true;
      logger.info?.("SOS notification worker started", { interval_seconds: intervalMs / 1000 });
      timer = setIntervalFn(() => { void runOnce(); }, intervalMs);
      timer.unref?.();
      void runOnce();
      return true;
    },
    async stop() {
      if (timer !== null) {
        clearIntervalFn(timer);
        timer = null;
      }
      if (inFlight) await inFlight;
      logger.info?.("SOS notification worker stopped");
    },
    runOnce
  };
}
