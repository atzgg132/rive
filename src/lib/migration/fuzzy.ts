/**
 * Deterministic string similarity.
 *
 * Hand-written rather than pulled from a dependency: the whole surface needed
 * is one edit-distance ratio and one token-set ratio, and a shared library
 * would still need this much wrapping to be conservative enough for merging
 * business records.
 *
 * Nothing here is ever sufficient on its own to merge two records. Callers in
 * `identity.ts` and `dedupe.ts` require corroborating evidence.
 */

import {
  companyComparisonForm,
  comparisonForm,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./normalize/text.ts";

/** Levenshtein distance with an early exit once the budget is exceeded. */
export function levenshtein(a: string, b: string, maxDistance = Infinity): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let previous = new Array<number>(b.length + 1);
  let current = new Array<number>(b.length + 1);
  for (let index = 0; index <= b.length; index += 1) previous[index] = index;

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMinimum = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, substitution);
      if (current[j] < rowMinimum) rowMinimum = current[j];
    }
    if (rowMinimum > maxDistance) return maxDistance + 1;
    const swap = previous;
    previous = current;
    current = swap;
  }
  return previous[b.length];
}

/** Edit distance expressed as a 0–1 similarity over the longer string. */
export function editRatio(a: string, b: string): number {
  if (!a && !b) return 1;
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}

function tokenize(value: string): string[] {
  return value.split(" ").filter(Boolean);
}

/**
 * Token-set similarity, tolerant of word order and of one name being a
 * shortened form of the other.
 *
 * "ACME" against "Acme Technologies" is the case that matters: every token of
 * the shorter name appears in the longer one. That earns a high but capped
 * score, because containment is weaker evidence than a true match — "Smith
 * Design" is contained in "Smith Design Group" and also in "Smith Designs Ltd".
 */
export function tokenSetRatio(a: string, b: string): number {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (!left.size || !right.size) return 0;

  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  if (intersection === 0) return 0;

  const smaller = Math.min(left.size, right.size);
  const larger = Math.max(left.size, right.size);
  const coverage = intersection / smaller;
  const jaccard = intersection / (left.size + right.size - intersection);

  if (coverage === 1 && smaller < larger) {
    // Full containment. Scale by how much of the longer name is accounted for
    // so "Acme" ⊂ "Acme Technologies" outranks "Acme" ⊂ "Acme Global Media Ltd".
    return 0.78 + 0.14 * (smaller / larger);
  }
  return jaccard;
}

/**
 * Overall similarity between two free-text names, in 0–1.
 *
 * Takes the strongest of edit-distance and token-set similarity: the two catch
 * different errors (typos versus abbreviation) and a weighted blend would
 * under-score both.
 */
export function stringSimilarity(a: string, b: string): number {
  const left = comparisonForm(a);
  const right = comparisonForm(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  return Math.max(editRatio(left, right), tokenSetRatio(left, right));
}

/**
 * Similarity between two company names, ignoring legal suffixes.
 *
 * "Acme Technologies Pvt Ltd" and "Acme Technologies" compare as identical
 * after suffix removal, which is the intended behaviour — but the caller still
 * sees this as fuzzy evidence, not as an identifier match.
 */
export function companySimilarity(a: string, b: string): number {
  const left = companyComparisonForm(a);
  const right = companyComparisonForm(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  return Math.max(editRatio(left, right), tokenSetRatio(left, right));
}

/**
 * Similarity between a source header and a canonical alias.
 *
 * Underscore-separated header tokens are compared as a set so `customer_email`
 * matches the alias `email` partially and `customer_email` exactly, while
 * `e_mail` still reaches `email` through edit distance.
 */
export function headerSimilarity(header: string, alias: string): number {
  if (header === alias) return 1;
  const headerTokens = header.split("_").filter(Boolean);
  const aliasTokens = alias.split("_").filter(Boolean);
  const joined = headerTokens.join(" ");
  const aliasJoined = aliasTokens.join(" ");
  if (joined === aliasJoined) return 1;

  const edit = editRatio(joined, aliasJoined);
  const token = tokenSetRatio(joined, aliasJoined);
  let score = Math.max(edit, token);

  // A header that ends with the alias ("customer_email" → "email") is a
  // qualified form of it and should score close to an exact match.
  if (headerTokens.length > aliasTokens.length && joined.endsWith(aliasJoined)) {
    score = Math.max(score, 0.9);
  }
  return score;
}
