import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Structural guards for the Zoho connector safety invariants, no database
// needed — the same pattern as migration-rollback-safety.test.mjs.

const connectorRoutePath = fileURLToPath(new URL("../../src/app/api/connectors/route.ts", import.meta.url));
const connectorRouteSource = readFileSync(connectorRoutePath, "utf8");

const callbackRoutePath = fileURLToPath(new URL("../../src/app/api/connectors/zoho-books/callback/route.ts", import.meta.url));
const callbackRouteSource = readFileSync(callbackRoutePath, "utf8");

const zohoBooksPath = fileURLToPath(new URL("../../src/utils/zohoBooks.ts", import.meta.url));
const zohoBooksSource = readFileSync(zohoBooksPath, "utf8");

test("disconnect revokes the Zoho grant before the local row is removed", () => {
  const revokeCall = connectorRouteSource.indexOf("revokeZohoCredentials(");
  const deleteCall = connectorRouteSource.indexOf("connectorConnection.deleteMany");
  assert.ok(revokeCall !== -1, "disconnect must call revokeZohoCredentials");
  assert.ok(deleteCall !== -1, "disconnect must still remove the local row");
  assert.ok(
    revokeCall < deleteCall,
    "revoke must be attempted before the local delete, so a revoked token cannot outlive the row",
  );
  // The revoke is guarded to Zoho connections only — a calendar disconnect is
  // unaffected.
  assert.match(connectorRouteSource, /provider === "zoho_books"/);
});

test("Zoho connection save never auto-selects an organization", () => {
  // saveZohoConnection stores candidate organizations but no organizationId —
  // the user confirms explicitly via the organization endpoint before sync.
  assert.ok(
    !zohoBooksSource.includes('organizationId: organization.organization_id'),
    "saveZohoConnection must not set organizationId from the default/first org",
  );
  assert.ok(
    zohoBooksSource.includes("settings.organizations") && zohoBooksSource.includes("organizationId is deliberately absent"),
    "the stored settings must list candidate orgs without selecting one",
  );
});

test("the callback flow does not finalize a multi-org account without confirmation", () => {
  // The callback stores the connection and redirects with a signal that org
  // confirmation is still required; sync refuses to run until
  // settings.organizationId is set (enforced in verifyZohoConnection and the
  // sync route).
  assert.ok(
    callbackRouteSource.includes("zohoOrgConfirmation=1"),
    "the callback must signal that organization confirmation is still pending",
  );
});

test("sync refuses to import until an organization has been confirmed", () => {
  const syncRoutePath = fileURLToPath(new URL("../../src/app/api/connectors/zoho-books/sync/route.ts", import.meta.url));
  const syncRouteSource = readFileSync(syncRoutePath, "utf8");
  assert.match(syncRouteSource, /Choose a Zoho Books organization before importing/);
  assert.match(syncRouteSource, /settings\?\.organizationId/);
});

test("Zoho Books source has no delete path", () => {
  // The provider adapter is read-only by construction: it only ever produces
  // IR and fetches pages; nothing in it can delete a database record.
  const adapterPath = fileURLToPath(new URL("../../src/lib/migration/adapters/zoho.ts", import.meta.url));
  const adapterSource = readFileSync(adapterPath, "utf8");
  assert.doesNotMatch(adapterSource, /\.delete(Many)?\(/i, "the Zoho adapter must never delete");
  // And the utility module that persists connections never issues a delete on
  // user data either.
  assert.doesNotMatch(zohoBooksSource, /\.(client|project|invoice|expense)\.delete/i);
});
