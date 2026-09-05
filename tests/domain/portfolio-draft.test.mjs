import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPortfolioPersistBody,
  classifyLocalDraft,
  coalescePersistQueue,
  isQuietPersistFailure,
  parsePortfolioDraftSnapshot,
  portfolioPublishErrorSection,
  shouldApplyServerSnapshot,
} from "../../src/utils/portfolioDraft.ts";

function snapshot(revision) {
  return {
    revision,
    content: { name: "Local" },
    theme: { accent: "#2563EB", mode: "light", radius: "soft" },
    templateKey: "minimal-pro",
    slug: "local",
    seo: { title: "T", description: "D", indexable: true },
  };
}

test("a missing local draft needs no human decision", () => {
  assert.equal(classifyLocalDraft(3, null), "none");
});

test("a local draft at the same revision is unsaved work from this generation", () => {
  assert.equal(classifyLocalDraft(3, snapshot(3)), "restore");
});

test("a local draft at another revision is a conflict, not a silent restore", () => {
  assert.equal(classifyLocalDraft(5, snapshot(3)), "conflict");
});

test("an older snapshot without a revision still restores rather than alarming", () => {
  assert.equal(classifyLocalDraft(5, snapshot(Number.NaN)), "restore");
});

test("a server response must not clobber a newer local edit", () => {
  assert.equal(shouldApplyServerSnapshot(4, 4), true);
  assert.equal(shouldApplyServerSnapshot(4, 5), false);
});

test("autosave persist bodies never include a status", () => {
  const body = buildPortfolioPersistBody({
    revision: 2,
    content: { name: "A" },
    theme: { accent: "#2563EB", mode: "light", radius: "soft" },
    templateKey: "minimal-pro",
    slug: "a",
    seo: { title: "", description: "", indexable: true },
  });
  assert.equal("status" in body, false);
});

test("publish persist bodies send an explicit status and nothing else extra", () => {
  const body = buildPortfolioPersistBody({
    revision: 2,
    content: { name: "A" },
    theme: { accent: "#2563EB", mode: "light", radius: "soft" },
    templateKey: "minimal-pro",
    slug: "a",
    seo: { title: "", description: "", indexable: true },
    status: "published",
  });
  assert.equal(body.status, "published");
});

test("offline and network failures stay quiet; other errors do not", () => {
  assert.equal(isQuietPersistFailure(new TypeError("Failed to fetch"), true), true);
  assert.equal(isQuietPersistFailure(new TypeError("Failed to fetch"), false), true);
  assert.equal(isQuietPersistFailure(new Error("Choose a valid public URL."), true), false);
  assert.equal(isQuietPersistFailure(new Error("offline"), false), true);
});

test("draft snapshots parse only when the required fields are present", () => {
  assert.equal(parsePortfolioDraftSnapshot(null), null);
  assert.equal(parsePortfolioDraftSnapshot("{"), null);
  assert.equal(parsePortfolioDraftSnapshot(JSON.stringify({ slug: "x" })), null);

  const parsed = parsePortfolioDraftSnapshot(JSON.stringify(snapshot(7)));
  assert.equal(parsed?.revision, 7);
  assert.equal(parsed?.slug, "local");
  assert.equal(parsed?.seo.indexable, true);
});

function persistBody(slug, savedSlug) {
  return buildPortfolioPersistBody({
    revision: 2,
    content: { name: "A" },
    theme: { accent: "#2563EB", mode: "light", radius: "soft" },
    templateKey: "minimal-pro",
    slug,
    savedSlug,
    seo: { title: "", description: "", indexable: true },
  });
}

test("an unchanged public URL is left out of the save", () => {
  /* It used to ride on every autosave. The endpoint answers a taken slug with
     a 409, so one unavailable URL in the field failed every unrelated save and
     nothing written afterwards was stored. */
  const body = persistBody("agnik", "agnik");
  assert.equal("slug" in body, false);
  // Everything else still travels.
  assert.deepEqual(body.content, { name: "A" });
  assert.equal(body.templateKey, "minimal-pro");
  assert.equal(body.revision, 2);
});

test("a changed public URL is still sent, so it can be claimed or rejected", () => {
  const body = persistBody("agnik-studio", "agnik");
  assert.equal(body.slug, "agnik-studio");
});

test("without a known saved slug the URL is sent, preserving old behaviour", () => {
  assert.equal(persistBody("agnik", undefined).slug, "agnik");
});
test("publish rejections map to the studio section holding the missing field", () => {
  assert.equal(portfolioPublishErrorSection("Add your display name before publishing."), "profile");
  assert.equal(portfolioPublishErrorSection("Add a headline before publishing."), "profile");
  assert.equal(portfolioPublishErrorSection("Add a short introduction before publishing."), "profile");
  assert.equal(portfolioPublishErrorSection("Add a contact email before publishing."), "profile");
  assert.equal(portfolioPublishErrorSection("That public URL is already taken."), "profile");
  assert.equal(portfolioPublishErrorSection("Choose a valid public URL."), "profile");
  assert.equal(portfolioPublishErrorSection("Name every practice, or remove the empty one, before publishing."), "practices");
  assert.equal(portfolioPublishErrorSection("Confirm that this case study should be shown on your public portfolio before publishing it."), "work");
});

test("unrelated save failures offer no section jump", () => {
  assert.equal(portfolioPublishErrorSection(""), null);
  assert.equal(portfolioPublishErrorSection("This portfolio changed in another tab. Reload before saving."), null);
  assert.equal(portfolioPublishErrorSection("could not save portfolio"), null);
});
test("a save with nothing in flight runs immediately", () => {
  assert.equal(coalescePersistQueue({ inFlight: false }), "proceed");
});

test("a save that arrives mid-flight queues behind it instead of reporting success", () => {
  assert.equal(coalescePersistQueue({ inFlight: true }), "queue");
  assert.equal(coalescePersistQueue({ inFlight: true, queuedStatus: "published" }), "queue");
  assert.equal(coalescePersistQueue({ inFlight: true, silent: true }), "queue");
});

test("a silent autosave covered by a queued publish is dropped", () => {
  assert.equal(
    coalescePersistQueue({ inFlight: true, queuedStatus: "published", silent: true }),
    "drop-redundant-autosave",
  );
});
