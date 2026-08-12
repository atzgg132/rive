/**
 * Source adapter interface.
 *
 * V1 ships one adapter (`GenericTabularAdapter`) because generic rules are
 * sufficient for ordinary CSV/XLSX exports. The interface exists now so that
 * vendor knowledge can be added later without touching the pipeline: an
 * adapter may only *contribute signals*, never write records or override a
 * validation rule.
 *
 * Vendor rules are kept strictly separate from generic rules. A Zoho-specific
 * alias must not leak into the generic scorer, or every source would slowly
 * inherit every vendor's quirks.
 */

import type {
  MigrationEntity,
  SourceClassification,
  SourceProfile,
} from "../types.ts";

/** A vendor's own name for a canonical field, e.g. "Customer Name" → name. */
export type HeaderAlias = {
  /** Normalized source header this adapter recognises. */
  header: string;
  entity: MigrationEntity;
  /** Canonical field key from `fields.ts`. */
  target: string;
};

/** A vendor's status vocabulary mapped onto Rive's. */
export type StatusAlias = {
  entity: MigrationEntity;
  /** Lowercased source status. */
  from: string;
  /** Canonical Rive status. */
  to: string;
};

export type RelationshipHint = {
  entity: MigrationEntity;
  /** Column whose value identifies a record in `targetEntity`. */
  column: string;
  targetEntity: MigrationEntity;
  /** True when the column holds a vendor primary key rather than a name. */
  isForeignKey: boolean;
};

export type SourceAdapter = {
  id: string;
  label: string;
  /**
   * Confidence in 0–1 that this adapter's vendor produced the source. The
   * generic adapter always returns a low non-zero score so it wins only when
   * no vendor adapter recognises the export.
   */
  detect: (profile: SourceProfile) => number;
  /**
   * Vendor-specific classification. Returning null defers to the generic
   * classifier rather than forcing a guess.
   */
  classify: (profile: SourceProfile) => { classification: SourceClassification; confidence: number; reason: string } | null;
  provideHeaderAliases: () => HeaderAlias[];
  normalizeStatuses: () => StatusAlias[];
  /** Columns that carry a stable vendor id for the record itself. */
  identifyExternalIds: (entity: MigrationEntity) => string[];
  provideRelationshipHints: () => RelationshipHint[];
};

/** Adapter-derived signal for one (header, entity, field) combination. */
export type AdapterHintIndex = {
  adapterId: string;
  headerAliases: Map<string, Map<MigrationEntity, string>>;
  statusAliases: Map<string, string>;
  relationshipHints: RelationshipHint[];
};

export function buildHintIndex(adapter: SourceAdapter): AdapterHintIndex {
  const headerAliases = new Map<string, Map<MigrationEntity, string>>();
  for (const alias of adapter.provideHeaderAliases()) {
    const byEntity = headerAliases.get(alias.header) || new Map<MigrationEntity, string>();
    byEntity.set(alias.entity, alias.target);
    headerAliases.set(alias.header, byEntity);
  }
  const statusAliases = new Map<string, string>();
  for (const alias of adapter.normalizeStatuses()) {
    statusAliases.set(`${alias.entity}:${alias.from.toLowerCase()}`, alias.to);
  }
  return {
    adapterId: adapter.id,
    headerAliases,
    statusAliases,
    relationshipHints: adapter.provideRelationshipHints(),
  };
}
