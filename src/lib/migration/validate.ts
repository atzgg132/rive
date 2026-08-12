/**
 * Business validation.
 *
 * These are the same rules the workflow APIs enforce, sourced from the shared
 * `domain-vocabulary` module rather than restated, so a record that passes
 * migration validation cannot be one the product would have rejected.
 *
 * Severity is the whole point of this stage:
 *   warning — the record imports, with something the user should know
 *   error   — the record cannot import until its source data is fixed
 */

import {
  CLIENT_STATUS_SET,
  EXPENSE_CATEGORY_SET,
  FIELD_LIMITS,
  INVOICE_STATUS_SET,
  MAX_MONETARY_VALUE,
  PROJECT_PRIORITY_SET,
  PROJECT_STATUS_SET,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "../domain-vocabulary.ts";
import {
  isEmail,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./patterns.ts";
import {
  isValidIsoCurrency,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./normalize/money.ts";
import type { MigrationIssue, MigrationRecordIR } from "./types.ts";

function text(record: MigrationRecordIR, key: string): string {
  const value = record.normalized[key];
  return typeof value === "string" ? value.trim() : "";
}

function num(record: MigrationRecordIR, key: string): number | null {
  const value = record.normalized[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fail(code: string, message: string, extra: Partial<MigrationIssue> = {}): MigrationIssue {
  return { code, severity: "error", message, ...extra };
}

function warn(code: string, message: string, extra: Partial<MigrationIssue> = {}): MigrationIssue {
  return { code, severity: "warning", message, ...extra };
}

/** A short label for this record, used in every message the user reads. */
export function recordLabel(record: MigrationRecordIR): string {
  switch (record.entity) {
    case "clients":
      return text(record, "name") || "Unnamed client";
    case "projects":
      return text(record, "title") || "Untitled project";
    case "invoices":
      return text(record, "invoiceNumber") ? `Invoice ${text(record, "invoiceNumber")}` : "Untitled invoice";
    case "expenses":
      return text(record, "description") || "Unnamed expense";
    default:
      return record.source.sourceKey;
  }
}

function validateCurrency(record: MigrationRecordIR, issues: MigrationIssue[], required: boolean): void {
  const currency = text(record, "currency");
  if (!currency) {
    if (required) {
      // Currency resolution already recorded *why* it could not decide; this
      // only escalates it to something that blocks the record.
      issues.push(fail("CURRENCY_REQUIRED", "Rive needs to know which currency this amount is in.", { field: "currency" }));
    }
    return;
  }
  if (!isValidIsoCurrency(currency)) {
    issues.push(fail("CURRENCY_INVALID", `"${currency}" is not a three-letter currency code.`, { field: "currency", sourceValue: currency }));
  }
}

function validateDateOrder(
  record: MigrationRecordIR,
  issues: MigrationIssue[],
  earlierKey: string,
  laterKey: string,
  message: string,
): void {
  const earlier = text(record, earlierKey);
  const later = text(record, laterKey);
  // Both are `YYYY-MM-DD`, so lexicographic comparison is calendar comparison.
  if (earlier && later && later < earlier) {
    issues.push(warn("DATE_ORDER", message, { field: laterKey, sourceValue: later }));
  }
}

function validateClient(record: MigrationRecordIR, issues: MigrationIssue[]): void {
  const name = text(record, "name");
  if (!name) {
    issues.push(fail("NAME_REQUIRED", "A client needs a name.", { field: "name" }));
  } else if (name.length > FIELD_LIMITS.clientName) {
    issues.push(warn("NAME_LONG", "The client name was shortened to fit.", { field: "name" }));
  }

  const email = text(record, "email");
  if (email && !isEmail(email)) {
    issues.push(warn("EMAIL_INVALID", `"${email}" is not a valid email address, so it was left out.`, { field: "email", sourceValue: email }));
  }

  const status = text(record, "status");
  if (status && !CLIENT_STATUS_SET.has(status)) {
    issues.push(warn("STATUS_UNSUPPORTED", `"${status}" is not a client status Rive uses. This client will be active.`, { field: "status", sourceValue: status }));
  }
}

function validateProject(record: MigrationRecordIR, issues: MigrationIssue[]): void {
  if (!text(record, "title")) {
    issues.push(fail("TITLE_REQUIRED", "A project needs a name.", { field: "title" }));
  }

  const status = text(record, "status");
  if (status && !PROJECT_STATUS_SET.has(status)) {
    issues.push(warn("STATUS_UNSUPPORTED", `"${status}" is not a project status Rive uses. This project will be active.`, { field: "status", sourceValue: status }));
  }

  const priority = text(record, "priority");
  if (priority && !PROJECT_PRIORITY_SET.has(priority)) {
    issues.push(warn("PRIORITY_UNSUPPORTED", `"${priority}" is not a priority Rive uses. This project will be medium.`, { field: "priority", sourceValue: priority }));
  }

  const budget = num(record, "budget");
  if (budget !== null) {
    if (budget < 0) {
      issues.push(warn("BUDGET_NEGATIVE", "A negative budget was left out.", { field: "budget", sourceValue: String(budget) }));
    } else if (budget > MAX_MONETARY_VALUE) {
      issues.push(fail("BUDGET_TOO_LARGE", "This budget is larger than Rive can store.", { field: "budget" }));
    }
    validateCurrency(record, issues, false);
  }

  validateDateOrder(record, issues, "startDate", "dueDate", "The due date is before the start date. Rive imported both as given.");
}

function validateInvoice(record: MigrationRecordIR, issues: MigrationIssue[]): void {
  const number = text(record, "invoiceNumber");
  if (!number) {
    issues.push(fail("INVOICE_NUMBER_REQUIRED", "An invoice needs a number.", { field: "invoiceNumber" }));
  } else if (number.length > FIELD_LIMITS.invoiceNumber) {
    issues.push(warn("INVOICE_NUMBER_LONG", "The invoice number was shortened to fit.", { field: "invoiceNumber" }));
  }

  const total = num(record, "total");
  if (total === null) {
    issues.push(fail("TOTAL_REQUIRED", "An invoice needs a total.", { field: "total" }));
  } else if (total < 0) {
    issues.push(fail("TOTAL_NEGATIVE", "An invoice total cannot be negative. Record a credit note separately.", { field: "total", sourceValue: String(total) }));
  } else if (total > MAX_MONETARY_VALUE) {
    issues.push(fail("TOTAL_TOO_LARGE", "This total is larger than Rive can store.", { field: "total" }));
  }

  validateCurrency(record, issues, total !== null);

  const status = text(record, "status");
  if (status && !INVOICE_STATUS_SET.has(status)) {
    issues.push(warn("STATUS_UNSUPPORTED", `"${status}" is not an invoice status Rive uses. This invoice will be a draft.`, { field: "status", sourceValue: status }));
  }

  validateDateOrder(record, issues, "issueDate", "dueDate", "The due date is before the issue date. Rive imported both as given.");

  // A paid invoice with no payment date still imports; the date is inferred
  // from the issue date at commit, which is recorded as a warning here.
  if (status === "paid" && !text(record, "paidDate")) {
    issues.push(warn("PAID_DATE_MISSING", "This invoice is marked paid but has no payment date. Rive will use the issue date.", { field: "paidDate" }));
  }

  if (!record.resolvedRelationships.clientId && !text(record, "clientRef") && !text(record, "clientEmailRef")) {
    issues.push(warn("CLIENT_MISSING", "This invoice does not name a client, so it will not be linked to one.", { field: "clientId" }));
  }
}

function validateExpense(record: MigrationRecordIR, issues: MigrationIssue[]): void {
  if (!text(record, "description")) {
    issues.push(fail("DESCRIPTION_REQUIRED", "An expense needs a description.", { field: "description" }));
  }

  const amount = num(record, "amount");
  if (amount === null) {
    issues.push(fail("AMOUNT_REQUIRED", "An expense needs an amount.", { field: "amount" }));
  } else if (amount === 0) {
    issues.push(warn("AMOUNT_ZERO", "This expense has no value.", { field: "amount" }));
  } else if (Math.abs(amount) > MAX_MONETARY_VALUE) {
    issues.push(fail("AMOUNT_TOO_LARGE", "This amount is larger than Rive can store.", { field: "amount" }));
  } else if (amount < 0) {
    // Accounting exports write refunds as negatives. Rive stores expenses as
    // positive amounts, so the sign is dropped and the user is told.
    issues.push(warn("AMOUNT_NEGATIVE", "This amount was negative, so Rive imported it as a positive expense.", { field: "amount", sourceValue: String(amount) }));
  }

  validateCurrency(record, issues, amount !== null);

  const category = text(record, "category");
  if (category && !EXPENSE_CATEGORY_SET.has(category)) {
    issues.push(warn("CATEGORY_UNSUPPORTED", `"${category}" is not a category Rive uses. This expense will be filed under Other.`, { field: "category", sourceValue: category }));
  }
}

/**
 * Validate every record, folding the results into its warnings and errors and
 * updating its status. A record already skipped as a duplicate keeps that
 * outcome — there is no point blocking an import for a row nothing will write.
 */
export function validateRecords(records: MigrationRecordIR[]): void {
  for (const record of records) {
    if (record.action === "skip" || record.action === "link") continue;

    const issues: MigrationIssue[] = [];
    switch (record.entity) {
      case "clients": validateClient(record, issues); break;
      case "projects": validateProject(record, issues); break;
      case "invoices": validateInvoice(record, issues); break;
      case "expenses": validateExpense(record, issues); break;
      default: break;
    }

    for (const issue of issues) {
      if (issue.severity === "error") record.errors.push(issue);
      else record.warnings.push(issue);
    }

    if (record.errors.length) {
      record.status = "error";
      record.action = "skip";
    } else if (record.status !== "review") {
      record.status = "ready";
    }
  }
}
