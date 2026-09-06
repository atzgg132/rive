import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

// W01 (D3 + MONEY-03, D4 + MONEY-05): the REAL dashboard and revenue-summary
// handlers against the REAL isolated Postgres (auth stubbed; the exchange-rate
// fetch stubbed to null so conversion is same-currency identity). Fixtures use
// unique labels per run and are never deleted.

const W01_DATABASE_URL =
  process.env.W01_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://arnav_bhattacharya@127.0.0.1:5434/rive_w01?sslmode=disable";
process.env.DATABASE_URL = W01_DATABASE_URL;
process.env.DATABASE_SSL = process.env.DATABASE_SSL || "disable";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const { prisma } = await import("../../src/utils/db.ts");
const { mergePortfolioContent } = await import("../../src/utils/portfolio.ts");
const { normalizeCurrency } = await import("../../src/lib/currency.ts");
const exchangeRates = await import("../../src/utils/exchangeRates.ts");
const { buildActivationPlan } = await import("../../src/lib/activation-plan.ts");
const { normalizeActivationGoal } = await import("../../src/lib/activation.ts");
const { normalizeGuideProgress } = await import("../../src/lib/guides.ts");
const invoiceTotals = await import("../../src/utils/invoiceTotals.ts");
const revenueTrend = await import("../../src/utils/revenueTrend.ts");
const invoiceLifecycle = await import("../../src/utils/invoiceLifecycle.ts");

function compileRoute(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const dashboardCompiled = compileRoute("../../src/app/api/workflow/dashboard/route.ts");
const summaryCompiled = compileRoute("../../src/app/api/workflow/revenue/summary/route.ts");

const RUN = Date.now().toString(36);
const OWNER_EMAIL = `w01-rev-${RUN}@test.invalid`;
const TIME_ZONE = "Asia/Kolkata";
const BULK_COUNT = 20_005; // exceeds the old 20,000-row ceiling

let pgAvailable = true;
let ownerId = "";
const session = { userId: "" };
const Prisma = require("@prisma/client").Prisma;

function baseDeps() {
  return {
    "@/utils/db": { prisma, Prisma },
    "@/utils/userAuth": { getSessionUser: async () => ({ userId: session.userId }) },
    "@/utils/invoiceTotals": invoiceTotals,
  };
}

function loadDashboard() {
  const handlerExports = {};
  runInNewContext(dashboardCompiled, {
    exports: handlerExports,
    console,
    URL,
    require: (name) => {
      const deps = {
        ...baseDeps(),
        "@/utils/portfolio": { mergePortfolioContent },
        "@/lib/currency": { normalizeCurrency },
        "@/utils/exchangeRates": {
          convertFromSnapshot: exchangeRates.convertFromSnapshot,
          getExchangeRateSnapshot: async () => null,
        },
        "@/lib/activation-plan": { buildActivationPlan },
        "@/lib/activation": { normalizeActivationGoal },
        "@/lib/guides": { normalizeGuideProgress },
      };
      return deps[name] || require(name);
    },
  });
  return handlerExports;
}

function loadSummary() {
  const handlerExports = {};
  runInNewContext(summaryCompiled, {
    exports: handlerExports,
    console,
    URL,
    require: (name) => {
      const deps = {
        ...baseDeps(),
        "@/utils/revenueTrend": revenueTrend,
        "@/utils/invoiceLifecycle": invoiceLifecycle,
      };
      return deps[name] || require(name);
    },
  });
  return handlerExports;
}

let dashboardGET = null;
let summaryGET = null;

function monthKeyInTz(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      calendar: "iso8601",
      numberingSystem: "latn",
      timeZone,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}`;
}

function shiftMonth(month, offset) {
  const [year, number] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, number - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

const THIS_MONTH = monthKeyInTz(new Date(), TIME_ZONE);
const PREV_MONTH = shiftMonth(THIS_MONTH, -1);

function requirePg(t) {
  if (!pgAvailable) t.skip("isolated Postgres unreachable — start the WSL cluster on :5434");
}

let clientA = "";
let clientB = "";
let fixtureReady = false;

async function seedFixtures() {
  if (fixtureReady) return;
  ownerId = (await prisma.user.create({
    data: { email: OWNER_EMAIL, passwordHash: "scrypt:w01:w01", timeZone: TIME_ZONE },
  })).id;
  session.userId = ownerId;

  // Two clients, one display name: they must never merge into one row.
  const tag = `W01R-${RUN}`;
  const a = await prisma.client.create({ data: { userId: ownerId, name: "Acme", email: `${tag}-a@test.invalid` } });
  const b = await prisma.client.create({ data: { userId: ownerId, name: "Acme", email: `${tag}-b@test.invalid` } });
  clientA = a.id;
  clientB = b.id;

  // Split-month settlement: 400 previous month, 600 this month, on one invoice.
  const split = await prisma.invoice.create({
    data: { userId: ownerId, clientId: clientA, invoiceNumber: `${tag}-split`, status: "paid", currency: "USD", total: 1000, amountPaid: 1000 },
  });
  await prisma.invoicePayment.createMany({
    data: [
      { invoiceId: split.id, amount: 400, paidAt: new Date(`${PREV_MONTH}-15T12:00:00.000Z`), method: "manual" },
      { invoiceId: split.id, amount: 600, paidAt: new Date(`${THIS_MONTH}-15T12:00:00.000Z`), method: "manual" },
    ],
  });

  // A partial receipt before settlement must already count as cash.
  const partial = await prisma.invoice.create({
    data: { userId: ownerId, clientId: clientB, invoiceNumber: `${tag}-partial`, status: "partially_paid", currency: "USD", total: 500, amountPaid: 200 },
  });
  await prisma.invoicePayment.create({
    data: { invoiceId: partial.id, amount: 200, paidAt: new Date(`${THIS_MONTH}-15T12:00:00.000Z`), method: "manual" },
  });

  // Legacy collection: amountPaid with no receipt rows.
  await prisma.invoice.create({
    data: { userId: ownerId, invoiceNumber: `${tag}-legacy`, status: "paid", currency: "USD", total: 300, amountPaid: 300 },
  });

  // Reconciliation error: receipt rows exceed amountPaid; surfaced, not netted.
  const excess = await prisma.invoice.create({
    data: { userId: ownerId, invoiceNumber: `${tag}-excess`, status: "paid", currency: "USD", total: 100, amountPaid: 100 },
  });
  await prisma.invoicePayment.create({
    data: { invoiceId: excess.id, amount: 120, paidAt: new Date(`${THIS_MONTH}-15T12:00:00.000Z`), method: "manual" },
  });

  // Over-limit bulk: small open invoices in a fixed old cohort month.
  const rows = [];
  for (let index = 0; index < BULK_COUNT; index += 1) {
    rows.push({
      userId: ownerId,
      invoiceNumber: `${tag}-bulk-${String(index).padStart(5, "0")}`,
      status: "sent",
      currency: "USD",
      total: 1,
      amountPaid: 0,
      issueDate: new Date("2020-01-15T12:00:00.000Z"),
      updatedAt: new Date(),
    });
  }
  for (let offset = 0; offset < rows.length; offset += 2000) {
    await prisma.invoice.createMany({ data: rows.slice(offset, offset + 2000) });
  }
  fixtureReady = true;
}

before(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    pgAvailable = false;
    return;
  }
  dashboardGET = loadDashboard().GET;
  summaryGET = loadSummary().GET;
  await seedFixtures();
});

after(async () => {
  await prisma.$disconnect().catch(() => undefined);
});

test("D3: the overview chart sums dated receipts by paidAt in the owner calendar", async (t) => {
  requirePg(t);
  const response = await dashboardGET(new Request("https://rive.test/api/workflow/dashboard"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  const byPeriod = new Map(body.chartData.map((row) => [row.period, row]));
  assert.equal(byPeriod.get(PREV_MONTH)?.revenue, 400);
  assert.equal(byPeriod.get(THIS_MONTH)?.revenue, 920); // 600 + 200 partial + 120 excess receipts
  assert.deepEqual(body.chartDefinition, {
    metric: "cash_received",
    source: "InvoicePayment.amount",
    dateField: "paidAt",
    timeZone: TIME_ZONE,
    startMonth: shiftMonth(THIS_MONTH, -5),
    endMonth: THIS_MONTH,
  });
});

test("D3: legacy collections and reconciliation gaps are explicit, not netted", async (t) => {
  requirePg(t);
  const body = await (await dashboardGET(new Request("https://rive.test/api/workflow/dashboard"))).json();
  assert.deepEqual(body.financialIntegrity, [{
    currency: "USD",
    collectionsWithoutPaymentDate: 300,
    paymentReconciliationExcess: 20,
  }]);
});

test("MONEY-04: overview tiles and top clients agree on collected (not gross)", async (t) => {
  requirePg(t);
  const body = await (await dashboardGET(new Request("https://rive.test/api/workflow/dashboard"))).json();
  // Collected: 1000 split + 200 partial + 300 legacy + 100 excess = 1600.
  // Pending: 300 outstanding on the partial invoice plus the open bulk ones.
  assert.equal(body.stats.totalPaid, 1600);
  assert.equal(body.stats.totalPending, 300 + BULK_COUNT);
  const byName = new Map(body.topClients.map((row) => [row.id, row]));
  assert.equal(byName.get(clientA)?.total_revenue, "1000");
  assert.equal(byName.get(clientB)?.total_revenue, "200"); // banked, not the 500 gross
});

test("D4: totals stay complete past the old 20,000-row ceiling", async (t) => {
  requirePg(t);
  const body = await (await summaryGET(new Request("https://rive.test/api/workflow/revenue/summary"))).json();
  assert.equal(body.success, true);
  const usd = body.currencies.find((row) => row.currency === "USD");
  assert.ok(usd);
  // Issued: 1000 + 500 + 300 + 100 + 20,005 bulk ones.
  assert.equal(usd.issued, 1900 + BULK_COUNT);
  assert.equal(usd.collected, 1600);
  assert.equal(usd.outstanding, 300 + BULK_COUNT);
  assert.equal(usd.invoiceCount, 4 + BULK_COUNT);
  assert.equal(usd.collectionsWithoutPaymentDate, 300);
  assert.equal(usd.paymentReconciliationExcess, 20);
  const bulkCohort = body.monthlyRevenue.find((row) => row.month === "2020-01" && row.currency === "USD");
  assert.ok(bulkCohort);
  assert.equal(bulkCohort.invoiced, BULK_COUNT);
  assert.equal(bulkCohort.collected, 0);
});

test("D4/MONEY-05: same-name clients stay separate rows keyed by client id", async (t) => {
  requirePg(t);
  const body = await (await summaryGET(new Request("https://rive.test/api/workflow/revenue/summary"))).json();
  const acmeRows = body.byClient.filter((row) => row.client === "Acme" && row.currency === "USD");
  assert.equal(acmeRows.length, 2);
  const byId = new Map(acmeRows.map((row) => [row.clientId, row]));
  assert.equal(byId.get(clientA)?.invoiced, 1000);
  assert.equal(byId.get(clientB)?.invoiced, 500);
  assert.notEqual(byId.get(clientA)?.clientId, byId.get(clientB)?.clientId);
});

test("MONEY-03: revenue summary exposes the same dated-cash series as the overview", async (t) => {
  requirePg(t);
  const body = await (await summaryGET(new Request("https://rive.test/api/workflow/revenue/summary"))).json();
  const usdCash = body.cashByMonth.filter((row) => row.currency === "USD");
  assert.deepEqual(usdCash.map((row) => [row.month, row.cashReceived]), [[PREV_MONTH, 400], [THIS_MONTH, 920]]);
  assert.equal(body.reportingDefinitions.cashByMonth.source, "InvoicePayment.amount grouped by paidAt");
  assert.equal(body.reportingDefinitions.cashByMonth.timeZone, TIME_ZONE);
  assert.deepEqual(body.financialIntegrity, [{
    currency: "USD",
    collectionsWithoutPaymentDate: 300,
    paymentReconciliationExcess: 20,
  }]);
});
