/**
 * A read-only snapshot of the workspace the migration is landing in.
 *
 * The engine needs to know what already exists so it can link rather than
 * duplicate, but it must stay pure and database-free. The server layer loads
 * these plain shapes; nothing here can write.
 */

import {
  companyComparisonForm,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./normalize/text.ts";

export type ExistingClient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  website: string | null;
};

export type ExistingProject = {
  id: string;
  title: string;
  clientId: string | null;
};

export type ExistingInvoice = {
  id: string;
  invoiceNumber: string;
  clientId: string | null;
  total: number;
  issueDate: string | null;
};

export type ExistingExpense = {
  id: string;
  description: string;
  amount: number;
  date: string | null;
};

export type WorkspaceSnapshot = {
  defaultCurrency: string;
  clients: ExistingClient[];
  projects: ExistingProject[];
  invoices: ExistingInvoice[];
  expenses: ExistingExpense[];
};

export type WorkspaceIndex = {
  snapshot: WorkspaceSnapshot;
  clientsByEmail: Map<string, ExistingClient>;
  clientsByName: Map<string, ExistingClient>;
  projectsByName: Map<string, ExistingProject>;
  /** Invoice numbers are unique per user in the schema; this mirrors that. */
  invoiceNumbers: Map<string, ExistingInvoice>;
  expenseFingerprints: Map<string, ExistingExpense>;
};

export const EMPTY_WORKSPACE: WorkspaceSnapshot = {
  defaultCurrency: "USD",
  clients: [],
  projects: [],
  invoices: [],
  expenses: [],
};

/**
 * Composite key for an expense.
 *
 * Expenses have no natural identifier, so "same description, same amount, same
 * day" is the strongest deterministic statement available. It is used only to
 * *offer* a duplicate, never to skip one silently.
 */
export function expenseFingerprint(description: string, amount: number, date: string | null): string {
  return `${companyComparisonForm(description)}|${amount.toFixed(2)}|${date || ""}`;
}

export function buildWorkspaceIndex(snapshot: WorkspaceSnapshot): WorkspaceIndex {
  const clientsByEmail = new Map<string, ExistingClient>();
  const clientsByName = new Map<string, ExistingClient>();
  for (const client of snapshot.clients) {
    if (client.email) clientsByEmail.set(client.email.toLowerCase().trim(), client);
    const nameKey = companyComparisonForm(client.name);
    // First writer wins so the mapping is deterministic when a workspace
    // already contains two clients whose names normalize identically.
    if (nameKey && !clientsByName.has(nameKey)) clientsByName.set(nameKey, client);
    const companyKey = client.company ? companyComparisonForm(client.company) : "";
    if (companyKey && !clientsByName.has(companyKey)) clientsByName.set(companyKey, client);
  }

  const projectsByName = new Map<string, ExistingProject>();
  for (const project of snapshot.projects) {
    const key = companyComparisonForm(project.title);
    if (key && !projectsByName.has(key)) projectsByName.set(key, project);
  }

  const invoiceNumbers = new Map<string, ExistingInvoice>();
  for (const invoice of snapshot.invoices) {
    invoiceNumbers.set(invoice.invoiceNumber.toLowerCase().trim(), invoice);
  }

  const expenseFingerprints = new Map<string, ExistingExpense>();
  for (const expense of snapshot.expenses) {
    expenseFingerprints.set(expenseFingerprint(expense.description, expense.amount, expense.date), expense);
  }

  return { snapshot, clientsByEmail, clientsByName, projectsByName, invoiceNumbers, expenseFingerprints };
}
