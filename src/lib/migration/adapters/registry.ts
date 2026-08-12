/**
 * Adapter registry.
 *
 * Adding a vendor adapter later is a one-line change here plus a new module.
 * The pipeline resolves the adapter once per source and passes only its hint
 * index downstream, so no vendor code runs inside scoring, normalization,
 * validation, or commit.
 */

import {
  genericTabularAdapter,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./generic.ts";
import {
  buildHintIndex,
  type AdapterHintIndex,
  type SourceAdapter,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./types.ts";
import type { SourceProfile } from "../types.ts";

/**
 * Registered adapters, highest specificity first.
 *
 * Deliberately not populated with Zoho Books / QuickBooks / Bonsai / FreshBooks
 * / Xero adapters: V1 builds no vendor integrations. Their absence is the
 * point — the seam is proven by the generic adapter flowing through it.
 */
const ADAPTERS: SourceAdapter[] = [genericTabularAdapter];

export function listAdapters(): SourceAdapter[] {
  return [...ADAPTERS];
}

/** Pick the adapter that most confidently recognises this source. */
export function resolveAdapter(profile: SourceProfile): SourceAdapter {
  let best = genericTabularAdapter;
  let bestScore = -1;
  for (const adapter of ADAPTERS) {
    const score = adapter.detect(profile);
    if (score > bestScore) {
      bestScore = score;
      best = adapter;
    }
  }
  return best;
}

export function resolveHintIndex(profile: SourceProfile): AdapterHintIndex {
  return buildHintIndex(resolveAdapter(profile));
}

export { genericTabularAdapter };
