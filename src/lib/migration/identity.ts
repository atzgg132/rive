/**
 * Client identity resolution.
 *
 * The same business appears under different names in different exports:
 * "Acme Technologies Pvt Ltd" in the client list, "ACME" in the project sheet,
 * "Acme Technologies" on the invoices. Reconstructing that they are one client
 * is what turns four spreadsheets into a connected workspace.
 *
 * The rule that keeps this trustworthy: only *deterministic* keys merge records
 * automatically. Fuzzy similarity never merges anything — it only produces a
 * candidate the user is asked to confirm.
 */

import {
  companyComparisonForm,
  normalizeDisplayName,
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
import type { MigrationEntity } from "./types.ts";

/**
 * Consumer mailbox providers. Two clients sharing `gmail.com` are not related,
 * so the email *domain* signal must never fire for these.
 */
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.co.uk", "hotmail.com",
  "outlook.com", "live.com", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com",
  "proton.me", "protonmail.com", "zoho.com", "gmx.com", "mail.com", "yandex.com",
  "rediffmail.com", "fastmail.com", "hey.com",
]);

export type ClientMention = {
  /** Unique within a migration: a record's sourceKey, or a synthetic ref id. */
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  externalId: string | null;
  taxId: string | null;
  /** `record` = a row in a clients source. `reference` = a name on a project/invoice. */
  origin: "record" | "reference";
  /** Which source the mention came from, for the review UI. */
  fromEntity: MigrationEntity;
};

export type IdentityGroup = {
  groupKey: string;
  mentions: ClientMention[];
  /** The fullest name in the group, used as the display label. */
  displayName: string;
  /** Evidence that merged this group, strongest first. */
  evidence: string[];
  confidence: number;
};

export type IdentityIndex = {
  groups: Map<string, IdentityGroup>;
  groupKeyByMentionId: Map<string, string>;
};

function emailDomain(email: string | null): string | null {
  if (!email) return null;
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain || PUBLIC_EMAIL_DOMAINS.has(domain)) return null;
  return domain;
}

function websiteDomain(website: string | null): string | null {
  if (!website) return null;
  const match = website.toLowerCase().match(/^(?:https?:\/\/)?(?:www\.)?([^/\s:]+)/);
  const domain = match?.[1];
  if (!domain || !domain.includes(".") || PUBLIC_EMAIL_DOMAINS.has(domain)) return null;
  return domain;
}

function phoneDigits(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  // Compare the last 10 digits so "+91 98765 43210" and "098765 43210" agree
  // without a country code being invented for either.
  return digits.length >= 9 ? digits.slice(-10) : null;
}

/**
 * Deterministic keys for a mention, strongest first.
 *
 * Only these merge records. Their order is the precedence used when explaining
 * a match to the user.
 */
function strongKeys(mention: ClientMention): Array<{ key: string; evidence: string; weight: number }> {
  const keys: Array<{ key: string; evidence: string; weight: number }> = [];
  if (mention.externalId) {
    keys.push({ key: `external:${mention.externalId.toLowerCase()}`, evidence: "the same source ID", weight: 1 });
  }
  if (mention.taxId) {
    keys.push({ key: `tax:${mention.taxId.toLowerCase().replace(/\s/g, "")}`, evidence: "the same tax ID", weight: 1 });
  }
  if (mention.email) {
    keys.push({ key: `email:${mention.email.toLowerCase()}`, evidence: "the same email address", weight: 0.99 });
  }
  const name = companyComparisonForm(mention.name);
  if (name) {
    keys.push({ key: `name:${name}`, evidence: "an identical name once legal suffixes are ignored", weight: 0.93 });
  }
  return keys;
}

/** Weaker keys: corroborating evidence only, never a merge on their own. */
function supportingKeys(mention: ClientMention): Array<{ key: string; evidence: string }> {
  const keys: Array<{ key: string; evidence: string }> = [];
  const domain = emailDomain(mention.email) || websiteDomain(mention.website);
  if (domain) keys.push({ key: `domain:${domain}`, evidence: `the same web domain (${domain})` });
  const phone = phoneDigits(mention.phone);
  if (phone) keys.push({ key: `phone:${phone}`, evidence: "the same phone number" });
  return keys;
}

class UnionFind {
  private parent = new Map<string, string>();

  find(value: string): string {
    const parent = this.parent.get(value);
    if (parent === undefined) {
      this.parent.set(value, value);
      return value;
    }
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent.set(value, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }
}

/**
 * Group mentions that deterministically refer to the same client.
 *
 * Union happens on strong keys only. A group's confidence is the weight of the
 * weakest link that formed it, so a group merged purely on matching names is
 * reported less confidently than one merged on a shared email address.
 */
export function buildIdentityIndex(mentions: readonly ClientMention[]): IdentityIndex {
  const unionFind = new UnionFind();
  const byKey = new Map<string, { mentionIds: string[]; evidence: string; weight: number }>();

  for (const mention of mentions) {
    unionFind.find(mention.id);
    for (const { key, evidence, weight } of strongKeys(mention)) {
      const entry = byKey.get(key) || { mentionIds: [], evidence, weight };
      entry.mentionIds.push(mention.id);
      byKey.set(key, entry);
    }
  }

  const evidenceByRoot = new Map<string, Array<{ evidence: string; weight: number }>>();
  for (const entry of byKey.values()) {
    if (entry.mentionIds.length < 2) continue;
    const [first, ...rest] = entry.mentionIds;
    for (const other of rest) unionFind.union(first, other);
  }
  // Record evidence after all unions so it attaches to final roots.
  for (const entry of byKey.values()) {
    if (entry.mentionIds.length < 2) continue;
    const root = unionFind.find(entry.mentionIds[0]);
    const list = evidenceByRoot.get(root) || [];
    list.push({ evidence: entry.evidence, weight: entry.weight });
    evidenceByRoot.set(root, list);
  }

  const membersByRoot = new Map<string, ClientMention[]>();
  for (const mention of mentions) {
    const root = unionFind.find(mention.id);
    const list = membersByRoot.get(root) || [];
    list.push(mention);
    membersByRoot.set(root, list);
  }

  const groups = new Map<string, IdentityGroup>();
  const groupKeyByMentionId = new Map<string, string>();

  for (const [root, members] of membersByRoot) {
    const groupKey = stableGroupKey(members);
    const evidence = (evidenceByRoot.get(root) || []).sort((a, b) => b.weight - a.weight);
    groups.set(groupKey, {
      groupKey,
      mentions: members,
      displayName: chooseDisplayName(members),
      evidence: evidence.map((item) => item.evidence),
      // The weakest link determines how much a group can be trusted.
      confidence: evidence.length ? Math.min(...evidence.map((item) => item.weight)) : 1,
    });
    for (const member of members) groupKeyByMentionId.set(member.id, groupKey);
  }

  return { groups, groupKeyByMentionId };
}

/**
 * A group key that does not depend on iteration order, so the same upload
 * always produces the same keys — a prerequisite for a stable plan hash.
 */
function stableGroupKey(members: readonly ClientMention[]): string {
  const candidates = members.map((member) => `${companyComparisonForm(member.name)}|${member.email || ""}`);
  candidates.sort();
  return `g:${candidates[0]}`;
}

/**
 * Prefer the most complete name as the group's label: users recognise
 * "Acme Technologies Pvt Ltd" more readily than "ACME".
 */
function chooseDisplayName(members: readonly ClientMention[]): string {
  const records = members.filter((member) => member.origin === "record");
  const pool = records.length ? records : [...members];
  return normalizeDisplayName(
    pool
      .map((member) => member.name)
      .sort((a, b) => b.trim().length - a.trim().length || a.localeCompare(b))[0] || "",
  );
}

export type FuzzyIdentityMatch = {
  groupKey: string;
  displayName: string;
  confidence: number;
  evidence: string[];
};

/**
 * Find groups a free-text name probably refers to, without merging anything.
 *
 * The uniqueness bonus is the "cross-file contextual consistency" signal: a
 * name that resembles exactly one known client is far better evidence than one
 * that resembles three. Confidence stays capped below the auto-link threshold
 * so every fuzzy match still reaches the user for confirmation.
 */
export function findFuzzyIdentityMatches(
  name: string,
  index: IdentityIndex,
  supporting: { email?: string | null; phone?: string | null; website?: string | null } = {},
): FuzzyIdentityMatch[] {
  const cleaned = normalizeDisplayName(name);
  if (!cleaned) return [];

  const supportKeys = new Set(
    supportingKeys({
      id: "probe", name: cleaned, email: supporting.email || null, phone: supporting.phone || null,
      website: supporting.website || null, externalId: null, taxId: null, origin: "reference", fromEntity: "clients",
    }).map((item) => item.key),
  );

  const scored: FuzzyIdentityMatch[] = [];
  for (const group of index.groups.values()) {
    let best = 0;
    for (const mention of group.mentions) {
      const score = companySimilarity(cleaned, mention.name);
      if (score > best) best = score;
    }
    if (best < MATCH_THRESHOLDS.floor) continue;

    const evidence = [`the names are ${Math.round(best * 100)}% similar`];
    let confidence = best;

    // Corroborating identifiers lift a weak name match into a useful one.
    const groupSupport = new Set(group.mentions.flatMap((mention) => supportingKeys(mention).map((item) => item.key)));
    for (const key of supportKeys) {
      if (groupSupport.has(key)) {
        confidence = Math.min(0.95, confidence + 0.12);
        evidence.push(key.startsWith("domain:") ? `they share ${key.slice(7)}` : "they share a phone number");
      }
    }
    scored.push({ groupKey: group.groupKey, displayName: group.displayName, confidence, evidence });
  }

  scored.sort((a, b) => b.confidence - a.confidence);

  // Being the only plausible candidate is itself evidence.
  if (scored.length === 1 && scored[0].confidence >= MATCH_THRESHOLDS.floor) {
    scored[0] = {
      ...scored[0],
      confidence: Math.min(0.9, scored[0].confidence + 0.05),
      evidence: [...scored[0].evidence, "it is the only client with a similar name"],
    };
  }
  return scored.filter((match) => match.confidence >= MATCH_THRESHOLDS.fuzzyNameSuggest);
}

export { emailDomain, phoneDigits, websiteDomain, PUBLIC_EMAIL_DOMAINS };
