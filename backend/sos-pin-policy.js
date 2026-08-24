const SOS_PIN_WINDOW_SECONDS = 15 * 60;
const SOS_PIN_LOCK_THRESHOLD = 3;
const SOS_PIN_MAX_DELAY_SECONDS = 60;

export function sosPinAttemptPolicy(failedAttempts) {
  const failures = Math.max(0, Number(failedAttempts) || 0);
  if (failures < SOS_PIN_LOCK_THRESHOLD) {
    return { locked: false, delaySeconds: 0 };
  }
  const exponent = Math.min(failures - SOS_PIN_LOCK_THRESHOLD, 6);
  return {
    locked: true,
    delaySeconds: Math.min(2 ** exponent, SOS_PIN_MAX_DELAY_SECONDS)
  };
}

export function sosPinWindowSeconds() {
  return SOS_PIN_WINDOW_SECONDS;
}
