export function benchmarkExportAuditEvent({ consentedUsers, excludedUsers, eventCount, dryRun }) {
  return {
    eventType: 'benchmark_export',
    createdAt: new Date().toISOString(),
    consentedUsers: Number(consentedUsers) || 0,
    excludedUsers: Number(excludedUsers) || 0,
    eventCount: Number(eventCount) || 0,
    dryRun: Boolean(dryRun),
    containsMedicalValues: false,
    containsDirectIdentifiers: false,
  };
}
