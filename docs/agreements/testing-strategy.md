# Agreements testing strategy

## Purpose

The target is a trustworthy agreement-to-cash flow, not only a successful happy-path click-through. Tests must prove state invariants, ownership, immutability, idempotency, public-link behavior, provider boundaries, and integration with projects, milestones, invoices, files, notifications, and portfolio projections.

The current repository already has:

- `tests/e2e/contracts-ux.spec.ts` for mocked authenticated UI/responsive flows;
- `scripts/smoke-contracts.mjs` for a disposable real-database end-to-end workflow;
- `tests/e2e/public-routes.spec.ts` and `server-guards.spec.ts` for public/auth guards.

Preserve these as regression suites while adding lower-level tests around rules that currently live only in route handlers.

## Test layers

### Domain/unit tests

Run without a database, HTTP server, React, or provider SDK.

- State transition matrix for every current and target transition.
- Same-state idempotency behavior.
- Version number/hash/stable serialization.
- Clause normalization and required-clause recovery.
- Currency/money rounding, taxes, deposits, due dates, recurring occurrences.
- Payment-term eligibility for signing, fixed-date, milestone-due, milestone-approved, and disputed states.
- Change-request/amendment diff classification: material vs operational.
- Public token generation/hash/expiry/session-binding decisions.
- OTP code hashing, attempt counters, cooldown/expiry.
- Evidence manifest ordering and hash calculation.
- Project-generation plan determinism and natural-key calculation.
- Sanitized event metadata and hash-chain calculation.

### Database/constraint tests

Use PostgreSQL, not SQLite, because PostgreSQL constraints/indexes/JSONB/transactions matter.

- `(agreement_id, version_number)` uniqueness.
- One active/current version/actionable session per relevant scope.
- Accepted version immutable through application and restricted DB role.
- One role/party/sequence according to product policy.
- Workspace-consistent client/project/milestone/file relations.
- One acceptance per signer/version/provider event.
- One payment occurrence/invoice link per occurrence key.
- One project-generation result per accepted version.
- Event sequence/hash uniqueness and insert-only behavior.
- Artifact/render hash and object manifest relationships.
- Retention/legal-hold restrictions.

### API integration tests

Use real Route Handlers with test PostgreSQL and controlled email/object/provider fakes.

- Authentication missing/expired/tampered session.
- Workspace ownership on every Agreement, Client, Project, Milestone, Invoice, File, and Evidence endpoint.
- Invalid JSON/body/schema/length/currency/date handling.
- Optimistic expected-version conflicts.
- State transition HTTP status and error code consistency.
- Idempotency-Key replay returns the same response and no duplicate rows.
- Notifications/outbox created transactionally with the domain event.
- Public routes never return internal workspace/member data.

### Public-link tests

- Random token storage contains only a hash.
- Wrong purpose token cannot access another resource.
- Expired/revoked/rotated links cannot read or mutate.
- Old version link cannot accept after a new version is created.
- First access creates a short-lived session; session cannot be reused for another link.
- Link mutation requires the correct signer/recipient session.
- Replay of accept/decline/comment is idempotent or safely rejected.
- Rate limits apply to GET and POST and coordinate across worker instances in the production adapter.
- Referrer/log redaction does not leak raw token.
- Public payload is minimal before and after verification.

### Verification/provider tests

For each adapter:

- challenge creation and normalized response;
- code delivery failure;
- wrong/expired/too-many-attempts code;
- provider timeout/retry/cancel;
- signed webhook verification using raw body;
- timestamp/replay rejection;
- duplicate event no-op;
- unknown event safe handling;
- provider payload size/sensitive-field redaction;
- acceptance only after provider result and exact document hash match.

### File/PDF/evidence tests

- MIME/size/signature allowlist and malware quarantine.
- File object key is random, private, and workspace-scoped.
- Byte hash changes are detected.
- Accepted version’s canonical hash and rendered hash are stable.
- Download route never renders a different artifact under the same manifest.
- Evidence export includes only trusted server records and captures a consistent snapshot.
- Export expiry, role access, signed URL expiry, download event, and revocation.
- PDF page-break/long-clause/Unicode/Indian currency/date/timezone rendering.

### Background job/retry tests

- Claim lease and stale-lease recovery.
- Crash after provider/email/object side effect before status update.
- Retry/backoff/dead-letter behavior.
- Dedupe keys for email/reminders/artifacts/exports.
- Concurrent billing workers.
- Concurrent project generation workers.
- Maintenance expiry and provider-cancel behavior.
- Outbox ordering for acceptance -> project generation -> invoice eligibility.

### Browser end-to-end tests

Use Playwright against the real app for production-blocking paths; keep mocked UI tests for fast layout/empty-state coverage.

- Authenticated workspace creation and navigation.
- Client public review at mobile and desktop widths.
- Acceptance/signing at mobile and desktop widths.
- Keyboard-only navigation, focus management, labels, error announcements, contrast.
- Long agreement/attachments/loading/error states.
- Expired/revoked/rotated links.
- Downloaded PDF/evidence pack authorization.
- Retry UX for provider/email/job failures.

## Production-blocking E2E flows

### Flow A — create, review, accept, lock

`draft -> send -> client views -> client accepts -> final version locked`

Assertions:

- structured version and rendered artifact exist;
- public response exposes exact version/hash and minimal data;
- acceptance method and consent text version are recorded;
- any later edit creates a new version rather than mutating accepted content;
- old acceptance link cannot accept again;
- owner notification/final document delivery is retriable and deduplicated.

### Flow B — changes request and stale-link protection

`client requests changes -> new version -> old link/version cannot accept -> latest version accepted`

Assertions:

- formal `ChangeRequest` is created, not only a comment;
- new version contains revision reason/diff;
- old link returns intentional revoked/expired response;
- old version’s acceptance command fails even under a race;
- latest version acceptance references latest canonical/rendered hashes.

### Flow C — accepted Agreement to project exactly once

`accepted Agreement -> preview -> confirm -> project/milestones/invoice schedule created once`

Assertions:

- preview is deterministic;
- client/project/milestones/tasks/calendar/invoice terms map to the accepted snapshot;
- repeated confirm with same/different idempotency key does not duplicate;
- partial failure resumes from `ProjectGenerationRecord`;
- operational edits show divergence without rewriting accepted content.

### Flow D — deliverable, revision, resubmission, approval, invoice

`submit -> client revision request -> resubmit -> client approve -> invoice eligible/generated`

Assertions:

- each submission/revision is immutable and file-hashed;
- approval records reviewer/session/verification/time;
- invoice eligibility comes from approval, not task completion;
- generated invoice is exactly once and remains reviewable before sending;
- payment event is separate from invoice status.

### Flow E — amendment without historical mutation

`amendment proposed -> accepted -> project/invoice projection updated`

Assertions:

- base accepted version, amendment version, and approvals remain visible;
- only approved changed fields update operational projections;
- historical milestone/payment/invoice evidence remains unchanged;
- repeated amendment command is idempotent;
- dispute/termination policy blocks unsupported changes.

### Flow F — evidence pack authorization

`authorized member requests -> async generation -> expiring download`

Assertions:

- package contains only trusted server-side records and manifest hashes;
- generation is retryable/deduplicated;
- unauthorized member/public/stale link cannot download;
- download event and expiry are recorded;
- output copy states it preserves records for review and makes no court/admissibility guarantee.

## Current regression coverage to preserve

The existing `scripts/smoke-contracts.mjs` already validates:

- project coverage and client/project reuse;
- JSON snapshot fields and required clause recovery;
- review comments/approval/notifications;
- immutable versioning and link revocation;
- partial signature decline recovery;
- signing-link reissue and sequencing;
- executed PDF and evidence headers;
- milestone due-date snapshots and billing idempotency;
- invoice amount guard, delivery recovery, deletion protection;
- project/client deletion and milestone replacement guards.

During migration, run this script unchanged against the compatibility routes, then add Agreement-native equivalents. Any changed status/name should be mapped in serializers rather than weakening the assertions.

## Test data and fixtures

Use factories with explicit workspace/user/client/project/version IDs and fixture classes:

- solo freelancer with one client/project;
- agency workspace with owner/admin/member/finance/viewer;
- multiple client representatives and billing contact;
- agreement with long clauses, Unicode/INR values, taxes, deposit, fixed/milestone/recurring terms;
- missing contact/company/address/email;
- partially signed/declined/expired/cancelled/superseded/disputed records;
- malicious/oversize attachments;
- provider duplicate/out-of-order webhook;
- failed project generation and billing worker leases.

Factories must never use predictable public tokens or reuse production data. Seed hashes/PII as test-only values.

## Test observability

Each test captures `requestId`, workspace ID, Agreement ID, version ID, provider event ID, idempotency key hash, and job attempt. Assertions should inspect both response and database/event timeline. Raw OTPs/tokens are test-only and must not appear in ordinary logs.

## Minimum production gate

Before enabling verified acceptance or automatic project generation in production:

- all six flows pass against PostgreSQL with two concurrent workers;
- all P0 threat tests pass;
- migration dry-run/backfill/rollback passes on a production-shaped anonymized copy;
- accessibility scans have no serious/critical violations on public review/signing and authenticated Agreement detail;
- public-route load test meets rate-limit/latency budget;
- PDF/evidence byte/hash verification passes;
- provider outage and email failure runbooks are exercised;
- founder/legal approval of consent, retention, templates, and claims is recorded.
