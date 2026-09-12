import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

/**
 * The expenses summary regression: the tiles used to be computed from whatever
 * paginated rows the client happened to hold, so "this month" changed when the
 * owner paged or filtered. The summary now comes from server-side groupBys
 * scoped to the owner alone — these tests pin that contract without a real
 * database.
 */

const require = createRequire(import.meta.url);
const ts = require("typescript");
const pagination = await import("../../src/lib/pagination.ts");

const USER = "summary-owner";

function matchesWhere(row, where = {}) {
  for (const [field, expected] of Object.entries(where)) {
    if (expected === undefined || expected === null) continue;
    if (expected instanceof Date) {
      if (new Date(row[field]).getTime() !== expected.getTime()) return false;
      continue;
    }
    if (typeof expected === "object" && !Array.isArray(expected)) {
      if ("gte" in expected || "lt" in expected || "lte" in expected || "gt" in expected) {
        const value = row[field] instanceof Date ? row[field] : new Date(row[field]);
        if ("gte" in expected && value < expected.gte) return false;
        if ("lt" in expected && value >= expected.lt) return false;
        if ("gt" in expected && value <= expected.gt) return false;
        if ("lte" in expected && value > expected.lte) return false;
        continue;
      }
      if ("contains" in expected) {
        if (!String(row[field]).toLowerCase().includes(String(expected.contains).toLowerCase())) return false;
        continue;
      }
      if ("not" in expected) {
        if (expected.not === null && row[field] === null) return false;
        if (expected.not !== null && row[field] === expected.not) return false;
        continue;
      }
      if ("in" in expected) {
        if (!expected.in.includes(row[field])) return false;
        continue;
      }
    }
    if (row[field] !== expected) return false;
  }
  return true;
}

function createStub(expenses) {
  return {
    expense: {
      async count({ where }) {
        return expenses.filter((row) => matchesWhere(row, where)).length;
      },
      async findMany({ where, skip = 0, take } = {}) {
        let rows = expenses.filter((row) => matchesWhere(row, where));
        rows = [...rows].sort((a, b) => new Date(b.date) - new Date(a.date));
        return rows.slice(skip, typeof take === "number" ? skip + take : undefined)
          .map((row) => ({ ...row, project: row.projectId ? { title: "Linked project" } : null }));
      },
      async groupBy({ by, where }) {
        const groups = new Map();
        for (const row of expenses.filter((entry) => matchesWhere(entry, where))) {
          const key = by.map((field) => row[field]).join("");
          const entry = groups.get(key) || Object.fromEntries(by.map((field) => [field, row[field]]));
          entry._sum = { amount: (entry._sum?.amount || 0) + Number(row.amount) };
          groups.set(key, entry);
        }
        return [...groups.values()];
      },
    },
    user: {
      async findUnique() {
        return { timeZone: "UTC" };
      },
    },
  };
}

function loadExpensesRoute(stub) {
  const source = readFileSync(new URL("../../src/app/api/workflow/expenses/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const handlerExports = {};
  runInNewContext(compiled, {
    exports: handlerExports,
    console,
    URL,
    require: (name) => {
      const deps = {
        "@/utils/db": { prisma: stub },
        "@/utils/userAuth": { getSessionUser: async () => ({ userId: USER }) },
        "@/utils/productEvents": { PRODUCT_EVENTS: { expenseCreated: "expense_created" }, recordProductEvent: async () => ({}) },
        "@/lib/pagination": pagination,
      };
      return deps[name] || require(name);
    },
  });
  return handlerExports.GET;
}

const now = new Date();
const thisMonthDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15));
const lastMonthDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));

const fixture = [
  { id: "e-a", userId: USER, projectId: "p-1", category: "software", description: "Figma", amount: 100, currency: "USD", date: thisMonthDay, receiptUrl: null, isBillable: true, isReimbursed: false, createdAt: thisMonthDay, updatedAt: thisMonthDay },
  { id: "e-b", userId: USER, projectId: null, category: "travel", description: "Uber", amount: 50, currency: "USD", date: thisMonthDay, receiptUrl: null, isBillable: false, isReimbursed: false, createdAt: thisMonthDay, updatedAt: thisMonthDay },
  { id: "e-c", userId: USER, projectId: null, category: "software", description: "Old license", amount: 200, currency: "USD", date: lastMonthDay, receiptUrl: null, isBillable: true, isReimbursed: true, createdAt: lastMonthDay, updatedAt: lastMonthDay },
  { id: "e-d", userId: USER, projectId: null, category: "meals", description: "Lunch", amount: 80, currency: "EUR", date: thisMonthDay, receiptUrl: null, isBillable: false, isReimbursed: false, createdAt: thisMonthDay, updatedAt: thisMonthDay },
  { id: "e-x", userId: "someone-else", projectId: null, category: "other", description: "Not yours", amount: 9999, currency: "USD", date: thisMonthDay, receiptUrl: null, isBillable: true, isReimbursed: false, createdAt: thisMonthDay, updatedAt: thisMonthDay },
];

const GET = loadExpensesRoute(createStub(fixture));

test("summary tiles describe the workspace, not the filtered page", async () => {
  // Filter to "travel" and shrink the page to one row: neither moves the summary.
  const response = await GET(new Request("https://rive.test/api/workflow/expenses?category=travel&pageSize=1"));
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.expenses.length, 1);
  assert.equal(body.expenses[0].description, "Uber");

  assert.equal(body.summary.month.byCurrency.USD, 150);
  assert.equal(body.summary.month.byCurrency.EUR, 80);
  assert.equal(body.summary.month.count, 3);
  assert.equal(body.summary.billableOutstanding.byCurrency.USD, 100);
  assert.equal(body.summary.linked.byCurrency.USD, 100);
});

test("the category rollup spans all history while the month view stays in-month", async () => {
  const body = await (await GET(new Request("https://rive.test/api/workflow/expenses"))).json();

  const categories = new Map(body.summary.categories.map((row) => [`${row.category}:${row.currency}`, row.amount]));
  // software includes last month's 200 — the breakdown is all-time.
  assert.equal(categories.get("software:USD"), 300);
  assert.equal(categories.get("travel:USD"), 50);
  assert.equal(categories.get("meals:EUR"), 80);
  // But the month sum does not.
  assert.equal(body.summary.month.byCurrency.USD, 150);
});

test("another tenant's expenses never reach the summary or the list", async () => {
  const body = await (await GET(new Request("https://rive.test/api/workflow/expenses"))).json();

  assert.ok(body.expenses.every((row) => row.user_id === USER));
  assert.equal(body.summary.month.byCurrency.USD, 150, "the other tenant's 9999 must not leak in");
  assert.equal(body.pagination.total, 4);
});
