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

test("a break-even month reports positive zero, never negative zero", () => {
  // Intl.NumberFormat renders -0 with its sign, which printed "-$0.00" for a
  // month that simply had no activity.
  const chart = prepareFinancialChart([
    { month: "Aug 2026", period: "2026-08", revenue: 0, expenses: 0 },
    { month: "Sep 2026", period: "2026-09", revenue: 250, expenses: 250 },
  ]);

  for (const point of chart.points) {
    assert.equal(point.net, 0);
    assert.ok(Object.is(point.net, 0), `${point.label} produced negative zero`);
    assert.ok(!Object.is(point.net, -0), `${point.label} produced negative zero`);
  }
  assert.ok(Object.is(chart.totals.net, 0), "totals produced negative zero");
});

test("net keeps its sign when the month is not break-even", () => {
  const chart = prepareFinancialChart([
    { month: "Oct 2026", period: "2026-10", revenue: 100, expenses: 400 },
    { month: "Nov 2026", period: "2026-11", revenue: 900, expenses: 400 },
  ]);

  assert.equal(chart.points[0].net, -300);
  assert.equal(chart.points[1].net, 500);
  assert.equal(chart.totals.net, 200);
});

test("net extent gives each direction its own readable ceiling", () => {
  const chart = prepareFinancialChart([
    { month: "Oct 2026", period: "2026-10", revenue: 100, expenses: 400 }, // net -300
    { month: "Nov 2026", period: "2026-11", revenue: 900, expenses: 400 }, // net +500
  ]);

  // Both directions round up to the same nice ceiling: the baseline sits mid-track.
  assert.deepEqual(chart.netExtent, { up: 500, down: 500 });
  assert.equal(chart.baselineShare, 0.5);
});

test("an all-positive window keeps the baseline on the bottom edge", () => {
  const chart = prepareFinancialChart([
    { month: "Oct 2026", period: "2026-10", revenue: 400, expenses: 100 },
    { month: "Nov 2026", period: "2026-11", revenue: 900, expenses: 400 },
  ]);

  assert.equal(chart.netExtent.down, 0);
  assert.equal(chart.baselineShare, 1);
});

test("an all-negative window parks the baseline on the top edge", () => {
  const chart = prepareFinancialChart([
    { month: "Oct 2026", period: "2026-10", revenue: 100, expenses: 400 },
    { month: "Nov 2026", period: "2026-11", revenue: 100, expenses: 900 },
  ]);

  assert.equal(chart.netExtent.up, 0);
  assert.equal(chart.baselineShare, 0);
});

test("an empty window still has a stable extent and baseline", () => {
  const chart = prepareFinancialChart([
    { month: "Jan", revenue: 0, expenses: 0 },
    { month: "Feb", revenue: 0, expenses: 0 },
  ]);

  assert.deepEqual(chart.netExtent, { up: 0, down: 0 });
  assert.equal(chart.baselineShare, 1);
});
