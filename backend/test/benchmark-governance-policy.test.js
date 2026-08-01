import test from 'node:test';
import assert from 'node:assert/strict';
import { mayRunBenchmarkExport, requireStagingEnvironment } from '../benchmark-governance-policy.js';

test('benchmark export requires staging, dedicated role, and explicit consent', () => {
  assert.equal(mayRunBenchmarkExport({ environment: 'staging', role: 'benchmark_export_admin', consent: true }), true);
  assert.equal(mayRunBenchmarkExport({ environment: 'production', role: 'benchmark_export_admin', consent: true }), false);
  assert.equal(mayRunBenchmarkExport({ environment: 'staging', role: 'admin', consent: true }), false);
  assert.equal(mayRunBenchmarkExport({ environment: 'staging', role: 'benchmark_export_admin', consent: false }), false);
  assert.throws(() => requireStagingEnvironment('production'));
  assert.doesNotThrow(() => requireStagingEnvironment('staging'));
});
