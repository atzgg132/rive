# Open beta local testing

This checklist covers the waitlist-to-open-signup transition, verification, feedback capture, admin funnel, and invoice flow. It is intentionally local-only; it does not deploy or mutate a production environment.

## Configure and migrate

1. Copy `.env.example` to `.env.local`.
2. Set a reachable development `DATABASE_URL`, a long `SESSION_SECRET`, a different `CRON_SECRET`, and `APP_URL=http://localhost:3000`.
3. Keep `EMAIL_PROVIDER="console"` for local testing.
4. Run:

```bash
npm run db:generate
npm run db:migrate
npm run dev
```

## Signup and verification smoke test

1. Open `/register` in a fresh browser session.
2. Confirm there is no waitlist or invitation gate.
3. Register with a new address.
4. Confirm the response says verification is required and no authenticated workspace session is created yet.
5. Copy the verification URL printed by the server's `[email:console]` log and open it.
6. Confirm the account is signed in and `/api/auth/session` reports `emailVerifiedAt`.
7. Log out, try to log in before verification with another new account, and confirm the response offers resend verification rather than creating a session.
8. Use resend twice and confirm the older link is rejected after the newer token is issued.

Legacy accounts whose verification requirement is null should continue to work. Existing invitation links should lead into normal registration and only preserve referral context.

## Product analytics and feedback smoke test

1. Complete onboarding with a business type, profession, primary goal, starting path, and acquisition source.
2. Create a real client, project, and connected outcome. Confirm records created through the product carry `dataOrigin="user"`.
3. Confirm the contextual feedback prompt appears after the relevant delay, can be dismissed or snoozed, and can be submitted with a rating, optional text, and optional contact permission.
4. Open `/admin`, sign in, and verify Overview, Funnel, Users, Feedback, and Reliability load without exposing raw feedback context or secrets.
5. Confirm the funnel distinguishes qualified, activated, deeply activated, real-data, WAU/MAU, W1, workflow depth, activation path, and acquisition source.

## Invoice smoke test

1. Open `/workflow/invoices/new` and create a draft without manually entering an invoice number.
2. Confirm numbering is assigned server-side and is unique per workspace.
3. Add decimal quantities/rates, a discount, a tax rate, a client, and a project. Confirm the server-calculated subtotal, discount, tax, total, and live preview agree.
4. Send the invoice. Confirm the delivery event is recorded, a professional server PDF can be downloaded, the public link uses a random token, and the public page never exposes draft data.
5. Open the public link once and confirm the invoice view is recorded; download its PDF and confirm it uses the immutable sent snapshot.
6. Record a partial payment and then the remainder. Retry the same payment with the same `Idempotency-Key` and confirm it is not duplicated.
7. Void only an unpaid invoice and confirm paid, partially-paid, sent, and Agreement-generated invoices are blocked; confirm sent invoices cannot be edited or deleted.
8. Use invoice settings to save sender details and a prefix, then create another invoice. Move the due date into the past and confirm the lifecycle changes it to overdue on the next invoice/summary read.

## Background email delivery

For SMTP/SES delivery, run the protected outbox endpoint from a scheduler with the configured bearer secret:

```bash
curl -X POST http://localhost:3000/api/cron/email-outbox \
  -H "Authorization: Bearer $CRON_SECRET"
```

The console provider processes verification mail immediately to make local testing deterministic. Production must use a real provider, a stable `APP_URL`, scheduled outbox processing, and the migrated schema before enabling open signup.
