/**
 * The canonical field catalogue.
 *
 * This is the vocabulary every source is mapped into. Adding support for a new
 * column name is an edit here, not a change to the mapping algorithm; adding a
 * new Rive field is an entry here plus a normalizer and a validation rule.
 */

import type { InferredType, MigrationEntity } from "./types.ts";

/**
 * Semantic type of a canonical field. Coarser than `InferredType` because it
 * describes intent ("this holds money") rather than observed shape.
 */
export type SemanticType =
  | "text"
  | "longtext"
  | "email"
  | "phone"
  | "url"
  | "money"
  | "rate"
  | "date"
  | "enum"
  | "tags"
  | "currency"
  | "boolean"
  | "identifier"
  | "reference";

export type CanonicalField = {
  key: string;
  entity: MigrationEntity;
  /** Shown in the manual mapping dropdown. */
  label: string;
  semanticType: SemanticType;
  required: boolean;
  /** Normalized header forms that suggest this field. */
  aliases: string[];
  /** Column types that are acceptable evidence for this field. */
  acceptedTypes: InferredType[];
  /**
   * Column types that disqualify this field outright. A date column can never
   * become an amount, however similar the two headers look.
   */
  rejectedTypes: InferredType[];
  /** For relationship fields: which entity the value points at. */
  relationTo?: MigrationEntity;
  maxLength?: number;
  /** Fields the user should not have to see in the mapping dropdown. */
  internal?: boolean;
};

const TEXTUAL: InferredType[] = ["text", "categorical", "identifier"];
const MONEYISH: InferredType[] = ["currency", "number"];
const NEVER_MONEY: InferredType[] = ["date", "email", "url", "phone", "boolean"];
const NEVER_DATE: InferredType[] = ["email", "url", "phone", "boolean", "currency"];

export const CANONICAL_FIELDS: CanonicalField[] = [
  // ---------------------------------------------------------------- clients
  {
    key: "name", entity: "clients", label: "Client name", semanticType: "text", required: true,
    aliases: ["client_name", "customer_name", "client", "customer", "name", "account_name", "account", "contact_name", "company_name", "company", "organisation", "organization", "business_name", "party", "bill_to", "billed_to", "display_name", "full_name"],
    acceptedTypes: [...TEXTUAL], rejectedTypes: ["date", "boolean", "currency", "url"], maxLength: 160,
  },
  {
    key: "email", entity: "clients", label: "Client email", semanticType: "email", required: false,
    aliases: ["email", "email_address", "client_email", "customer_email", "e_mail", "contact_email", "primary_email", "bill_to_email", "billing_email"],
    acceptedTypes: ["email", "text"], rejectedTypes: ["date", "currency", "number", "boolean", "url", "phone"], maxLength: 254,
  },
  {
    key: "phone", entity: "clients", label: "Client phone", semanticType: "phone", required: false,
    aliases: ["phone", "phone_number", "mobile", "mobile_number", "telephone", "tel", "contact_number", "work_phone", "cell"],
    acceptedTypes: ["phone", "text", "number", "identifier"], rejectedTypes: ["date", "email", "url", "boolean"], maxLength: 80,
  },
  {
    key: "company", entity: "clients", label: "Client company", semanticType: "text", required: false,
    aliases: ["company", "company_name", "organisation", "organization", "business_name", "firm", "employer", "legal_name"],
    acceptedTypes: [...TEXTUAL], rejectedTypes: ["date", "boolean", "currency", "email"], maxLength: 160,
  },
  {
    key: "website", entity: "clients", label: "Client website", semanticType: "url", required: false,
    aliases: ["website", "url", "web", "site", "homepage", "web_address", "domain"],
    acceptedTypes: ["url", "text"], rejectedTypes: ["date", "currency", "boolean", "email", "phone"], maxLength: 500,
  },
  {
    key: "address", entity: "clients", label: "Client address", semanticType: "longtext", required: false,
    aliases: ["address", "billing_address", "street", "street_address", "mailing_address", "location", "address_line_1", "postal_address"],
    acceptedTypes: ["text"], rejectedTypes: ["date", "currency", "boolean", "email", "url"], maxLength: 1_000,
  },
  {
    key: "notes", entity: "clients", label: "Client notes", semanticType: "longtext", required: false,
    aliases: ["notes", "note", "remarks", "comments", "description", "memo"],
    acceptedTypes: ["text", "categorical"], rejectedTypes: ["date", "currency", "boolean", "email", "url"], maxLength: 2_000,
  },
  {
    key: "tags", entity: "clients", label: "Client tags", semanticType: "tags", required: false,
    aliases: ["tags", "labels", "segments", "groups", "keywords"],
    acceptedTypes: ["text", "categorical"], rejectedTypes: ["date", "currency", "email", "url"],
  },
  {
    key: "status", entity: "clients", label: "Client status", semanticType: "enum", required: false,
    aliases: ["status", "client_status", "state", "customer_status"],
    acceptedTypes: ["categorical", "text", "boolean"], rejectedTypes: ["date", "currency", "email", "url"],
  },
  {
    key: "externalId", entity: "clients", label: "Source client ID", semanticType: "identifier", required: false,
    aliases: ["client_id", "customer_id", "contact_id", "external_id", "account_id", "id", "reference", "ref"],
    acceptedTypes: ["identifier", "number", "text"], rejectedTypes: ["date", "email", "url", "boolean"],
  },

  // --------------------------------------------------------------- projects
  {
    key: "title", entity: "projects", label: "Project name", semanticType: "text", required: true,
    aliases: ["project_name", "project_title", "project", "title", "name", "job", "job_name", "engagement", "work", "assignment", "matter", "campaign"],
    acceptedTypes: [...TEXTUAL], rejectedTypes: ["date", "boolean", "currency", "email", "url"], maxLength: 200,
  },
  {
    key: "description", entity: "projects", label: "Project description", semanticType: "longtext", required: false,
    aliases: ["description", "details", "scope", "summary", "brief", "notes", "project_description", "remarks"],
    acceptedTypes: ["text", "categorical"], rejectedTypes: ["date", "currency", "boolean", "email", "url"], maxLength: 2_000,
  },
  {
    key: "clientRef", entity: "projects", label: "Client", semanticType: "reference", required: false, relationTo: "clients",
    aliases: ["client", "client_name", "customer", "customer_name", "account", "account_name", "company", "bill_to", "client_ref"],
    acceptedTypes: [...TEXTUAL], rejectedTypes: ["date", "boolean", "currency", "url"],
  },
  {
    key: "clientEmailRef", entity: "projects", label: "Client email", semanticType: "email", required: false, relationTo: "clients",
    aliases: ["client_email", "customer_email", "contact_email", "account_email"],
    acceptedTypes: ["email", "text"], rejectedTypes: ["date", "currency", "number", "boolean", "url"],
  },
  {
    key: "status", entity: "projects", label: "Project status", semanticType: "enum", required: false,
    aliases: ["status", "project_status", "state", "stage", "phase", "progress"],
    acceptedTypes: ["categorical", "text", "boolean"], rejectedTypes: ["date", "currency", "email", "url"],
  },
  {
    key: "priority", entity: "projects", label: "Project priority", semanticType: "enum", required: false,
    aliases: ["priority", "urgency", "importance"],
    acceptedTypes: ["categorical", "text"], rejectedTypes: ["date", "currency", "email", "url"],
  },
  {
    key: "startDate", entity: "projects", label: "Start date", semanticType: "date", required: false,
    aliases: ["start_date", "started_at", "start", "kickoff", "kickoff_date", "begin_date", "commenced", "from_date"],
    acceptedTypes: ["date"], rejectedTypes: NEVER_DATE,
  },
  {
    key: "dueDate", entity: "projects", label: "Due date", semanticType: "date", required: false,
    aliases: ["due_date", "deadline", "end_date", "completion_date", "target_date", "delivery_date", "finish", "finish_date", "to_date"],
    acceptedTypes: ["date"], rejectedTypes: NEVER_DATE,
  },
  {
    key: "budget", entity: "projects", label: "Project budget", semanticType: "money", required: false,
    aliases: ["budget", "project_value", "value", "contract_value", "fee", "quoted_amount", "amount", "total", "project_budget", "estimate"],
    acceptedTypes: MONEYISH, rejectedTypes: NEVER_MONEY,
  },
  {
    key: "currency", entity: "projects", label: "Currency", semanticType: "currency", required: false,
    aliases: ["currency", "currency_code", "ccy", "curr"],
    acceptedTypes: ["categorical", "text", "identifier"], rejectedTypes: ["date", "email", "url", "boolean"],
  },
  {
    key: "tags", entity: "projects", label: "Project tags", semanticType: "tags", required: false,
    aliases: ["tags", "labels", "keywords", "categories"],
    acceptedTypes: ["text", "categorical"], rejectedTypes: ["date", "currency", "email", "url"],
  },
  {
    key: "externalId", entity: "projects", label: "Source project ID", semanticType: "identifier", required: false,
    aliases: ["project_id", "external_id", "id", "reference", "code", "job_id", "job_number"],
    acceptedTypes: ["identifier", "number", "text"], rejectedTypes: ["date", "email", "url", "boolean"],
  },

  // --------------------------------------------------------------- invoices
  {
    key: "invoiceNumber", entity: "invoices", label: "Invoice number", semanticType: "identifier", required: true,
    aliases: ["invoice_number", "invoice_no", "invoice_id", "number", "bill_no", "bill_number", "bill", "inv_no", "inv_number", "doc_number", "document_number", "invoice", "reference", "voucher_no"],
    acceptedTypes: ["identifier", "text", "number", "categorical"], rejectedTypes: ["date", "email", "url", "boolean"], maxLength: 80,
  },
  {
    key: "clientRef", entity: "invoices", label: "Client", semanticType: "reference", required: false, relationTo: "clients",
    aliases: ["client", "client_name", "customer", "customer_name", "bill_to", "billed_to", "account", "account_name", "company", "party", "customer_display_name"],
    acceptedTypes: [...TEXTUAL], rejectedTypes: ["date", "boolean", "currency", "url"],
  },
  {
    key: "clientEmailRef", entity: "invoices", label: "Client email", semanticType: "email", required: false, relationTo: "clients",
    aliases: ["client_email", "customer_email", "bill_to_email", "email", "billing_email", "contact_email"],
    acceptedTypes: ["email", "text"], rejectedTypes: ["date", "currency", "number", "boolean", "url"],
  },
  {
    key: "projectRef", entity: "invoices", label: "Project", semanticType: "reference", required: false, relationTo: "projects",
    aliases: ["project", "project_name", "project_title", "job", "job_name", "engagement"],
    acceptedTypes: [...TEXTUAL], rejectedTypes: ["date", "boolean", "currency", "url", "email"],
  },
  {
    key: "status", entity: "invoices", label: "Invoice status", semanticType: "enum", required: false,
    aliases: ["status", "invoice_status", "payment_status", "state", "paid_status"],
    acceptedTypes: ["categorical", "text", "boolean"], rejectedTypes: ["date", "currency", "email", "url"],
  },
  {
    key: "currency", entity: "invoices", label: "Currency", semanticType: "currency", required: false,
    aliases: ["currency", "currency_code", "ccy", "curr"],
    acceptedTypes: ["categorical", "text", "identifier"], rejectedTypes: ["date", "email", "url", "boolean"],
  },
  {
    key: "subtotal", entity: "invoices", label: "Subtotal", semanticType: "money", required: false,
    aliases: ["subtotal", "sub_total", "net_amount", "amount_before_tax", "taxable_amount", "net", "net_total"],
    acceptedTypes: MONEYISH, rejectedTypes: NEVER_MONEY,
  },
  {
    key: "taxAmount", entity: "invoices", label: "Tax amount", semanticType: "money", required: false,
    aliases: ["tax", "tax_amount", "vat", "vat_amount", "gst", "gst_amount", "tax_total", "sales_tax"],
    acceptedTypes: MONEYISH, rejectedTypes: NEVER_MONEY,
  },
  {
    key: "taxRate", entity: "invoices", label: "Tax rate", semanticType: "rate", required: false,
    aliases: ["tax_rate", "vat_rate", "gst_rate", "tax_percent", "tax_percentage", "rate"],
    acceptedTypes: ["number", "text"], rejectedTypes: NEVER_MONEY,
  },
  {
    key: "total", entity: "invoices", label: "Invoice total", semanticType: "money", required: false,
    aliases: ["total", "amount", "invoice_total", "grand_total", "total_amount", "invoice_amount", "amount_due", "balance", "bill_total", "gross_total", "total_due"],
    acceptedTypes: MONEYISH, rejectedTypes: NEVER_MONEY,
  },
  {
    key: "issueDate", entity: "invoices", label: "Issue date", semanticType: "date", required: false,
    aliases: ["issue_date", "invoice_date", "date", "created_date", "bill_date", "document_date", "issued_on", "issued"],
    acceptedTypes: ["date"], rejectedTypes: NEVER_DATE,
  },
  {
    key: "dueDate", entity: "invoices", label: "Due date", semanticType: "date", required: false,
    aliases: ["due_date", "payment_due", "due", "maturity_date", "due_on", "payment_due_date"],
    acceptedTypes: ["date"], rejectedTypes: NEVER_DATE,
  },
  {
    key: "paidDate", entity: "invoices", label: "Paid date", semanticType: "date", required: false,
    aliases: ["paid_date", "payment_date", "paid_on", "settled_on", "date_paid", "cleared_on"],
    acceptedTypes: ["date"], rejectedTypes: NEVER_DATE,
  },
  {
    key: "notes", entity: "invoices", label: "Invoice notes", semanticType: "longtext", required: false,
    aliases: ["notes", "memo", "description", "remarks", "terms", "comments", "particulars"],
    acceptedTypes: ["text", "categorical"], rejectedTypes: ["date", "currency", "boolean", "email", "url"], maxLength: 2_000,
  },
  {
    key: "externalId", entity: "invoices", label: "Source invoice ID", semanticType: "identifier", required: false,
    aliases: ["external_id", "invoice_uuid", "id", "source_id", "zoho_invoice_id"],
    acceptedTypes: ["identifier", "number", "text"], rejectedTypes: ["date", "email", "url", "boolean"],
  },

  // --------------------------------------------------------------- expenses
  {
    key: "description", entity: "expenses", label: "Expense description", semanticType: "text", required: true,
    aliases: ["description", "expense", "item", "particulars", "details", "memo", "narration", "merchant", "vendor", "payee", "supplier", "vendor_name", "merchant_name", "expense_name", "purpose"],
    acceptedTypes: [...TEXTUAL], rejectedTypes: ["date", "boolean", "currency", "email", "url"], maxLength: 500,
  },
  {
    key: "amount", entity: "expenses", label: "Expense amount", semanticType: "money", required: true,
    aliases: ["amount", "total", "expense_amount", "cost", "value", "debit", "price", "spend", "paid", "gross_amount"],
    acceptedTypes: MONEYISH, rejectedTypes: NEVER_MONEY,
  },
  {
    key: "currency", entity: "expenses", label: "Currency", semanticType: "currency", required: false,
    aliases: ["currency", "currency_code", "ccy", "curr"],
    acceptedTypes: ["categorical", "text", "identifier"], rejectedTypes: ["date", "email", "url", "boolean"],
  },
  {
    key: "category", entity: "expenses", label: "Expense category", semanticType: "enum", required: false,
    aliases: ["category", "expense_category", "type", "expense_type", "classification", "account", "account_name", "head"],
    acceptedTypes: ["categorical", "text"], rejectedTypes: ["date", "currency", "email", "url", "boolean"],
  },
  {
    key: "date", entity: "expenses", label: "Expense date", semanticType: "date", required: false,
    aliases: ["date", "expense_date", "transaction_date", "posted_date", "spent_on", "paid_on", "txn_date", "purchase_date"],
    acceptedTypes: ["date"], rejectedTypes: NEVER_DATE,
  },
  {
    key: "projectRef", entity: "expenses", label: "Project", semanticType: "reference", required: false, relationTo: "projects",
    aliases: ["project", "project_name", "project_title", "job", "job_name", "client_project"],
    acceptedTypes: [...TEXTUAL], rejectedTypes: ["date", "boolean", "currency", "url", "email"],
  },
  {
    key: "isBillable", entity: "expenses", label: "Billable", semanticType: "boolean", required: false,
    aliases: ["billable", "is_billable", "rebillable", "chargeable", "client_billable"],
    acceptedTypes: ["boolean", "categorical", "text"], rejectedTypes: ["date", "currency", "email", "url"],
  },
  {
    key: "isReimbursed", entity: "expenses", label: "Reimbursed", semanticType: "boolean", required: false,
    aliases: ["reimbursed", "is_reimbursed", "repaid", "settled", "reimbursement_status"],
    acceptedTypes: ["boolean", "categorical", "text"], rejectedTypes: ["date", "currency", "email", "url"],
  },
  {
    key: "receiptUrl", entity: "expenses", label: "Receipt link", semanticType: "url", required: false,
    aliases: ["receipt", "receipt_url", "receipt_link", "attachment", "attachment_url", "document_url"],
    acceptedTypes: ["url", "text"], rejectedTypes: ["date", "currency", "boolean", "email", "phone"],
  },
  {
    key: "externalId", entity: "expenses", label: "Source transaction ID", semanticType: "identifier", required: false,
    aliases: ["transaction_id", "txn_id", "external_id", "id", "reference", "ref", "expense_id", "source_id"],
    acceptedTypes: ["identifier", "number", "text"], rejectedTypes: ["date", "email", "url", "boolean"],
  },
];

const FIELDS_BY_ENTITY = new Map<MigrationEntity, CanonicalField[]>();
for (const field of CANONICAL_FIELDS) {
  const list = FIELDS_BY_ENTITY.get(field.entity) || [];
  list.push(field);
  FIELDS_BY_ENTITY.set(field.entity, list);
}

export function fieldsForEntity(entity: MigrationEntity): CanonicalField[] {
  return FIELDS_BY_ENTITY.get(entity) || [];
}

export function findField(entity: MigrationEntity, key: string): CanonicalField | null {
  return fieldsForEntity(entity).find((field) => field.key === key) || null;
}

export function requiredFields(entity: MigrationEntity): CanonicalField[] {
  return fieldsForEntity(entity).filter((field) => field.required);
}

/**
 * Options shown in the manual mapping dropdown. Scoped to the source's own
 * entity so a user classifying an invoice sheet is not offered every expense
 * field in the product.
 */
export function mappingOptions(entity: MigrationEntity): Array<{ value: string; label: string }> {
  return [
    { value: "", label: "Ignore this column" },
    ...fieldsForEntity(entity)
      .filter((field) => !field.internal)
      .map((field) => ({ value: field.key, label: field.label })),
  ];
}
