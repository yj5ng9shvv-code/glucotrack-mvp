const DEFAULT_INTERVAL_HOURS = 24;
const MAX_INTERVAL_HOURS = 24 * 7;

function intervalMilliseconds(value) {
  const hours = Number(value ?? DEFAULT_INTERVAL_HOURS);
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_INTERVAL_HOURS) {
    throw new RangeError(`LOCATION_CLEANUP_INTERVAL_HOURS must be between 1 and ${MAX_INTERVAL_HOURS}`);
  }
  return hours * 60 * 60 * 1000;
}

export function createLocationRetentionWorker({
  retentionService,
  enabled = false,
  intervalHours = DEFAULT_INTERVAL_HOURS,
  logger = console,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval
}) {
  if (!retentionService?.cleanup) throw new TypeError("retentionService.cleanup is required");

  const intervalMs = intervalMilliseconds(intervalHours);
  let timer = null;
  let inFlight = null;

  const runOnce = async () => {
    if (!enabled || inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const result = await retentionService.cleanup();
        logger.info?.("Location retention cleanup completed", {
          locations_deleted: result.locations?.deleted ?? 0,
          access_logs_deleted: result.accessLogs?.deleted ?? 0
        });
        return result;
      } catch (error) {
        logger.error?.("Location retention cleanup failed", {
          message: String(error?.message ?? error ?? "unknown cleanup error")
        });
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
    async start() {
      if (!enabled) {
        logger.info?.("Location retention cleanup disabled");
        return false;
      }
      if (timer !== null) return true;
      logger.info?.("Location retention cleanup started", { interval_hours: intervalMs / (60 * 60 * 1000) });
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
      logger.info?.("Location retention cleanup stopped");
    },
    runOnce
  };
}
