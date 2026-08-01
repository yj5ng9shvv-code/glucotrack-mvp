export const FAMILY_PRESENCE_ONLINE_WINDOW_SECONDS = 150;

export function isFamilyPresenceOnline(lastSeen, now = Date.now()) {
  const timestamp = new Date(lastSeen ?? 0).getTime();
  return Number.isFinite(timestamp) && timestamp > 0 &&
    now - timestamp <= FAMILY_PRESENCE_ONLINE_WINDOW_SECONDS * 1000;
}

export function finitePresenceCoordinate(value, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : null;
}
