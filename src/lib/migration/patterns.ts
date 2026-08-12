/**
 * Deterministic value-pattern detectors.
 *
 * These are the engine's only source of truth about "what does this value look
 * like?". Profiling, field mapping, and normalization all call into here, so a
 * column can never be described one way while being converted another.
 */

// Deliberately conservative: it accepts real addresses and rejects prose that
// merely contains an "@". Full RFC 5322 acceptance is not the goal.
const EMAIL_PATTERN = /^[^\s@,;<>()[\]\\]+@[^\s@,;<>()[\]\\]+\.[a-z]{2,}$/i;
const URL_PATTERN = /^(https?:\/\/|www\.)[^\s]+\.[^\s]{2,}$/i;
// "paid" and "unpaid" are deliberately absent. They are invoice *statuses*, and
// treating them as booleans made status columns profile as yes/no data.
const BOOLEAN_TRUE = new Set(["true", "yes", "y", "1", "on", "t"]);
const BOOLEAN_FALSE = new Set(["false", "no", "n", "0", "off", "f"]);

/** Currency symbols mapped to the ISO code they unambiguously imply. */
const UNAMBIGUOUS_SYMBOLS: Record<string, string> = {
  "₹": "INR",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₽": "RUB",
  "₩": "KRW",
  "₪": "ILS",
  "₦": "NGN",
  "₫": "VND",
  "฿": "THB",
  "₱": "PHP",
  "₴": "UAH",
  "₺": "TRY",
};

/**
 * Symbols used by more than one currency. `$` is the important one: it belongs
 * to USD, CAD, AUD, SGD, HKD, NZD and more. The engine never resolves these on
 * its own — it asks.
 */
const AMBIGUOUS_SYMBOLS: Record<string, string[]> = {
  $: ["USD", "CAD", "AUD", "SGD", "HKD", "NZD", "MXN"],
  kr: ["SEK", "NOK", "DKK"],
};

/** Written currency prefixes seen in real exports, mapped to ISO codes. */
const CURRENCY_WORDS: Record<string, string> = {
  rs: "INR",
  "rs.": "INR",
  "rs/-": "INR",
  inr: "INR",
  rupees: "INR",
  usd: "USD",
  "us$": "USD",
  dollars: "USD",
  eur: "EUR",
  euro: "EUR",
  euros: "EUR",
  gbp: "GBP",
  pounds: "GBP",
  aed: "AED",
  cad: "CAD",
  aud: "AUD",
  sgd: "SGD",
  jpy: "JPY",
  chf: "CHF",
  zar: "ZAR",
};

export function isEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length <= 254 && EMAIL_PATTERN.test(trimmed);
}

export function isUrl(value: string): boolean {
  return URL_PATTERN.test(value.trim());
}

/**
 * Phone detection without inventing a country. We require enough digits to be
 * a real number and reject anything carrying letters or decimal structure,
 * which keeps amounts and invoice ids out.
 */
export function isPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /[a-z]/i.test(trimmed)) return false;
  if (!/^[+()\d][\d\s\-().+]*$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  // A bare decimal such as "1234.56" is money, not a phone number.
  return !/\d[.,]\d{1,2}$/.test(trimmed);
}

export function parseBoolean(value: string): boolean | null {
  const key = value.trim().toLowerCase();
  if (BOOLEAN_TRUE.has(key)) return true;
  if (BOOLEAN_FALSE.has(key)) return false;
  return null;
}

export function isBooleanLike(value: string): boolean {
  return parseBoolean(value) !== null;
}

/**
 * Identifier likelihood: invoice numbers, transaction ids, SKUs.
 *
 * The shape that matters is a short token mixing letters/separators with
 * digits ("INV-001", "2026/044"), or a long pure-digit run that is clearly a
 * reference rather than an amount.
 */
export function isIdentifierLike(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64 || /\s{2,}/.test(trimmed)) return false;
  if (isEmail(trimmed) || isUrl(trimmed)) return false;
  if (/^-?\d{1,3}([,.]\d{3})*([.,]\d{1,2})?$/.test(trimmed)) return false; // formatted money
  if (/^[A-Za-z0-9]+[-_/#][A-Za-z0-9-_/#]*\d+$/.test(trimmed)) return true;
  if (/^[A-Za-z]{1,6}\d{2,}$/.test(trimmed)) return true;
  if (/^\d{6,}$/.test(trimmed)) return true;
  return false;
}

export type MoneyParse = {
  amount: number;
  /** ISO code when it could be determined without guessing, else null. */
  currency: string | null;
  /** The raw symbol or word found, for explaining the decision to the user. */
  symbol: string | null;
  /** Candidate ISO codes when the symbol is shared by several currencies. */
  ambiguousCurrencies: string[];
  negative: boolean;
};

/**
 * Parse a monetary value across the formats real exports produce.
 *
 * Handles `1,000.50`, `1.000,50`, `1 000,50`, `₹1,000`, `$1,000`, `Rs. 1,000`,
 * `INR 1000`, `(500)` for negatives, and trailing minus signs. Returns null
 * rather than a zero when the value is not money at all — a silent zero would
 * become a real invoice total.
 */
export function parseMoney(value: string): MoneyParse | null {
  const original = value.trim();
  if (!original) return null;

  let working = original;
  let negative = false;

  // Accountancy parentheses: (1,200.00) means -1200.00
  if (/^\(.*\)$/.test(working)) {
    negative = true;
    working = working.slice(1, -1).trim();
  }

  let symbol: string | null = null;
  let currency: string | null = null;
  let ambiguousCurrencies: string[] = [];

  // ISO code or written currency, leading or trailing.
  const wordMatch = working.match(/^([A-Za-z$₹€£¥.]{1,8})\s*[\s.]?\s*(?=[\d(+-])|(?<=[\d)])\s*([A-Za-z]{2,8})$/);
  if (wordMatch) {
    const token = (wordMatch[1] || wordMatch[2] || "").trim().toLowerCase().replace(/\s+/g, "");
    const mapped = CURRENCY_WORDS[token] || CURRENCY_WORDS[token.replace(/\.$/, "")];
    if (mapped) {
      currency = mapped;
      symbol = (wordMatch[1] || wordMatch[2] || "").trim();
    }
  }

  for (const [candidate, iso] of Object.entries(UNAMBIGUOUS_SYMBOLS)) {
    if (working.includes(candidate)) {
      symbol = candidate;
      currency = iso;
      break;
    }
  }
  if (!currency) {
    for (const [candidate, options] of Object.entries(AMBIGUOUS_SYMBOLS)) {
      if (working.toLowerCase().includes(candidate)) {
        symbol = candidate;
        ambiguousCurrencies = options;
        break;
      }
    }
  }
  if (!currency && !ambiguousCurrencies.length) {
    const isoMatch = working.match(/\b([A-Z]{3})\b/);
    if (isoMatch && CURRENCY_WORDS[isoMatch[1].toLowerCase()]) {
      currency = CURRENCY_WORDS[isoMatch[1].toLowerCase()];
      symbol = isoMatch[1];
    }
  }

  // Strip everything that is not part of the number itself.
  let numeric = working.replace(/[^\d.,\-+\s]/g, "").trim();
  if (/-\s*$/.test(numeric)) {
    negative = true;
    numeric = numeric.replace(/-\s*$/, "").trim();
  }
  if (/^-/.test(numeric)) {
    negative = true;
    numeric = numeric.replace(/^-/, "").trim();
  }
  numeric = numeric.replace(/^\+/, "").replace(/\s/g, "");
  if (!numeric || !/\d/.test(numeric)) return null;

  numeric = normalizeDecimalSeparators(numeric);
  if (numeric === null) return null;
  const amount = Number(numeric);
  if (!Number.isFinite(amount)) return null;

  return {
    amount: negative ? -Math.abs(amount) : amount,
    currency,
    symbol,
    ambiguousCurrencies,
    negative,
  };
}

/**
 * Work out which separator is the decimal point.
 *
 * `1,234.56` and `1.234,56` are the same amount written by different locales.
 * The rule used here: whichever separator appears last is the decimal one, and
 * a lone separator followed by exactly three digits is a thousands group.
 */
function normalizeDecimalSeparators(input: string): string {
  const lastComma = input.lastIndexOf(",");
  const lastDot = input.lastIndexOf(".");

  if (lastComma === -1 && lastDot === -1) return input;

  if (lastComma > -1 && lastDot > -1) {
    return lastComma > lastDot
      ? input.replace(/\./g, "").replace(",", ".")
      : input.replace(/,/g, "");
  }

  const separator = lastComma > -1 ? "," : ".";
  const index = lastComma > -1 ? lastComma : lastDot;
  const decimals = input.length - index - 1;
  const occurrences = input.split(separator).length - 1;

  // "1.234" / "1,234" with one separator and 3 trailing digits is a thousands
  // group; "1.23" is a decimal. Multiple separators are always grouping.
  if (occurrences > 1) return input.split(separator).join("");
  if (decimals === 3 && index > 0) return input.split(separator).join("");
  return separator === "," ? input.replace(",", ".") : input;
}

export function containsCurrencyMarker(value: string): boolean {
  const lower = value.toLowerCase();
  if (Object.keys(UNAMBIGUOUS_SYMBOLS).some((symbol) => value.includes(symbol))) return true;
  if (Object.keys(AMBIGUOUS_SYMBOLS).some((symbol) => lower.includes(symbol))) return true;
  return Object.keys(CURRENCY_WORDS).some((word) => new RegExp(`(^|[^a-z])${escapeRegExp(word)}([^a-z]|$)`, "i").test(lower));
}

/** Resolve a bare currency token ("Rs/-", "inr", "₹") to an ISO code. */
export function currencyTokenToIso(value: string): { currency: string | null; ambiguous: string[] } {
  const trimmed = value.trim();
  if (!trimmed) return { currency: null, ambiguous: [] };
  const lower = trimmed.toLowerCase();
  if (UNAMBIGUOUS_SYMBOLS[trimmed]) return { currency: UNAMBIGUOUS_SYMBOLS[trimmed], ambiguous: [] };
  if (CURRENCY_WORDS[lower]) return { currency: CURRENCY_WORDS[lower], ambiguous: [] };
  if (/^[A-Za-z]{3}$/.test(trimmed)) return { currency: trimmed.toUpperCase(), ambiguous: [] };
  if (AMBIGUOUS_SYMBOLS[lower]) return { currency: null, ambiguous: AMBIGUOUS_SYMBOLS[lower] };
  const stripped = lower.replace(/[^a-z$₹€£¥]/g, "");
  if (CURRENCY_WORDS[stripped]) return { currency: CURRENCY_WORDS[stripped], ambiguous: [] };
  if (AMBIGUOUS_SYMBOLS[stripped]) return { currency: null, ambiguous: AMBIGUOUS_SYMBOLS[stripped] };
  for (const [symbol, iso] of Object.entries(UNAMBIGUOUS_SYMBOLS)) {
    if (trimmed.includes(symbol)) return { currency: iso, ambiguous: [] };
  }
  return { currency: null, ambiguous: [] };
}

export function isNumeric(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isEmail(trimmed) || isUrl(trimmed)) return false;
  return /^[-+(]?\d[\d\s,.]*\)?$/.test(trimmed) && /\d/.test(trimmed);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const CURRENCY_SYMBOL_TABLE = {
  unambiguous: UNAMBIGUOUS_SYMBOLS,
  ambiguous: AMBIGUOUS_SYMBOLS,
  words: CURRENCY_WORDS,
};
