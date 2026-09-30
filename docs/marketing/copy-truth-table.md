# Marketing copy truth table (v2 site)

Every product claim on the v2 marketing site (`src/content/site/*`) maps to the
code or route that proves it. A claim that is not in this table does not ship.
Figures on the site are sample data from the fictional studio in
`src/components/marketing/WorkspacePreview.tsx` and are labelled as sample.

| Claim (as written on the site) | Proof |
| --- | --- |
| Clients with notes, tags, projects, tasks, milestones, budgets | `prisma/schema.prisma` (Client, Project, Task, Milestone); `src/app/(dashboard)/workflow/*` |
| Enquiries arrive from the portfolio and convert into a client in one step | `src/app/api/public/portfolio/[slug]/inquiries/route.ts`; `src/app/api/portfolio/inquiries/[id]/convert/route.ts` |
| Share a review link for comments, then a separate link to accept | `src/app/review/[token]` (comments only); `src/app/sign/[token]`, `src/app/api/public/contracts/sign/[token]/route.ts` |
| Acceptance is a typed name, recorded with who, when and which version | `src/components/marketing/AcceptanceDocument.tsx` (mirrors `/sign/[token]`): typed-name acceptance linked to version hash, named party, timestamp and consent text |
| Recorded acceptance is not a guarantee of legal enforceability | Product rule — `PRODUCT.md` Capabilities and Constraints |
| When a payment in the agreement comes due, Rive drafts the invoice to review and send | `src/utils/contractBilling.ts` — `processContractBilling` creates a `status: "draft"` invoice ("Review the Agreement and invoice before sending") |
| Payment reminders you can pause per invoice | `src/utils/invoiceReminders.ts`; `Invoice.remindersPaused` in `prisma/schema.prisma`; `src/app/api/workflow/invoices/[id]/reminders/route.ts` |
| Rive records payments. It doesn't move money | Product rule — `PRODUCT.md`; no payment-collection code exists |
| Invoices in your client's currency; multi-currency reporting | `src/lib/currency.ts`; invoice `currency` field; revenue display currency |
| Revenue, expenses and profit margin | `src/app/(dashboard)/dashboard/page.tsx` (`profitMargin`); `src/app/(dashboard)/workflow/expenses` |
| Two-way Google Calendar sync | `src/utils/googleCalendar.ts` (`syncToken` incremental pull + push); `src/app/api/calendar/webhooks/google` |
| Private Apple Calendar feed | `src/app/api/calendar/feed/[token]/route.ts` |
| Six portfolio templates | `PORTFOLIO_TEMPLATES` in `src/utils/portfolio.ts` (6 entries); profiles in `src/components/portfolio/PortfolioRenderer.tsx` |
| Import clients, projects, invoices and expenses from CSV or XLSX, with review before saving | `src/app/(dashboard)/migrate` (`MigrationWizard`); `src/utils/migration/analyze.ts`, `commit.ts` |
| One operator per account; no team access yet | Product rule — `PRODUCT.md` Users |
| Full workspace export is not available yet | No export route exists; `/pricing` states the same |
| Free during open beta, no credit card; paid pricing published before beta ends | `PRODUCT.md`; `src/app/(marketing)/pricing/page.tsx` |

## Cut or reworded from the brief

- "…nothing gets typed twice" — not provable (manual invoices and expenses are typed). Cut.
- "The client's signature drawn by the Thread" — Rive records a typed name, not a drawn signature. The Thread underlines the typed name instead.
- "Payment recorded and the margin shown" per job — only workspace-level profit margin exists. The site says "revenue, expenses and margin update".
- "Seven tabs" fragments (inbox, chat…) are shown as the situation *before* Rive, not as integrations.
