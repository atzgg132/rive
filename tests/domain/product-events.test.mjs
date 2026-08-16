import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCT_EVENT_CONTRACTS,
  PRODUCT_EVENT_NAMES,
  PRODUCT_EVENTS,
  PRODUCT_EVENT_SCHEMA_VERSION,
  validateProductEvent,
} from "../../src/lib/analytics/eventContracts.ts";
import { recordProductEvent, sanitizeEventProperties } from "../../src/utils/productEvents.ts";

test("every first-party product event has a versioned contract", () => {
  for (const eventName of Object.values(PRODUCT_EVENTS)) {
    assert.ok(PRODUCT_EVENT_CONTRACTS[eventName], `missing contract for ${eventName}`);
    assert.equal(PRODUCT_EVENT_CONTRACTS[eventName].version, 1);
    assert.ok(PRODUCT_EVENT_NAMES.has(eventName));
  }
  assert.equal(PRODUCT_EVENT_SCHEMA_VERSION, 1);
});

test("event validation protects identity, entities, and real-data origin", () => {
  assert.equal(validateProductEvent({ eventName: PRODUCT_EVENTS.workspaceViewed, module: "workspace", userId: "user-1" }).ok, true);
  assert.equal(validateProductEvent({ eventName: PRODUCT_EVENTS.workspaceViewed, module: "workspace" }).ok, false);
  assert.equal(validateProductEvent({ eventName: PRODUCT_EVENTS.invoiceCreated, module: "invoices", userId: "user-1", entityType: "invoice", entityId: "invoice-1" }).ok, false);
  assert.equal(validateProductEvent({ eventName: PRODUCT_EVENTS.invoiceCreated, module: "invoices", userId: "user-1", entityType: "invoice", entityId: "invoice-1", dataOrigin: "user" }).ok, true);
  assert.equal(validateProductEvent({ eventName: "not_a_contract", module: "unknown", userId: "user-1" }).ok, false);
  assert.equal(validateProductEvent({ eventName: "activation.not_registered", module: "activation", userId: "user-1" }).ok, false);
  assert.equal(validateProductEvent({ eventName: PRODUCT_EVENTS.workspaceViewed, module: "workspace", userId: "user-1", schemaVersion: 2 }).ok, false);
});

test("recordProductEvent stores the envelope version and records rejected contracts", async () => {
  const events = [];
  const issues = [];
  const client = {
    productEvent: { create: async ({ data }) => events.push(data) },
    productEventIssue: { create: async ({ data }) => issues.push(data) },
  };

  const accepted = await recordProductEvent({
    userId: "user-1",
    eventName: PRODUCT_EVENTS.projectCreated,
    module: "projects",
    entityType: "project",
    entityId: "project-1",
    dataOrigin: "user",
    properties: { safe: "value", email: "private@example.com", nested: { token: "secret" } },
  }, client);

  assert.deepEqual(accepted, { accepted: true });
  assert.equal(events[0].eventVersion, 1);
  assert.equal(events[0].schemaVersion, 1);
  assert.deepEqual(events[0].properties, { safe: "value", nested: {} });

  const rejected = await recordProductEvent({ userId: "user-1", eventName: PRODUCT_EVENTS.projectCreated, module: "projects" }, client);
  assert.deepEqual(rejected, { accepted: false, reason: "invalid_contract" });
  assert.equal(events.length, 1);
  assert.match(issues[0].reason, /missing_entity/);
});

test("event property sanitization removes sensitive keys and bounds depth", () => {
  assert.deepEqual(sanitizeEventProperties({ password: "no", ok: true, deep: { one: { two: { three: "dropped" } } } }), { ok: true, deep: { one: {} } });
});
