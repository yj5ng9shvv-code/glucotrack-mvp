import { writeFile } from 'node:fs/promises';
import { generateSyntheticDataset, syntheticDatasetSummary } from '../digital-twin-synthetic.js';

const output = process.argv[2] ?? 'synthetic-benchmark.json';
const dataset = generateSyntheticDataset();
await writeFile(output, JSON.stringify(dataset, null, 2), 'utf8');
console.log(JSON.stringify({ output, ...syntheticDatasetSummary(dataset) }, null, 2));
