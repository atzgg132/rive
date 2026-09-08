import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeWorkspaceSearch,
  SEARCH_MIN_QUERY_LENGTH,
  SEARCH_MAX_QUERY_LENGTH,
  SEARCH_TOTAL_LIMIT,
  normalizeWorkspaceSearchLimit,
  sortWorkspaceSearchResults,
  workspaceSearchWhere,
} from "../../src/lib/workspace-search.ts";

test("normalizes and bounds workspace search terms", () => {
  assert.equal(normalizeWorkspaceSearch("  Acme\n\tStudio  "), "Acme Studio");
  assert.equal(normalizeWorkspaceSearch("\u0000\u0001Acme"), "Acme");
  assert.equal(normalizeWorkspaceSearch("a".repeat(SEARCH_MAX_QUERY_LENGTH + 10)).length, SEARCH_MAX_QUERY_LENGTH);
  assert.equal(normalizeWorkspaceSearch("a").length, 0);
  assert.equal(SEARCH_MIN_QUERY_LENGTH, 2);
  assert.equal(normalizeWorkspaceSearch("   "), "");
});

test("normalizes a positive search limit without allowing an unbounded query", () => {
  assert.equal(normalizeWorkspaceSearchLimit("5"), 5);
  assert.equal(normalizeWorkspaceSearchLimit("999"), SEARCH_TOTAL_LIMIT);
  assert.equal(normalizeWorkspaceSearchLimit("0"), SEARCH_TOTAL_LIMIT);
  assert.equal(normalizeWorkspaceSearchLimit("not-a-number"), SEARCH_TOTAL_LIMIT);
});

test("builds every search predicate with owner scope and case-insensitive fields", () => {
  for (const kind of ["client", "project", "invoice", "expense", "agreement"]) {
    const where = workspaceSearchWhere(kind, "user-1", "Acme");
    assert.equal(where.userId, "user-1");
    assert.ok(Array.isArray(where.OR));
    assert.ok(where.OR.length > 0);
    assert.ok(where.OR.every((entry) => Object.values(entry)[0]));
  }
  assert.deepEqual(workspaceSearchWhere("project", "user-1", "Acme").OR[2], { client: { userId: "user-1", name: { contains: "Acme", mode: "insensitive" } } });
  assert.deepEqual(workspaceSearchWhere("invoice", "user-1", "Acme").OR[2], { project: { userId: "user-1", title: { contains: "Acme", mode: "insensitive" } } });
});

test("ranks exact, prefix, and contains matches before deterministic ties", () => {
  const results = Array.from({ length: SEARCH_TOTAL_LIMIT + 4 }, (_, index) => ({
    kind: "client",
    type: "client",
    id: `id-${String(SEARCH_TOTAL_LIMIT + 4 - index).padStart(2, "0")}`,
    title: index === 0 ? "Acme Studio" : index === 1 ? "Acme" : index === 2 ? "West Acme" : "Beta",
    subtitle: null,
    status: "active",
    href: "/workflow/clients/x",
  }));
  const sorted = sortWorkspaceSearchResults(results, "Acme");
  assert.equal(sorted[0].title, "Acme");
  assert.equal(sorted[1].title, "Acme Studio");
  assert.equal(sorted[2].title, "West Acme");
  assert.equal(sorted.length, SEARCH_TOTAL_LIMIT + 4);
});
