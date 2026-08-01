import test from 'node:test';
import assert from 'node:assert/strict';
import { benchmarkExportEnabled, requireBenchmarkExportEnabled } from '../benchmark-export-policy.js';

test('benchmark export is disabled by default', () => {
  assert.equal(benchmarkExportEnabled(undefined), false);
  assert.equal(benchmarkExportEnabled('false'), false);
  assert.equal(benchmarkExportEnabled('true'), true);
  assert.throws(() => requireBenchmarkExportEnabled('false'));
});
