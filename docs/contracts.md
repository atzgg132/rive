# Agreements and recorded acceptance

The current compatibility workflow is exposed as Agreements in the product while retaining the physical `contracts` tables and routes. The two named parties review an immutable Agreement version and record typed-name acceptance; Rive stores the acceptance evidence, completed artifact, and downstream billing triggers.

## Workflow

1. Create an Agreement draft from `/workflow/contracts`.
2. Select a client/project, edit clause text, turn optional clauses on or off, and add payment items.
3. Optional — share the **review link** (step 1 on the Agreement page). It is an unguessable bearer credential, expires, and is stored only as a hash. The client can comment and say they have no more comments ("ready for the final version"); a later comment withdraws that signal. It never records acceptance.
4. Revise the draft. Every save creates a new immutable `ContractVersion`; old review links are revoked. Creating a new link while one is active asks for confirmation, because the old link stops working.
5. Finalize the exact version and request acceptance. Only the **client** receives a public acceptance link (step 2), emailed and shown once. When the client accepts, the owner gets a notification and an email, and records their own acceptance on the Agreement page while signed in (`POST /api/workflow/contracts/[id]/accept`). There is no owner link; owner links issued before this change are refused and redirect to the workspace.
6. After both parties record acceptance, Rive records the acceptance evidence, stores the accepted PDF, and **activates the payment plan immediately**. Anything already due (the on-acceptance deposit, past fixed dates) is drafted in the same request.
7. `on_signing`, milestone-completed, milestone-due, and fixed-date items create one idempotent draft invoice per payment-plan item, numbered with the owner's invoice prefix. The owner is notified and prompted to review. An invoice becomes `sent` only after the explicit send action records successful email delivery.
8. Work setup (project, milestones, dated tasks) is optional planning after acceptance. It never gates billing, and a blank date keeps the linked Project's existing date.
9. Voiding an accepted Agreement (both parties) cancels triggers that have not drafted yet and moves never-sent drafts to the `cancelled` invoice status (retained, not deleted). Sent invoices are unchanged.

Start-engagement in agreement mode puts the first payment into the Agreement as an on-acceptance payment-plan item instead of creating a separate invoice, so the client accepts the price and the invoice cannot be duplicated.

The composer reuses the existing client name, email, company, and address, plus the linked project title, brief, currency, and milestones. Those values are snapshotted into each editable Agreement version; the user only supplies Agreement-specific choices such as clauses, payment amounts, due periods, governing law, and jurisdiction. Project budgets are not silently converted into payment plans because that could create an unintended financial obligation.

## Safety invariants

- Rive is never an acceptance party. The only acceptance parties created by the workflow are the workspace owner and the selected client; legacy database fields still use signer names.
- Accepted versions cannot be edited. Editing creates a new version and revokes prior review/acceptance links.
- Client/project/milestone ownership is checked server-side; payment triggers cannot point at another project.
- Client recorded acceptance is sequenced before owner recorded acceptance. Both go through one writer (`src/utils/agreementAcceptance.ts`).
- A request whose client has already accepted never expires: the maintenance job reminds the owner once a day instead. A request that lapsed before this rule can still be completed by the owner's in-app acceptance (`expired → signing → executed`).
- A signed-in owner cannot accept on the client's link in the client's name.
- After acceptance, the client's acceptance link becomes their record link for 365 days (download and void requests), and the emailed accepted copy lasts as long. The owner can email a fresh copy at any time.
- A void of an accepted Agreement needs both parties. The client confirms through an emailed void link; the owner always confirms in the workspace.
- Route errors return a message only for `AgreementActionError`; anything else is logged and replaced with a generic message.
- Acceptance evidence contains the exact version hash, party role/name/email, consent-text version, timestamp, hashed IP/user-agent metadata, and provider event id.
- Typed-name acceptance is an alpha acceptance record. It is not an OTP result, independent identity verification, regulated/digital-signature claim, or substitute for any transaction-specific formality.
- Review and acceptance links are token-hashed, expiry-checked, revocable, rate-limited, and never returned from database reads.
- Contract-linked invoices and sent/paid invoices cannot be deleted through the normal invoice action.
- Scheduled billing claims an occurrence before creating an invoice, recovers stale claims, and uses a unique occurrence/invoice relationship to prevent duplicate drafts. It selects only triggers that are due in the database query, so future-dated triggers cannot starve due ones. Occurrences parked as `awaiting_work_setup` by the earlier release are drafted like any other due trigger.

## Provider configuration

For production, set `CONTRACTS_ENABLED=true`, `ESIGN_PROVIDER=rive`, `CONTRACTS_RECORDED_ACCEPTANCE_ENABLED=true`, and a strong `SESSION_SECRET`. The production parameter set now explicitly opts into Rive's first-party recorded-acceptance implementation. The `local` provider remains available for isolated development smoke tests; it is rejected in production unless `CONTRACTS_ALLOW_LOCAL_PROVIDER_IN_PRODUCTION=true` is explicitly set. Unknown providers, missing production secrets, disabled feature flags, and incomplete provider responses fail closed.

This release enables the current alpha acceptance record, not a regulated or independently verified electronic-signature service. Keep the consent language and product copy that explain the typed-name method and its limits, and obtain the applicable legal/product approval before marketing it as a contract acceptance workflow.

The provider-neutral `EsignProvider` interface remains the seam for a future external provider. The current `local` and `rive` adapters are not a complete external e-sign integration: there is no completed callback route, webhook signature verification, or asynchronous reconciliation. `ESIGN_WEBHOOK_SECRET` is reserved for that future adapter and is not evidence that callbacks are active. No provider failure may mark an Agreement accepted.

Public-link mutations (sign, review, void) and public GETs (artifact, review, sign) use the Postgres-backed `durableRateLimit` helper. Authenticated workspace routes may still use the process-local limiter.

## Database setup

With a configured local `DATABASE_URL`:

```powershell
npx prisma migrate deploy
npx prisma generate
npm run dev
```

For local testing against the AWS development database, authenticate with the AWS CLI and use the repository’s ephemeral SSM tunnel. It does not write the database URL to `.env.local`:

```powershell
aws login
npm run db:migrate:status:aws
npm run db:migrate:aws
npm run dev:aws
```

The disposable real-database smoke flow can be run with email delivery disabled inside its test server:

```powershell
npm run contracts:smoke:aws
```

The scheduled production job calls `POST /api/contracts/maintenance` with the existing cron bearer secret every 15 minutes. A signed-in owner can run the same logic for one contract from the contract detail page.
