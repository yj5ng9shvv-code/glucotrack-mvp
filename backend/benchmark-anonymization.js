import { createHash } from 'node:crypto';
import { mayExportForBenchmark } from './benchmark-consent-policy.js';

const allowedEntryKeys = new Set(['time', 'glucoseMmol', 'carbs', 'source']);

export function anonymizeBenchmarkUsers(users, salt) {
  if (!salt) throw new Error('anonymization salt is required');
  return users.map((user) => ({
    anonymous_user_id: `anon-${createHash('sha256').update(`${salt}:${user.id}`).digest('hex').slice(0, 20)}`,
    entries: (user.entries ?? []).map((entry) => Object.fromEntries(
      Object.entries(entry).filter(([key]) => allowedEntryKeys.has(key))
    )),
  }));
}

export function consentedBenchmarkUsers(users) {
  return users.filter(mayExportForBenchmark);
}

export function benchmarkExportDryRun(users) {
  const eligible = consentedBenchmarkUsers(users);
  return {
    totalUsers: users.length,
    consentedUsers: eligible.length,
    excludedUsers: users.length - eligible.length,
    eventCount: eligible.reduce((total, user) => total + (user.entries?.length ?? 0), 0),
    exportedFields: ['anonymous_user_id', 'time', 'glucoseMmol', 'carbs', 'source'],
    writesFile: false,
    includesMedicalValues: false,
  };
}
