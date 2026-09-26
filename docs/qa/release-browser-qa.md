# Release browser QA

A manual pass in a real browser on https://dev.rive.work, with the same
standing accounts every release. It complements the Playwright suite; it does
not replace it.

## When it applies

- Every PR or promotion that changes something a user sees in the browser.
- Run it on dev.rive.work **after** the change has deployed to `dev`, and
  **before** the `dev` → `main` promotion.
- The report goes in the promotion PR body (format at the end of this file).

## Standing accounts

| Account | Email | Used for | Password |
| --- | --- | --- | --- |
| QA main | `arnav+rive-qa@rive.work` | Everything except 2FA | SSM SecureString `/rive/dev/QA_MAIN_PASSWORD` (ap-south-1) |
| QA 2FA | `arnav+rive-qa-2fa@rive.work` | Two-factor authentication only, so a lockout can never take QA main with it | SSM SecureString `/rive/dev/QA_2FA_PASSWORD` (ap-south-1) |

Read a password with your AWS login:

```bash
aws ssm get-parameter --region ap-south-1 --name /rive/dev/QA_MAIN_PASSWORD --with-decryption --query Parameter.Value --output text
```

Both accounts are password accounts, not Google-linked. Google sign-in uses the
Google profile's email, so it cannot reach a plus-address account.

If an AI agent runs the pass, the account owner types passwords, TOTP codes and
recovery codes, and stores any new recovery codes in their password manager.
The agent drives everything else.

## Rules

- **dev only.** Never test on rive.work (production). Never read or use a
  `/rive/prod/*` SSM parameter.
- **No destructive database commands** against the dev database: no
  `prisma db push`, `prisma migrate reset`, `prisma migrate deploy`, and no raw
  DELETE or UPDATE SQL. The only allowed write is the demo seeder below, aimed
  at QA main. Everything else goes through the web UI.
- **Client emails go to the owner's inbox.** Any client you create uses a
  plus-address such as `arnav+client1@rive.work`, `arnav+client2@rive.work`.
  Invoice reminders and receipts send real email. The seeded demo clients use
  non-deliverable `.example` addresses; never turn reminders on for invoices
  addressed to them.
- **Leave QA 2FA with 2FA turned OFF** at the end of every pass, so the next
  release starts clean.
- If you change a QA password, change it back or update its SSM parameter.
- **Don't touch other users' data.** Create or edit only records that belong to
  the QA accounts.
- **Never commit credentials.** No password, recovery code, TOTP secret or
  session token goes into the repo, a commit, a PR or an issue.
- Record each issue with its URL, viewport size and light/dark mode, plus a
  screenshot. Keep devtools open and record red console errors and failed
  (4xx/5xx) requests with the page they happened on.

## Setup and reset

### 1. Accounts

If an account is missing, register it at https://dev.rive.work/register with
the email above, verify the email, finish onboarding (choose "Explore Rive"),
and store the password in its SSM parameter:

```bash
aws ssm put-parameter --region ap-south-1 --type SecureString --name /rive/dev/QA_MAIN_PASSWORD --value '<password>'
```

### 2. Seed QA main

`scripts/seed-freelancer-demo.mjs` adds demo clients, projects, milestones,
tasks, invoices, expenses, a portfolio, enquiries and traffic. It also sets the
portfolio name to "Arnav Bhattacharya"; that is expected. It uses stable ids,
so re-running it each release refreshes the same demo records instead of
duplicating them.

Ids are scoped to the target account, so seeding QA main never touches another
account's demo records. An account seeded before scoping keeps its original
ids, so re-seeding it stays idempotent.

Run it through the same SSM tunnel that `scripts/dev-aws.ps1` opens. The
script has no action for this seeder, so in PowerShell do what it does:

1. Open the tunnel: region `ap-south-1`; the running instance tagged
   `Name=rive-app`; RDS instance `rive-postgres`; SSM parameter
   `/rive/dev/DATABASE_URL`; local port `5433`
   (`aws ssm start-session --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters host=<rds-endpoint>,portNumber=5432,localPortNumber=5433`).
2. Set `$env:DATABASE_URL` to the SSM URL with the RDS host replaced by
   `127.0.0.1:5433`. Set `DATABASE_SSL_REJECT_UNAUTHORIZED=true`,
   `DATABASE_SSL_SERVERNAME=<rds-endpoint>` and
   `NODE_EXTRA_CA_CERTS=<path to the RDS global CA bundle>`, as the script does.
3. Make sure `APP_ENV` and `NODE_ENV` are **not** `production`.
4. Dry run, and confirm the `before` output is QA main:
   `node scripts/seed-freelancer-demo.mjs --email=arnav+rive-qa@rive.work`
5. Apply:
   `node scripts/seed-freelancer-demo.mjs --email=arnav+rive-qa@rive.work --apply`
6. Close the tunnel: stop the `session-manager-plugin` process.

If the tunnel or the seed fails, stop and report the exact error. Do not
improvise other database writes.

### 3. Per-release records (browser, QA main)

Reuse these if they exist from a previous release:

- Client "QA Reminder Client" at `arnav+client<N>@rive.work`. Once a client has
  used the reminder unsubscribe link, it stays opted out. Re-test reminders
  with a fresh client (`client2`, `client3`, …) and note which clients are
  opted out in the report.
- A GBP project for that client.
- Draft invoices named with the release date so each release's records are
  distinguishable, as the release's feature checks require.

## Baseline regression checklist (every release)

- [ ] Sign in and sign out (QA main).
- [ ] The dashboard loads with the seeded data.
- [ ] Create a client, a project and an invoice.
- [ ] Send an invoice and open its public link.
- [ ] Settings loads and saves.
- [ ] Spot-check at 375px width and in dark mode.
- [ ] No red console errors or failed requests on the pages you visited.

## Feature checks by release

Append one heading per release. Keep each check as expected behaviour, so the
next pass can re-run it.

### 2026-09 — Settings, reminders, weekly summary, 2FA (#66)

**Settings (/settings), QA main**

- Reachable from the sidebar ("Settings"), the account menu when the sidebar
  is collapsed (click the avatar), the mobile menu (hamburger at phone width),
  and the command palette (Ctrl/Cmd+K → "Open settings", plus one
  "Settings: <section>" entry per section).
- Sections in order: Profile, Business & invoicing, Workspace defaults,
  Preferences, Notifications, Integrations, Referrals, Security. The left nav is sticky on
  desktop; a horizontal chip row on mobile. Links scroll to their section;
  `/settings#security` lands there directly.
- Profile: edit name, profession, business types and photo, then save and
  reload. The changes persist and the photo shows on the portfolio. An empty
  name is rejected.
- Business & invoicing: business name, contact, email, phone, address, tax ID,
  invoice prefix, default payment terms (0–365 days), payment instructions,
  default terms, logo. Terms outside 0–365 are rejected with a clear message.
  `/workflow/invoice-settings` redirects here. After saving, the Create
  invoice preview shows the real business name and logo, and a new invoice's
  due date is prefilled as today + terms.
- Workspace defaults: currency (a picker; codes that aren't ISO 4217, such as
  `ZZZ`, are rejected by the API) and time zone (sorted, UTC first). With EUR
  set, a new invoice with no project, a new expense and a new agreement default
  to EUR. A linked project's currency (e.g. GBP) wins over the workspace
  default.
- Preferences: the display currency lives here and is **not** in the top
  header (desktop or mobile). Changing it changes how amounts are shown, not
  what's stored. Theme toggle. "Replay guided tour" starts the walkthrough.
- Notifications: with "Login alert emails" off, signing in sends no "new
  sign-in" email. "Weekly business summary" toggle.
- Integrations: Google Calendar, the Apple Calendar feed and Zoho Books (only
  if enabled on dev) in one place. The Calendar page's "Calendar connections"
  modal shows the same panel.
- Security: change password needs the current password; the new one must be
  8+ characters. This session stays signed in; another browser or incognito
  session is signed out. "Sign out everywhere else" ends other sessions and
  keeps this one.

**Invoice reminders and paid receipts, QA main**

- Settings → Business & invoicing → "Invoice reminders" is OFF on a fresh
  account (note it if it's already on from a previous run). The schedule is 3
  days before due, and 1, 7 and 14 days after; each step can be toggled. "Send
  paid receipts" is OFF by default.
- Create two draft invoices for the reminder client, named with today's date:
  R1 due yesterday with no project (backdate its issue date, since a due date
  can't be earlier than the issue date), and R2 due in 14 days linked to the
  GBP project. For a reminder you can check the next day, also send an R3 due
  in 4 days.
- Sending R2 (from the invoice panel or from the invoice list) shows a one-time
  "Turn on invoice reminders?" prompt in the invoice panel, only if the account
  has never seen it. "Turn on" enables
  reminders, and the prompt never appears again. An invoice without a due date
  never triggers it.
- With reminders on, a sent, unpaid invoice with a due date has "Pause
  reminders" / "Resume reminders" (hidden while reminders are off). The
  client-facing invoice shows the business name, address and tax ID.
- **Reminder timing.** The job skips every step whose date falls on or before
  the day the invoice was sent (`selectDueReminderStep` in
  `src/utils/invoiceReminders.ts`), because the invoice email covers it. An
  invoice sent today never gets a reminder today. To see one, send an invoice
  at least a day before one of its step dates (for example, due in 4 days, so
  "due in 3 days" falls tomorrow) and check on that date. The email job runs
  every minute, and a queued reminder goes out on the next tick.
- When a step's date arrives, the client gets the reminder (e.g. "1 day
  overdue") with a "View invoice" link to the same public link as the
  original invoice email. A step is never sent twice. An invoice sent on or
  after its due date gets no "due in 3 days" reminder. Paused, paid and void
  invoices get no reminders.
- Every reminder has "Stop reminder emails for this business". Opening it only
  shows a confirmation page; nothing changes until "Stop reminder emails" is
  clicked, which then shows "Done…". After that the client gets no reminders
  but still receives invoices. This opt-out persists on the client.
- Turn on "Send paid receipts" and record R2's full payment. The client gets
  exactly one receipt, with the amount formatted (e.g. £250.00) and a
  "View invoice" link.

**Weekly summary, QA main**

- Dashboard: a "Want a Monday morning summary?" card appears once per account,
  and not while the onboarding/guided card is showing. "Turn on" enables it
  with a confirmation. "Not now" hides it for good, including after a reload.
  On a reused account it may already have been answered; note it.
- Settings → Notifications has the same toggle.
- Until its hourly schedule is applied on AWS the email doesn't send. That's
  expected, not a bug.

**Two-factor authentication, QA 2FA only**

- Settings → Security → "Turn on two-factor authentication" shows a QR code, a
  setup link (for phones), a manual key and a 6-digit code field. On dev the
  authenticator entry is labelled "rive.work (dev)". A valid code shows 10
  recovery codes with Copy and Download buttons; they stay on screen until
  "I've saved these recovery codes" is ticked and Done is clicked. Status then reads "On since <date>. 10 unused recovery codes
  left." A security email is sent.
- Sign out, then sign in with email and password. You land on "Enter your
  code" (`/login/two-factor`), not the dashboard. A wrong code shows an error,
  the right code signs you in, and the same code can't be reused within its
  30-second window.
- "Use a recovery code instead" works once per code: reusing a code fails, and
  the remaining count drops.
- Google sign-in on a 2FA account also asks for the code (only testable if the
  account is Google-linked).
- "Regenerate recovery codes" needs the password plus a current code, and shows
  10 new codes that stay until confirmed. The old codes stop working, and a
  notice email is sent.
- Leaving the code step open for more than 10 minutes gives "This sign-in has
  expired".
- **Last:** "Turn off" needs the password plus a current code. Afterwards
  sign-in no longer asks for a code, and a notice email is sent. Always end
  with 2FA off.

**Legal pages (content review)**

- `/privacy`: §5 "Emails we send to your clients on your behalf" (later
  sections renumbered) and a "Service emails" paragraph in §3.
- `/terms`: §5 "Communications sent to your clients".
- The numbering is consistent, cross-references are right, and the wording
  matches the behaviour observed above.

**UI/UX pass (every screen above)**

- Viewports 1440px, ~768px, 375px and 320px: no horizontal scroll, clipped or
  overlapping content, or tap targets that are too small.
- Light and dark mode.
- Keyboard only: tab order, visible focus, Enter/Space on buttons and toggles,
  Escape closes dialogs.
- Loading states, disabled states while saving, toasts, and clear messages.
- Copy and naming ("rive." branding, section names), and consistency with the
  rest of the app (fonts, spacing, square corners, button styles).
- With seeded data present, Settings still loads quickly and currency defaults
  behave sensibly next to existing records.

### 2026-09 — Referral programme with launch credit (#81)

**Settings -> Referrals, QA main**

- The section shows a personal link ending `/register?ref=<8-character code>`.
  The copy button copies it, and the code stays the same after a reload.
- Joined, Activated and "Free months earned: N of 5" read 0 for an account
  that has referred no one.

**Referred signup, fresh synthetic account in a private window**

- Open the QA main referral link, register a uniquely labelled synthetic
  account, and verify its email. QA main's Joined goes up by one, and
  Activated stays the same.
- In the new account, finish onboarding, then add a client and a project with
  a due date linked to it. Reload QA main's Settings: Activated and months
  earned each go up by one. The new account's Referrals section says it
  earned 1 free month.
- A `?ref=` value that is not an issued code (for example `?ref=newsletter`)
  still signs up normally and adds nothing to anyone's Joined count.

**Pricing and admin**

- `/pricing` has the "Do referrals earn anything?" answer: one month per
  activated referral, up to five, plus one month for the new account.
- Admin -> Funnel has a Referrals panel showing referred signups, activated
  referrals, referrers and launch-credit months owed.

## Report format

Start with setup:

- Account emails (never passwords), where the passwords are stored, the seed
  `after` summary, the records you created, and any setup problems.

Then the findings, grouped by feature. For each finding:

- **Severity.** Blocker: the feature is broken, or there's a data or security
  risk. Major: wrong behaviour or a confusing flow. Minor: cosmetic or copy.
  Suggestion.
- **Where:** URL and section.
- **Steps to reproduce.**
- **Expected** (from the feature checks) vs **actual**.
- **Screenshot**, viewport, and light or dark mode.
- **Console or network errors**, if any.

End with:

1. A pass / fail / not-tested checklist of every area.
2. What you couldn't test, and why.
3. The state the standing accounts were left in: is 2FA off on QA 2FA? Are the
   passwords unchanged? Which clients are opted out of reminders?
4. The top 5 fixes by impact.
