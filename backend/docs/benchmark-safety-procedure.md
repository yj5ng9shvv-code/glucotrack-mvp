# Benchmark safety procedure

1. Run synthetic checks only with `npm run benchmark:synthetic`.
2. Validate any future approved dataset before calculation.
3. Never run a benchmark against production data.
4. Future export requires all of: staging environment, dedicated export role,
   explicit opt-in, validator success, and export enabled by an explicit flag.
5. A synthetic MAE is a technical fixture result only. It is not clinical
   validation, a medical claim, or evidence of performance on real people.

The default export state is disabled.
