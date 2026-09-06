/**
 * D2 (START-05): owner-scoped durable Idempotency-Key replay on invoice creation.
 *
 * Exercises the REAL route (`src/app/api/workflow/invoices/route.ts`) against
 * the REAL isolated Postgres database — no network mocks. Fixtures are
 * uniquely labelled synthetics; nothing is deleted or reset.
 *
 * Run:
 *   DATABASE_URL=postgresql://arnav_bhattacharya@127.0.0.1:5434/rive_w04?sslmode=disable `
 *   DATABASE_SSL=disable EMAIL_PROVIDER=console SESSION_SECRET=w04-test-secret `
 *   node --experimental-strip-types --import ./tests/helpers/real-db-loader.mjs `
 *        --test tests/persistence/w04-invoice-idempotency.test.mjs
 */
import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { POST as createInvoice } from "../../src/app/api/workflow/invoices/route.ts";
import { prisma } from "../../src/utils/db.ts";
import { generateUserToken } from "../../src/utils/userAuth.ts";

const DATABASE_URL = process.env.DATABASE_URL || "";
assert.match(DATABASE_URL, /rive_w04/, "persistence tests must target the isolated rive_w04 database");

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
let ownerSeq = 0;

async function createOwner() {
  ownerSeq += 1;
  const tag = `${stamp}-o${ownerSeq}`;
  const user = await prisma.user.create({
    data: {
      email: `w04-idem-${tag}@example.invalid`,
      passwordHash: "scrypt:w04-test-fixture",
      name: null,
      profession: null,
      currency: "USD",
    },
  });
  const client = await prisma.client.create({
    data: {
      userId: user.id,
      name: `W04 Idem Acme ${tag}`,
      email: `w04-idem-billing-${tag}@example.invalid`,
      tags: [],
    },
  });
  const token = generateUserToken(user.id, user.email, user.plan, user.sessionVersion);
  return { user, client, token };
}

function invoiceRequest(token, body, key) {
  return new NextRequest("http://localhost/api/workflow/invoices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: `rive_session=${token}`,
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify(body),
  });
}

function invoiceBody(client, overrides = {}) {
  return {
    client_id: client.id,
    currency: "USD",
    items: [{ description: "W04 first value", quantity: "1", unit_price: "250.00" }],
    ...overrides,
  };
}

async function postInvoice(owner, body, key) {
  const response = await createInvoice(invoiceRequest(owner.token, body, key));
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

async function invoiceCount(userId) {
  return prisma.invoice.count({ where: { userId } });
}

function guardKey(userId, key) {
  return `invoice-create:${userId}:${key}`;
}

test("a repeated Idempotency-Key returns the original invoice and number", async () => {
  const owner = await createOwner();
  const key = `w04-key-replay-${stamp}`;
  const body = invoiceBody(owner.client);

  const first = await postInvoice(owner, body, key);
  assert.equal(first.status, 201);
  assert.equal(first.data?.success, true);
  const originalId = first.data?.invoice?.id;
  const originalNumber = first.data?.invoice?.invoiceNumber;
  assert.ok(originalId);
  assert.ok(originalNumber);

  // Same bytes, same key — not even an issue_date is sent, so the retry must
  // match despite the server stamping a different default time per attempt.
  const replay = await postInvoice(owner, body, key);
  assert.equal(replay.status, 200);
  assert.equal(replay.data?.success, true);
  assert.equal(replay.data?.replayed, true);
  assert.equal(replay.data?.invoice?.id, originalId);
  assert.equal(replay.data?.invoice?.invoiceNumber, originalNumber);

  assert.equal(await invoiceCount(owner.user.id), 1);
  assert.equal(await prisma.productEvent.count({ where: { dedupeKey: guardKey(owner.user.id, key) } }), 1);
});

test("a conflicting payload under the same key is rejected, never silently accepted", async () => {
  const owner = await createOwner();
  const key = `w04-key-conflict-${stamp}`;
  const first = await postInvoice(owner, invoiceBody(owner.client), key);
  assert.equal(first.status, 201);

  const conflict = await postInvoice(
    owner,
    invoiceBody(owner.client, { items: [{ description: "W04 first value", quantity: "1", unit_price: "999.00" }] }),
    key,
  );
  assert.equal(conflict.status, 409);
  assert.equal(conflict.data?.success, false);
  assert.equal(await invoiceCount(owner.user.id), 1);
});

test("requests without a key, or with a fresh key, create independent invoices", async () => {
  const owner = await createOwner();
  const first = await postInvoice(owner, invoiceBody(owner.client), null);
  const second = await postInvoice(owner, invoiceBody(owner.client), null);
  const third = await postInvoice(owner, invoiceBody(owner.client), `w04-key-fresh-${stamp}`);
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(third.status, 201);
  const ids = new Set([first.data?.invoice?.id, second.data?.invoice?.id, third.data?.invoice?.id]);
  assert.equal(ids.size, 3);
  assert.equal(await invoiceCount(owner.user.id), 3);
});

test("idempotency keys are scoped per owner", async () => {
  const first = await createOwner();
  const second = await createOwner();
  const key = `w04-key-shared-${stamp}`;
  const one = await postInvoice(first, invoiceBody(first.client), key);
  const two = await postInvoice(second, invoiceBody(second.client), key);
  assert.equal(one.status, 201);
  assert.equal(two.status, 201);
  assert.notEqual(one.data?.invoice?.id, two.data?.invoice?.id);
  assert.equal(await invoiceCount(first.user.id), 1);
  assert.equal(await invoiceCount(second.user.id), 1);
});

test("concurrent duplicate POSTs create exactly one invoice", async () => {
  const owner = await createOwner();
  const key = `w04-key-race-${stamp}`;
  const body = invoiceBody(owner.client);
  const [left, right] = await Promise.all([postInvoice(owner, body, key), postInvoice(owner, body, key)]);
  assert.deepEqual([left.status, right.status].sort(), [200, 201]);
  const replayed = [left, right].find((result) => result.status === 200);
  const created = [left, right].find((result) => result.status === 201);
  assert.equal(replayed?.data?.replayed, true);
  assert.equal(replayed?.data?.invoice?.id, created?.data?.invoice?.id);
  assert.equal(await invoiceCount(owner.user.id), 1);
});
