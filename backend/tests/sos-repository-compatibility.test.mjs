import assert from "node:assert/strict";
import test from "node:test";

import { createSosRepository } from "../family/repositories/sosRepository.js";

test("Family SOS repository normalizes legacy status values and supports idempotency", async () => {
  const queries = [];
  const repository = createSosRepository(async (sql, params = []) => {
    queries.push({ sql, params });
    return { rows: [], rowCount: 1, insertId: 1 };
  });

  await repository.createSOS(10, 50.45, 30.52, 8, {
    clientEventId: "sos-event-202608150001",
    clientRequestId: "sos-create-202608150001",
    source: "auto"
  });
  await repository.findByClientEvent(10, "sos-event-202608150001");
  await repository.findActiveByPatient(10);
  await repository.cancelSOS(1, 10);
  await repository.resolveSOS(1, 10);
  await repository.updateLocation(1, 10, 51, 31, 9);

  assert.match(queries[0].sql, /INSERT INTO sos_events\(patient_id, user_id, status/);
  assert.match(queries[0].sql, /client_event_id, client_request_id, source/);
  assert.match(queries[1].sql, /client_event_id = \$2/);
  assert.match(queries[2].sql, /CASE LOWER\(status\)/);
  assert.match(queries[2].sql, /LOWER\(status\) = 'active'/);
  assert.match(queries[3].sql, /SET status = 'cancelled'/);
  assert.match(queries[3].sql, /status_updated_at = UTC_TIMESTAMP\(\)/);
  assert.match(queries[4].sql, /SET status = 'resolved'/);
  assert.match(queries[5].sql, /last_location_at = UTC_TIMESTAMP\(\)/);
});