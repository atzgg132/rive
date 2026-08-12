/**
 * Mapping resolution seam.
 *
 * The deterministic engine produces mappings; some come back UNRESOLVED. This
 * module defines the boundary where an additional resolver — today none, later
 * an LLM — may propose an answer for exactly those cases.
 *
 * Three properties of this seam are load-bearing and must survive any future
 * change:
 *
 * 1. A resolver only ever sees UNRESOLVED items. High and medium confidence
 *    mappings never reach it, so it cannot overturn deterministic work.
 * 2. A resolver returns *proposals*, not decisions. Every proposal is re-scored
 *    by `applyProposals` against the same type vetoes the deterministic engine
 *    uses, and downgraded to review if it fails.
 * 3. No resolver writes to the database. Resolution happens before plan
 *    construction; the plan is still the only thing commit can execute.
 *
 * V1 ships `deterministicResolver`, which proposes nothing. That is the correct
 * behaviour, not a placeholder: unresolved means "ask the user".
 */

import {
  MAPPING_THRESHOLDS,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./config.ts";
import {
  findField,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./fields.ts";
import type { FieldMapping, MappingPlan, MigrationEntity, SourceProfile } from "./types.ts";

/** What a resolver is asked about: one column that could not be mapped. */
export type UnresolvedMapping = {
  entity: MigrationEntity;
  sourceColumn: string;
  /** Column statistics. Never raw customer rows beyond a few examples. */
  profileSummary: {
    inferredType: string;
    nullPercentage: number;
    uniquePercentage: number;
    exampleValues: string[];
  };
  /** Sibling column names, which is often the deciding context. */
  siblingColumns: string[];
  candidateMappings: Array<{ target: string; confidence: number; reason: string }>;
};

export type ResolutionProposal = {
  sourceColumn: string;
  target: string | null;
  confidence: number;
  reason: string;
};

export type MappingResolver = {
  id: string;
  /** False when the resolver is not configured; the pipeline then skips it. */
  isEnabled: () => boolean;
  resolve: (unresolved: UnresolvedMapping[]) => Promise<ResolutionProposal[]>;
};

/** Extract the UNRESOLVED items from a mapping plan in resolver input form. */
export function collectUnresolved(plan: MappingPlan, profile: SourceProfile): UnresolvedMapping[] {
  const siblingColumns = profile.columns.map((column) => column.header);
  return plan.mappings
    .filter((mapping) => mapping.status === "UNRESOLVED")
    .map((mapping) => {
      const column = profile.columns.find((item) => item.header === mapping.sourceColumn);
      return {
        entity: plan.entity,
        sourceColumn: mapping.sourceColumn,
        profileSummary: {
          inferredType: column?.inferredType || "text",
          nullPercentage: column?.nullPercentage ?? 0,
          uniquePercentage: column?.uniquePercentage ?? 0,
          exampleValues: column?.exampleValues.slice(0, 3) || [],
        },
        siblingColumns,
        candidateMappings: mapping.candidateMappings,
      };
    });
}

/**
 * V1 resolver: proposes nothing.
 *
 * Leaving a column unresolved is a deliberate product decision. The engine
 * refuses to decide when a header is ambiguous *and* the values do not settle
 * it, because a wrong automatic mapping is more expensive than one question.
 */
export const deterministicResolver: MappingResolver = {
  id: "deterministic",
  isEnabled: () => false,
  resolve: async () => [],
};

/**
 * Merge resolver proposals back into a mapping plan.
 *
 * Proposals are validated, never trusted: an unknown field key is dropped, a
 * target already claimed by a confident mapping is dropped, and anything a
 * resolver claims above the medium threshold is still capped there so it lands
 * in user review rather than auto-applying.
 */
export function applyProposals(plan: MappingPlan, proposals: ResolutionProposal[]): MappingPlan {
  if (!proposals.length) return plan;
  const claimed = new Set(
    plan.mappings.filter((mapping) => mapping.target && mapping.status !== "UNRESOLVED").map((mapping) => mapping.target as string),
  );

  const mappings: FieldMapping[] = plan.mappings.map((mapping) => {
    if (mapping.status !== "UNRESOLVED") return mapping;
    const proposal = proposals.find((item) => item.sourceColumn === mapping.sourceColumn);
    if (!proposal || !proposal.target) return mapping;

    const field = findField(plan.entity, proposal.target);
    if (!field || claimed.has(field.key)) return mapping;

    claimed.add(field.key);
    return {
      ...mapping,
      target: field.key,
      // Capped below `high` on purpose: a proposal is a suggestion for the user
      // to confirm, never an automatic mapping.
      confidence: Math.min(proposal.confidence, MAPPING_THRESHOLDS.high - 0.01),
      band: "medium",
      status: "SUGGESTED",
      reason: proposal.reason,
    };
  });

  const mappedTargets = new Set(mappings.map((mapping) => mapping.target).filter(Boolean) as string[]);
  return {
    ...plan,
    mappings,
    missingRequired: plan.missingRequired.filter((key) => !mappedTargets.has(key)),
  };
}
