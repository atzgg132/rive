import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PORTFOLIO_THEME,
  normalizeHexColor,
  validatePortfolioTheme,
} from "../../src/utils/portfolio.ts";

test("hex accents normalize to #RRGGBB and reject anything else", () => {
  assert.equal(normalizeHexColor("#db2777"), "#DB2777");
  assert.equal(normalizeHexColor("2563eb"), "#2563EB");
  assert.equal(normalizeHexColor("  #0891B2  "), "#0891B2");
  assert.equal(normalizeHexColor("not-a-colour"), DEFAULT_PORTFOLIO_THEME.accent);
  assert.equal(normalizeHexColor("#fff"), DEFAULT_PORTFOLIO_THEME.accent);
  assert.equal(normalizeHexColor("#DB2777", "#111111"), "#DB2777");
});

test("theme validation accepts a real accent and refuses a broken one", () => {
  assert.equal(validatePortfolioTheme(undefined), null);
  assert.equal(validatePortfolioTheme({ accent: "#DB2777", mode: "dark", radius: "sharp" }), null);
  assert.equal(validatePortfolioTheme({ accent: "blue" }), "Accent colour must be a hex value.");
  assert.equal(validatePortfolioTheme({ mode: "neon" }), "Theme mode is invalid.");
  assert.equal(validatePortfolioTheme({ radius: "chunky" }), "Theme corners are invalid.");
  assert.equal(validatePortfolioTheme("blue"), "Theme must be an object.");
});
