const MAX_DIARY_ENTRIES = 1000;
const MAX_SENSOR_READINGS = 288;

export function validateHealthSnapshot(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "payload must be an object";
  if (!payload.profile || typeof payload.profile !== "object" || Array.isArray(payload.profile)) return "profile is required";
  const diaryEntries = Array.isArray(payload.diaryEntries) ? payload.diaryEntries : [];
  const sensorReadings = Array.isArray(payload.sensorReadings) ? payload.sensorReadings : [];
  if (diaryEntries.length > MAX_DIARY_ENTRIES) return "invalid diaryEntries";
  if (sensorReadings.length > MAX_SENSOR_READINGS) return "invalid sensorReadings";
  const profile = payload.profile;
  if (!text(profile.fullName, 120) || !text(profile.email, 255) ||
      !optionalInteger(profile.age, 0, 130) || !optionalNumber(profile.weightKg, 20, 400) ||
      !optionalNumber(profile.heightCm, 50, 260) || !optionalNumber(profile.glucoseMmol, 0, 35) ||
      !optionalNumber(profile.targetGlucoseMmol, 0, 20) || !optionalNumber(profile.insulinToCarbRatio, 0, 100) ||
      !optionalNumber(profile.correctionFactor, 0, 20)) return "invalid profile values";
  for (const entry of diaryEntries) {
    if (!entry || typeof entry !== "object" || !text(entry.id, 160) || !date(entry.time) ||
        !number(entry.glucoseMmol, 0, 35) || !number(entry.carbs, 0, 1000) ||
        !number(entry.insulinUnits, 0, 200)) return "invalid diary entry";
  }
  for (const reading of sensorReadings) {
    if (!reading || typeof reading !== "object" || !date(reading.time) ||
        !number(reading.glucoseMmol, 1, 35) ||
        !text(sensorReadingSourceId(reading), 220)) return "invalid sensor reading";
  }
  if (payload.emergency != null && (typeof payload.emergency !== "object" || Array.isArray(payload.emergency))) {
    return "invalid emergency data";
  }
  return null;
}

export function mergeHealthSnapshots(server, incoming) {
  return {
    ...server,
    ...incoming,
    profile: { ...(server?.profile ?? {}), ...(incoming?.profile ?? {}) },
    emergency: { ...(server?.emergency ?? {}), ...(incoming?.emergency ?? {}) },
    diaryEntries: mergeByKey(server?.diaryEntries, incoming?.diaryEntries, (item) => String(item.id)),
    sensorReadings: mergeByKey(server?.sensorReadings, incoming?.sensorReadings,
      (item) => sensorReadingSourceId(item)),
  };
}

function mergeByKey(first, second, keyOf) {
  const values = new Map();
  for (const item of [...(Array.isArray(first) ? first : []), ...(Array.isArray(second) ? second : [])]) {
    const key = keyOf(item);
    if (key == null || key === "") continue;
    values.set(String(key), item);
  }
  return [...values.values()].sort((a, b) => String(b.time).localeCompare(String(a.time)));
}

function sensorReadingSourceId(reading) {
  if (text(reading?.sourceId, 220)) return String(reading.sourceId);
  if (date(reading?.time) && text(reading?.brand, 160)) {
    return `${reading.brand}|${String(reading.time)}`;
  }
  return "";
}

function text(value, maximum) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}
function integer(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}
function number(value, minimum, maximum) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}
function optionalNumber(value, minimum, maximum) {
  if (value === null || value === undefined) return true;
  return number(value, minimum, maximum);
}
function optionalInteger(value, minimum, maximum) {
  if (value === null || value === undefined) return true;
  return integer(value, minimum, maximum);
}
function date(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
