import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PORTFOLIO_CONTENT,
  MAX_TAGLINE_LENGTH,
  PORTFOLIO_TEMPLATES,
  mergePortfolioContent,
  templateEyebrow,
  validatePortfolioContent,
} from "../../src/utils/portfolio.ts";

/**
 * The line above the headline.
 *
 * It used to be template-only and unreachable: a `visual-studio` portfolio said
 * "SELECTED VISUAL PRACTICE" on its public page with no way to change it. That
 * collided with Practices, which in this product means a distinct discipline
 * someone runs, so owners read it as a Practices setting leaking onto their
 * site. These cover the parts of making it editable that are easy to regress.
 */

test("no template default calls itself a practice", () => {
  for (const template of PORTFOLIO_TEMPLATES) {
    assert.ok(template.eyebrow.trim(), `${template.key} needs a default tagline`);
    assert.doesNotMatch(
      template.eyebrow,
      /practice/i,
      `${template.key} reuses "practice", which already means a discipline here`,
    );
  }
});

test("an unknown template still resolves to a real tagline", () => {
  // Never blank: an empty hero eyebrow renders as a gap above the headline.
  assert.equal(templateEyebrow("visual-studio"), "Selected visual work");
  assert.equal(templateEyebrow("does-not-exist"), PORTFOLIO_TEMPLATES[0].eyebrow);
  assert.equal(templateEyebrow(""), PORTFOLIO_TEMPLATES[0].eyebrow);
});

test("a portfolio saved before taglines existed still merges", () => {
  const legacy = { ...DEFAULT_PORTFOLIO_CONTENT };
  delete legacy.tagline;

  const merged = mergePortfolioContent(legacy);
  assert.equal(merged.tagline, "", "a missing tagline must fall back to the template, not to undefined");
});

test("merging is idempotent for the tagline", () => {
  const once = mergePortfolioContent({ ...DEFAULT_PORTFOLIO_CONTENT, tagline: "Bakery and record label" });
  const twice = mergePortfolioContent(once);
  assert.equal(twice.tagline, "Bakery and record label");
  assert.deepEqual(twice, once);
});

test("a non-string tagline becomes a blank one rather than rendering as an object", () => {
  assert.equal(mergePortfolioContent({ tagline: 42 }).tagline, "");
  assert.equal(mergePortfolioContent({ tagline: null }).tagline, "");
  assert.equal(mergePortfolioContent({ tagline: { name: "x" } }).tagline, "");
});

test("the tagline is capped, because the constraint is the hero layout", () => {
  assert.equal(validatePortfolioContent({ tagline: "x".repeat(MAX_TAGLINE_LENGTH) }), null);
  assert.match(
    validatePortfolioContent({ tagline: "x".repeat(MAX_TAGLINE_LENGTH + 1) }) || "",
    /tagline/i,
  );
  assert.match(validatePortfolioContent({ tagline: 12 }) || "", /tagline/i);
  // Absent is not invalid — every portfolio created before this field existed.
  assert.equal(validatePortfolioContent({}), null);
});
