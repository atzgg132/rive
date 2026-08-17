import assert from "node:assert/strict";
import test from "node:test";

import { normalizePortfolioReferrer } from "../../src/utils/portfolioAnalytics.ts";

test("normalizes external referrers to their origin", () => {
  assert.equal(
    normalizePortfolioReferrer("https://www.google.com/search?q=portfolio#results"),
    "https://www.google.com",
  );
  assert.equal(normalizePortfolioReferrer("http://example.com:8080/article"), "http://example.com:8080");
});

test("removes first-party and local referrers", () => {
  for (const referrer of [
    "https://rive.work/",
    "https://www.rive.work/p/atzgg132",
    "https://dev.rive.work/p/atzgg132/product-design",
    "http://localhost:3000/portfolio",
    "http://127.0.0.1:3000/portfolio",
  ]) {
    assert.equal(normalizePortfolioReferrer(referrer), null, referrer);
  }
});

test("treats missing, invalid, and non-web referrers as direct", () => {
  assert.equal(normalizePortfolioReferrer(null), null);
  assert.equal(normalizePortfolioReferrer(""), null);
  assert.equal(normalizePortfolioReferrer("not a URL"), null);
  assert.equal(normalizePortfolioReferrer("mailto:hello@example.com"), null);
});
