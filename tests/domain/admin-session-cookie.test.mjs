import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_PATH,
  LEGACY_ADMIN_SESSION_COOKIE_PATH,
  cookiePathMatches,
} from "../../src/utils/adminSessionCookie.ts";

const adminApiRoot = fileURLToPath(new URL("../../src/app/api/admin", import.meta.url));

// Walk the real route tree instead of hardcoding a list, so an admin endpoint
// added later is covered by this contract without anyone remembering to add it.
function adminApiRequestPaths(directory = adminApiRoot, prefix = "/api/admin") {
  const paths = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const segment = entry.name.replace(/^\[(?:\.\.\.)?(.+)]$/, "sample-$1");
      paths.push(...adminApiRequestPaths(join(directory, entry.name), `${prefix}/${segment}`));
    } else if (entry.name === "route.ts") {
      paths.push(prefix);
    }
  }
  return paths;
}

test("path matching follows the RFC 6265 boundary rule", () => {
  assert.equal(cookiePathMatches("/admin", "/admin"), true);
  assert.equal(cookiePathMatches("/admin", "/admin/users"), true);
  assert.equal(cookiePathMatches("/admin", "/administrator"), false);
  assert.equal(cookiePathMatches("/", "/anything/at/all"), true);
});

test("the admin session cookie reaches every admin API route", () => {
  const routes = adminApiRequestPaths();
  assert.ok(routes.length >= 5, `expected to discover the admin API surface, found ${routes.length}`);
  assert.ok(routes.includes("/api/admin/session"), "the session check must be part of the discovered surface");

  for (const route of routes) {
    assert.equal(
      cookiePathMatches(ADMIN_SESSION_COOKIE_PATH, route),
      true,
      `${ADMIN_SESSION_COOKIE} scoped to "${ADMIN_SESSION_COOKIE_PATH}" must be sent to ${route}`,
    );
  }
});

test("the admin session cookie still reaches the admin page", () => {
  assert.equal(cookiePathMatches(ADMIN_SESSION_COOKIE_PATH, "/admin"), true);
});

test("the retired /admin cookie scope is the login loop, captured", () => {
  // Scoping the session to "/admin" let the browser store it and then withhold it
  // from the endpoints that validate it: the session check answered 401, the page
  // fell back to the login form, and a correct password looked like a rejection.
  assert.equal(cookiePathMatches(LEGACY_ADMIN_SESSION_COOKIE_PATH, "/admin"), true);
  assert.equal(cookiePathMatches(LEGACY_ADMIN_SESSION_COOKIE_PATH, "/api/admin/session"), false);
  assert.equal(cookiePathMatches(LEGACY_ADMIN_SESSION_COOKIE_PATH, "/api/admin/analytics"), false);
  assert.notEqual(ADMIN_SESSION_COOKIE_PATH, LEGACY_ADMIN_SESSION_COOKIE_PATH);
});
