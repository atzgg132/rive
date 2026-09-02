import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPortfolioCaseStudyFromProject,
  isProjectProofEligible,
  mergeGeneratedPortfolioCaseStudy,
  projectCaseStudyId,
} from "../../src/utils/portfolio.ts";
import {
  deterministicWorkSetupId,
  previewWorkSetup,
  normalizeWorkSetupPlan,
  WorkSetupError,
} from "../../src/utils/projectGeneration.ts";

function generation(overrides = {}) {
  return {
    id: "generation-1",
    acceptedVersionId: "version-1",
    acceptedVersion: { id: "version-1", version: 2, content: { projectTitle: "Accepted project", projectDescription: "Accepted scope" } },
    contract: {
      id: "contract-1",
      userId: "owner-1",
      clientId: "client-1",
      title: "Accepted Agreement",
      status: "executed",
      currency: "USD",
      projectId: null,
      executedAt: new Date("2026-08-20T12:00:00.000Z"),
      project: null,
      paymentPlanItems: [],
    },
    ...overrides,
  };
}

test("work setup normalization is canonical and hashes the same plan identically", () => {
  const raw = {
    project: { title: "  Launch project  ", description: "  Build the thing  ", startDate: "2026-09-01", dueDate: "2026-09-30" },
    milestones: [{ key: "design", title: "Design approval", dueDate: "2026-09-15" }],
    tasks: [{ key: "brief", title: "Write brief", dueDate: "2026-09-03", milestoneKey: "design" }],
    billing: { activateAcceptedPlan: true },
  };

  const first = previewWorkSetup(generation(), raw);
  const second = previewWorkSetup(generation(), raw);

  assert.deepEqual(first.plan, second.plan);
  assert.equal(first.hash, second.hash);
  assert.match(first.hash, /^[a-f0-9]{64}$/);
  assert.equal(first.plan.project.mode, "create");
  assert.equal(first.plan.project.title, "Launch project");
  assert.equal(first.plan.tasks[0].milestoneKey, "design");
  assert.equal(first.plan.billing.activateAcceptedPlan, true);
  assert.throws(
    () => previewWorkSetup(generation(), { ...raw, tasks: [{ key: "brief", title: "Write brief" }] }),
    (error) => error instanceof WorkSetupError && error.code === "task_due_date_required",
  );
});

test("an already-linked Project is reused and cannot be replaced", () => {
  const linked = {
    id: "project-1",
    userId: "owner-1",
    clientId: "client-1",
    title: "Linked project",
    description: "Existing scope",
    currency: "USD",
    startDate: new Date("2026-08-01T12:00:00.000Z"),
    dueDate: null,
    contractCoverage: "undecided",
    externalContractLabel: null,
    externalContractUrl: null,
    contractDecisionAt: null,
    milestones: [],
  };
  const accepted = generation({ contract: { ...generation().contract, projectId: linked.id, project: linked } });

  assert.equal(normalizeWorkSetupPlan(accepted, { project: { mode: "reuse", projectId: linked.id } }).project.mode, "reuse");
  assert.throws(
    () => normalizeWorkSetupPlan(accepted, { project: { mode: "create" } }),
    (error) => error instanceof WorkSetupError && error.code === "project_mode_locked" && error.status === 409,
  );
  assert.throws(
    () => normalizeWorkSetupPlan(accepted, { project: { mode: "reuse", projectId: "another-project" } }),
    (error) => error instanceof WorkSetupError && error.code === "project_locked" && error.status === 409,
  );
});

test("work setup IDs are deterministic but distinct by resource seed", () => {
  const project = deterministicWorkSetupId("generation-1:project");
  assert.equal(project, deterministicWorkSetupId("generation-1:project"));
  assert.notEqual(project, deterministicWorkSetupId("generation-1:task:brief"));
  assert.match(project, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("project proof mapping is conservative, private, and completion-based", () => {
  const project = {
    id: "project-42",
    title: "  Website launch ",
    description: "A focused launch scope.",
    status: "completed",
    startDate: new Date("2026-04-01T12:00:00.000Z"),
    dueDate: new Date("2026-06-30T12:00:00.000Z"),
    completedAt: new Date("2026-06-20T12:00:00.000Z"),
    updatedAt: new Date("2026-06-21T12:00:00.000Z"),
    tags: ["React", " ", "Figma"],
    client: { name: "Jane Smith", company: "Acme Labs", email: "private@example.com" },
    milestones: [
      { title: "Design approval", completed: true, completedAt: new Date("2026-05-15T12:00:00.000Z") },
      { title: "Internal note", completed: false, completedAt: null },
    ],
  };

  const mapped = buildPortfolioCaseStudyFromProject(project);
  assert.equal(mapped.id, projectCaseStudyId(project.id));
  assert.equal(mapped.title, "Website launch");
  assert.equal(mapped.client, "Acme Labs");
  assert.equal(mapped.year, "2026");
  assert.deepEqual(mapped.deliverables, ["Design approval"]);
  assert.deepEqual(mapped.tools, ["React", "Figma"]);
  assert.equal(mapped.visibility, "private");
  assert.deepEqual(mapped.media, []);
  assert.equal("email" in mapped, false);
  assert.equal(isProjectProofEligible({ status: "active", milestones: [{ completed: true }] }), true);
  assert.equal(isProjectProofEligible({ status: "active", milestones: [{ completed: false }] }), false);
});

test("proof merges only missing generated fields and preserves owner media", () => {
  const existing = {
    id: "project-42",
    title: "Owner title",
    description: "Owner description",
    role: "Product designer",
    year: "2025",
    url: "https://example.com/work",
    imageUrl: "https://example.com/cover.jpg",
    client: "Owner client label",
    timeline: "8 weeks",
    deliverables: ["Owner deliverable"],
    media: [{ id: "media-1", kind: "image", url: "https://example.com/image.jpg", alt: "Work", caption: "" }],
    visibility: "private",
    challenge: "Owner challenge",
    solution: "Owner approach",
    outcome: "Owner outcome",
    tools: ["Owner tool"],
  };
  const generated = { ...existing, title: "Generated title", description: "Generated description", client: "Generated client", deliverables: ["Generated deliverable"], tools: ["Generated tool"] };
  const merged = mergeGeneratedPortfolioCaseStudy(existing, generated);

  assert.equal(merged.title, "Owner title");
  assert.equal(merged.description, "Owner description");
  assert.deepEqual(merged.deliverables, ["Owner deliverable"]);
  assert.deepEqual(merged.tools, ["Owner tool"]);
  assert.deepEqual(merged.media, existing.media);
  assert.equal(merged.visibility, "private");
});

test("proof drafting does not privatize a legacy public matching entry", () => {
  const existing = {
    id: "project-legacy",
    title: "Legacy project",
    description: "Already public before visibility was stored.",
    role: "Designer",
    year: "2025",
    url: "",
    imageUrl: "",
  };
  const generated = {
    ...existing,
    description: "Generated description",
    visibility: "private",
  };

  const merged = mergeGeneratedPortfolioCaseStudy(existing, generated);
  assert.equal(merged.visibility, undefined);
});
