/**
 * D7 (START-01): issuing — the client-only first draft sends successfully
 * with no project, agreement, milestone, or business profile.
 *
 * Runs against a LIVE dev server because the send route's PDF renderer
 * (.tsx) cannot load under plain node. The server uses the same isolated
 * Postgres database (rive_w04) and a console mail sink.
 *
 * Server (run first, from the repo root):
 *   $env:DATABASE_URL="postgresql://arnav_bhattacharya@127.0.0.1:5434/rive_w04?sslmode=disable"
 *   $env:DATABASE_SSL="disable"; $env:EMAIL_PROVIDER="console"; $env:SESSION_SECRET="w04-test-secret"
 *   npm run dev -- --hostname 127.0.0.1 --port 3101
 *
 * Then:
 *   $env:W04_BASE_URL="http://127.0.0.1:3101"   # (default when unset)
 *   node --experimental-strip-types --import ./tests/helpers/real-db-loader.mjs `
 *        --test tests/persistence/w04-invoice-send.test.mjs
 */
import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "../../src/utils/db.ts";
import { generateUserToken } from "../../src/utils/userAuth.ts";

const DATABASE_URL = process.env.DATABASE_URL || "";
assert.match(DATABASE_URL, /rive_w04/, "persistence tests must target the isolated rive_w04 database");

const BASE_URL = process.env.W04_BASE_URL || "http://127.0.0.1:3101";
const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

async function api(token, path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: `rive_session=${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

test("server is reachable before issuing", async () => {
  const response = await fetch(`${BASE_URL}/api/auth/session`, { cache: "no-store" }).catch(() => null);
  assert.ok(response, `dev server is not reachable at ${BASE_URL}; start it first (see file header)`);
});

test("a client-only first draft issues with no project or business profile", async () => {
  const tag = `${stamp}-send`;
  const user = await prisma.user.create({
    data: {
      email: `w04-send-${tag}@example.invalid`,
      passwordHash: "scrypt:w04-test-fixture",
      name: null,
      profession: null,
      currency: "USD",
    },
  });
  const client = await prisma.client.create({
    data: {
      userId: user.id,
      name: `W04 Send Acme ${tag}`,
      email: `w04-send-billing-${tag}@example.invalid`,
      tags: [],
    },
  });
  const token = generateUserToken(user.id, user.email, user.plan, user.sessionVersion);
  const auditBefore = await prisma.auditEvent.count({ where: { userId: user.id } });

  const created = await api(token, "/api/workflow/invoices", {
    client_id: client.id,
    currency: "USD",
    items: [{ description: "W04 first invoice", quantity: "1", unit_price: "250.00" }],
  });
  assert.equal(created.status, 201);
  const invoiceId = created.data?.invoice?.id;
  assert.ok(invoiceId);

  const sent = await api(token, `/api/workflow/invoices/${invoiceId}/send`, { confirm: true });
  assert.equal(sent.status, 200);
  assert.equal(sent.data?.success, true);

  const stored = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  assert.equal(stored?.status, "sent");
  assert.equal(stored?.projectId, null);
  assert.ok(stored?.sentAt instanceof Date);
  assert.ok(stored?.sentSnapshot);

  // First-value timing is recorded as an activation event.
  const auditAfter = await prisma.auditEvent.count({ where: { userId: user.id } });
  assert.ok(auditAfter > auditBefore);
});
