import assert from "node:assert/strict";
import test from "node:test";

import { ACTIVATION_GOALS, ACTIVATION_GOAL_NAV_PATHS, normalizeActivationGoal } from "../../src/lib/activation.ts";
import { buildActivationPlan } from "../../src/lib/activation-plan.ts";

const emptyWorkspace = {
  counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 },
  profileReady: false,
  selectedPortfolioProject: false,
  publishedPortfolio: false,
  projectDeadlineCount: 0,
  sentInvoiceCount: 0,
  calendarConnectionCount: 0,
  importJobCount: 0,
  unresolvedImportIssues: 0,
};

test("goal plans start with one obvious recommendation", () => {
  const organize = buildActivationPlan({ ...emptyWorkspace, goal: "organize" });
  const paid = buildActivationPlan({ ...emptyWorkspace, goal: "get_paid" });
  const finances = buildActivationPlan({ ...emptyWorkspace, goal: "understand_finances" });
  const publish = buildActivationPlan({ ...emptyWorkspace, goal: "publish_portfolio" });
  const migrate = buildActivationPlan({ ...emptyWorkspace, goal: "migrate" });

  assert.equal(organize.recommendedAction?.id, "first_client");
  assert.equal(paid.recommendedAction?.id, "first_client");
  assert.equal(finances.recommendedAction?.id, "import_work");
  assert.equal(publish.recommendedAction?.id, "complete_profile");
  assert.equal(migrate.recommendedAction?.id, "import_work");
  assert.ok(organize.secondaryActions.length <= 2);
  for (const goal of ACTIVATION_GOALS) {
    assert.ok(buildActivationPlan({ ...emptyWorkspace, goal }).secondaryActions.length <= 2);
  }
});

test("get-paid recommendation advances as real records appear", () => {
  const client = buildActivationPlan({ ...emptyWorkspace, goal: "get_paid", counts: { ...emptyWorkspace.counts, clients: 1 } });
  const project = buildActivationPlan({ ...emptyWorkspace, goal: "get_paid", counts: { ...emptyWorkspace.counts, clients: 1, projects: 1 } });
  const invoice = buildActivationPlan({ ...emptyWorkspace, goal: "get_paid", counts: { ...emptyWorkspace.counts, clients: 1, projects: 1, invoices: 1 } });
  const sent = buildActivationPlan({ ...emptyWorkspace, goal: "get_paid", counts: { ...emptyWorkspace.counts, clients: 1, projects: 1, invoices: 1 }, sentInvoiceCount: 1 });

  assert.equal(client.recommendedAction?.id, "first_project");
  assert.equal(project.recommendedAction?.id, "create_invoice");
  assert.equal(invoice.recommendedAction?.id, "send_invoice");
  assert.equal(sent.recommendedAction, null);
  assert.equal(sent.activationStage, "activated");
});

test("import plans stop nagging after guidance is dismissed", () => {
  const plan = buildActivationPlan({ ...emptyWorkspace, goal: "migrate", guidanceDismissed: true });
  assert.equal(plan.guidanceDismissed, true);
  assert.equal(plan.recommendedAction?.id, "import_work");
});

test("unknown goals and navigation remain safe for legacy users", () => {
  assert.equal(normalizeActivationGoal("unknown"), "organize");
  assert.deepEqual(ACTIVATION_GOAL_NAV_PATHS.publish_portfolio, ["/portfolio", "/workflow/projects", "/workflow/clients"]);
});

test("guidance status distinguishes available, dismissed, and completed runs", () => {
  const base = { ...emptyWorkspace, goal: "organize" };
  assert.equal(buildActivationPlan(base).automaticGuidanceStatus, "available");
  assert.equal(buildActivationPlan({ ...base, guidanceDismissed: true }).automaticGuidanceStatus, "dismissed");
  assert.equal(buildActivationPlan({ ...base, guidanceCompleted: true }).automaticGuidanceStatus, "completed");
});
