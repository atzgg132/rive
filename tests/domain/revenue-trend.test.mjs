import assert from "node:assert/strict";
import test from "node:test";

import { buildMonthlyTrend, monthLabel } from "../../src/utils/revenueTrend.ts";

/**
 * The chart this replaces drew each bar from `collected / invoiced` under a
 * label that read "invoiced", clamped every width to a minimum of 8% so six
 * very different months rendered as six identical stubs, kept one row per
 * currency per month so July could appear twice, and printed a converted
 * display-currency amount beside the original currency code — "INR — $12.55".
 */

const usd = (value) => value;
const noRates = () => null;

test("a month is one row, however many currencies it was invoiced in", () => {
  const { points } = buildMonthlyTrend(
    [
      { month: "2026-07", currency: "INR", invoiced: 100, collected: 50 },
      { month: "2026-07", currency: "USD", invoiced: 300, collected: 0 },
    ],
    usd,
  );

  assert.equal(points.length, 1, "one month must not produce two rows");
  assert.equal(points[0].invoiced, 400);
  assert.equal(points[0].collected, 50);
  assert.deepEqual(points[0].currencies, ["INR", "USD"]);
});

test("bar length compares months, rather than restating the collection rate", () => {
  const { points } = buildMonthlyTrend(
    [
      { month: "2026-01", currency: "USD", invoiced: 100, collected: 100 },
      { month: "2026-02", currency: "USD", invoiced: 1_000, collected: 0 },
    ],
    usd,
  );

  const [january, february] = points;
  // Fully collected but small: a tenth of the bar, not a full one.
  assert.equal(february.share, 1);
  assert.equal(january.share, 0.1);
  assert.equal(january.collectionRate, 100);
  assert.equal(february.collectionRate, 0);
});

test("months are ordered oldest first and the window keeps the most recent", () => {
  const rows = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05"].map((month) => ({
    month,
    currency: "USD",
    invoiced: 10,
    collected: 1,
  }));

  const { points } = buildMonthlyTrend(rows, usd, 6);
  assert.equal(points.length, 6);
  assert.equal(points[0].month, "2025-12", "the oldest month must be the one dropped");
  assert.equal(points[5].month, "2026-05");
});

test("a month is dropped whole when any of its currencies has no rate yet", () => {
  const convertOnlyUsd = (value, currency) => (currency === "USD" ? value : null);
  const { points, complete } = buildMonthlyTrend(
    [
      { month: "2026-06", currency: "USD", invoiced: 500, collected: 100 },
      { month: "2026-07", currency: "USD", invoiced: 300, collected: 0 },
      { month: "2026-07", currency: "INR", invoiced: 900, collected: 0 },
    ],
    convertOnlyUsd,
  );

  // Half a month drawn as a whole one is worse than saying so.
  assert.equal(complete, false);
  assert.deepEqual(points.map((point) => point.month), ["2026-06"]);
});

test("no rates at all yields nothing to draw rather than a wrong total", () => {
  const { points, complete } = buildMonthlyTrend(
    [{ month: "2026-07", currency: "INR", invoiced: 900, collected: 10 }],
    noRates,
  );
  assert.deepEqual(points, []);
  assert.equal(complete, false);
});

test("a month with no invoiced value reports no rate instead of dividing by zero", () => {
  const { points } = buildMonthlyTrend([{ month: "2026-07", currency: "USD", invoiced: 0, collected: 0 }], usd);
  assert.equal(points[0].collectionRate, null);
  assert.equal(points[0].share, 0);
});

test("month labels are readable and do not depend on the machine's locale", () => {
  assert.equal(monthLabel("2026-03"), "Mar 2026");
  assert.equal(monthLabel("2026-12"), "Dec 2026");
  // Anything unexpected is shown as-is rather than as "Invalid Date".
  assert.equal(monthLabel("2026-13"), "2026-13");
  assert.equal(monthLabel("nonsense"), "nonsense");
});
