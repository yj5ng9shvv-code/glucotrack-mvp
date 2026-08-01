export function benchmarkExportEnabled(environment = process.env.BENCHMARK_EXPORT_ENABLED) {
  return environment === 'true';
}

export function requireBenchmarkExportEnabled(environment) {
  if (!benchmarkExportEnabled(environment)) {
    throw new Error('benchmark export is disabled');
  }
}
