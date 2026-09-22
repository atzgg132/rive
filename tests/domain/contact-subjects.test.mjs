import assert from "node:assert/strict";
import test from "node:test";

import { CONTACT_SUBJECTS } from "../../src/content/marketing/resources.ts";

test("CONTACT_SUBJECTS includes Product question and excludes General Inquiry", () => {
  assert.ok(CONTACT_SUBJECTS.includes("Product question"));
  assert.ok(!CONTACT_SUBJECTS.includes("General Inquiry"));
});
