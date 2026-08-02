# Contracts and e-sign workflow

The contract workflow uses a first-party Rive signing workspace. The two named parties sign the immutable contract version, while Rive records the signing evidence, completed artifact, and downstream billing triggers.

## Workflow

1. Create a contract draft from `/workflow/contracts`.
2. Select a client/project, edit clause text, turn optional clauses on or off, and add payment items.
3. Create a review link. The link is an unguessable bearer credential, expires, and is stored only as a hash. It is for preview/comments; it is not a signature request.
4. Revise the draft. Every save creates a new immutable `ContractVersion`; old review links are revoked.
5. Finalize the exact version, start signing, then use the client link first and owner link second.
6. After both signatures, Rive records the evidence, creates a completed PDF on demand, and activates the payment plan.
7. `on_signing`, milestone-completed, milestone-due, and fixed-date items create one idempotent draft invoice per payment-plan item. The owner is notified and prompted to review. An invoice becomes `sent` only after the explicit send action records successful email delivery.

The composer reuses the existing client name, email, company, and address, plus the linked project title, brief, currency, and milestones. Those values are snapshotted into each editable contract version; the user only supplies contract-specific choices such as clauses, payment amounts, due periods, governing law, and jurisdiction. Project budgets are not silently converted into payment plans because that could create an unintended financial obligation.

## Safety invariants

- Rive is never a signer. The only signers created by the workflow are the workspace owner and the selected client.
- Signed versions cannot be edited. Editing creates a new version and revokes prior review/signing links.
- Client/project/milestone ownership is checked server-side; payment triggers cannot point at another project.
- Client signing is sequenced before owner signing.
- Signature evidence contains the exact version hash, signer role/name/email, consent-text version, timestamp, hashed IP/user-agent metadata, and provider event id.
- Review and signing links are token-hashed, expiry-checked, revocable, rate-limited, and never returned from database reads.
- Contract-linked invoices and sent/paid invoices cannot be deleted through the normal invoice action.
- Scheduled billing claims an occurrence before creating an invoice, recovers stale claims, and uses a unique occurrence/invoice relationship to prevent duplicate drafts.

## Provider configuration

Set `CONTRACTS_ENABLED=true` and `ESIGN_PROVIDER=rive` in deployed environments. The `local` provider remains available for isolated development smoke tests; it is rejected when `NODE_ENV=production`.

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
