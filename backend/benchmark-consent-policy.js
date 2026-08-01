export function benchmarkConsentState(value) {
  if (value === true) return 'granted';
  if (value === false) return 'declined';
  return 'not_granted';
}

export function mayExportForBenchmark(consent) {
  return benchmarkConsentState(consent?.benchmarkConsent) === 'granted';
}
