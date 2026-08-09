# Agreements current-state audit

Audit date: 2026-08-03
Repository: `C:\Users\Arnav Bhattacharya\.gemini\antigravity\scratch\zeno`
Audited revision: `29bb7f3` (`Complete contracts workflow and billing integration`)
Scope: repository and schema audit only; no production data was changed.

Phase 0 follow-up (2026-08-03): this baseline audit predates the closure slice. The current code now has a pure Contract status registry in `src/utils/contractStatus.ts`, routes use `transitionContractStatus` for root status changes, and the alpha flow is labelled recorded acceptance / typed-name acceptance. The findings below remain the baseline inventory; Phase 0 did not start schema, OTP, artifact-storage, outbox, project-generation, evidence, or Verified Work migrations.

## Executive summary

Rive has a real, usable Agreements workflow. It is not a dead-PDF prototype: the current implementation can create a draft from existing client/project records, capture a structured JSON content snapshot, create immutable numbered versions with SHA-256 hashes, issue expiring hashed review and acceptance links, collect sequenced typed-name acceptance records, render an accepted PDF, activate milestone/date payment triggers, create reviewable draft invoices, send notifications, and protect several destructive project/client/invoice operations.

The implementation is nevertheless a Contracts compatibility slice rather than a first-class agreement-to-cash domain. The core object is still the `Contract` table and a JSON `ContractVersion.content` snapshot. There are no structured agreement parties/sections/attachments/deliverables/approvals/change requests/amendments/evidence exports/project-generation records, no OTP or external verification adapter, no real provider webhook route, no workspace/team membership model, and no persistent rendered-document snapshot. The Phase 0 status registry now covers the live `starting` state and the authoritative root status writes are guarded, but the additive domain migration remains future work.

The safest conclusion is an incremental modular-monolith migration, not a rewrite. Preserve the current tables, IDs, public URL shapes, PDF renderer, client/project/invoice integration, and smoke workflow while introducing an Agreement domain layer, structured child records, explicit transition enforcement, verification adapters, durable artifacts, and transactional/idempotent operational conversion.

## Method and exact files inspected

The audit traced routes, handlers, Prisma relations, UI state, utilities, migrations, smoke tests, scheduled jobs, and recent history rather than relying only on filenames.

### Core repository and runtime

- `package.json` — Next.js `16.2.12`, React `19.2.4`, Prisma `7.9.1`, Playwright, `@react-pdf/renderer`, AWS SDK, SMTP support, and available scripts.
- `AGENTS.md` — repository instruction requiring the installed Next.js 16 guides to be read before code changes.
- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` — async request APIs, Turbopack/build behavior, and Next.js 16 changes.
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md` and `data-security.md` — relevant App Router security guidance.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — current Route Handler `Promise` params/cookie conventions.
- `next.config.ts`, `tsconfig.json`, `prisma.config.ts`, `.env.example`, `README.md` — runtime, build, database, environment, and deployment assumptions.
- `git log --oneline --all` and `git show 29bb7f3` — recent Contracts implementation and migration history.

### Data model and migrations

- `prisma/schema.prisma` — `User`, `Client`, `Project`, `Milestone`, `Task`, `CalendarEvent`, `Invoice`, `AuditEvent`, `Portfolio`, `Contract`, `ContractVersion`, `ContractSigner`, `ContractSignature`, `ContractReviewLink`, `ContractComment`, `ContractEvent`, `ContractArtifact`, `ContractPaymentPlanItem`, `ContractBillingOccurrence`, `InvoiceDelivery`, and `Notification` models.
- `prisma/migrations/20260729000000_baseline/migration.sql` — original business data model.
- `prisma/migrations/20260730000000_add_operational_indexes/migration.sql` — operational query indexes.
- `prisma/migrations/20260731120000_add_contracts_esign_billing/migration.sql` — current Contract, version, signer, signature, link, comment, event, artifact, billing, delivery, and notification tables.
- `prisma/migrations/20260801153000_add_project_contract_coverage/migration.sql` — project contract coverage fields and backfill from non-void contracts.
- `prisma/migrations/20260730120000_add_activation_migration_foundation/migration.sql` — related import and activation foundation.

### Auth, ownership, security, and infrastructure

- `src/utils/userAuth.ts` — stateless HMAC session cookie, password hashing, and session extraction.
- `src/utils/auth.ts`, `src/utils/authTokens.ts` — separate legacy token helpers and password/waitlist token storage.
- `src/utils/rateLimit.ts` — process-local in-memory rate limiting.
- `src/utils/db.ts` — Prisma 7 PostgreSQL adapter and TLS/pool setup.
- `src/utils/connectorSecurity.ts`, `src/utils/calendarCrypto.ts` — existing encryption/security patterns.
- `src/app/(dashboard)/layout.tsx` — authenticated workspace shell, navigation, notifications, and `Contracts` route registration.
- `infrastructure/aws/jobs.tf`, `infrastructure/aws/lambda/job_runner.py`, `infrastructure/aws/variables.tf`, `infrastructure/aws/parameters.tf` — scheduled HTTP job runner and contract billing flag.
- `src/app/api/contracts/maintenance/route.ts` — cron-protected expiry, overdue invoice, and contract billing maintenance.

### Contracts backend

- `src/app/api/workflow/contracts/route.ts` — authenticated list and draft creation; client/project ownership checks; payment plan snapshot; project coverage update.
- `src/app/api/workflow/contracts/template/route.ts` — client/project template hydration and default clause readiness.
- `src/app/api/workflow/contracts/[id]/route.ts` — owned detail, new version creation, clause/payment editing, and voiding.
- `src/app/api/workflow/contracts/[id]/review/route.ts` — review-link creation, expiry, revocation, and optional email.
- `src/app/api/workflow/contracts/[id]/comments/route.ts` — owner comments and comment status changes.
- `src/app/api/workflow/contracts/[id]/finalize/route.ts` — final-version checks, open-comment guard, signer checks, and finalization.
- `src/app/api/workflow/contracts/[id]/start-signing/route.ts` — provider envelope creation, signing-link creation, signer sequencing, and invitation email.
- `src/app/api/workflow/contracts/[id]/signing-links/route.ts` — authenticated signing-link reissue and revocation.
- `src/app/api/workflow/contracts/[id]/artifact/route.ts` — authenticated executed PDF rendering.
- `src/app/api/workflow/contracts/[id]/billing/run/route.ts` — authenticated billing worker trigger.
- `src/app/api/public/contracts/review/[token]/route.ts` — bearer-token public review, comments, approval, and last-access update.
- `src/app/api/public/contracts/sign/[token]/route.ts` — bearer-token typed signature, decline, sequence enforcement, execution, artifact evidence, and billing kick.
- `src/app/api/public/contracts/artifact/[token]/route.ts` and `src/app/api/public/contracts/sign/[token]/artifact/route.ts` — public artifact links and on-demand PDF rendering.
- `src/utils/contracts.ts` — current content type, default legal clauses, normalization, hashing, token generation, provider flags, status helper, and event/notification helpers.
- `src/utils/esign.ts` — local demo and first-party Rive provider adapters.
- `src/utils/contractPdf.tsx` — React PDF rendering and signature evidence footer.
- `src/utils/contractBilling.ts` — eligibility checks, claim/recovery, one-invoice-per-payment-plan-item, notification, and email prompt.
- `src/utils/email.ts` — review, signing, executed-contract, invoice-ready, and invoice-sent emails.

### Contracts frontend and tests

- `src/app/(dashboard)/workflow/contracts/page.tsx` — list, filters, action counts, uncovered-project prompt, and composer launch.
- `src/app/(dashboard)/workflow/contracts/[id]/page.tsx` — detail workspace, editor, review/signing links, clauses, payment triggers, comments, history, artifact, and void actions.
- `src/components/contracts/ContractComposer.tsx` — three-step client/project/terms/payment draft composer.
- `src/app/review/[token]/page.tsx` — public review/comments/approval experience.
- `src/app/sign/[token]/page.tsx` — public signing experience and typed-name consent UI.
- `tests/e2e/contracts-ux.spec.ts` — mocked responsive/authenticated Contracts UI checks.
- `tests/e2e/public-routes.spec.ts` and `tests/e2e/server-guards.spec.ts` — public-route and authentication guard checks.
- `scripts/smoke-contracts.mjs` — real-database end-to-end smoke path for coverage, review, versioning, signing, PDF, milestone billing, invoice delivery, idempotency, and destructive guards.
- `scripts/inspect-contract-smoke.mjs` and `scripts/cleanup-contract-smoke.mjs` — smoke fixture inspection/cleanup.

### Connected modules

- `src/app/api/workflow/clients/route.ts` and `src/app/api/workflow/clients/[id]/route.ts` — client ownership and deletion guards.
- `src/app/api/workflow/projects/route.ts` and `src/app/api/workflow/projects/[id]/route.ts` — project/milestone lifecycle and Contract protection.
- `src/app/api/workflow/projects/[id]/contract-coverage/route.ts` — external/none/undecided coverage decision.
- `src/app/api/workflow/milestones/[id]/route.ts` — milestone completion, contract snapshot acknowledgement, and billing trigger.
- `src/app/api/workflow/invoices/route.ts` and `src/app/api/workflow/invoices/[id]/send/route.ts` — invoice calculations, status transitions, delivery, and generated-invoice guards.
- `src/app/api/notifications/route.ts` and `src/app/(dashboard)/layout.tsx` — in-app notification persistence and presentation.
- `src/app/api/uploads/presign/route.ts`, `src/utils/clientUploads.ts`, and `src/app/api/public/assets/[...key]/route.ts` — current image-only object storage path; no Contract attachment path.
- `src/app/api/portfolio/route.ts`, `src/utils/portfolio.ts`, `src/utils/portfolioProvisioning.ts`, and `src/components/portfolio/*` — portfolio foundation with no accepted-agreement verification link.
- `src/utils/calendar.ts` and `src/app/api/calendar/*` — calendar projection/sync foundation; no Agreement-generated events.

## Existing functionality and status

“Fully functional” below means functional within the current limited Contract scope, not complete against the target Agreement product.

| Capability | Current status | Evidence and boundary |
| --- | --- | --- |
| Create a draft | Partially functional | `POST /api/workflow/contracts` validates the owner/client/project relationship and creates signers, payment rows, a version, and a creation event. It requires a pre-existing `Client`; there is no party/company/contact creation transaction. |
| Client/project reuse | Fully functional in current scope | `src/app/api/workflow/contracts/template/route.ts` and `contracts/route.ts` snapshot existing client fields and project brief/milestone IDs. |
| Structured agreement content | Partially functional | `ContractVersion.content` is JSON with typed TypeScript shapes in `src/utils/contracts.ts`; important terms are not queryable relational data and there is no schema registry beyond `schemaVersion: 1`. |
| Legal clause templates | Partially functional | `DEFAULT_CONTRACT_SECTIONS` is server-side and required clauses are reinserted by `normalizeSections`, but there is no persisted, versioned template catalog, locale, author, legal review status, or clause provenance. |
| Review link | Partially functional | `POST /review` creates a random token, stores only its hash, supports expiry/revocation, comments, and approval. The link is a bearer credential; there is no review session or client identity verification. |
| Comments | Fully functional in current scope | `ContractComment`, public POST, owner PATCH, events, and notifications work together. Comments are version-scoped. There is no threaded reply, attachment, or formal change-request relation. |
| Client review approval | Partially functional | Any holder of a valid review link can POST `action: approve` with an arbitrary name/email; the server records a notification/event but no OTP or verified signatory identity. |
| Immutable versions | Partially functional | Every owner PUT creates a new numbered `ContractVersion` with a canonical JSON hash and revokes old links. There is no stored diff/reason, rendered snapshot, sent/viewed/accepted flags, or database-level immutability trigger. |
| Finalization | Partially functional | `finalize/route.ts` validates email, open comments, signers, currency, and milestone due-date snapshots. Enforcement is duplicated in route branches, and the exported transition helper is not used. |
| Signer sequencing | Fully functional in current scope | `start-signing` assigns client sequence 1/owner sequence 2; public signing checks unfinished prior signers. |
| Typed signature | Partially functional | `sign/[token]/route.ts` records a typed value, consent text version, provider label, IP/user-agent hashes, timestamp, and provider event ID. This is not OTP verification or a regulated/eIDAS-style signature. |
| E-sign provider abstraction | Partially functional | `src/utils/esign.ts` has `EsignProvider`, local, and first-party Rive adapters. Both providers create random envelope IDs and no provider callback route exists even though `start-signing` supplies `/api/public/contracts/sign/provider-callback`. |
| Executed artifact | Partially functional | An evidence JSON is stored in `ContractArtifact`; `contractPdf.tsx` renders a PDF on demand. The actual bytes are not stored or hashed, so the downloaded PDF can change with renderer/runtime changes. |
| Payment plan | Fully functional in current scope | `ContractPaymentPlanItem` stores one trigger per planned item and snapshot content includes the plan. Supported triggers are signing, milestone complete, milestone due, and fixed date. Recurring terms, deposits/taxes rules, and amendment revisions are absent. |
| Invoice generation | Partially functional | `contractBilling.ts` claims occurrences and creates one draft invoice per item. It is idempotent for the current one-shot model, but tax is hardcoded to zero, there is no contract-invoice link domain, and there is no validated payment-event model. |
| Invoice delivery | Partially functional | `invoices/[id]/send/route.ts` claims sending, records `InvoiceDelivery`, leaves a draft on delivery failure, and emits a Contract event where linked. There is no retry queue or webhook reconciliation. |
| Payment tracking | Backend/frontend-only outside Contracts | Invoice status can be set to `paid` through the generic invoice PUT route, but there is no payment transaction/provider/evidence record and no Contract-specific business rule for payment received. |
| Milestones | Partially functional | `Milestone` is a project row with title/due/completed. `milestones/[id]` drives billing and protects snapshot dates. There are no submissions, deliverable files, external links, client reviews, revision counts, or approval identity. |
| Tasks | Not integrated with Contracts | `Task` exists and is project-linked, but no Contract route creates tasks or ties task changes to scope/amendments. |
| Project generation | Not implemented | Contract creation links to an existing project and updates `contractCoverage`; acceptance never creates/updates a project, milestones, tasks, calendar events, or invoice schedule transaction. |
| Calendar | Not integrated with Contracts | `src/utils/calendar.ts` projects existing project/milestone/invoice/task dates; no Agreement generation outbox/event is present. |
| Change requests/amendments | Not implemented | `ContractComment` can carry a note; there is no formal requested change, impact, approval, amendment version, or project/invoice synchronization model. |
| Attachments/files | Not implemented for Contracts | `ContractArtifact.objectKey` exists but is unused; uploads are image-only and scoped to `purpose: portfolio`. |
| Audit/event trail | Partially functional | `ContractEvent` is server-created in main flows and surfaced in detail; it is not hash-chained, not protected by DB triggers, cascades on Contract deletion, is capped at 100 in the detail read, and is not a shared append-only domain event system. |
| Notifications | Partially functional | Contract comments, approval, decline, execution, and invoice drafts create persisted `Notification` rows; email is best-effort in request handlers. There is no delivery/outbox relation or client notification channel. |
| Public link security | Partially functional | Links use 32 random bytes, hashed storage, expiry, revocation, and process-local rate limits. There is no token rotation session, OTP challenge, access log, cookie-bound session, distributed throttling, or public route abuse budget. |
| Workspace/organisation ownership | Backend-only single-user boundary | Nearly every query filters `userId`; `User` is the only workspace owner entity. There are no organisations, memberships, roles, or team permissions. |
| Portfolio | Not integrated with Contracts | Portfolio has its own content/revision/publish model. It cannot derive a confidential-safe verified-work record from accepted milestones and client-approved public details. |
| Feature flags | Partially functional | `CONTRACTS_ENABLED` and `ESIGN_PROVIDER` are environment gates. There is no per-workspace rollout, kill switch by capability, or persisted flag audit. |
| Background jobs | Partially functional | AWS EventBridge/Lambda calls `/api/contracts/maintenance` every 15 minutes when enabled. Expiry and billing run in bounded synchronous loops; evidence/PDF/notifications are not queued. |
| Proposals | Not present | No proposal model or route was found; contract creation starts from a client/project/template. |
| OTP/verification | Not present | No OTP, challenge, verification attempt, or provider webhook model/route was found. |

## Existing architecture

### Current request/data flow

```text
authenticated User session
  -> Contract routes (userId filter)
  -> Contract + ContractVersion.content JSON
  -> bearer review/sign link (token hash)
  -> public route
  -> ContractEvent / Signature / BillingOccurrence
  -> Invoice / Notification / email
```

### Route surface

| Surface | Routes | Ownership/credential model |
| --- | --- | --- |
| Authenticated UI/API | `/workflow/contracts`, `/workflow/contracts/[id]`, `/api/workflow/contracts*` | `getSessionUser(req)` plus `where: { userId: session.userId }`; no role layer. |
| Public review | `/review/[token]`, `/api/public/contracts/review/[token]` | Hashed bearer token; anonymous name/email supplied in POST. |
| Public signing | `/sign/[token]`, `/api/public/contracts/sign/[token]` | Hashed bearer token; typed name must match signer snapshot; no OTP/session. |
| Public artifact | `/api/public/contracts/artifact/[token]`, `/sign/[token]/artifact` | Hashed bearer artifact/sign link; 90-day artifact link or still-valid signer link. |
| Maintenance | `/api/contracts/maintenance` | Exact `Authorization: Bearer ${CRON_SECRET}`; expires contracts, marks invoice overdue, runs billing. |

### Database entities and relationships

The current physical graph is:

```text
User 1---* Contract *---1 Client
             |
             *---0..1 Project
             |
             *---* ContractVersion
             |       |
             |       *---* ContractSignature
             |       *---* ContractReviewLink
             *---* ContractSigner
             *---* ContractComment
             *---* ContractEvent
             *---* ContractArtifact
             *---* ContractPaymentPlanItem ---0..1 Milestone ---1 Project
                         |
                         0..1 ContractBillingOccurrence ---0..1 Invoice
```

Important current schema facts from `prisma/schema.prisma`:

- All Contract lifecycle/status/provider/role/event strings are unconstrained `TEXT`/Prisma `String`; the database has no check constraints or native enums.
- `ContractVersion.content` is `Json`; `contentHash` and `(contractId, version)` uniqueness exist.
- `ContractSigner` has `(contractId, role)` uniqueness, but no check that one signer is a client and one is an owner, that sequences are unique, or that user/client records belong to the Contract owner.
- Contract foreign keys protect row existence but cannot enforce same-owner relationships between `Contract.userId`, `Client.userId`, and `Project.userId`.
- `ContractEvent` points to a Contract with `ON DELETE CASCADE`; history can disappear when the root is deleted, although normal API deletion is converted to void for most records.
- `ContractArtifact` has nullable `objectKey` and JSON `content`; it does not require a durable object or one immutable artifact per version.
- `ContractBillingOccurrence.paymentPlanItemId` and `invoiceId` are unique, which protects the current one-shot occurrence model.

### Statuses actually in use

`src/utils/contractStatus.ts` declares `draft`, `in_review`, `ready_to_sign`, `starting`, `signing`, `executed`, `declined`, `void`, and `expired`, including same-state idempotency and optimistic expected-state predicates. Root Contract status changes in the current workflow now go through `transitionContractStatus`; the database still stores compatibility strings without a check constraint, so the static writer test remains part of the guardrail.

### Authorization model

The repository is a single-user-per-workspace model. `User` owns `Client`, `Project`, `Invoice`, `Contract`, notifications, portfolio, calendar, and tasks. Authenticated routes generally scope by `userId`. Contract create/update paths additionally validate client/project/milestone ownership, and generic project/invoice/client routes have Contract-specific deletion/edit guards. There is no organisation ID, workspace membership, role, permission, admin boundary, or delegated agency signatory model.

### File storage and PDFs

`src/app/api/uploads/presign/route.ts` accepts only image MIME types for `purpose: portfolio`; no contract attachment upload exists. `src/utils/contractPdf.tsx` uses `@react-pdf/renderer` server-side, but execution stores evidence JSON and a hash of that evidence, then regenerates PDF bytes when downloaded. `objectKey` is never populated.

### Notifications, email, and jobs

Contract routes create `Notification` rows in the same transaction for some events and call SMTP email functions after commits with `.catch(() => undefined)` in several paths. There is no outbox, delivery retry table, provider webhook reconciliation, or job queue for Contract work. AWS EventBridge invokes a Lambda HTTP runner; `/api/contracts/maintenance` handles expiry and billing every 15 minutes when `contract_billing_jobs_enabled` is true.

## Critical problems and risks

### P0 — resolve before broad Contract expansion

1. **Anonymous bearer possession is being used as acceptance identity.** `src/app/api/public/contracts/review/[token]/route.ts` accepts approval from any token holder with a user-entered name/email. `src/app/api/public/contracts/sign/[token]/route.ts` only adds typed-name matching and a checkbox. This can be useful as a basic recorded acceptance, but it is not OTP-verified identity and must not be marketed as regulated e-signature or court-proof evidence.
2. **The provider callback URL is dead.** `start-signing/route.ts` passes `/api/public/contracts/sign/provider-callback`, but no matching route or webhook verification handler exists. A future provider cannot reliably reconcile asynchronous envelope events.
3. **The database has no status constraint.** Phase 0 addresses the current application-level gap with a complete registry, optimistic transition service, exhaustive database-free tests, and a static raw-writer scan. Future schema work is still needed to constrain/backfill historical values safely.
4. **Rendered artifacts are not immutable.** `ContractArtifact.contentHash` hashes an evidence JSON object, not the actual PDF bytes. All artifact routes call `renderContractPdf` at download time. A renderer/library/font change can produce different bytes under the same evidence hash.
5. **There is no organisation/workspace membership boundary.** `userId` is the tenant boundary. This is acceptable for a solo alpha but unsafe as soon as agency/team access, delegated signers, or support access is introduced.

### P1 — architecture/data integrity

6. **Canonical content is a large JSON blob.** Scope, clauses, payment terms, parties, and milestone snapshots cannot be queried, constrained, diffed, or independently permissioned. This prevents reliable Agreement-to-Project, reporting, and evidence export.
7. **Cross-tenant integrity is application-only.** Database foreign keys do not ensure a Contract's client/project have the same owner. The current routes check it; future writers or backfills may not.
8. **Event history is not append-only at the storage boundary.** There is no event type registry, `previousHash`, sequence, DB trigger, or restricted writer. Events also cascade with Contract deletion and only 100 are returned in the detail endpoint.
9. **Public-link throttling is process-local.** `src/utils/rateLimit.ts` uses a `Map`, so limits reset on deployment and do not coordinate across instances. Phase 0 adds privacy-safe structured access logs for review, acceptance, and artifact GETs; mutation throttling remains process-local until a shared limiter is introduced.
10. **Public payloads expose more PII than necessary.** Review/sign responses include client email/address through the content snapshot and signing response. The link is intended for the named recipient; a stolen link should have minimized data until verification succeeds.
11. **No idempotency contract exists for externally retried writes.** Review-link creation, draft creation, signing-link reissue, email delivery, and project/invoice side effects lack request idempotency keys. Billing is comparatively safe because occurrence and invoice IDs are unique, but the surrounding operations are not.
12. **Email and notification delivery are dual writes without recovery.** Database events may commit while email fails; later retries are not durable or deduplicated. Some notification failures are deliberately swallowed.
13. **Billing is only a one-shot draft-invoice generator.** It hardcodes tax to zero, has no deposits/recurring/fixed schedule aggregate, no payment-event ledger, and generic invoice PUT can mark a non-cancelled invoice paid without a validated payment record.
14. **Project operations are not generated from acceptance.** A Contract must already point at a Project. Milestones/tasks/calendar/invoice schedule remain manually connected, so the accepted agreement is not yet the operational source of truth.
15. **Milestones do not carry delivery evidence.** A boolean `completed` can make a billing trigger eligible without submission, files, links, client review, revision count, or approval identity.
16. **Attachments/change requests/amendments/evidence packs are absent.** Comments are not a substitute for a controlled change request; the implementation cannot preserve file hashes or export a trusted dispute timeline.
17. **No verified-work path exists.** Portfolio content is independent and public by user choice; there is no client-approved public projection from an accepted Agreement and completed milestones.

### P2/P3 — maintainability/product/legal risk

18. Status, signer, billing, and event values are unconstrained strings across UI and routes.
19. Contract legal text is server-side but has no template/version/legal-review metadata and the default clause wording could be interpreted as legal advice if presented too strongly.
20. `ContractSigner.email` can be an empty string for a client during draft creation, while finalization later requires an email; party readiness is deferred and not represented as a domain status.
21. `reviewExpiresAt` is one field serving review and signing expiry; separate link/session expiry semantics are not modeled.
22. Payment plan editing is rejected only after an occurrence exists; there is no amendment model for changing accepted economic terms.
23. Phase 0 adds exhaustive database-free Contract state-transition tests and a raw-writer static scan. There are still no repository unit tests for money/date calculation or token/security helpers; the main real flow is a script plus Playwright UI mocks.
24. Current public URLs are stable but token metadata does not include access session, recipient binding, rotation count, or purpose-specific challenge state.
25. The current UI and user-facing messages now use Agreements/recorded acceptance vocabulary while the Contract file names, database fields, event codes, and public route shapes remain compatibility interfaces.

## Existing assets worth preserving

- The Prisma 7 PostgreSQL adapter and existing `userId` ownership query style in `src/utils/db.ts` and workflow routes.
- `ContractVersion` numbering, `contentHash`, and version-scoped link/comment/signature relations as the seed of immutable versions.
- `createAccessToken`, `hashAccessToken`, token expiry/revocation, and `Cache-Control: no-store` on public review/sign reads; these are good primitives even though session binding and distributed abuse controls are missing.
- `ContractContent`, `stableStringify`, `sha256`, `normalizeSections`, and required-clause recovery in `src/utils/contracts.ts` as a compatibility serializer while structured rows are introduced.
- `EsignProvider` in `src/utils/esign.ts` as the vendor boundary; replace the stub implementations rather than coupling routes to a vendor.
- Transactional claim/recovery pattern in `src/utils/contractBilling.ts`, unique occurrence/invoice relations, and existing invoice edit/send guards.
- Existing project/milestone/client ownership checks and destructive-action protection in `projects/route.ts`, `milestones/[id]/route.ts`, `clients/[id]/route.ts`, and `invoices/route.ts`.
- `contractCoverage` and external-contract metadata on `Project` as an interim discovery/activation signal.
- Server-rendered PDF utility `src/utils/contractPdf.tsx`; evolve it to persist a canonical render rather than replacing it.
- Email templates and delivery records in `src/utils/email.ts` and `InvoiceDelivery`.
- `ContractEvent` and `AuditEvent` as seeds for a unified append-only event/outbox strategy, with data-retention and immutability improvements.
- `scripts/smoke-contracts.mjs`, which already covers many important regressions and should become the compatibility suite for the Agreement migration.
- AWS EventBridge/Lambda job runner and existing cron secret path for scheduled expiry/billing; add durable job semantics before adding more jobs.
- Current client review/signing UI patterns, responsive layout, accessibility labels, and public route tests.

## Recommended target architecture in one paragraph

Adopt an Agreement domain module inside the current modular monolith. Keep `contracts` and existing UUIDs as the compatibility root at first, but expose it through an `Agreement` aggregate/repository. Store canonical structured version snapshots and rendered artifact bytes separately; keep accepted versions immutable. Add explicit state-transition and authorization services, purpose-specific public links plus review sessions and verification attempts, provider adapters plus signed webhooks, an append-only event/outbox layer, deterministic transactional project-generation records, structured milestone submission/review and change-request/amendment models, contract-invoice links and payment events, asynchronous evidence exports, and privacy-preserving verified-work projections. Use `workspaceId`/membership roles once team support is introduced; until then, continue enforcing `userId` on every authenticated query and never treat a public link as stronger identity evidence than the method actually used.

## Proposed migration strategy

1. Freeze further schema drift and add baseline tests/observability behind `CONTRACTS_ENABLED`.
2. Introduce domain names and repository/service boundaries without renaming physical tables or URLs.
3. Add structured child tables keyed by existing Contract and ContractVersion IDs; backfill from JSON with a quarantine report for malformed records.
4. Keep `ContractVersion.content` as a compatibility snapshot during a dual-read period; write both structured rows and the legacy JSON snapshot transactionally for new versions.
5. Add strict database constraints only after discovery/backfill validation; do not rely on TypeScript enums alone.
6. Add public-link sessions/verification alongside the current bearer flow; initially keep “basic recorded acceptance” explicit and gate OTP-required acceptance by feature flag.
7. Add durable rendered PDF/object storage, then generate evidence exports asynchronously.
8. Add project-generation records and idempotent conversion for newly accepted Agreements; never silently rewrite historical accepted content.
9. Add deliverable/approval/change-request/amendment flows and contract-invoice/payment events.
10. Only after compatibility telemetry is clean should the code use `Agreement` as the primary domain name; a physical table rename is optional and must preserve UUID URLs through a compatibility view or mapping.

## First safe engineering slice

The first code slice recommended after this audit is narrow and reversible:

- formalize the current live `starting` status in `src/utils/contracts.ts`;
- centralize the allowed current Contract transitions, including idempotent self-transitions;
- call that guard from review creation, finalization, signing start/rollback, public decline/execution, version reset, and void paths;
- add a pure transition matrix test fixture to the existing test strategy without changing the database schema or public URLs.

This does not claim the current Contract lifecycle is the final Agreement lifecycle. It prevents new impossible current-state records while the additive Agreement migration is designed.

## Assumptions and decisions requiring founder input

### Assumptions used for this audit

- The audited branch is the intended source of truth; no uncommitted work was present at audit start.
- Rive is currently a single-user workspace product; `User` is the effective tenant boundary.
- Existing Contract UUIDs and `/review/[token]`, `/sign/[token]` URL shapes must remain valid for already-issued links.
- The first acceptance method may remain “basic recorded acceptance” for development/alpha, but product copy must not call it OTP-verified or regulated e-signature.
- Indian users/currency are a primary context, but tax, governing law, signer authority, and retention requirements remain legal/product decisions.

### Founder/product/legal decisions required

1. Should the public product language say “recorded acceptance,” “electronic signature,” or reserve “signature” for an external provider? Legal counsel should approve the consent text and claims.
2. Which initial verification method is required for production: email link only, email OTP, phone OTP, an external e-sign vendor, or a tiered choice by risk/plan?
3. Is the acceptance order always client then Rive owner, or should the sender be able to choose order and add multiple authorised representatives?
4. What is the minimum agency/team permission model and who may send, amend, void, view PII, export evidence, or act as a signatory?
5. What are the retention/deletion rules for agreements, IP/device metadata, attachments, and evidence exports by region and plan?
6. Which tax systems, currencies, recurring billing, deposits, payment providers, and invoice numbering rules are in scope for the first operational conversion release?
7. Should accepted Agreements automatically generate a project, or require a preview/confirmation step every time?
8. Which client-approved fields may appear in Verified Work, and what happens when an engagement is disputed or confidential?
9. Which clause templates are counsel-reviewed, for which jurisdictions, and how will template changes be versioned and communicated?
