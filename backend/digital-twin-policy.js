export function eventsAtOrBefore(entries, cutoffTime) {
  const cutoff = Date.parse(cutoffTime);
  if (!Number.isFinite(cutoff)) return [];
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const eventTime = Date.parse(entry?.time);
    return Number.isFinite(eventTime) && eventTime <= cutoff;
  });
}
