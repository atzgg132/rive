export type NormalizedEmailAddress = string & { readonly __brand: "NormalizedEmailAddress" };

export type EmailAddressParseResult =
  | { ok: true; value: NormalizedEmailAddress }
  | { ok: false; reason: "missing" | "too_long" | "invalid_format" };

const MAX_EMAIL_LENGTH = 254;
const MIN_EMAIL_LENGTH = 3;
const MAX_LOCAL_LENGTH = 64;
const MAX_DOMAIN_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;

const LOCAL_PART_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const LABEL_PATTERN = /^[a-z0-9-]+$/;
const LETTER_TLD_PATTERN = /^[a-z]{2,63}$/;
const PUNYCODE_TLD_PATTERN = /^xn--[a-z0-9-]{1,59}$/;

function invalidFormat(): EmailAddressParseResult {
  return { ok: false, reason: "invalid_format" };
}

export function parseEmailAddress(value: unknown): EmailAddressParseResult {
  if (typeof value !== "string") return { ok: false, reason: "missing" };
  const normalized = value.trim().toLowerCase();
  if (!normalized) return { ok: false, reason: "missing" };
  if (normalized.length > MAX_EMAIL_LENGTH) return { ok: false, reason: "too_long" };
  if (normalized.length < MIN_EMAIL_LENGTH) return invalidFormat();

  const at = normalized.indexOf("@");
  if (at === -1 || at !== normalized.lastIndexOf("@")) return invalidFormat();
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!local || !domain) return invalidFormat();
  if (local.length > MAX_LOCAL_LENGTH) return { ok: false, reason: "too_long" };
  if (domain.length > MAX_DOMAIN_LENGTH) return { ok: false, reason: "too_long" };

  if (!LOCAL_PART_PATTERN.test(local)) return invalidFormat();
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return invalidFormat();

  const labels = domain.split(".");
  if (labels.length < 2) return invalidFormat();
  for (const label of labels) {
    if (!label || label.length > MAX_LABEL_LENGTH) return invalidFormat();
    if (!LABEL_PATTERN.test(label)) return invalidFormat();
    if (label.startsWith("-") || label.endsWith("-")) return invalidFormat();
  }
  const topLevel = labels[labels.length - 1];
  if (!LETTER_TLD_PATTERN.test(topLevel) && !PUNYCODE_TLD_PATTERN.test(topLevel)) return invalidFormat();

  return { ok: true, value: normalized as NormalizedEmailAddress };
}

export function normalizeEmailAddress(value: unknown): NormalizedEmailAddress | null {
  const parsed = parseEmailAddress(value);
  return parsed.ok ? parsed.value : null;
}

export function isValidEmailAddress(value: unknown): boolean {
  return parseEmailAddress(value).ok;
}
