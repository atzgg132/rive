/**
 * The generic tabular adapter — the only adapter V1 needs.
 *
 * It contributes no vendor-specific knowledge on purpose. All of its behaviour
 * comes from the canonical field catalogue and the generic scorer, so a plain
 * CSV export from any tool is handled by the same code path. Vendor adapters
 * added later sit alongside this one and are selected by `detect()`.
 */

import type { SourceAdapter } from "./types.ts";

export const genericTabularAdapter: SourceAdapter = {
  id: "generic_tabular",
  label: "CSV or spreadsheet export",
  // Low but non-zero: any future vendor adapter that recognises its own export
  // outranks the generic path, and nothing ever falls through unhandled.
  detect: () => 0.1,
  classify: () => null,
  provideHeaderAliases: () => [],
  normalizeStatuses: () => [],
  identifyExternalIds: () => [],
  provideRelationshipHints: () => [],
};
