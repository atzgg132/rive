/**
 * Deduplication, in two directions.
 *
 * Within the upload: the same client appearing in three files must become one
 * client, not three. Against the workspace: importing "Acme" when Acme already
 * exists must link to the existing record, never overwrite or clone it.
 *
 * The governing rule is that existing data is never modified. The only outcomes
 * are create, link, skip, and review — there is no update path in V1, so a
 * migration cannot damage records the user already trusts.
 */

import {
  companyComparisonForm,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./normalize/text.ts";
import {
  companySimilarity,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./fuzzy.ts";
import {
  MATCH_THRESHOLDS,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./config.ts";
import {
  expenseFingerprint,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./workspace.ts";
import type { WorkspaceIndex } from "./workspace.ts";
import type { IdentityIndex } from "./identity.ts";
import type { DuplicateCandidate, MigrationRecordIR } from "./types.ts";

function text(record: MigrationRecordIR, key: string): string {
  const value = record.normalized[key];
  return typeof value === "string" ? value.trim() : "";
}

function num(record: MigrationRecordIR, key: string): number | null {
  const value = record.normalized[key];
  return typeof value === "number" ? value : null;
}

/** Deterministic ordering so the same upload always elects the same primary. */
function bySourceKey(a: MigrationRecordIR, b: MigrationRecordIR): number {
  return a.source.sourceKey.localeCompare(b.source.sourceKey);
}

function markSkip(record: MigrationRecordIR, candidate: DuplicateCandidate): void {
  record.action = "skip";
  record.status = "skipped";
  record.duplicateCandidates.push(candidate);
}

function markLink(record: MigrationRecordIR, candidate: DuplicateCandidate): void {
  record.action = "link";
  record.status = "ready";
  record.duplicateCandidates.push(candidate);
}

function markReview(record: MigrationRecordIR, candidate: DuplicateCandidate): void {
  record.action = "review";
  record.status = "review";
  record.duplicateCandidates.push(candidate);
}

export function applyDeduplication(
  records: MigrationRecordIR[],
  index: IdentityIndex,
  workspace: WorkspaceIndex,
): void {
  dedupeClients(records, index, workspace);
  dedupeProjects(records, workspace);
  dedupeInvoices(records, workspace);
  dedupeExpenses(records, workspace);
}

/**
 * Clients collapse by identity group. Because groups are only formed from
 * deterministic keys (email, source id, identical normalized name), collapsing
 * them is not a guess — but it is still reported so the user can see it.
 */
function dedupeClients(records: MigrationRecordIR[], index: IdentityIndex, workspace: WorkspaceIndex): void {
  const clients = records.filter((record) => record.entity === "clients" && record.status !== "error");
  const byGroup = new Map<string, MigrationRecordIR[]>();

  for (const record of clients) {
    const key = record.groupKey || record.source.sourceKey;
    const list = byGroup.get(key) || [];
    list.push(record);
    byGroup.set(key, list);
  }

  for (const [groupKey, members] of byGroup) {
    const ordered = [...members].sort(bySourceKey);
    const [primary, ...duplicates] = ordered;
    const group = index.groups.get(groupKey);

    for (const duplicate of duplicates) {
      markSkip(duplicate, {
        scope: "batch",
        targetId: null,
        groupKey,
        label: text(primary, "name") || primary.source.sourceKey,
        confidence: group?.confidence ?? 0.93,
        evidence: group?.evidence.length ? group.evidence : ["the same client appears more than once in your files"],
      });
    }

    // Now decide what the surviving record does about existing workspace data.
    const email = text(primary, "email").toLowerCase();
    const existingByEmail = email ? workspace.clientsByEmail.get(email) : undefined;
    if (existingByEmail) {
      markLink(primary, {
        scope: "workspace",
        targetId: existingByEmail.id,
        groupKey,
        label: existingByEmail.name,
        confidence: 0.99,
        evidence: ["a client with this email address already exists in Rive"],
      });
      continue;
    }

    const nameKey = companyComparisonForm(text(primary, "name"));
    const existingByName = nameKey ? workspace.clientsByName.get(nameKey) : undefined;
    if (existingByName) {
      markLink(primary, {
        scope: "workspace",
        targetId: existingByName.id,
        groupKey,
        label: existingByName.name,
        confidence: 0.93,
        evidence: ["a client with an identical name already exists in Rive"],
      });
      continue;
    }

    // Fuzzy resemblance to existing data is offered, never applied.
    const name = text(primary, "name");
    const near = workspace.snapshot.clients
      .map((client) => ({ client, score: companySimilarity(name, client.name) }))
      .filter((entry) => entry.score >= MATCH_THRESHOLDS.fuzzyNameSuggest && entry.score < 1)
      .sort((a, b) => b.score - a.score)[0];
    if (near) {
      markReview(primary, {
        scope: "workspace",
        targetId: near.client.id,
        groupKey,
        label: near.client.name,
        confidence: Math.min(0.92, near.score),
        evidence: [`"${near.client.name}" already exists and is ${Math.round(near.score * 100)}% similar`],
      });
    }
  }
}

function dedupeProjects(records: MigrationRecordIR[], workspace: WorkspaceIndex): void {
  const projects = records.filter((record) => record.entity === "projects" && record.status !== "error");
  const seen = new Map<string, MigrationRecordIR>();

  for (const record of [...projects].sort(bySourceKey)) {
    const title = text(record, "title");
    const externalId = record.source.externalId;
    // A project's identity is its name *within its client*, so two clients may
    // each have a "Website redesign" without colliding.
    const clientScope = record.resolvedRelationships.clientId?.existingId
      || record.resolvedRelationships.clientId?.groupKey
      || "";
    const key = `${clientScope}|${companyComparisonForm(title)}`;

    if (externalId) {
      const externalKey = `ext:${externalId.toLowerCase()}`;
      const previous = seen.get(externalKey);
      if (previous) {
        markSkip(record, {
          scope: "batch", targetId: null, groupKey: previous.source.sourceKey, label: text(previous, "title"),
          confidence: 1, evidence: ["the same source project ID appears twice"],
        });
        continue;
      }
      seen.set(externalKey, record);
    }

    const previous = seen.get(key);
    if (previous) {
      markSkip(record, {
        scope: "batch", targetId: null, groupKey: previous.source.sourceKey, label: title,
        confidence: 0.9, evidence: ["the same project name appears twice for this client"],
      });
      continue;
    }
    seen.set(key, record);

    const existing = workspace.projectsByName.get(companyComparisonForm(title));
    if (existing) {
      markLink(record, {
        scope: "workspace", targetId: existing.id, groupKey: null, label: existing.title,
        confidence: 0.93, evidence: ["a project with this name already exists in Rive"],
      });
    }
  }
}

/**
 * Invoice numbers are unique per user in the schema, so a collision is not a
 * judgement call: creating the record would fail. Skipping is the only safe
 * outcome, and the user is shown exactly which invoices were left alone.
 */
function dedupeInvoices(records: MigrationRecordIR[], workspace: WorkspaceIndex): void {
  const invoices = records.filter((record) => record.entity === "invoices" && record.status !== "error");
  const seenNumbers = new Map<string, MigrationRecordIR>();
  const seenExternal = new Map<string, MigrationRecordIR>();

  for (const record of [...invoices].sort(bySourceKey)) {
    const externalId = record.source.externalId;
    if (externalId) {
      const key = externalId.toLowerCase();
      const previous = seenExternal.get(key);
      if (previous) {
        markSkip(record, {
          scope: "batch", targetId: null, groupKey: previous.source.sourceKey,
          label: text(previous, "invoiceNumber"), confidence: 1,
          evidence: ["the same source invoice ID appears twice"],
        });
        continue;
      }
      seenExternal.set(key, record);
    }

    const number = text(record, "invoiceNumber").toLowerCase();
    if (!number) continue;

    const previous = seenNumbers.get(number);
    if (previous) {
      markSkip(record, {
        scope: "batch", targetId: null, groupKey: previous.source.sourceKey,
        label: text(previous, "invoiceNumber"), confidence: 1,
        evidence: ["this invoice number appears more than once in your files"],
      });
      continue;
    }
    seenNumbers.set(number, record);

    const existing = workspace.invoiceNumbers.get(number);
    if (existing) {
      markSkip(record, {
        scope: "workspace", targetId: existing.id, groupKey: null,
        label: existing.invoiceNumber, confidence: 1,
        evidence: ["an invoice with this number already exists in Rive"],
      });
    }
  }
}

/**
 * Expenses have no natural key. The composite of description, amount, and date
 * is strong but not conclusive — two identical purchases on one day are
 * plausible — so a match is raised for review rather than skipped.
 */
function dedupeExpenses(records: MigrationRecordIR[], workspace: WorkspaceIndex): void {
  const expenses = records.filter((record) => record.entity === "expenses" && record.status !== "error");
  const seenFingerprints = new Map<string, MigrationRecordIR>();
  const seenExternal = new Map<string, MigrationRecordIR>();

  for (const record of [...expenses].sort(bySourceKey)) {
    const externalId = record.source.externalId;
    if (externalId) {
      const key = externalId.toLowerCase();
      const previous = seenExternal.get(key);
      if (previous) {
        markSkip(record, {
          scope: "batch", targetId: null, groupKey: previous.source.sourceKey,
          label: text(previous, "description"), confidence: 1,
          evidence: ["the same transaction ID appears twice"],
        });
        continue;
      }
      seenExternal.set(key, record);
    }

    const amount = num(record, "amount");
    const description = text(record, "description");
    if (amount === null || !description) continue;
    const fingerprint = expenseFingerprint(description, amount, text(record, "date") || null);

    const previous = seenFingerprints.get(fingerprint);
    if (previous) {
      markReview(record, {
        scope: "batch", targetId: null, groupKey: previous.source.sourceKey,
        label: description, confidence: 0.85,
        evidence: ["an identical expense appears earlier in your files"],
      });
      continue;
    }
    seenFingerprints.set(fingerprint, record);

    const existing = workspace.expenseFingerprints.get(fingerprint);
    if (existing) {
      markReview(record, {
        scope: "workspace", targetId: existing.id, groupKey: null,
        label: existing.description, confidence: 0.85,
        evidence: ["an identical expense already exists in Rive"],
      });
    }
  }
}
