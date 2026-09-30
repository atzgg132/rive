import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCT_EVENTS, PRODUCT_EVENT_CONTRACTS, validateProductEvent } from "../../src/lib/analytics/eventContracts.ts";
import { MARKETING_CTA_PLACEMENTS, MARKETING_CTA_PLACEMENT_SET } from "../../src/lib/domain-vocabulary.ts";
import { MEANINGFUL_PRODUCT_EVENTS } from "../../src/utils/funnelDefinitions.ts";

test("marketing_cta_clicked has a v1 contract that needs an identity and a module", () => {
  assert.equal(PRODUCT_EVENTS.marketingCtaClicked, "marketing_cta_clicked");
  assert.equal(PRODUCT_EVENT_CONTRACTS.marketing_cta_clicked.version, 1);
  assert.equal(validateProductEvent({ eventName: "marketing_cta_clicked", module: "marketing", anonymousId: "anon-1" }).ok, true);
  assert.equal(validateProductEvent({ eventName: "marketing_cta_clicked", module: "marketing" }).ok, false);
});

test("CTA placements are a closed vocabulary", () => {
  assert.equal(new Set(MARKETING_CTA_PLACEMENTS).size, MARKETING_CTA_PLACEMENTS.length);
  for (const placement of ["hero", "nav", "pill", "finale", "pricing"]) assert.ok(MARKETING_CTA_PLACEMENT_SET.has(placement));
  assert.equal(MARKETING_CTA_PLACEMENT_SET.has("<script>"), false);
});

test("a marketing click never counts toward activation or active-user metrics", () => {
  assert.equal(MEANINGFUL_PRODUCT_EVENTS.has("marketing_cta_clicked"), false);
});
