import test from 'node:test';
import assert from 'node:assert/strict';
import { benchmarkExportAuditEvent } from '../benchmark-export-audit.js';

test('benchmark export audit contains aggregates only', () => {
  const event = benchmarkExportAuditEvent({ consentedUsers: 2, excludedUsers: 3, eventCount: 8, dryRun: true });
  assert.equal(event.containsMedicalValues, false);
  assert.equal(event.containsDirectIdentifiers, false);
  assert.equal(event.eventCount, 8);
});
