import test from 'node:test';
import assert from 'node:assert/strict';
import { benchmarkConsentState, mayExportForBenchmark } from '../benchmark-consent-policy.js';

test('benchmark export requires explicit opt-in', () => {
  assert.equal(benchmarkConsentState(true), 'granted');
  assert.equal(benchmarkConsentState(false), 'declined');
  assert.equal(benchmarkConsentState(undefined), 'not_granted');
  assert.equal(mayExportForBenchmark({ benchmarkConsent: true }), true);
  assert.equal(mayExportForBenchmark({}), false);
});
