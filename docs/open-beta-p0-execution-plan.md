# Open beta P0 execution plan

## Outcome

Rive becomes open signup, free during beta, email-verified, measurable from acquisition through repeat value, and operationally safe for real users. Invoicing becomes a trustworthy workflow with server-calculated money, stable numbering, client-facing delivery, payment history, and revenue truth.

## P0 workstreams and acceptance gates

### 1. Open signup and graceful transition

Implemented locally:

- marketing CTAs go to `/register`; the waitlist endpoint is closed with a compatibility response;
- new accounts are free customer accounts and cannot create a session before email verification;
- verification tokens are single-use, expiring, hashed at rest, and resendable through a generic response;
- verification email delivery uses an encrypted outbox, console delivery locally, and a protected cron endpoint for SMTP/SES in production;
- legacy accounts and old invite links remain usable without making invitation status an access gate.

Launch gate: apply the migration, configure a real transactional provider, schedule the outbox worker, and complete the verification/resend/expired-token smoke test in a production-like environment.

### 2. Funnel instrumentation and definitions

Implemented locally:

- anonymous identity, first-touch acquisition attribution, session/page events, authenticated product events, and safe event-property filtering;
- explicit `dataOrigin` on user/imported business records;
- versioned v1 definitions in `src/utils/funnelDefinitions.ts` and `docs/funnel-definitions.md`;
- admin metrics for signups, qualification, activation union/path breakdown, real-data users, WAU/MAU, mature W1 retention, workflow depth, and instrumentation/email reliability.

Launch gate: create a test account for each value path, verify raw events and entity origins, reconcile numerator/denominator counts manually, and freeze the first baseline before acquisition spend is judged.

### 3. Admin control room

Implemented locally:

- HttpOnly database-backed admin sessions with revoke/expiry and legacy header compatibility for old scripts;
- Overview, funnel, user explorer/timeline, feedback triage, reliability, and historical waitlist archive tabs;
- 30-second metrics cache and bounded event/record reads.

Immediate follow-up: replace the bounded event scan with daily rollups once event volume is material, and add an explicit data-quality alert when event freshness or outbox backlog breaches a threshold.

### 4. Feedback loop

Implemented locally:

- contextual prompts for workspace, onboarding, activation, and invoices;
- rating, free text, optional contact permission, safe context, dismiss/snooze state, and admin triage;
- feedback is linked to the workflow/module and not treated as anonymous noise by default.

Operating rule: review new feedback twice weekly, tag it by problem and user stage, and only promote a request to roadmap work when it is supported by repeated behavior or high-value customer evidence.

### 5. Invoicing and revenue

Implemented locally:

- Decimal-safe server calculation, line-item validation, tax limits, currency-aware rounding, atomic invoice numbering, and invoice settings;
- polished draft editor/live preview, client/project linking, immutable sent snapshot, secure random public link, delivery history, view tracking, void flow, payment ledger, partial payments, outstanding balance, and revenue summary;
- imported/legacy paid invoice amounts are carried into the payment ledger;
- contract-generated invoices emit the same product events as manually created invoices;
- public/revenue/PDF views show outstanding balance rather than mislabeling the gross total after payment.

Still P0 before calling invoicing commercially complete: test real SMTP delivery and bounce/failure recovery, verify public-link behavior after void/payment races, and decide whether payment collection is manual-only for beta or whether a provider-backed pay button is required.

## Rollout sequence

1. Apply schema migrations in a backup-protected environment.
2. Deploy with email provider configured but keep the existing audience announcement quiet.
3. Run the open-beta smoke checklist and verify admin data quality.
4. Open signup to a small traffic slice for one day; watch verification delivery, signup-to-qualified, server errors, and event freshness.
5. Open all traffic; review funnel and feedback daily for the first week.
6. At day 14, publish the first mature W1 retention baseline and choose one activation leak to fix before adding broad feature scope.

## P1 after stability

- automatic overdue status transitions and reminder sequences;
- provider-backed invoice payment links, reconciliation, refunds, and webhook idempotency;
- recurring invoices, credit notes, invoice templates, richer client communication history, and branded exports;
- daily analytics rollups, cohort/source drilldowns, CSV export, and alerting;
- feedback tagging, deduplication, research notes, and a lightweight customer advisory cadence.

## Nice-to-haves / do not pull into P0

Advanced dashboard customization, arbitrary survey builders, full accounting/tax compliance, multi-seat permissions, complex recurring billing, and acquisition optimization before the first real activation/retention baseline.

## Release decision

The codebase is locally buildable and structurally ready for the migration-and-staging phase. It is not production-open-beta ready until the database migration, transactional email provider, outbox scheduler, and database-backed smoke tests have all passed in the target environment.
