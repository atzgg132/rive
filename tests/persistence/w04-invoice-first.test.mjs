/**
 * D7 (START-01/START-03): a verified new user reviews a valid first
 * invoice with a client and NO project, agreement, or milestone — and is
 * not gated behind business-profile questions. Issuing (send) is covered
 * against a live dev server in w04-invoice-send.test.mjs because the send
 * route's PDF renderer (.tsx) cannot load under plain node.
 *
 * Exercises the REAL invoice routes against the REAL isolated Postgres
 * database. The fixture owner has a NULL name/profession, so creation and
 * review prove no profile completeness is required.
 *
 * Run: see tests/persistence/w04-invoice-idempotency.test.mjs header.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { POST as createInvoice, GET as listInvoices } from "../../src/app/api/workflow/invoices/route.ts";
import { prisma } from "../../src/utils/db.ts";
import { generateUserToken } from "../../src/utils/userAuth.ts";

const DATABASE_URL = process.env.DATABASE_URL || "";
assert.match(DATABASE_URL, /rive_w04/, "persistence tests must target the isolated rive_w04 database");

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function authedRequest(token, url, method, body) {
  return new NextRequest(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      cookie: `rive_session=${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("a verified profile-less user issues a first invoice with a client only", async () => {
  const tag = `${stamp}-first`;
  const user = await prisma.user.create({
    data: {
      email: `w04-first-${tag}@example.invalid`,
      passwordHash: "scrypt:w04-test-fixture",
      name: null,
      profession: null,
      currency: "USD",
    },
  });
  assert.equal(user.emailVerifiedAt, null);
  assert.equal(user.emailVerificationRequiredAt, null);
  const client = await prisma.client.create({
    data: {
      userId: user.id,
      name: `W04 First Acme ${tag}`,
      email: `w04-first-billing-${tag}@example.invalid`,
      tags: [],
    },
  });
  const token = generateUserToken(user.id, user.email, user.plan, user.sessionVersion);


  // Create: client only — no project_id, no agreement, no milestone.
  const created = await createInvoice(
    authedRequest(token, "http://localhost/api/workflow/invoices", "POST", {
      client_id: client.id,
      currency: "USD",
      items: [{ description: "W04 first invoice", quantity: "1", unit_price: "250.00" }],
    }),
  );
  assert.equal(created.status, 201);
  const createdData = await created.json();
  assert.equal(createdData?.success, true);
  const invoiceId = createdData?.invoice?.id;
  assert.ok(invoiceId);
  assert.equal(createdData?.invoice?.projectId, null);

  // Review: the draft carries the client, real line items, and valid totals.
  const reviewed = await listInvoices(
    authedRequest(token, `http://localhost/api/workflow/invoices?id=${encodeURIComponent(invoiceId)}`, "GET"),
  );
  assert.equal(reviewed.status, 200);
  const reviewedData = await reviewed.json();
  const draft = reviewedData?.invoices?.[0];
  assert.ok(draft);
  assert.equal(draft.project_id, null);
  assert.equal(draft.project_title, null);
  assert.equal(draft.status, "draft");
  assert.equal(Number(draft.total), 250);
  assert.equal(draft.items?.length, 1);

  // The draft is sendable: still a draft, linked client carries an email,
  // and no project, agreement, or milestone is attached.
  const stored = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: { select: { email: true } } },
  });
  assert.equal(stored?.status, "draft");
  assert.equal(stored?.projectId, null);
  assert.ok(stored?.client?.email);
});
