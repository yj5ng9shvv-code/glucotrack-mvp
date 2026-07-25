# Digital twin synthetic benchmark

This report documents a technical test fixture only. It contains no production
or user-provided medical data and must not be interpreted as clinical evidence.

## Fixed configuration

- Algorithm: `personal-cases-v1`
- Features: `carbs-current-glucose-v1`
- Benchmark: `walk-forward-v1`
- Generator: `synthetic-v1`
- Seed: `20260725`
- Horizon: 120 minutes; actual-measurement tolerance: ±15 minutes
- Minimum comparable cases: 3

## Reproduction

```text
npm run generate-benchmark-synthetic -- synthetic-benchmark.json
npm run validate-benchmark-dataset -- synthetic-benchmark.json
npm run benchmark:dataset -- synthetic-benchmark.json
```

The fixture contains 20 synthetic users and is intentionally labelled
`synthetic_only`. Real-world MAE requires a separately approved, anonymized or
staging dataset; production data is not used by these commands.
