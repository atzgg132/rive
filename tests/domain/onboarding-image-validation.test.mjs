import assert from "node:assert/strict";
import test from "node:test";

import { isValidOnboardingAvatarUrl } from "../../src/utils/portfolio.ts";

function pngDataUrl(byteLength) {
  return `data:image/png;base64,${Buffer.alloc(byteLength).toString("base64")}`;
}

test("accepts the managed asset URL returned by the production upload path", () => {
  assert.equal(
    isValidOnboardingAvatarUrl(
      "/api/public/assets/portfolio/123e4567-e89b-12d3-a456-426614174000/123e4567-e89b-12d3-a456-426614174001.png",
    ),
    true,
  );
});

test("accepts an inline PNG at the 1.8 MiB boundary", () => {
  assert.equal(isValidOnboardingAvatarUrl(pngDataUrl(Math.floor(1.8 * 1024 * 1024))), true);
});

test("rejects an inline PNG above the 1.8 MiB boundary", () => {
  assert.equal(isValidOnboardingAvatarUrl(pngDataUrl(Math.floor(1.8 * 1024 * 1024) + 1)), false);
});

test("rejects arbitrary relative asset paths", () => {
  assert.equal(isValidOnboardingAvatarUrl("/uploads/profile.png"), false);
});
