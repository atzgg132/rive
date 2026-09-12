import assert from "node:assert/strict";
import test from "node:test";

import {
  countsAsNativeDeadline,
  isQualifiedUser,
  qualificationBlockers,
  acquisitionSource,
  evaluateActivation,
  evaluateDeepActivation,
  hasRealDataRecords,
  summarizeFunnelUser,
} from "../../src/utils/funnelDefinitions.ts";

test("a project created in the activation window counts as a deadline if it has any due date", () => {
  assert.equal(countsAsNativeDeadline({ dueDate: new Date("2026-09-30T00:00:00.000Z") }), true);
  assert.equal(countsAsNativeDeadline({ dueDate: "2026-09-30" }), true);
  assert.equal(countsAsNativeDeadline({ dueDate: null }), false);
  assert.equal(countsAsNativeDeadline({ dueDate: undefined }), false);
});

function user(overrides = {}) {
  return {
    accountType: "customer",
    emailVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    emailVerificationRequiredAt: new Date("2026-08-01T00:00:00.000Z"),
    onboardingStatus: "complete",
    businessType: "freelancer",
    profession: "designer",
    onboardingData: { goal: "organize", startingPath: "quickstart" },
    attribution: { firstTouchSource: "direct", lastTouchSource: "direct", referralSource: null },
    ...overrides,
  };
}

test("qualified users need email-ready onboarding, profession, goal, path, and a captured source", () => {
  assert.equal(isQualifiedUser(user()), true);
  assert.deepEqual(qualificationBlockers(user()), []);
});

test("skip-setup without goal/profession/business type is not qualified", () => {
  const skipped = user({
    onboardingStatus: "complete",
    businessType: null,
    profession: null,
    onboardingData: { startingPath: "skipped" },
  });
  assert.equal(isQualifiedUser(skipped), false);
  assert.deepEqual(qualificationBlockers(skipped).sort(), [
    "missing_business_type",
    "missing_goal",
    "missing_profession",
  ]);
});

test("uncaptured acquisition source is a qualification blocker", () => {
  const uncaptured = user({
    attribution: { firstTouchSource: null, lastTouchSource: null, referralSource: null },
  });
  assert.equal(acquisitionSource(uncaptured), "uncaptured");
  assert.equal(isQualifiedUser(uncaptured), false);
  assert.equal(qualificationBlockers(uncaptured).includes("uncaptured_source"), true);
});

test("internal accounts never qualify", () => {
  assert.equal(isQualifiedUser(user({ accountType: "demo" })), false);
  assert.equal(qualificationBlockers(user({ accountType: "demo" })).includes("internal"), true);
});

const signup = new Date("2026-08-01T00:00:00.000Z");
const day3 = new Date("2026-08-04T00:00:00.000Z");
const day10 = new Date("2026-08-11T00:00:00.000Z");

function facts(overrides = {}) {
  return {
    signupAt: signup,
    clients: [{ id: "c1", createdAt: day3 }],
    projects: [{ id: "p1", clientId: "c1", dueDate: day3, createdAt: day3 }],
    invoices: [],
    expenses: [],
    calendarEvents: [],
    importJobs: [],
    portfolios: [],
    ...overrides,
  };
}

test("native activation is the union of client + linked project + connected outcome within 7 days", () => {
  const result = evaluateActivation(facts());
  assert.equal(result.native, true);
  assert.equal(result.activated, true);
  assert.deepEqual(result.paths, ["native"]);
  assert.deepEqual(result.blockers, []);
});

test("a project without a client does not activate natively even with a due date", () => {
  const result = evaluateActivation(facts({
    projects: [{ id: "p1", clientId: null, dueDate: day3, createdAt: day3 }],
  }));
  assert.equal(result.native, false);
  assert.equal(result.activated, false);
  assert.equal(result.blockers.includes("no_linked_project_in_window"), true);
});

test("work after day 7 does not count as funnel activation", () => {
  const result = evaluateActivation(facts({
    clients: [{ id: "c1", createdAt: day10 }],
    projects: [{ id: "p1", clientId: "c1", dueDate: day10, createdAt: day10 }],
  }));
  assert.equal(result.activated, false);
  assert.equal(result.blockers.includes("no_client_in_window"), true);
});

test("migration activation requires two committed entity types and zero unresolved rows", () => {
  const pass = evaluateActivation(facts({
    clients: [],
    projects: [],
    importJobs: [{
      completedAt: day3,
      createdAt: day3,
      unresolvedCount: 0,
      records: [{ targetType: "client" }, { targetType: "project" }],
    }],
  }));
  assert.equal(pass.migration, true);
  assert.equal(pass.activated, true);

  const unresolved = evaluateActivation(facts({
    clients: [],
    projects: [],
    importJobs: [{
      completedAt: day3,
      createdAt: day3,
      unresolvedCount: 1,
      records: [{ targetType: "client" }, { targetType: "project" }],
    }],
  }));
  assert.equal(unresolved.migration, false);
});

test("portfolio activation requires a published portfolio with contact email and a non-private real project", () => {
  const result = evaluateActivation(facts({
    clients: [],
    projects: [{ id: "p1", clientId: null, dueDate: null, createdAt: day3 }],
    portfolios: [{
      publishedAt: day3,
      content: {
        contactEmail: "a@example.com",
        projects: [{ id: "project-p1", visibility: "public", title: "Site" }],
      },
    }],
  }));
  assert.equal(result.portfolio, true);
  assert.equal(result.activated, true);
});

test("unqualified users with a full native graph still do not count as funnel-activated", () => {
  const native = evaluateActivation(facts());
  assert.equal(native.activated, true);
  assert.equal(isQualifiedUser(user({ onboardingData: { startingPath: "skipped" }, profession: null, businessType: null })), false);
});

test("real-data users are record-based, so a client row counts and calendar-only events still count", () => {
  assert.equal(hasRealDataRecords({ clients: 1, projects: 0, invoices: 0, expenses: 0, calendarEvents: 0 }), true);
  assert.equal(hasRealDataRecords({ clients: 0, projects: 0, invoices: 0, expenses: 0, calendarEvents: 1 }), true);
  assert.equal(hasRealDataRecords({ clients: 0, projects: 0, invoices: 0, expenses: 0, calendarEvents: 0 }), false);
});

test("skip-setup with a native graph is registered with real data, not funnel-activated", () => {
  const skipped = user({
    onboardingStatus: "complete",
    businessType: null,
    profession: null,
    onboardingData: { startingPath: "skipped" },
  });
  const summary = summarizeFunnelUser({
    user: skipped,
    activation: evaluateActivation(facts()),
    realData: true,
  });
  assert.equal(summary.stage, "registered");
  assert.equal(summary.qualified, false);
  assert.equal(summary.activated, false);
  assert.equal(summary.realData, true);
  assert.deepEqual(summary.activationPaths, ["native"]);
  assert.equal(summary.qualificationBlockers.includes("missing_goal"), true);
});

test("a qualified native user is funnel-activated", () => {
  const summary = summarizeFunnelUser({
    user: user(),
    activation: evaluateActivation(facts()),
    realData: true,
  });
  assert.equal(summary.stage, "activated");
  assert.equal(summary.qualified, true);
  assert.equal(summary.activated, true);
});

// Deep activation must stay identical to the Overview card, so these cases pin
// the shared evaluator the metrics pass, the Users list and the diagnosis all
// read from.
function deepFacts(overrides = {}) {
  return {
    signupAt: signup,
    activated: true,
    events: [
      { eventName: "client_created", module: "clients", occurredAt: day3 },
      { eventName: "project_created", module: "projects", occurredAt: day3 },
      { eventName: "invoice_created", module: "invoices", occurredAt: new Date("2026-08-06T00:00:00.000Z") },
    ],
    projects: [{ id: "p1", clientId: "c1", dueDate: day3, createdAt: day3 }],
    invoices: [{ id: "i1", projectId: "p1", clientId: "c1", createdAt: day3 }],
    expenses: [],
    calendarEvents: [],
    ...overrides,
  };
}

test("deep activation needs 3+ modules, 2+ active days and a connected workflow within 14 days", () => {
  const result = evaluateDeepActivation(deepFacts());
  assert.equal(result.deeplyActivated, true);
  assert.equal(result.moduleCount, 3);
  assert.equal(result.activeDays, 2);
  assert.equal(result.connectedWorkflow, true);
});

test("a single active day is not deep activation even with enough modules", () => {
  const result = evaluateDeepActivation(deepFacts({
    events: [
      { eventName: "client_created", module: "clients", occurredAt: day3 },
      { eventName: "project_created", module: "projects", occurredAt: day3 },
      { eventName: "invoice_created", module: "invoices", occurredAt: day3 },
    ],
  }));
  assert.equal(result.deeplyActivated, false);
  assert.equal(result.activeDays, 1);
});

test("two modules is not deep activation even across two days", () => {
  const result = evaluateDeepActivation(deepFacts({
    events: [
      { eventName: "client_created", module: "clients", occurredAt: day3 },
      { eventName: "project_created", module: "projects", occurredAt: new Date("2026-08-06T00:00:00.000Z") },
    ],
  }));
  assert.equal(result.deeplyActivated, false);
  assert.equal(result.moduleCount, 2);
});

test("an unlinked invoice does not connect the workflow", () => {
  const result = evaluateDeepActivation(deepFacts({
    invoices: [{ id: "i1", projectId: "someone-elses-project", clientId: null, createdAt: day3 }],
  }));
  assert.equal(result.connectedWorkflow, false);
  assert.equal(result.deeplyActivated, false);
});

test("events after day 14 do not count toward deep activation", () => {
  const late = new Date("2026-08-20T00:00:00.000Z");
  const result = evaluateDeepActivation(deepFacts({
    events: [
      { eventName: "client_created", module: "clients", occurredAt: late },
      { eventName: "project_created", module: "projects", occurredAt: late },
      { eventName: "invoice_created", module: "invoices", occurredAt: late },
    ],
    invoices: [{ id: "i1", projectId: "p1", clientId: "c1", createdAt: late }],
  }));
  assert.equal(result.moduleCount, 0);
  assert.equal(result.connectedWorkflow, false);
  assert.equal(result.deeplyActivated, false);
});

test("deep signals without funnel activation do not count", () => {
  const result = evaluateDeepActivation(deepFacts({ activated: false }));
  assert.equal(result.deeplyActivated, false);
  // The sub-scores still report, so the diagnosis can say what is missing.
  assert.equal(result.moduleCount, 3);
});

test("the funnel summary carries deep activation to the Users list and diagnosis", () => {
  const summary = summarizeFunnelUser({
    user: user(),
    activation: evaluateActivation(facts()),
    realData: true,
    deepActivation: evaluateDeepActivation(deepFacts()),
  });
  assert.equal(summary.stage, "activated");
  assert.equal(summary.deeplyActivated, true);
  assert.equal(summary.deepActivation?.connectedWorkflow, true);

  const shallow = summarizeFunnelUser({
    user: user(),
    activation: evaluateActivation(facts()),
    realData: true,
  });
  assert.equal(shallow.deeplyActivated, false);
  assert.equal(shallow.deepActivation, null);
});
