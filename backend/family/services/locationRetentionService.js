const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOCATION_RETENTION_DAYS = 30;
const DEFAULT_ACCESS_LOG_RETENTION_DAYS = 365;
const MAX_RETENTION_DAYS = 3650;

function retentionDays(value, name, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_RETENTION_DAYS) {
    throw new RangeError(`${name} must be an integer between 1 and ${MAX_RETENTION_DAYS}`);
  }
  return parsed;
}

function cutoffFor(days, now) {
  return new Date(now.getTime() - days * DAY_MS);
}

export function createLocationRetentionService({
  locationRepository,
  locationHistoryRetentionDays = process.env.LOCATION_HISTORY_RETENTION_DAYS,
  accessLogRetentionDays = process.env.LOCATION_ACCESS_LOG_RETENTION_DAYS,
  now = () => new Date()
}) {
  if (!locationRepository?.deleteExpiredLocations || !locationRepository?.deleteExpiredAccessLogs) {
    throw new TypeError("locationRepository cleanup methods are required");
  }

  const locationDays = retentionDays(
    locationHistoryRetentionDays,
    "LOCATION_HISTORY_RETENTION_DAYS",
    DEFAULT_LOCATION_RETENTION_DAYS
  );
  const accessLogDays = retentionDays(
    accessLogRetentionDays,
    "LOCATION_ACCESS_LOG_RETENTION_DAYS",
    DEFAULT_ACCESS_LOG_RETENTION_DAYS
  );

  return {
    get locationHistoryRetentionDays() {
      return locationDays;
    },
    get accessLogRetentionDays() {
      return accessLogDays;
    },
    async cleanupExpiredLocations() {
      const cutoff = cutoffFor(locationDays, now());
      const result = await locationRepository.deleteExpiredLocations(cutoff);
      return { deleted: Number(result?.affectedRows ?? result?.rowCount ?? 0), cutoff };
    },
    async cleanupExpiredAccessLogs() {
      const cutoff = cutoffFor(accessLogDays, now());
      const result = await locationRepository.deleteExpiredAccessLogs(cutoff);
      return { deleted: Number(result?.affectedRows ?? result?.rowCount ?? 0), cutoff };
    },
    async cleanup() {
      const [locations, accessLogs] = await Promise.all([
        this.cleanupExpiredLocations(),
        this.cleanupExpiredAccessLogs()
      ]);
      return { locations, accessLogs };
    }
  };
}
