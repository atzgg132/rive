import assert from "node:assert/strict";
import test from "node:test";

import {
  FIXTURE,
  fixtureIds,
  parseSeedArgs,
  refuseProduction,
  summarizeFixture,
} from "../../scripts/lib/launch-film-fixture.mjs";

test("launch film fixture uses stable IDs, INR, and reserved synthetic addresses", () => {
  const first = fixtureIds();
  const second = fixtureIds();
  assert.equal(first.client, second.client);
  assert.match(first.client, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(first.project, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(first.client, first.project);

  assert.equal(FIXTURE.currency, "INR");
  assert.equal(FIXTURE.client.name, "Maya Rao");
  assert.equal(FIXTURE.client.company, "Northstar Studio");
  assert.equal(FIXTURE.project.title, "Northstar Brand System");
  assert.match(FIXTURE.client.email, /\.(example|invalid|test)$/i);
  assert.equal(FIXTURE.client.email.includes("@"), true);
  assert.equal(FIXTURE.notesIdentifySynthetic, true);
  assert.match(FIXTURE.client.notes, /synthetic/i);
});

test("launch film fixture is one linked client/project story with the required financial totals", () => {
  assert.equal(FIXTURE.clients.length, 1);
  assert.equal(FIXTURE.projects.length, 1);
  assert.equal(FIXTURE.projects[0].clientKey, FIXTURE.client.key);
  assert.equal(FIXTURE.financials.projectValue, 240_000);
  assert.equal(FIXTURE.financials.paid, 160_000);
  assert.equal(FIXTURE.financials.outstanding, 80_000);
  assert.equal(FIXTURE.financials.expenses, 32_000);
  assert.equal(FIXTURE.financials.paid + FIXTURE.financials.outstanding, FIXTURE.financials.projectValue);

  const expenseTotal = FIXTURE.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  assert.equal(expenseTotal, 32_000);
  assert.equal(FIXTURE.expenses.every((expense) => expense.projectKey === FIXTURE.project.key), true);
});

test("launch film fixture has three milestones, tasks, two invoices, and one recorded payment", () => {
  assert.equal(FIXTURE.milestones.length, 3);
  assert.deepEqual(
    FIXTURE.milestones.map((milestone) => milestone.title),
    ["Discovery", "Direction", "Final delivery"],
  );
  assert.equal(FIXTURE.milestones.filter((milestone) => milestone.key !== "final").every((milestone) => milestone.completed), true);
  assert.equal(FIXTURE.milestoneState("before").final.completed, false);
  assert.equal(FIXTURE.milestoneState("after").final.completed, true);

  assert.ok(FIXTURE.tasks.length >= 3);
  assert.equal(FIXTURE.tasks.every((task) => task.projectKey === FIXTURE.project.key), true);
  assert.ok(FIXTURE.tasks.some((task) => task.dueDate));

  assert.equal(FIXTURE.invoices.length, 2);
  const invoiceTotal = FIXTURE.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  assert.equal(invoiceTotal, 240_000);
  assert.equal(FIXTURE.payments.length, 1);
  assert.equal(FIXTURE.payments[0].amount, 160_000);
  assert.equal(FIXTURE.payments[0].invoiceNumber, FIXTURE.invoices.find((invoice) => invoice.status === "paid").number);
});

test("launch film fixture includes a matching portfolio case study and synthetic testimonial", () => {
  assert.equal(FIXTURE.portfolio.project.title, "Northstar Brand System");
  assert.equal(FIXTURE.portfolio.project.client, "Northstar Studio");
  assert.match(FIXTURE.portfolio.testimonial.quote, /synthetic|demo|launch film/i);
  assert.equal(FIXTURE.portfolio.testimonial.name, "Maya Rao");
  assert.equal(FIXTURE.portfolio.testimonial.company.includes("Northstar Studio"), true);
  assert.match(FIXTURE.portfolio.testimonial.source, /synthetic/i);
});

test("launch film seed CLI requires an email, defaults to inspect, and refuses production", () => {
  assert.throws(() => parseSeedArgs([]), /--email/);
  const inspect = parseSeedArgs(["--email=demo@example.com"]);
  assert.equal(inspect.email, "demo@example.com");
  assert.equal(inspect.apply, false);
  assert.equal(inspect.state, "after");
  const apply = parseSeedArgs(["--email=demo@example.com", "--apply", "--state=before"]);
  assert.equal(apply.apply, true);
  assert.equal(apply.state, "before");
  assert.throws(() => refuseProduction({ APP_ENV: "production" }), /production/);
  assert.throws(() => refuseProduction({ NODE_ENV: "production" }), /production/);
  assert.equal(refuseProduction({ APP_ENV: "development" }), true);
});

test("launch film fixture summary exposes the stable record IDs capture automation needs", () => {
  const summary = summarizeFixture();
  assert.equal(summary.clientId, fixtureIds().client);
  assert.equal(summary.projectId, fixtureIds().project);
  assert.equal(summary.invoicePaidId, fixtureIds().invoices.paid);
  assert.equal(summary.invoiceOutstandingId, fixtureIds().invoices.outstanding);
  assert.equal(summary.portfolioProjectId, FIXTURE.portfolio.project.id);
  assert.equal(summary.counts.clients, 1);
  assert.equal(summary.counts.projects, 1);
  assert.equal(summary.counts.milestones, 3);
  assert.equal(summary.counts.invoices, 2);
  assert.equal(summary.counts.payments, 1);
});
