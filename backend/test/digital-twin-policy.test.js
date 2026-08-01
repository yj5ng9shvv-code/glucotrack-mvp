import test from "node:test";
import assert from "node:assert/strict";
import { eventsAtOrBefore } from "../digital-twin-policy.js";

test("filters future events inside the prediction algorithm boundary", () => {
  const cutoff = "2026-07-25T12:00:00.000Z";
  const events = [
    { id: "before", time: "2026-07-25T11:59:59.999Z" },
    { id: "boundary", time: cutoff },
    { id: "after", time: "2026-07-25T12:00:00.001Z" },
    { id: "offset-after", time: "2026-07-25T14:01:00+02:00" },
  ];
  assert.deepEqual(eventsAtOrBefore(events, cutoff).map((entry) => entry.id), ["before", "boundary"]);
});
