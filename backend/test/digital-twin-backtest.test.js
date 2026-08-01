import test from "node:test";
import assert from "node:assert/strict";
import { baselinePredictors, benchmarkHistory, benchmarkReport, buildWalkForwardPoints, errorMetrics, historicalCarbDeltas, lastValueBaseline, mean, median, personalCasesPredictor, walkForward } from "../digital-twin-backtest.js";

test("walk-forward baselines exclude events after the cutoff", () => {
  const cutoff = "2026-01-02T00:00:00Z";
  const entries = [
    { time: "2026-01-01T08:00:00Z", glucoseMmol: 6, carbs: 0 },
    { time: "2026-01-01T08:10:00Z", glucoseMmol: 0, carbs: 30 },
    { time: "2026-01-01T09:10:00Z", glucoseMmol: 8, carbs: 0 },
    { time: "2026-01-03T08:00:00Z", glucoseMmol: 1, carbs: 0 },
    { time: "2026-01-03T08:10:00Z", glucoseMmol: 0, carbs: 30 },
    { time: "2026-01-03T09:10:00Z", glucoseMmol: 30, carbs: 0 },
  ];
  const deltas = historicalCarbDeltas(entries, 30, cutoff);
  assert.deepEqual(deltas, [2]);
  assert.equal(lastValueBaseline(6), 6);
  assert.equal(mean(deltas), 2);
  assert.equal(median(deltas), 2);
});

test("backtest error metrics are deterministic and ignore incomplete points", () => {
  const metrics = errorMetrics([
    { predicted: 6, actual: 5 }, { predicted: 8, actual: 10 }, { predicted: 7, actual: 7 }, { predicted: 4 },
  ]);
  assert.deepEqual(metrics, { sampleCount: 3, mae: 1, medianAbsoluteError: 1, rmse: Math.sqrt(5 / 3), meanSignedError: -1 / 3 });
});

test("walk-forward gives every baseline the same cutoff history", () => {
  const results = walkForward([{
    predictionTime: "2026-01-02T00:00:00Z", actual: 8,
    entries: [{ time: "2026-01-01T00:00:00Z" }, { time: "2026-01-03T00:00:00Z" }],
  }], {
    first: ({ history }) => history.length,
    second: ({ history }) => history.length,
  });
  assert.equal(results.first.mae, results.second.mae);
  assert.equal(results.first.sampleCount, 1);
});

test("standard baselines use only comparable personal cases before the prediction time", () => {
  const results = walkForward([{
    predictionTime: "2026-01-02T12:00:00Z",
    currentGlucose: 6,
    carbs: 30,
    actual: 8,
    entries: [
      { time: "2026-01-01T08:00:00Z", glucoseMmol: 5 },
      { time: "2026-01-01T08:05:00Z", carbs: 30 },
      { time: "2026-01-01T09:05:00Z", glucoseMmol: 7 },
      // This otherwise-perfect future case must never improve a backtest score.
      { time: "2026-01-03T08:00:00Z", glucoseMmol: 5 },
      { time: "2026-01-03T08:05:00Z", carbs: 30 },
      { time: "2026-01-03T09:05:00Z", glucoseMmol: 30 },
    ],
  }], baselinePredictors());

  assert.equal(results.lastValue.mae, 2);
  assert.equal(results.meanSimilarCarb.mae, 0);
  assert.equal(results.medianSimilarCarb.mae, 0);
});

test("personal-cases benchmark uses the same cutoff and requires three prior cases", () => {
  const point = {
    predictionTime: "2026-01-04T12:00:00Z", currentGlucose: 6, carbs: 30,
    entries: [
      { time: "2026-01-01T08:00:00Z", glucoseMmol: 5 }, { time: "2026-01-01T08:05:00Z", carbs: 30 }, { time: "2026-01-01T10:05:00Z", glucoseMmol: 7 },
      { time: "2026-01-02T08:00:00Z", glucoseMmol: 5 }, { time: "2026-01-02T08:05:00Z", carbs: 30 }, { time: "2026-01-02T10:05:00Z", glucoseMmol: 8 },
      { time: "2026-01-03T08:00:00Z", glucoseMmol: 5 }, { time: "2026-01-03T08:05:00Z", carbs: 30 }, { time: "2026-01-03T10:05:00Z", glucoseMmol: 9 },
      { time: "2026-01-05T08:00:00Z", glucoseMmol: 1 }, { time: "2026-01-05T08:05:00Z", carbs: 30 }, { time: "2026-01-05T10:05:00Z", glucoseMmol: 30 },
    ],
  };
  const history = point.entries.filter((entry) => entry.time < point.predictionTime);
  assert.equal(personalCasesPredictor({ ...point, history }), 9);
});

test("benchmark report compares MAE without claiming improvement on missing data", () => {
  const empty = benchmarkReport([]);
  assert.equal(empty.candidate, null);
  assert.deepEqual(empty.comparisons, {});
});

test("walk-forward point builder uses only an actual measurement near the selected horizon", () => {
  const points = buildWalkForwardPoints([
    { time: "2026-01-01T08:00:00Z", glucoseMmol: 6 },
    { time: "2026-01-01T08:05:00Z", carbs: 30 },
    { time: "2026-01-01T10:05:00Z", glucoseMmol: 8 },
    { time: "2026-01-01T14:05:00Z", carbs: 20 },
    { time: "2026-01-01T19:05:00Z", glucoseMmol: 20 },
  ]);
  assert.equal(points.length, 1);
  assert.equal(points[0].actual, 8);
});

test("history benchmark returns an empty non-claiming report when data is insufficient", () => {
  const report = benchmarkHistory([{ time: "2026-01-01T08:00:00Z", glucoseMmol: 6 }]);
  assert.equal(report.candidate, null);
});
