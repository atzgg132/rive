/**
 * Monetary and currency normalization.
 *
 * Two rules the product depends on:
 *
 * 1. Historical amounts are never converted. An invoice raised in EUR stays an
 *    EUR invoice; migration is not a reporting layer and must not silently
 *    restate the past at today's rate.
 * 2. Currency is resolved from evidence in a fixed order, and an ambiguous
 *    symbol is never guessed. `$` is not USD merely because most users are, and
 *    INR is not assumed because the workspace is Indian.
 */

import {
  currencyTokenToIso,
  parseMoney,
  type MoneyParse,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "../patterns.ts";
import {
  MAX_MONETARY_VALUE,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "../domain-vocabulary.ts";
import type { CurrencySource } from "../config.ts";

export type AmountResolution = {
  /** Rounded to the two decimal places the schema stores. */
  amount: number | null;
  /** Exactly as it appeared in the source. Never discarded. */
  raw: string;
  error: string | null;
  parse: MoneyParse | null;
};

export type CurrencyResolution = {
  currency: string | null;
  source: CurrencySource | null;
  /** Codes the value could mean when a shared symbol was used. */
  ambiguousCandidates: string[];
  reason: string;
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isValidIsoCurrency(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

export function resolveAmount(rawValue: string): AmountResolution {
  const raw = rawValue ?? "";
  const trimmed = raw.trim();
  if (!trimmed) return { amount: null, raw, error: null, parse: null };

  const parse = parseMoney(trimmed);
  if (!parse) {
    return { amount: null, raw, error: `"${trimmed}" is not an amount Rive can read.`, parse: null };
  }
  const amount = roundMoney(parse.amount);
  if (!Number.isFinite(amount)) {
    return { amount: null, raw, error: `"${trimmed}" is not an amount Rive can read.`, parse };
  }
  if (Math.abs(amount) > MAX_MONETARY_VALUE) {
    return { amount: null, raw, error: `"${trimmed}" is larger than Rive can store.`, parse };
  }
  return { amount, raw, error: null, parse };
}

export type CurrencyContext = {
  /** Value of the row's own currency column, if one was mapped. */
  rowCurrency?: string;
  /** Currency declared by the file or adapter. */
  sourceCurrency?: string | null;
  /** Currency the user picked for this migration session. */
  migrationDefault?: string | null;
  /** The workspace's own default currency. Always present. */
  workspaceDefault: string;
};

/**
 * Resolve the currency for one financial record.
 *
 * Order: explicit column → source metadata → migration default → workspace
 * default. A symbol embedded in the amount only contributes when it is
 * unambiguous; a shared symbol such as `$` returns its candidates so the review
 * step can ask which one is meant.
 */
export function resolveCurrency(context: CurrencyContext, amountParse: MoneyParse | null): CurrencyResolution {
  const rowToken = (context.rowCurrency || "").trim();
  if (rowToken) {
    const { currency, ambiguous } = currencyTokenToIso(rowToken);
    if (currency && isValidIsoCurrency(currency)) {
      return { currency, source: "row", ambiguousCandidates: [], reason: `The row states ${currency}.` };
    }
    if (ambiguous.length) {
      return {
        currency: null,
        source: null,
        ambiguousCandidates: ambiguous,
        reason: `"${rowToken}" could mean ${ambiguous.slice(0, 3).join(", ")}.`,
      };
    }
    return {
      currency: null,
      source: null,
      ambiguousCandidates: [],
      reason: `"${rowToken}" is not a currency Rive recognises.`,
    };
  }

  // A symbol inside the amount itself is weaker than a dedicated column but
  // still direct evidence from the row.
  if (amountParse?.currency && isValidIsoCurrency(amountParse.currency)) {
    return {
      currency: amountParse.currency,
      source: "row",
      ambiguousCandidates: [],
      reason: `The amount is written in ${amountParse.currency}.`,
    };
  }
  if (amountParse?.ambiguousCurrencies.length) {
    return {
      currency: null,
      source: null,
      ambiguousCandidates: amountParse.ambiguousCurrencies,
      reason: `"${amountParse.symbol}" could mean ${amountParse.ambiguousCurrencies.slice(0, 3).join(", ")}.`,
    };
  }

  const sourceCurrency = (context.sourceCurrency || "").trim().toUpperCase();
  if (sourceCurrency && isValidIsoCurrency(sourceCurrency)) {
    return { currency: sourceCurrency, source: "source", ambiguousCandidates: [], reason: `The file states ${sourceCurrency}.` };
  }

  const migrationDefault = (context.migrationDefault || "").trim().toUpperCase();
  if (migrationDefault && isValidIsoCurrency(migrationDefault)) {
    return {
      currency: migrationDefault,
      source: "migrationDefault",
      ambiguousCandidates: [],
      reason: `You chose ${migrationDefault} for this import.`,
    };
  }

  const workspaceDefault = context.workspaceDefault.trim().toUpperCase();
  return {
    currency: isValidIsoCurrency(workspaceDefault) ? workspaceDefault : "USD",
    source: "workspace",
    ambiguousCandidates: [],
    reason: `Your workspace currency is ${workspaceDefault}.`,
  };
}

/** Parse a tax rate, tolerating a trailing percent sign. */
export function resolveRate(rawValue: string): { rate: number | null; error: string | null } {
  const trimmed = (rawValue || "").trim();
  if (!trimmed) return { rate: null, error: null };
  const parse = parseMoney(trimmed.replace(/%/g, ""));
  if (!parse) return { rate: null, error: `"${trimmed}" is not a tax rate Rive can read.` };
  const rate = roundMoney(parse.amount);
  if (rate < 0 || rate > 100) return { rate: null, error: `A tax rate of ${rate}% is outside the range Rive accepts.` };
  return { rate, error: null };
}
