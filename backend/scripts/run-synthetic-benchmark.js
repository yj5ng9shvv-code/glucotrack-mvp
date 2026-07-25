import { benchmarkHistory } from '../digital-twin-backtest.js';
import { aggregateSyntheticBenchmarks, generateSyntheticDataset, syntheticDatasetSummary } from '../digital-twin-synthetic.js';
import { DIGITAL_TWIN_BENCHMARK_CONFIG } from '../digital-twin-benchmark-config.js';

const dataset = generateSyntheticDataset();
const reports = dataset.map((user) => benchmarkHistory(user.entries));
const report = {
  dataset: syntheticDatasetSummary(dataset),
  config: DIGITAL_TWIN_BENCHMARK_CONFIG,
  benchmark: aggregateSyntheticBenchmarks(reports),
  notice: 'Synthetic technical verification only; not evidence of clinical effectiveness.',
};
console.log(JSON.stringify(report, null, 2));
