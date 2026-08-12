/**
 * Relationship reconstruction across every uploaded source.
 *
 * This runs once, after all files are parsed, which is why upload order does
 * not matter: an invoice can reference a client that appears in a file read
 * later, or in no file at all.
 *
 * Resolution precedence, strongest first:
 *   1. an existing workspace record matched on a strong key  → link
 *   2. an identity group formed from deterministic keys      → link
 *   3. a fuzzy name match                                    → review
 *   4. nothing                                               → create or review
 *
 * Steps 1 and 2 resolve automatically. Step 3 never does.
 */

import {
  buildIdentityIndex,
  findFuzzyIdentityMatches,
  type ClientMention,
  type IdentityIndex,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./identity.ts";
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
import type { WorkspaceIndex } from "./workspace.ts";
import type { MigrationEntity, MigrationRecordIR, RelationshipCandidate } from "./types.ts";

function text(record: MigrationRecordIR, key: string): string {
  const value = record.normalized[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Gather every mention of a client across all sources: rows in a clients file,
 * plus the client named on each project, invoice, and (indirectly) expense.
 */
export function collectClientMentions(records: readonly MigrationRecordIR[]): ClientMention[] {
  const mentions: ClientMention[] = [];
  for (const record of records) {
    if (record.entity === "clients") {
      const name = text(record, "name");
      if (!name) continue;
      mentions.push({
        id: record.source.sourceKey,
        name,
        email: text(record, "email") || null,
        phone: text(record, "phone") || null,
        website: text(record, "website") || null,
        externalId: record.source.externalId,
        taxId: null,
        origin: "record",
        fromEntity: "clients",
      });
      continue;
    }

    if (record.entity === "projects" || record.entity === "invoices") {
      const name = text(record, "clientRef");
      const email = text(record, "clientEmailRef");
      if (!name && !email) continue;
      mentions.push({
        id: `${record.source.sourceKey}#clientRef`,
        // An email with no name still identifies a client; the local part is a
        // reasonable provisional label until the user sees it.
        name: name || email.split("@")[0],
        email: email || null,
        phone: null,
        website: null,
        externalId: null,
        taxId: null,
        origin: "reference",
        fromEntity: record.entity,
      });
    }
  }
  return mentions;
}

export type RelationshipResolution = {
  index: IdentityIndex;
  /** Groups that exist only because an invoice or project named them. */
  referenceOnlyGroups: Set<string>;
};

/**
 * Resolve a client reference for one record.
 *
 * Returns the candidates found, plus the resolution when one is safe to apply.
 */
function resolveClientReference(
  record: MigrationRecordIR,
  index: IdentityIndex,
  workspace: WorkspaceIndex,
): { candidates: RelationshipCandidate[]; resolved: RelationshipCandidate | null } {
  const name = text(record, "clientRef");
  const email = text(record, "clientEmailRef");
  if (!name && !email) return { candidates: [], resolved: null };

  const candidates: RelationshipCandidate[] = [];

  // 1. An existing workspace client matched on a strong key.
  const existingByEmail = email ? workspace.clientsByEmail.get(email.toLowerCase()) : undefined;
  if (existingByEmail) {
    const candidate: RelationshipCandidate = {
      field: "clientId",
      targetEntity: "clients",
      groupKey: null,
      existingId: existingByEmail.id,
      label: existingByEmail.name,
      confidence: 0.99,
      evidence: ["an existing client has the same email address"],
    };
    return { candidates: [candidate], resolved: candidate };
  }

  const nameKey = companyComparisonForm(name);
  const existingByName = nameKey ? workspace.clientsByName.get(nameKey) : undefined;
  if (existingByName) {
    const candidate: RelationshipCandidate = {
      field: "clientId",
      targetEntity: "clients",
      groupKey: null,
      existingId: existingByName.id,
      label: existingByName.name,
      confidence: 0.93,
      evidence: ["an existing client has an identical name"],
    };
    return { candidates: [candidate], resolved: candidate };
  }

  // 2. An identity group built from this migration's own deterministic keys.
  const mentionId = `${record.source.sourceKey}#clientRef`;
  const groupKey = index.groupKeyByMentionId.get(mentionId);
  if (groupKey) {
    const group = index.groups.get(groupKey);
    // A group containing an actual client row is a real link. A group holding
    // only this one reference is not evidence of anything yet.
    const hasRecord = group?.mentions.some((mention) => mention.origin === "record");
    const sharesWithOthers = (group?.mentions.length || 0) > 1;
    if (group && (hasRecord || sharesWithOthers)) {
      const candidate: RelationshipCandidate = {
        field: "clientId",
        targetEntity: "clients",
        groupKey,
        existingId: null,
        label: group.displayName,
        confidence: group.confidence,
        evidence: group.evidence.length ? group.evidence : ["the same client name appears in more than one file"],
      };
      return { candidates: [candidate], resolved: candidate };
    }
  }

  // 3. Fuzzy matches against existing workspace clients and imported groups.
  for (const existing of workspace.snapshot.clients) {
    const score = companySimilarity(name || email, existing.name);
    if (score >= MATCH_THRESHOLDS.fuzzyNameSuggest && score < 1) {
      candidates.push({
        field: "clientId",
        targetEntity: "clients",
        groupKey: null,
        existingId: existing.id,
        label: existing.name,
        confidence: Math.min(0.9, score),
        evidence: [`an existing client's name is ${Math.round(score * 100)}% similar`],
      });
    }
  }
  for (const match of findFuzzyIdentityMatches(name || email, index, { email })) {
    const group = index.groups.get(match.groupKey);
    if (!group?.mentions.some((mention) => mention.origin === "record")) continue;
    if (group.mentions.some((mention) => mention.id === mentionId)) continue;
    candidates.push({
      field: "clientId",
      targetEntity: "clients",
      groupKey: match.groupKey,
      existingId: null,
      label: match.displayName,
      confidence: match.confidence,
      evidence: match.evidence,
    });
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  // Fuzzy evidence never resolves on its own, however high it scores.
  return { candidates: candidates.slice(0, 4), resolved: null };
}

function resolveProjectReference(
  record: MigrationRecordIR,
  projectsByName: Map<string, { key: string; label: string }>,
  workspace: WorkspaceIndex,
): { candidates: RelationshipCandidate[]; resolved: RelationshipCandidate | null } {
  const title = text(record, "projectRef");
  if (!title) return { candidates: [], resolved: null };
  const key = companyComparisonForm(title);

  const existing = workspace.projectsByName.get(key);
  if (existing) {
    const candidate: RelationshipCandidate = {
      field: "projectId",
      targetEntity: "projects",
      groupKey: null,
      existingId: existing.id,
      label: existing.title,
      confidence: 0.93,
      evidence: ["an existing project has an identical name"],
    };
    return { candidates: [candidate], resolved: candidate };
  }

  const imported = projectsByName.get(key);
  if (imported) {
    const candidate: RelationshipCandidate = {
      field: "projectId",
      targetEntity: "projects",
      groupKey: imported.key,
      existingId: null,
      label: imported.label,
      confidence: 0.95,
      evidence: ["a project with this exact name is being imported"],
    };
    return { candidates: [candidate], resolved: candidate };
  }

  const candidates: RelationshipCandidate[] = [];
  for (const [candidateKey, candidate] of projectsByName) {
    const score = companySimilarity(key, candidateKey);
    if (score >= MATCH_THRESHOLDS.fuzzyNameSuggest && score < 1) {
      candidates.push({
        field: "projectId",
        targetEntity: "projects",
        groupKey: candidate.key,
        existingId: null,
        label: candidate.label,
        confidence: Math.min(0.9, score),
        evidence: [`an imported project's name is ${Math.round(score * 100)}% similar`],
      });
    }
  }
  for (const project of workspace.snapshot.projects) {
    const score = companySimilarity(title, project.title);
    if (score >= MATCH_THRESHOLDS.fuzzyNameSuggest && score < 1) {
      candidates.push({
        field: "projectId",
        targetEntity: "projects",
        groupKey: null,
        existingId: project.id,
        label: project.title,
        confidence: Math.min(0.9, score),
        evidence: [`an existing project's name is ${Math.round(score * 100)}% similar`],
      });
    }
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  return { candidates: candidates.slice(0, 4), resolved: null };
}

/**
 * Reconstruct every relationship in the migration.
 *
 * Mutates records in place with `groupKey`, `relationshipCandidates` and
 * `resolvedRelationships`, and returns the identity index for later use by
 * deduplication and plan building.
 */
export function resolveRelationships(
  records: MigrationRecordIR[],
  workspace: WorkspaceIndex,
): RelationshipResolution {
  const mentions = collectClientMentions(records);
  const index = buildIdentityIndex(mentions);

  // Imported projects, indexed by normalized title, so invoices and expenses
  // can attach to a project defined in a different file.
  const projectsByName = new Map<string, { key: string; label: string }>();
  for (const record of records) {
    if (record.entity !== "projects") continue;
    const title = text(record, "title");
    if (!title) continue;
    const key = companyComparisonForm(title);
    if (key && !projectsByName.has(key)) {
      projectsByName.set(key, { key: record.source.sourceKey, label: title });
    }
  }

  const referenceOnlyGroups = new Set<string>();
  for (const [groupKey, group] of index.groups) {
    if (!group.mentions.some((mention) => mention.origin === "record")) referenceOnlyGroups.add(groupKey);
  }

  for (const record of records) {
    if (record.entity === "clients") {
      record.groupKey = index.groupKeyByMentionId.get(record.source.sourceKey) || null;
      continue;
    }

    if (record.entity === "projects" || record.entity === "invoices") {
      const { candidates, resolved } = resolveClientReference(record, index, workspace);
      record.relationshipCandidates.push(...candidates);
      if (resolved) {
        record.resolvedRelationships.clientId = {
          groupKey: resolved.groupKey,
          existingId: resolved.existingId,
          confidence: resolved.confidence,
        };
      }
    }

    if (record.entity === "invoices" || record.entity === "expenses") {
      const { candidates, resolved } = resolveProjectReference(record, projectsByName, workspace);
      record.relationshipCandidates.push(...candidates);
      if (resolved) {
        record.resolvedRelationships.projectId = {
          groupKey: resolved.groupKey,
          existingId: resolved.existingId,
          confidence: resolved.confidence,
        };
      }
    }
  }

  return { index, referenceOnlyGroups };
}

/**
 * Client records implied by invoices or projects that named a client no file
 * describes.
 *
 * Spec-critical behaviour: a migration containing only invoices can still
 * reconstruct its clients, but only from information the source actually
 * carried. Nothing is invented — a client created this way has a name, and an
 * email only if the invoice supplied one.
 */
export function deriveImpliedClients(
  records: readonly MigrationRecordIR[],
  resolution: RelationshipResolution,
): MigrationRecordIR[] {
  const derived = new Map<string, MigrationRecordIR>();

  for (const groupKey of resolution.referenceOnlyGroups) {
    const group = resolution.index.groups.get(groupKey);
    if (!group) continue;

    const source = group.mentions[0];
    const owner = records.find((record) => source.id.startsWith(record.source.sourceKey));
    if (!owner) continue;

    // If the reference already has plausible matches, creating a new client
    // would quietly answer the very question the user should be asked. An
    // invoice naming "ACME" beside a client list containing "Acme Technologies
    // Pvt Ltd" must surface as a merge decision, not become a second client.
    const owners = group.mentions
      .map((mention) => records.find((record) => mention.id.startsWith(record.source.sourceKey)))
      .filter((record): record is MigrationRecordIR => Boolean(record));
    if (owners.some((record) => record.relationshipCandidates.length > 0)) continue;

    const email = group.mentions.find((mention) => mention.email)?.email || null;
    const normalized: Record<string, unknown> = { name: group.displayName };
    if (email) normalized.email = email;

    derived.set(groupKey, {
      entity: "clients",
      source: {
        sourceId: owner.source.sourceId,
        fileName: owner.source.fileName,
        sheetName: owner.source.sheetName,
        sourceRow: owner.source.sourceRow,
        sourceKey: `derived:client:${groupKey}`,
        externalId: null,
      },
      // Provenance for a derived record is the columns it came from, not a row
      // of its own, so the raw payload records exactly that.
      raw: { name: group.displayName, ...(email ? { email } : {}) },
      normalized,
      fieldMappings: {},
      confidence: group.confidence,
      warnings: [
        {
          code: "CLIENT_DERIVED",
          severity: "warning",
          message: `${group.displayName} was created from ${describeOrigin(group.mentions[0].fromEntity)} because no client file described them.`,
        },
      ],
      errors: [],
      relationshipCandidates: [],
      resolvedRelationships: {},
      duplicateCandidates: [],
      groupKey,
      status: "ready",
      action: "create",
    });
  }

  return [...derived.values()];
}

function describeOrigin(entity: MigrationEntity): string {
  return entity === "invoices" ? "your invoices" : entity === "projects" ? "your projects" : "your files";
}
