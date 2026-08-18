import assert from "node:assert/strict";
import test from "node:test";

import { financialChartScale, prepareFinancialChart } from "../../src/utils/financialChart.ts";

test("financial chart sanitizes invalid amounts and keeps an expense-only month", () => {
  const chart = prepareFinancialChart([
    { month: "Jan 2026", period: "2026-01", revenue: Number.NaN, expenses: 125 },
    { month: "Feb 2026", period: "2026-02", revenue: -40, expenses: Number.POSITIVE_INFINITY },
  ]);

  assert.deepEqual(chart.points, [
    { key: "2026-01", label: "Jan 2026", revenue: 0, expenses: 125, net: -125 },
    { key: "2026-02", label: "Feb 2026", revenue: 0, expenses: 0, net: 0 },
  ]);
  assert.deepEqual(chart.totals, { revenue: 0, expenses: 125, net: -125 });
  assert.equal(chart.defaultPointKey, "2026-01");
  assert.equal(chart.hasActivity, true);
});

test("financial chart has a stable empty scale and selects the latest period", () => {
  const chart = prepareFinancialChart([
    { month: "Jan", revenue: 0, expenses: 0 },
    { month: "Feb", revenue: 0, expenses: 0 },
  ]);

  assert.equal(chart.scaleMax, 1);
  assert.equal(chart.defaultPointKey, "Feb-1");
  assert.equal(chart.hasActivity, false);
});

test("financial chart scale rounds up to readable steps", () => {
  assert.equal(financialChartScale(0), 1);
  assert.equal(financialChartScale(1_425), 2_000);
  assert.equal(financialChartScale(5_001), 10_000);
});
