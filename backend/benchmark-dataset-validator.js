const forbiddenKeys = new Set(['email', 'name', 'phone', 'token', 'ip', 'device_id', 'user_id', 'notes', 'photo', 'latitude', 'longitude']);

export function validateBenchmarkDataset(dataset) {
  const errors = [];
  if (!Array.isArray(dataset)) return { valid: false, errors: ['dataset must be an array'] };
  for (const [index, user] of dataset.entries()) {
    if (!String(user?.anonymous_user_id ?? '').startsWith('synthetic-') && !String(user?.anonymous_user_id ?? '').startsWith('anon-')) errors.push(`user ${index}: invalid anonymous id`);
    if (Object.keys(user ?? {}).some((key) => forbiddenKeys.has(key))) errors.push(`user ${index}: forbidden identifier`);
    for (const entry of user?.entries ?? []) {
      if (!Number.isFinite(Date.parse(entry?.time))) errors.push(`user ${index}: invalid time`);
      if (entry?.glucoseMmol != null && (!(Number(entry.glucoseMmol) > 0) || Number(entry.glucoseMmol) > 50)) errors.push(`user ${index}: invalid glucose`);
      if (Object.keys(entry ?? {}).some((key) => forbiddenKeys.has(key))) errors.push(`user ${index}: forbidden identifier`);
    }
  }
  return { valid: errors.length === 0, errors };
}
