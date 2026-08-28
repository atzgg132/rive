# Agreements Phase 0 closure

> **Historical snapshot (2026-08-03).** This document records the evidence and
> decision at the end of the original Phase 0 slice; its flags, limitations,
> test counts, and closure status are not the current release state. See
> `docs/RELEASE_TRANCHE_HANDOFF.md` and `docs/contracts.md` for the current
> implementation and operational gates. In particular, later work added the
> durable email outbox and database migration that were explicitly out of scope
> here. The statements below are retained as a dated audit trail.

Date: 2026-08-03
Baseline: `29bb7f3` (`Complete contracts workflow and billing integration`)
Scope: transition audit, database-free guards, terminology, provider fail-closed behavior, privacy-safe public-link telemetry, and test diagnosis.
Explicitly out of scope: schema migrations, OTP, durable artifact storage, outbox/project-generation/evidence-pack migrations, and Verified Work.

## Decision

PHASE 0 NOT CLOSED

The Phase 0 implementation slice is substantially complete, but closure is withheld because the database-backed E2E/integration evidence is not conclusive in this environment. PostgreSQL is unavailable and no `E2E_USER_EMAIL` is configured. The available browser/API shards pass; the database-required shard cannot establish a pass.

No schema migration was started. The physical `contracts` tables, Contract IDs, legacy field names, internal event codes, and public URL shapes remain intact.

## Transition registry

`src/utils/contractStatus.ts` is the pure registry. Registered states support same-state idempotency; an unregistered current or next state is rejected. `buildContractStatusUpdate` adds the expected current status to the `where` clause and the new status to `data`, so a stale writer cannot silently update a record in another state.

| Current state | Allowed next states | Operational meaning |
| --- | --- | --- |
| `draft` | `in_review`, `ready_to_sign`, `void` | Private editable version, review, direct finalization, or void. |
| `in_review` | `draft`, `ready_to_sign`, `expired`, `void` | Review/revision, finalization, expiry, or void. |
| `ready_to_sign` | `draft`, `starting`, `in_review`, `expired`, `void` | Finalized version can be replaced, acceptance can be claimed, review can be reopened, or request can close. |
| `starting` | `ready_to_sign`, `signing`, `expired`, `void` | Live provider-preparation claim with recovery on provider/transaction failure. |
| `signing` | `executed`, `declined`, `expired`, `void` | Sequenced acceptance collection, decline, expiry, or cancellation. |
| `executed` | `void` in the pure registry; no current user route permits it | Accepted evidence is immutable for editing and acceptance. The explicit executed-to-void policy remains an unresolved administrative-action decision. |
| `declined` | `draft`, `in_review`, `void` | Requested changes can produce a new version/review or close the record. |
| `void` | none | Terminal compatibility state. |
| `expired` | `draft`, `in_review`, `ready_to_sign`, `void` | Reissue/revise/finalize again or close. |

The domain tests cover every declared allowed and rejected pair, every registered same-state pair, `starting` recovery, partial decline, expiry reissue, version replacement, void/executed guards, and stale expected-state construction. They also scan API/util source for raw root Contract status writes. The only permitted root status writer is `transitionContractStatus`; Contract creation uses the Prisma `draft` default, and the signing-link route's `status: "signing"` is an optimistic predicate, not a write.

## Route transition coverage

| Route/operation | Entry predicate and root transition | Side effects and ordering | Retry, HTTP/error, and recovery |
| --- | --- | --- | --- |
| `POST /api/workflow/contracts` | Controlled root creation; Prisma default is `draft`, with no explicit raw status write. | One transaction creates the root, signers, payment-plan rows, version, event, and project coverage. | No idempotency key; a client retry can create duplicates. Transaction errors roll back. |
| `POST /api/workflow/contracts/[id]/review` | `draft`/`in_review`/`expired` -> `in_review`; same-state `in_review` is supported. Final versions are rejected. | Old review links are revoked and the new hashed link is created before the optimistic root update; event is in the same transaction. Review email is attempted after commit. | Stale status rolls the transaction back. Expired requests can be reissued. Email failure leaves the link available for copy/retry. |
| `POST /api/workflow/contracts/[id]/finalize` | `draft`/`in_review`/`expired` -> `ready_to_sign`; already `ready_to_sign`/`signing` returns an idempotent success response. | An expired provider envelope is voided before the transaction. The transaction updates the root, finalizes the exact version, revokes review links, and records the event. | Provider cleanup failure returns `502` and leaves status unchanged. Stale root count throws and rolls back. Open comments, changed parties, missing email, invalid payment snapshots, or prior signatures return `409`/`400`. |
| `POST /api/workflow/contracts/[id]/start-signing` | Stale `starting` claims older than 15 minutes recover to `ready_to_sign`; then `ready_to_sign` -> `starting` is claimed optimistically. | Provider envelope creation happens after the claim. The response is validated for provider, `created` status, and non-empty envelope ID. Only then does a transaction move `starting` -> `signing`, create acceptance links, invite signers, and record the event. | Claim races return `409`. Provider exception/incomplete response returns a failure and recovers `starting` -> `ready_to_sign`. Transaction failure voids the provider envelope and attempts the same recovery. No callback/webhook route is complete. |
| `POST /api/workflow/contracts/[id]/signing-links` | Only `signing`; no root status write. | Revokes the party's old acceptance links, creates a hashed replacement, updates the expiry using `where status: "signing"`, updates invitation time, and records an event. Email is after commit. | Signed parties cannot be reissued. Stale status rolls back link changes. Delivery failure is reported while the copied link remains available. |
| `PUT /api/workflow/contracts/[id]` | Editable statuses create a new immutable version and move `draft`/`in_review`/`declined`/`expired`/`ready_to_sign` -> `draft`. `starting`/`signing`/`executed`/`void` are locked. | New version, payment snapshot, signer reset, root transition, link revocation, and event are one transaction. Prior signatures remain attached to the prior version. | Optimistic status count protects stale edits. Declined/expired partial acceptance recovery is through a new version. No idempotency key. |
| `DELETE /api/workflow/contracts/[id]` | Any non-`executed`, non-`void` status -> `void`; `void` is an idempotent success; `executed` is rejected. | For `signing`, provider void happens before the transaction. The transaction moves the root, revokes links, records the event, and may reset project coverage. | Provider failure returns `502` and keeps the Agreement active. Stale status returns an error/rollback. Accepted history is retained and cannot be deleted. |
| `POST /api/contracts/maintenance` | `in_review`/`signing` with expired `reviewExpiresAt` -> `expired`. | Optimistic transaction revokes expired links and records expiry; notifications and billing maintenance follow. Invoice `overdue` writes are unrelated Invoice status writes. | Safe to rerun; stale candidates are skipped. Cron authorization is required. Expired records can re-enter review/finalization through the explicit routes. |
| `GET/POST /api/public/contracts/review/[token]` | No root transition. Review approval changes only the version from draft/approved to approved. | Hashed bearer lookup, purpose/expiry/revocation checks, request telemetry, comments/events, and approval notification. | Review POST is process-local rate-limited. Approval accepts a user-entered name/email but does not establish verified identity; this remains an alpha risk. |
| `GET/POST /api/public/contracts/sign/[token]` | GET has no transition. Decline is `signing` -> `declined`; typed-name acceptance records a signer/signature first and moves `signing` -> `executed` only when all parties are signed. | Decline atomically updates root/signer, revokes links, and records the reason/event. Acceptance is one transaction: signature, signer status, event, final root transition, billing occurrences, evidence JSON/hash, and artifact link. | Sequence enforcement prevents owner-before-client. Decline is idempotent for an already-declined party and cannot replace an existing signed party. Duplicate signature `P2002` is reconciled as already accepted only when the signer/Contract state matches. Provider failure never reaches acceptance. |
| `GET /api/workflow/contracts/[id]/artifact` and public artifact routes | No transition; only accepted status/artifact checks. | PDF is rendered from the accepted version/evidence and access is logged without raw token/URL/name. | Missing/expired/revoked/not-ready links return bounded errors. Rendered PDF bytes are still regenerated on demand; durable immutable bytes remain a future risk. |
| Comments, billing-run, project coverage, and list/detail GET routes | No root Contract status write. | Comments/events, billing occurrence claims, and project/invoice projections are separate concerns. | Static scan explicitly distinguishes Invoice/payment-plan/signer/version status writes from root Contract status writes. |

### Transition side-effect invariants

- No provider response can mark an Agreement accepted; provider preparation must validate before `starting -> signing`, and cleanup is attempted on transaction failure.
- No email delivery result can mark an Agreement accepted. Link creation is committed first; delivery failure is returned as a delivery reason.
- Accepted versions and their evidence are not auto-deleted. The current user route rejects deleting `executed` records.
- The current `executed -> void` registry entry is not exposed by that route; founder/legal policy should decide whether an explicit administrative void action is ever allowed while retaining evidence.
- All route root status changes use optimistic expected-state predicates. Same-state updates are limited to registered states and are not a bypass for unknown/raw statuses.

## Terminology and product surface

Completed in the current surface:

- Navigation, composer, list/detail pages, project coverage, revenue links, review page, and acceptance page say **Agreements**, **recorded acceptance**, **typed-name acceptance**, **acceptance record**, and **accepted version**.
- Public API messages, notification titles, comments/timeline labels, acceptance emails, review emails, and PDF headings use the same vocabulary.
- Consent text version is `2026-08-03-v2` and explicitly says this is not an OTP or identity-verification result.
- No current flow claims regulated, verified, or digital-signature status. Internal compatibility names such as `contracts`, `signatures`, `signedAt`, `signatureValue`, `signing`, event codes, and public routes remain unchanged.
- Existing future-state architecture documents may mention OTP/external e-sign as planned adapters; those references are not claims about the current alpha.

## Provider and operational behavior

- `EsignProvider` remains provider-neutral with `createEnvelope` and `voidEnvelope`.
- `local` is a development/demo adapter. In production it fails closed unless `CONTRACTS_ALLOW_LOCAL_PROVIDER_IN_PRODUCTION=true`.
- `rive` is the first-party recorded-acceptance adapter. In production it fails closed unless `CONTRACTS_RECORDED_ACCEPTANCE_ENABLED=true`.
- Unknown provider, missing production `SESSION_SECRET`, disabled Contracts, or incomplete provider response fails closed.
- The AWS parameter defaults the recorded-acceptance production flag to `false`; `.env.example` enables it only for local development. No email OTP adapter or external provider callback was added.
- `/api/public/contracts/sign/provider-callback` is still only a callback URL supplied to the interface; no complete callback route, raw-body verification, replay protection, or asynchronous reconciliation exists.

## Privacy-safe public-link telemetry

`logContractPublicLinkAccess` records only request ID, purpose (`review`/`acceptance`/`artifact`), Contract/version IDs, outcome, expiry/revocation/rate-limit booleans, hashed request IP, hashed user-agent, and timestamp. It does not log bearer tokens, URLs, typed names, OTPs, provider secrets, or full network metadata. The hash secret is `SESSION_SECRET` and production fails closed when it is missing. Review/acceptance evidence stored in the database intentionally retains named-party/evidence fields under the product evidence policy; those fields are not written to the access log.

Public mutation rate limits remain a process-local `Map` fallback for the alpha. The code documents that production multi-instance deployments need a shared durable limiter; public GETs are logged but are not yet distributed-rate-limited.

## Test evidence and diagnosis

| Check | Result | Notes |
| --- | --- | --- |
| `npm run test:domain` | 12 passed, 0 failed, 0 skipped | Exhaustive registry/transition tests and raw-root-writer scan. |
| `npm run lint` | Passed | ESLint completed without findings. |
| `npx prisma validate` | Passed | Schema validation only; no migration generated or applied. |
| `npm run build` | Passed | Next.js `16.2.12` production build and TypeScript completed. |
| E2E shard A: contracts UX, public routes, responsive, connector config | 43 passed | 50.5 seconds after updating stale old-label assertions. |
| E2E shard B: server guards | 22 passed | 17.7 seconds. |
| E2E shard C: authenticated workspace | 9 skipped | `E2E_USER_EMAIL` is not configured; no seeded authenticated workspace was available. |
| E2E shard D: admin waitlist | unavailable | PostgreSQL connection to `127.0.0.1:5432` failed before setup; 1 setup failure and 4 dependent tests did not run. |
| PostgreSQL smoke/integration | unavailable | `psql` is not installed and no reachable test database was available. |

The former monolithic run (65 passed, 14 skipped before its 180-second timeout) was not conclusive. The split run removed the browser-shard bottleneck and exposed the actual remaining environment dependency: seeded/authenticated and waitlist tests need PostgreSQL/test credentials. All Playwright server processes exited; no Node test-server processes remained.

## Remaining risks and ambiguous decisions

1. Database-backed integration and authenticated E2E must pass against a real seeded PostgreSQL instance before closure.
2. The current typed-name method is bearer-link plus name matching and consent; it is not recipient verification, OTP, or an external e-signature. Production enablement remains an explicit founder/legal decision.
3. Local/Rive adapters are incomplete stubs without callback/webhook reconciliation. The production flag must remain off until that policy is approved.
4. Status values remain unconstrained database strings; the app-level registry/static scan is a temporary guardrail.
5. Public review approval accepts arbitrary entered reviewer name/email, and public link access lacks a durable distributed limiter/session exchange.
6. Acceptance artifacts store evidence JSON/hash and regenerate PDF bytes; durable immutable rendered bytes and evidence export are future work.
7. Email/notification writes have no durable outbox/retry; acceptance itself is not rolled back when post-acceptance notification/email fails.
8. No workspace/membership tenancy, OTP, project generation, milestone evidence, amendments, or Verified Work work was started.
9. Founder/legal decision is still needed on whether the pure registry’s explicit `executed -> void` transition should remain available for a future administrative action or be removed entirely.

## Rollback and recovery

This slice has no schema/data migration to roll back. Before deployment, keep the recorded-acceptance production flag false and local-provider production override false. To disable the current runtime without deleting records, set `CONTRACTS_ENABLED=false`; existing accepted Agreements/evidence remain retained. If the code changes are reverted, revert the exact files listed below as one compatibility slice and keep any production flags disabled until the prior runtime is verified. Do not delete or rewrite accepted Contract rows as part of rollback.

## Exact files changed in this slice

Application/configuration:

- `.env.example`
- `infrastructure/aws/parameters.tf`
- `package.json`
- `docs/contracts.md`

Agreement planning/closure documents:

- `docs/agreements/current-state-audit.md`
- `docs/agreements/database-migration-plan.md`
- `docs/agreements/execution-roadmap.md`
- `docs/agreements/security-threat-model.md`
- `docs/agreements/target-architecture.md`
- `docs/agreements/target-product-spec.md`
- `docs/agreements/testing-strategy.md`
- `docs/agreements/phase-0-closure.md`

UI and public copy:

- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/workflow/contracts/page.tsx`
- `src/app/(dashboard)/workflow/contracts/[id]/page.tsx`
- `src/app/(dashboard)/workflow/projects/[id]/page.tsx`
- `src/app/(dashboard)/workflow/revenue/page.tsx`
- `src/app/review/[token]/page.tsx`
- `src/app/sign/[token]/page.tsx`
- `src/components/contracts/ContractComposer.tsx`
- `src/components/dashboard/CommandPalette.tsx`

API and transition writers:

- `src/app/api/contracts/maintenance/route.ts`
- `src/app/api/public/contracts/artifact/[token]/route.ts`
- `src/app/api/public/contracts/review/[token]/route.ts`
- `src/app/api/public/contracts/sign/[token]/artifact/route.ts`
- `src/app/api/public/contracts/sign/[token]/route.ts`
- `src/app/api/workflow/contracts/route.ts`
- `src/app/api/workflow/contracts/template/route.ts`
- `src/app/api/workflow/contracts/[id]/route.ts`
- `src/app/api/workflow/contracts/[id]/artifact/route.ts`
- `src/app/api/workflow/contracts/[id]/billing/run/route.ts`
- `src/app/api/workflow/contracts/[id]/comments/route.ts`
- `src/app/api/workflow/contracts/[id]/finalize/route.ts`
- `src/app/api/workflow/contracts/[id]/review/route.ts`
- `src/app/api/workflow/contracts/[id]/signing-links/route.ts`
- `src/app/api/workflow/contracts/[id]/start-signing/route.ts`

Utilities and tests:

- `src/utils/contractStatus.ts`
- `src/utils/contracts.ts`
- `src/utils/contractBilling.ts`
- `src/utils/contractPdf.tsx`
- `src/utils/email.ts`
- `src/utils/esign.ts`
- `src/utils/rateLimit.ts`
- `tests/domain/contract-status.test.mjs`
- `tests/e2e/contracts-ux.spec.ts`

## Recommendation

Do not begin Phase 1 schema migration planning as an execution step yet. First provide a reachable seeded PostgreSQL test environment, configure a disposable `E2E_USER_EMAIL`, rerun the database-backed shards, resolve the executed-to-void policy, and then perform a fresh closure audit. The existing additive migration and architecture documents are ready as planning inputs, but Phase 0 is not safe to declare closed.

PHASE 0 NOT CLOSED
