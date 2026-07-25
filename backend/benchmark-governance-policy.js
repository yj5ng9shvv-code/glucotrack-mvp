export const BENCHMARK_GOVERNANCE = Object.freeze({
  allowedEnvironment: 'staging',
  requiredRole: 'benchmark_export_admin',
  exportEnabledByDefault: false,
  revocationExcludesFutureExportsImmediately: true,
});

export function mayRunBenchmarkExport({ environment, role, consent }) {
  return environment === BENCHMARK_GOVERNANCE.allowedEnvironment
    && role === BENCHMARK_GOVERNANCE.requiredRole
    && consent === true;
}

export function requireStagingEnvironment(environment) {
  if (environment !== BENCHMARK_GOVERNANCE.allowedEnvironment) {
    throw new Error('benchmark staging operations are disabled outside staging');
  }
}
