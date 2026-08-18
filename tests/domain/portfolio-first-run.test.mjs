import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_PORTFOLIO_CONTENT, isPortfolioUnstarted, mergePortfolioContent } from "../../src/utils/portfolio.ts";

/**
 * The first-run path appears only for someone who has not begun, and must get
 * out of the way the moment they have. A provisioned portfolio already contains
 * one blank project and one blank service, so counting arrays would say "started"
 * before anyone had typed anything.
 */

test("a freshly provisioned portfolio counts as unstarted", () => {
  assert.equal(isPortfolioUnstarted(DEFAULT_PORTFOLIO_CONTENT), true);
  assert.equal(DEFAULT_PORTFOLIO_CONTENT.projects.length, 1, "the blank starter project is why this cannot count arrays");
});

test("a name alone is enough to count as begun", () => {
  assert.equal(isPortfolioUnstarted({ ...DEFAULT_PORTFOLIO_CONTENT, name: "Arnav" }), false);
});

test("any of headline, bio, a project title or a service counts as begun", () => {
  const started = [
    { headline: "I design products" },
    { bio: "I help small teams ship." },
    { projects: [{ ...DEFAULT_PORTFOLIO_CONTENT.projects[0], title: "Harbour rebuild" }] },
    { projects: [{ ...DEFAULT_PORTFOLIO_CONTENT.projects[0], description: "A rebuild." }] },
    { services: [{ id: "s1", title: "Product design", description: "" }] },
  ];
  for (const overrides of started) {
    assert.equal(isPortfolioUnstarted({ ...DEFAULT_PORTFOLIO_CONTENT, ...overrides }), false, JSON.stringify(overrides));
  }
});

test("whitespace is not a start", () => {
  assert.equal(isPortfolioUnstarted({ ...DEFAULT_PORTFOLIO_CONTENT, name: "   ", headline: "\t" }), true);
});

test("it agrees with itself after a merge round-trip", () => {
  assert.equal(isPortfolioUnstarted(mergePortfolioContent({})), true);
  assert.equal(isPortfolioUnstarted(mergePortfolioContent({ name: "Arnav" })), false);
});
