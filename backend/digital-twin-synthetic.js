// Synthetic-only fixture generator. It never reads production data.
export const SYNTHETIC_GENERATOR_VERSION = 'synthetic-v1';

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function generateSyntheticDataset({ seed = 20260725, users = 20, mealsPerUser = 18 } = {}) {
  const random = rng(seed);
  const profiles = [2.8, 2.1, 1.3, 2.4, 1.9];
  return Array.from({ length: users }, (_, userIndex) => {
    const response = profiles[userIndex % profiles.length];
    const entries = [];
    const start = Date.UTC(2026, 0, 1) + userIndex * 3600_000;
    for (let mealIndex = 0; mealIndex < mealsPerUser; mealIndex += 1) {
      const time = new Date(start + mealIndex * 8 * 3600_000);
      const carbs = 20 + Math.round(random() * 50);
      const baseline = 5 + random() * 3;
      const noise = (random() - 0.5) * (userIndex % 5 === 3 ? 2.5 : 0.8);
      entries.push({ time: new Date(time.getTime() - 5 * 60_000).toISOString(), glucoseMmol: baseline, source: 'synthetic' });
      entries.push({ time: time.toISOString(), carbs, source: 'synthetic' });
      if (!(userIndex % 7 === 6 && mealIndex % 4 === 0)) {
        entries.push({ time: new Date(time.getTime() + 120 * 60_000).toISOString(), glucoseMmol: baseline + response * (carbs / 30) + noise, source: 'synthetic' });
      }
    }
    return { anonymous_user_id: `synthetic-${String(userIndex + 1).padStart(3, '0')}`, entries };
  });
}

export function syntheticDatasetSummary(dataset) {
  return {
    source: 'synthetic_only',
    generatorVersion: SYNTHETIC_GENERATOR_VERSION,
    users: dataset.length,
    events: dataset.reduce((total, user) => total + user.entries.length, 0),
    containsProductionData: false,
  };
}

export function aggregateSyntheticBenchmarks(reports) {
  const candidateReports = reports.map((report) => report.candidate).filter(Boolean);
  return {
    source: 'synthetic_only',
    users: reports.length,
    usersWithPredictions: candidateReports.length,
    comparablePoints: candidateReports.reduce((total, metrics) => total + metrics.sampleCount, 0),
    meanMae: candidateReports.length
      ? candidateReports.reduce((total, metrics) => total + metrics.mae, 0) / candidateReports.length
      : null,
    clinicalClaim: false,
  };
}
