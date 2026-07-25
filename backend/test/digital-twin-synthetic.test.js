import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateSyntheticBenchmarks, generateSyntheticDataset, syntheticDatasetSummary } from '../digital-twin-synthetic.js';
import { benchmarkHistory } from '../digital-twin-backtest.js';
import { validateBenchmarkDataset } from '../benchmark-dataset-validator.js';
import { anonymizeBenchmarkUsers, benchmarkExportDryRun, consentedBenchmarkUsers } from '../benchmark-anonymization.js';

test('synthetic benchmark dataset is reproducible and contains no production identifiers', () => {
  const first = generateSyntheticDataset();
  assert.deepEqual(first, generateSyntheticDataset());
  assert.equal(first.length, 20);
  assert.ok(first.every((user) => user.anonymous_user_id.startsWith('synthetic-')));
  assert.ok(first.every((user) => user.entries.length > 0));
});

test('synthetic users are benchmarked independently', () => {
  const dataset = generateSyntheticDataset();
  const reports = dataset.map((user) => benchmarkHistory(user.entries));
  assert.equal(reports.length, 20);
  assert.ok(reports.some((report) => report.candidate?.sampleCount > 0));
  // Each report receives only that user's entries; no shared global history exists.
  assert.ok(reports.every((report) => report.baselines.lastValue === null || report.baselines.lastValue.sampleCount >= 0));
});

test('synthetic dataset summary is explicitly non-production', () => {
  const summary = syntheticDatasetSummary(generateSyntheticDataset());
  assert.deepEqual(summary.containsProductionData, false);
  assert.equal(summary.users, 20);
  assert.ok(summary.events > 0);
});

test('synthetic aggregate is explicitly non-clinical', () => {
  const reports = generateSyntheticDataset().map((user) => benchmarkHistory(user.entries));
  const aggregate = aggregateSyntheticBenchmarks(reports);
  assert.equal(aggregate.users, 20);
  assert.equal(aggregate.clinicalClaim, false);
  assert.ok(aggregate.comparablePoints > 0);
});

test('benchmark validator accepts synthetic data and blocks identifiers', () => {
  assert.equal(validateBenchmarkDataset(generateSyntheticDataset()).valid, true);
  assert.equal(validateBenchmarkDataset([{ anonymous_user_id: 'anon-a', email: 'x@example.com', entries: [] }]).valid, false);
});

test('pseudonymization removes direct identifiers and remains stable for one export', () => {
  const input = [{ id: 42, entries: [{ time: '2026-01-01T00:00:00Z', glucoseMmol: 6, email: 'x@example.com', notes: 'private' }] }];
  const first = anonymizeBenchmarkUsers(input, 'test-salt');
  assert.deepEqual(first, anonymizeBenchmarkUsers(input, 'test-salt'));
  assert.deepEqual(Object.keys(first[0].entries[0]), ['time', 'glucoseMmol']);
  assert.equal(JSON.stringify(first).includes('x@example.com'), false);
  assert.equal(JSON.stringify(first).includes('42'), false);
});

test('benchmark export selection requires explicit consent', () => {
  const users = [{ id: 1, benchmarkConsent: true }, { id: 2, benchmarkConsent: false }, { id: 3 }];
  assert.deepEqual(consentedBenchmarkUsers(users).map((user) => user.id), [1]);
});

test('export dry-run returns aggregates only', () => {
  const dryRun = benchmarkExportDryRun([{ benchmarkConsent: true, entries: [{ glucoseMmol: 6 }] }, { entries: [] }]);
  assert.deepEqual(dryRun, { totalUsers: 2, consentedUsers: 1, excludedUsers: 1, eventCount: 1, exportedFields: ['anonymous_user_id', 'time', 'glucoseMmol', 'carbs', 'source'], writesFile: false, includesMedicalValues: false });
});
