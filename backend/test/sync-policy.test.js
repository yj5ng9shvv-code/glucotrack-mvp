import test from "node:test";
import assert from "node:assert/strict";
import { mergeHealthSnapshots, validateHealthSnapshot } from "../sync-policy.js";

function snapshot(id = "one") {
  return {
    profile: { fullName: "User", email: "u@example.com", age: 40, weightKg: 75,
      heightCm: 180, glucoseMmol: 6, targetGlucoseMmol: 6, insulinToCarbRatio: 10, correctionFactor: 2 },
    diaryEntries: [{ id, time: "2026-07-11T10:00:00Z", glucoseMmol: 6, carbs: 10, insulinUnits: 1 }],
    sensorReadings: [{ sourceId: id, brand: "manual", time: "2026-07-11T10:00:00Z", glucoseMmol: 6 }],
    emergency: {},
  };
}

test("validates a versioned medical snapshot payload", () => {
  assert.equal(validateHealthSnapshot(snapshot()), null);
  assert.equal(validateHealthSnapshot({ ...snapshot(), profile: { ...snapshot().profile, weightKg: undefined, heightCm: undefined } }), null);
  assert.equal(validateHealthSnapshot({ ...snapshot(), profile: { ...snapshot().profile, age: 999 } }), "invalid profile values");
  assert.equal(validateHealthSnapshot({ ...snapshot(), sensorReadings: [{ sourceId: "x", time: "bad", glucoseMmol: 99 }] }), "invalid sensor reading");
});

test("accepts diary sync before optional medical profile is completed", () => {
  const payload = snapshot("new-user-diary");
  payload.profile.age = 0;
  payload.profile.targetGlucoseMmol = 0;
  payload.profile.insulinToCarbRatio = 0;
  payload.profile.correctionFactor = 0;
  delete payload.profile.weightKg;
  delete payload.profile.heightCm;
  assert.equal(validateHealthSnapshot(payload), null);
});
test("merges simultaneous diary and sensor additions without loss", () => {
  const merged = mergeHealthSnapshots(snapshot("phone"), snapshot("web"));
  assert.deepEqual(merged.diaryEntries.map((item) => item.id).sort(), ["phone", "web"]);
  assert.deepEqual(merged.sensorReadings.map((item) => item.sourceId).sort(), ["phone", "web"]);
});

test("accepts sensor readings without sourceId when brand and time are available", () => {
  const payload = snapshot("phone");
  payload.sensorReadings[0] = {
    time: "2026-07-11T10:00:00Z",
    glucoseMmol: 6,
    brand: "manual",
  };
  assert.equal(validateHealthSnapshot(payload), null);
});

test("accepts payload missing optional arrays as empty snapshots", () => {
  const payload = snapshot("phone");
  delete payload.diaryEntries;
  delete payload.sensorReadings;
  assert.equal(validateHealthSnapshot(payload), null);
});

test("merges sensor readings with whitespace sourceId using fallback key", () => {
  const server = { ...snapshot("server"), profile: snapshot("server").profile, sensorReadings: [{ sourceId: "   ", brand: "manual", time: "2026-07-11T10:00:00Z", glucoseMmol: 5 }] };
  const incoming = snapshot("incoming");
  incoming.sensorReadings[0] = { sourceId: "manual|2026-07-11T10:00:00Z", brand: "manual", time: "2026-07-11T10:00:00Z", glucoseMmol: 6 };
  const merged = mergeHealthSnapshots(server, incoming);
  assert.equal(merged.sensorReadings.length, 1);
  assert.equal(merged.sensorReadings[0].glucoseMmol, 6);
});
