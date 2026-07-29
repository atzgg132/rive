# rive. activation system

## Product objective

A new user should reach a credible, useful workspace in under five minutes. The activation system is successful when the user has at least one of:

- imported real business data;
- created a client-to-project-to-invoice workflow;
- scheduled real work;
- generated a portfolio draft from existing profile and project data.

The dashboard is the destination, not the onboarding experience. Onboarding must create the data and context that make the dashboard useful.

## Journey

### 1. Welcome and intent

Ask only questions that materially personalize the product:

- business shape: freelancer, studio/agency, consultant, creator, small business;
- primary work type;
- preferred currency;
- timezone;
- immediate goal: organize work, get paid, understand finances, publish proof, or migrate.

Name and email are inherited from registration. Profile photo is optional and reused by the portfolio.

### 2. Choose the fastest path to value

Offer three equally legitimate paths:

1. **Import my work** — upload exports from Zoho, QuickBooks, FreshBooks, Wave, Xero, spreadsheets, or another CRM.
2. **Guide me through one real workflow** — create a client, project, due date, and optional first invoice in one connected form.
3. **Start clean** — enter the workspace with an activation checklist and strong contextual empty states.

A labelled demo workspace can be added later, but demo records must never be mixed silently with real financial data.

### 3. Universal import

The first production version accepts multiple CSV files and:

- detects clients, projects, invoices, and expenses from headers;
- previews detected record counts before writing;
- imports clients before dependent records;
- links projects and invoices to clients by normalized email or name;
- links expenses and invoices to projects by title where possible;
- rejects malformed and oversized files server-side;
- deduplicates clients and invoice numbers;
- reports imported, skipped, and unresolved records.

Future versions add:

- native Zoho, QuickBooks, Xero, FreshBooks, Stripe, bank, and Drive connectors;
- saved field mappings per source;
- background imports with resumable jobs;
- reconciliation and rollback;
- opening balances and tax configuration.

### 4. Activation handoff

The final screen explains what rive. created:

- records imported;
- calendar deadlines generated;
- portfolio fields prefilled;
- first financial insights unlocked;
- unresolved records requiring attention.

The primary CTA opens the dashboard. Secondary CTAs open the most relevant next action.

## Cross-product activation

- Clients become relationship context for projects and invoices.
- Project dates and milestones become calendar entries.
- Invoice due dates become calendar and cash-collection signals.
- Expenses feed profitability, category, and billable-cost insights.
- User identity and project history prefill the portfolio.
- Calendar tasks become protected focus blocks.

## Insight hierarchy

Every financial surface should answer:

1. What happened?
2. What needs attention?
3. What should I do next?

Dashboard:

- cash collected, outstanding, overdue, expenses, net earnings;
- collection rate and profit margin;
- upcoming project/invoice deadlines;
- activation checklist when data is insufficient.

Revenue:

- outstanding and overdue value;
- paid this month;
- collection rate;
- aging buckets;
- invoices requiring action.

Expenses:

- spend this month;
- largest category;
- billable unreimbursed amount;
- month-over-month movement;
- category concentration.

## Guardrails

- Never create unlabeled synthetic financial data.
- Preview imports before committing.
- Validate ownership and payloads server-side.
- Keep imports idempotent where stable identifiers exist.
- Preserve source context for future auditability.
- Do not claim two-way integration where only read-only subscription exists.
- Let users skip onboarding and return later without blocking their account.

## Delivery phases

### Phase 1 — activation foundation

- persisted onboarding state;
- automatic post-registration onboarding;
- profile and business preferences;
- multi-file CSV preview/import;
- portfolio profile photo upload;
- connected activation dashboard and financial insight cards.

### Phase 2 — assisted migration

- source-specific templates and field mapper;
- import jobs, reconciliation, retry, and rollback;
- opening balances;
- import from Drive.

### Phase 3 — continuous operating system

- bank feeds and accounting connectors;
- CRM, payments, storage, and productivity connectors;
- recommendation engine driven by workspace state;
- periodic data-quality and business-health reviews.
