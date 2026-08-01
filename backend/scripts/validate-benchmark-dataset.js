import { readFile } from 'node:fs/promises';
import { validateBenchmarkDataset } from '../benchmark-dataset-validator.js';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/validate-benchmark-dataset.js <dataset.json>');
  process.exitCode = 2;
} else {
  try {
    const result = validateBenchmarkDataset(JSON.parse(await readFile(path, 'utf8')));
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ valid: false, errors: [error.message] }));
    process.exitCode = 1;
  }
}
