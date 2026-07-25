import { readFile } from 'node:fs/promises';
import { benchmarkHistory } from '../digital-twin-backtest.js';
import { aggregateSyntheticBenchmarks } from '../digital-twin-synthetic.js';
import { validateBenchmarkDataset } from '../benchmark-dataset-validator.js';

const path = process.argv[2];
if (!path) throw new Error('Usage: node scripts/run-benchmark-dataset.js <dataset.json>');
const dataset = JSON.parse(await readFile(path, 'utf8'));
const validation = validateBenchmarkDataset(dataset);
if (!validation.valid) throw new Error(`Dataset rejected: ${validation.errors.join('; ')}`);
const reports = dataset.map((user) => benchmarkHistory(user.entries));
console.log(JSON.stringify({ source: 'validated_dataset', users: dataset.length, benchmark: aggregateSyntheticBenchmarks(reports) }, null, 2));
