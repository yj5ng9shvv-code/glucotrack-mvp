import { eventsAtOrBefore } from "./digital-twin-policy.js";

export function lastValueBaseline(currentGlucose) {
  return Number.isFinite(currentGlucose) ? currentGlucose : null;
}

export function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function historicalCarbDeltas(entries, carbs, cutoffTime) {
  const ordered = eventsAtOrBefore(entries, cutoffTime).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const deltas = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const meal = ordered[index];
    if (!(Number(meal.carbs) > 0) || Math.abs(Number(meal.carbs) - carbs) > 15) continue;
    const baseline = [...ordered.slice(0, index)].reverse().find((entry) => Number(entry.glucoseMmol) > 0);
    const after = ordered.slice(index + 1).find((entry) => {
      const minutes = (Date.parse(entry.time) - Date.parse(meal.time)) / 60000;
      return Number(entry.glucoseMmol) > 0 && minutes >= 30 && minutes <= 180;
    });
    if (baseline && after) deltas.push(Number(after.glucoseMmol) - Number(baseline.glucoseMmol));
  }
  return deltas;
}

// All baselines are deliberately simple and use exactly the same historical
// slice as a candidate predictor. They make offline comparisons reproducible.
export function baselinePredictions({ currentGlucose, carbs, history, predictionTime }) {
  const current = lastValueBaseline(Number(currentGlucose));
  if (!Number.isFinite(current)) return {};
  const deltas = historicalCarbDeltas(history, Number(carbs), predictionTime);
  const result = { lastValue: current };
  const averageDelta = mean(deltas);
  const medianDelta = median(deltas);
  if (Number.isFinite(averageDelta)) result.meanSimilarCarb = current + averageDelta;
  if (Number.isFinite(medianDelta)) result.medianSimilarCarb = current + medianDelta;
  return result;
}

export function baselinePredictors() {
  return {
    lastValue: (point) => baselinePredictions(point).lastValue,
    meanSimilarCarb: (point) => baselinePredictions(point).meanSimilarCarb,
    medianSimilarCarb: (point) => baselinePredictions(point).medianSimilarCarb,
  };
}

// Offline equivalent of the production personal-cases midpoint. It is kept
// separate from live prediction so that a benchmark can never alter a result.
export function personalCasesPredictor({ currentGlucose, carbs, history, predictionTime, horizonMinutes = 120 }) {
  const current = Number(currentGlucose);
  if (!Number.isFinite(current) || current <= 0) return null;
  const deltas = historicalCarbDeltas(history, Number(carbs), predictionTime);
  if (deltas.length < 3) return null;
  return current + mean(deltas);
}

export function buildWalkForwardPoints(entries, horizonMinutes = 120) {
  const ordered = [...entries]
    .filter((entry) => Number.isFinite(Date.parse(entry?.time)))
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const tolerance = 15 * 60_000;
  return ordered.flatMap((meal, index) => {
    const carbs = Number(meal?.carbs);
    if (!(carbs > 0)) return [];
    const predictionTime = meal.time;
    const current = [...ordered.slice(0, index)].reverse().find((entry) => Number(entry?.glucoseMmol) > 0);
    const target = Date.parse(predictionTime) + horizonMinutes * 60_000;
    const actual = ordered.slice(index + 1)
      .filter((entry) => Number(entry?.glucoseMmol) > 0)
      .sort((a, b) => Math.abs(Date.parse(a.time) - target) - Math.abs(Date.parse(b.time) - target))[0];
    if (!current || !actual || Math.abs(Date.parse(actual.time) - target) > tolerance) return [];
    return [{ entries: ordered, predictionTime, currentGlucose: Number(current.glucoseMmol), carbs, actual: Number(actual.glucoseMmol), horizonMinutes }];
  });
}

export function errorMetrics(predictions) {
  const errors = predictions
    .filter((item) => Number.isFinite(item?.predicted) && Number.isFinite(item?.actual))
    .map((item) => Number(item.predicted) - Number(item.actual));
  if (!errors.length) return null;
  const absolute = errors.map(Math.abs);
  return {
    sampleCount: errors.length,
    mae: mean(absolute),
    medianAbsoluteError: median(absolute),
    rmse: Math.sqrt(mean(errors.map((value) => value * value))),
    meanSignedError: mean(errors),
  };
}

export function walkForward(points, predictors) {
  const results = Object.fromEntries(Object.keys(predictors).map((name) => [name, []]));
  for (const point of points) {
    const history = eventsAtOrBefore(point.entries, point.predictionTime);
    for (const [name, predictor] of Object.entries(predictors)) {
      const predicted = predictor({ ...point, history });
      if (Number.isFinite(predicted) && Number.isFinite(point.actual)) {
        results[name].push({ predicted, actual: point.actual, predictionTime: point.predictionTime });
      }
    }
  }
  return Object.fromEntries(Object.entries(results).map(([name, rows]) => [name, errorMetrics(rows)]));
}

export function benchmarkReport(points) {
  const results = walkForward(points, {
    personalCases: personalCasesPredictor,
    ...baselinePredictors(),
  });
  const candidate = results.personalCases;
  const comparisons = Object.fromEntries(
    Object.entries(results)
      .filter(([name, metrics]) => name !== 'personalCases' && metrics && candidate)
      .map(([name, metrics]) => [name, {
        sampleCount: Math.min(candidate.sampleCount, metrics.sampleCount),
        maeDifference: candidate.mae - metrics.mae,
        betterMae: candidate.mae < metrics.mae,
      }])
  );
  return { candidate, baselines: results, comparisons };
}

export function benchmarkHistory(entries, horizonMinutes = 120) {
  return benchmarkReport(buildWalkForwardPoints(entries, horizonMinutes));
}
