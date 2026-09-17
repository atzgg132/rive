import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

// W01 (D1 + MONEY-01/02): the REAL payment route handler against the REAL
// isolated Postgres (auth stubbed; nothing else is). Every test creates its
// own uniquely-labelled invoice, so reruns never collide and nothing is ever
// deleted.

const W01_DATABASE_URL =
  process.env.W01_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://arnav_bhattacharya@127.0.0.1:5434/rive_w01?sslmode=disable";
process.env.DATABASE_URL = W01_DATABASE_URL;
process.env.DATABASE_SSL = process.env.DATABASE_SSL || "disable";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const { prisma } = await import("../../src/utils/db.ts");
const { currencyFractionDigits } = await import("../../src/utils/invoiceMath.ts");

const routeSource = readFileSync(
  new URL("../../src/app/api/workflow/invoices/[id]/payment/route.ts", import.meta.url),
  "utf8",
);
const compiledRoute = ts.transpileModule(routeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const compile = (relativePath) =>
  ts.transpileModule(readFileSync(new URL(relativePath, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

const idempotencyCompiled = compile("../../src/utils/idempotency.ts");

const RUN = Date.now().toString(36);
const OWNER_EMAIL = "w01-pay@test.invalid";
const OTHER_EMAIL = "w01-pay-other@test.invalid";

let pgAvailable = true;
let ownerId = "";
let otherId = "";
const session = { userId: "" };
const productEvents = [];
const clock = { now: new Date().toISOString() };

class FrozenDate extends Date {
  constructor(...args) {
    super(args.length ? args[0] : clock.now);
  }
  static now() {
    return Date.parse(clock.now);
  }
}

function sandboxRequire(name) {
  if (name === "@/utils/db") return { prisma, Prisma: require("@prisma/client").Prisma };
  if (name === "@/utils/userAuth") return { getSessionUser: async () => (session.userId ? { userId: session.userId } : null) };
  if (name === "@/utils/productEvents") {
    return {
      PRODUCT_EVENTS: { paymentRecorded: "payment_recorded" },
      recordProductEvent: async (event) => { productEvents.push(event); },
    };
  }
  if (name === "@/utils/invoiceMath") return { currencyFractionDigits };
  // The real boundary is covered by api-boundary.test.mjs; the sandbox
  // only needs a passthrough for well-formed JSON request bodies.
  if (name === "@/utils/apiBoundary") return { readJsonBody: async (request) => ({ ok: true, body: await request.json() }) };
  // These tests exercise real idempotency semantics (replay, conflict,
  // fencing), so the module itself is transpiled and evaluated here rather
  // than stubbed.
  if (name === "@/utils/idempotency") return loadIdempotency();
  return require(name);
}

let idempotencyExports = null;
function loadIdempotency() {
  if (!idempotencyExports) {
    idempotencyExports = {};
    runInNewContext(idempotencyCompiled, {
      exports: idempotencyExports,
      console,
      Date: FrozenDate,
      setTimeout,
      require: sandboxRequire,
    });
  }
  return idempotencyExports;
}

function loadHandler() {
  const handlerExports = {};
  runInNewContext(compiledRoute, {
    exports: handlerExports,
    console,
    Date: FrozenDate,
    setTimeout,
    require: sandboxRequire,
  });
  return handlerExports;
}

let POST = null;

function utcDay(offsetDays) {
  const base = new Date(clock.now);
  return new Date(base.getTime() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

async function pay(invoiceId, payload, key) {
  const headers = { "Content-Type": "application/json" };
  if (key) headers["Idempotency-Key"] = key;
  return POST(
    new Request(`https://rive.test/api/workflow/invoices/${invoiceId}/payment`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }),
    { params: Promise.resolve({ id: invoiceId }) },
  );
}

let invoiceSeq = 0;
async function makeInvoice({ owner = ownerId, status = "sent", currency = "USD", total = "1000", amountPaid = "0" } = {}) {
  invoiceSeq += 1;
  return prisma.invoice.create({
    data: {
      userId: owner,
      invoiceNumber: `W01P-${RUN}-${invoiceSeq}`,
      status,
      currency,
      total,
      amountPaid,
    },
  });
}

async function counts(invoiceId) {
  const [payments, events] = await Promise.all([
    prisma.invoicePayment.count({ where: { invoiceId } }),
    prisma.invoiceEvent.count({ where: { invoiceId } }),
  ]);
  return { payments, events };
}

function requirePg(t) {
  if (!pgAvailable) t.skip("isolated Postgres unreachable — start the WSL cluster on :5434");
}

before(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    pgAvailable = false;
    return;
  }
  POST = loadHandler().POST;
  for (const email of [OWNER_EMAIL, OTHER_EMAIL]) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (email === OWNER_EMAIL) ownerId = existing.id;
      else otherId = existing.id;
    } else {
      const created = await prisma.user.create({
        data: { email, passwordHash: "scrypt:w01:w01", timeZone: "UTC" },
      });
      if (email === OWNER_EMAIL) ownerId = created.id;
      else otherId = created.id;
    }
  }
  session.userId = ownerId;
});

after(async () => {
  await prisma.$disconnect().catch(() => undefined);
});

test("D1: a retried final payment returns the original receipt, not a rejection", async (t) => {
  requirePg(t);
  session.userId = ownerId;
  await prisma.user.update({ where: { id: ownerId }, data: { timeZone: "UTC" } });
  productEvents.length = 0;
  const invoice = await makeInvoice();
  const payload = { amount: "1000", method: "bank_transfer", reference: "w01-final", notes: "settled" };
  const first = await pay(invoice.id, payload, `w01-final-${RUN}`);
  assert.equal(first.status, 201);
  const original = await first.json();
  assert.equal(original.duplicate, false);
  assert.equal(original.receivedOn, utcDay(0));

  const retry = await pay(invoice.id, payload, `w01-final-${RUN}`);
  assert.equal(retry.status, 200);
  const repeated = await retry.json();
  assert.equal(repeated.paymentId, original.paymentId);
  assert.equal(repeated.duplicate, true);
  assert.equal(repeated.receivedOn, original.receivedOn);
  assert.deepEqual(await counts(invoice.id), { payments: 1, events: 1 });
  assert.equal(productEvents.length, 1);
  const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.equal(stored.status, "paid");
  assert.equal(String(stored.amountPaid), "1000");
});

for (const [field, changed] of [
  ["amount", "101"],
  ["method", "cash"],
  ["reference", "other-reference"],
  ["notes", "other-notes"],
  ["receivedOn", "2000-01-01"],
]) {
  test(`D1: a reused key with a changed ${field} is a 409 conflict with no second payment`, async (t) => {
    requirePg(t);
    session.userId = ownerId;
    await prisma.user.update({ where: { id: ownerId }, data: { timeZone: "UTC" } });
    productEvents.length = 0;
    const invoice = await makeInvoice();
    const key = `w01-conflict-${RUN}-${field}`;
    const firstPayload = { amount: "100", method: "bank_transfer", reference: "ref-1", notes: "first", receivedOn: utcDay(-2) };
    assert.equal((await pay(invoice.id, firstPayload, key)).status, 201);
    const conflict = await pay(invoice.id, { ...firstPayload, [field]: changed }, key);
    assert.equal(conflict.status, 409);
    assert.deepEqual(await conflict.json(), {
      success: false,
      message: "This idempotency key was already used with a different payment.",
    });
    assert.deepEqual(await counts(invoice.id), { payments: 1, events: 1 });
    assert.equal(productEvents.length, 1);
    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(String(stored.amountPaid), "100");
  });
}

test("MONEY-02: an omitted-date retry on a later day keeps the original receipt day", async (t) => {
  requirePg(t);
  session.userId = ownerId;
  await prisma.user.update({ where: { id: ownerId }, data: { timeZone: "America/Los_Angeles" } });
  productEvents.length = 0;
  clock.now = "2026-09-06T06:30:00.000Z"; // Sep 05 23:30 in Los Angeles
  try {
    const invoice = await makeInvoice();
    const key = `w01-omitted-${RUN}`;
    const first = await pay(invoice.id, { amount: "100" }, key);
    assert.equal(first.status, 201);
    const original = await first.json();
    assert.equal(original.receivedOn, "2026-09-05");
    const storedPaidAt = (await prisma.invoicePayment.findFirstOrThrow({ where: { invoiceId: invoice.id } })).paidAt.toISOString();

    clock.now = "2026-09-07T08:00:00.000Z"; // a later day, retry still omits the date
    const retry = await pay(invoice.id, { amount: "100" }, key);
    assert.equal(retry.status, 200);
    const repeated = await retry.json();
    assert.equal(repeated.receivedOn, "2026-09-05");
    assert.deepEqual(await counts(invoice.id), { payments: 1, events: 1 });
    assert.equal(productEvents.length, 1);
    const after = await prisma.invoicePayment.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    assert.equal(after.paidAt.toISOString(), storedPaidAt);
  } finally {
    clock.now = new Date().toISOString();
    await prisma.user.update({ where: { id: ownerId }, data: { timeZone: "UTC" } });
  }
});

test("MONEY-02: Received-on defaults to today in the owner timezone and keeps history", async (t) => {
  requirePg(t);
  session.userId = ownerId;
  await prisma.user.update({ where: { id: ownerId }, data: { timeZone: "Asia/Kolkata" } });
  clock.now = "2026-09-05T04:30:00.000Z"; // Sep 05 10:00 in Kolkata
  try {
    const invoice = await makeInvoice();
    const response = await pay(invoice.id, { amount: "400", receivedOn: "2026-08-31" }, `w01-kolkata-${RUN}`);
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.receivedOn, "2026-08-31");
    const payment = await prisma.invoicePayment.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    // Local midnight Aug 31 in Kolkata, surviving the month boundary.
    assert.equal(payment.paidAt.toISOString(), "2026-08-30T18:30:00.000Z");
    // createdAt stays the real entry moment; paidAt stays the chosen day.
    assert.ok(payment.createdAt.getTime() >= payment.paidAt.getTime());
    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(stored.status, "partially_paid");
    assert.equal(stored.paidDate, null);
  } finally {
    clock.now = new Date().toISOString();
    await prisma.user.update({ where: { id: ownerId }, data: { timeZone: "UTC" } });
  }
});

test("MONEY-02: invalid and future Received-on dates are rejected with no writes", async (t) => {
  requirePg(t);
  session.userId = ownerId;
  await prisma.user.update({ where: { id: ownerId }, data: { timeZone: "UTC" } });
  const bad = await makeInvoice();
  const badResponse = await pay(bad.id, { amount: "100", receivedOn: "2026-02-30" }, `w01-baddate-${RUN}`);
  assert.equal(badResponse.status, 400);
  assert.deepEqual(await counts(bad.id), { payments: 0, events: 0 });

  const future = await makeInvoice();
  const futureResponse = await pay(future.id, { amount: "100", receivedOn: utcDay(1) }, `w01-future-${RUN}`);
  assert.equal(futureResponse.status, 400);
  assert.deepEqual(await futureResponse.json(), { success: false, message: "Received on cannot be in the future." });
  assert.deepEqual(await counts(future.id), { payments: 0, events: 0 });
});

test("MONEY-01: overpayment is refused and zero-decimal currencies round exactly", async (t) => {
  requirePg(t);
  session.userId = ownerId;
  await prisma.user.update({ where: { id: ownerId }, data: { timeZone: "UTC" } });
  const invoice = await makeInvoice();
  const over = await pay(invoice.id, { amount: "1000.01" }, `w01-over-${RUN}`);
  assert.equal(over.status, 400);
  assert.deepEqual(await counts(invoice.id), { payments: 0, events: 0 });

  const jpy = await makeInvoice({ currency: "JPY", total: "1000" });
  const tiny = await pay(jpy.id, { amount: "0.4" }, `w01-tiny-${RUN}`);
  assert.equal(tiny.status, 400);
  const exact = await pay(jpy.id, { amount: "333" }, `w01-jpy-${RUN}`);
  assert.equal(exact.status, 201);
  const stored = await prisma.invoicePayment.findFirstOrThrow({ where: { invoiceId: jpy.id } });
  assert.equal(String(stored.amount), "333");
});

test("MONEY-01: ownership is checked before any key lookup; strangers see 404", async (t) => {
  requirePg(t);
  session.userId = ownerId;
  const invoice = await makeInvoice();
  await pay(invoice.id, { amount: "100", receivedOn: utcDay(-2) }, `w01-owned-${RUN}`);
  session.userId = otherId;
  const probe = await pay(invoice.id, { amount: "100", receivedOn: utcDay(-2) }, `w01-owned-${RUN}`);
  assert.equal(probe.status, 404);
  assert.deepEqual(await counts(invoice.id), { payments: 1, events: 1 });
  session.userId = ownerId;
});

test("MONEY-01: concurrent duplicate POSTs record exactly one payment and one event", async (t) => {
  requirePg(t);
  session.userId = ownerId;
  await prisma.user.update({ where: { id: ownerId }, data: { timeZone: "UTC" } });
  productEvents.length = 0;
  const invoice = await makeInvoice();
  const key = `w01-race-${RUN}`;
  const payload = { amount: "250", method: "manual", receivedOn: utcDay(-1) };
  const responses = await Promise.all(Array.from({ length: 8 }, () => pay(invoice.id, payload, key)));
  const statuses = responses.map((response) => response.status).sort();
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 200, 200, 201]);
  const bodies = await Promise.all(responses.map((response) => response.json()));
  assert.ok(bodies.every((body) => body.success === true));
  const paymentIds = new Set(bodies.map((body) => body.paymentId));
  assert.equal(paymentIds.size, 1);
  assert.ok(bodies.filter((body) => body.duplicate).length === 7);
  assert.deepEqual(await counts(invoice.id), { payments: 1, events: 1 });
  assert.equal(productEvents.length, 1);
});

test("MONEY-01: unauthenticated and unissued-invoice payments stay blocked", async (t) => {
  requirePg(t);
  session.userId = null;
  const invoice = await makeInvoice();
  assert.equal((await pay(invoice.id, { amount: "10" }, `w01-anon-${RUN}`)).status, 401);
  session.userId = ownerId;
  for (const status of ["draft", "voided"]) {
    const closed = await makeInvoice({ status });
    assert.equal((await pay(closed.id, { amount: "10" }, `w01-closed-${RUN}-${status}`)).status, 409);
    assert.deepEqual(await counts(closed.id), { payments: 0, events: 0 });
  }
  assert.deepEqual(await counts(invoice.id), { payments: 0, events: 0 });
});
