# Agreements target product specification

Status: proposed product/engineering contract
Internal domain name: `Agreement`
User-facing name: `Agreements` unless product research proves `Contracts` materially clearer for the current audience.

## Product thesis

Rive should make an accepted agreement operational. The accepted scope becomes the project brief, milestones become the execution plan, payment terms become invoice eligibility, client approvals become evidence, and a completed engagement can become verified proof of work. The agreement remains the immutable commercial record; operational records may evolve through controlled links, change requests, and amendments.

The product should communicate clarity rather than legal overreach:

- “Get the scope accepted.”
- “Keep every version and approval connected.”
- “Create a reliable evidence record for the work and payment trail.”

Do not say “court-proof,” “guaranteed enforceable,” “legally binding everywhere,” or “regulated digital signature” unless a reviewed provider and jurisdiction-specific legal position support the exact claim.

## Jobs to be done

### Service provider

“I need the client to agree to the same scope, timing, revisions, and payment terms I will use to run the work. I need the record to remain trustworthy when the work, approval, or payment is later questioned.”

### Client

“I need to understand what I am approving without creating a heavy account. I need to see the exact deliverables, timing, price, and changes, then leave a clear approval or request for revision.”

### Agency/team

“I need delegated roles, approved templates, and a shared timeline that preserve who was authorised to act and which workspace owns the record.”

## Domain definition

An `Agreement` is a workspace-owned commercial agreement aggregate with:

- parties and signatory snapshots;
- a versioned structured canonical document;
- lifecycle state and version state;
- secure review/acceptance sessions;
- immutable acceptance evidence;
- append-only events;
- operational conversion links;
- delivery, approval, invoice, payment, amendment, and evidence projections.

The Agreement is not just rich text and not just a PDF. A PDF is a rendered artifact of a canonical version. Structured data is the source used to generate operational records.

## Parties and identity

### Provider side

- Rive workspace/service provider (`workspaceId`);
- individual freelancer or agency identity;
- workspace member who authored/sent the version;
- authorised representative and signatory role;
- representative email/phone;
- optional billing contact.

### Client side

- client record;
- client company/legal entity;
- client contact;
- authorised representative;
- signatory name, role, email, and optional phone;
- optional billing contact.

Party fields used by a version are immutable snapshots. Later edits to a Client record do not rewrite an accepted Agreement. An amendment or new Agreement is required to change a contractual party or signatory.

## Canonical agreement content

Every version must be representable in structured data and renderable deterministically. Minimum fields:

### Header and term

- title;
- agreement type/template key;
- introduction/recitals;
- project start and end dates;
- currency and pricing model (`fixed`, `milestone`, `time_and_materials`, `recurring`, `hybrid`);
- tax treatment and tax registration metadata where configured.

### Scope

- scope of work;
- exclusions;
- assumptions and client dependencies;
- deliverables with acceptance criteria;
- milestones and deadlines;
- revision limits and review windows;
- change-request rules.

### Commercial terms

- deposits;
- payment schedule and trigger semantics;
- invoice due periods;
- fixed-date and recurring terms where supported;
- refund/cancellation terms;
- late-payment terms;
- expenses and tax treatment.

### Legal/operational clauses

- ownership/IP;
- confidentiality;
- warranty/support period;
- termination;
- dispute-resolution text;
- governing law and jurisdiction;
- custom clauses;
- attachments with file hashes and role/visibility.

Legal text is template-driven. A clause/template record must carry a version, locale/jurisdiction, author, review status, effective date, and a hash. Frontend components receive the selected clause snapshot; they do not contain critical legal language.

## Lifecycle state machine

The target aggregate uses the smallest state set that makes the user journey explicit. `viewed`, `commented`, `verification_succeeded`, `milestone_submitted`, and similar facts are events, not top-level Agreement states.

| State | Meaning | Allowed next states |
| --- | --- | --- |
| `draft` | Editable, private canonical content. | `in_review`, `cancelled` |
| `in_review` | A version is available for client review/comments. | `draft`, `changes_requested`, `acceptance_pending`, `expired`, `cancelled` |
| `changes_requested` | The client/signatory requested a formal content change; no acceptance may proceed. | `draft`, `cancelled` |
| `acceptance_pending` | A specific immutable version is awaiting configured acceptance/signatures. | `accepted`, `declined`, `expired`, `cancelled` |
| `accepted` | The exact version was accepted and is locked. | `active`, `superseded`, `terminated`, `disputed`, `completed` |
| `active` | Operational project conversion is confirmed or work has begun. | `completed`, `superseded`, `terminated`, `disputed` |
| `completed` | Contracted work is marked complete; evidence/Verified Work may be offered. | `disputed`, `superseded` |
| `declined` | A party declined the current acceptance request. | `draft`, `cancelled` |
| `expired` | The current review/acceptance window ended without acceptance. | `in_review`, `acceptance_pending`, `cancelled` |
| `cancelled` | The provider cancelled before acceptance or terminated the request. | none |
| `superseded` | Replaced by an approved amendment or new Agreement; historical record remains. | none |
| `terminated` | Accepted/active Agreement ended under its termination rules. | `disputed` |
| `disputed` | A party has opened a dispute; normal completion/financial automation is restricted by policy. | `active`, `completed`, `terminated` only through a recorded resolution action |

Rules:

1. Transitions are server-side commands, not arbitrary status updates.
2. A transition must name the actor, reason, current version, and idempotency key where externally retried.
3. `accepted` can only be entered from `acceptance_pending` for the exact current version and after all required signatories/verification requirements pass.
4. Accepted version content, party snapshots, attachment hashes, acceptance records, and event history are immutable.
5. A material change after acceptance creates an amendment or superseding Agreement; it cannot mutate the accepted version.
6. Expiring a link is not the same as cancelling the Agreement; expiry is a recoverable workflow state.

## Version rules

Every material edit creates a new `AgreementVersion`:

- monotonically increasing version number per Agreement;
- canonical structured content snapshot;
- deterministic rendered document snapshot;
- canonical content hash;
- rendered bytes hash;
- creator/member and creation time;
- reason for revision;
- machine-readable diff summary from the previous version;
- sent/viewed/accepted timestamps per version;
- superseded/amendment relation where applicable.

The accepted version is immutable. A later project deadline, task edit, or client profile edit must not mutate it. An amendment may reference the accepted version, specify changed fields, require re-acceptance, and update operational projections only after approval.

## Client review and acceptance experience

### Review

1. Provider chooses a template and client/project context.
2. Rive shows a content preview and readiness checklist.
3. Provider creates a review session for a specific version and sends one secure link.
4. Client sees only the minimum public data needed for review: named parties, scope, deliverables, milestones, price, payment schedule, clauses, and allowed attachments.
5. Client can comment on a section, request a formal change, or mark the version ready for acceptance.

### Acceptance

1. Provider finalizes a version and selects an acceptance method per signer.
2. Client receives a purpose-specific acceptance link/session.
3. Client reviews the exact version hash and consent text.
4. Configured verification adapter performs basic recorded, email, phone OTP, or external e-sign verification.
5. Server records the acceptance atomically only if the session is current, unrevoked, unexpired, not replayed, and all required signers are complete.
6. The version is locked, timestamped, and rendered bytes are stored.
7. Client receives a final copy; provider receives a notification.
8. Provider previews and confirms project generation, or an account/workspace policy auto-confirms it.

Simple recorded acceptance is an explicit product tier. Rive must not imply that typing a name and checking a box proves identity beyond the evidence actually collected.

## Secure public links and sessions

The URL contains a 32-byte random opaque token; the database stores only a keyed hash. A link has a purpose (`review`, `acceptance`, `artifact`, `evidence`), version, recipient/signatory, expiry, revocation time, creation reason, and rotation count.

After first valid access, the server creates a short-lived public review/acceptance session bound to:

- link ID and version ID;
- signer/recipient ID;
- secure, HttpOnly, SameSite cookie with an opaque session hash;
- optional verified email/phone challenge;
- last activity and absolute expiry;
- access/rate-limit counters.

Public pages never expose internal workspace IDs or unrelated client data. Every mutation re-resolves the session and current version server-side. Link access is logged as an event with privacy-minimized network metadata. Link enumeration must return indistinguishable 404/410 behavior and rate limits must be shared across app instances.

## Acceptance provider abstraction

Core domain interfaces:

```ts
interface AcceptanceProvider {
  readonly name: string;
  createChallenge(input: AcceptanceChallengeInput): Promise<AcceptanceChallenge>;
  verifyChallenge(input: VerifyChallengeInput): Promise<VerificationResult>;
  cancelChallenge(providerChallengeId: string): Promise<void>;
  verifyWebhook(input: ProviderWebhookInput): Promise<ProviderEvent>;
}
```

Adapters:

- `recorded` — basic consent, clearly labelled and suitable for low-risk development/alpha;
- `email_otp` — expiring, single-use code with attempt counter and delivery record;
- `phone_otp` — same, with phone recycling and SIM-swap risk documented;
- `external_esign` — provider envelope/status/signature evidence and verified webhook;
- future certificate-backed provider only after legal/technical review.

The Agreement aggregate stores provider-neutral results plus provider reference/payload in a restricted acceptance record. Routes never import provider-specific SDKs.

## Audit evidence

Events are server-generated and append-only through a single writer service. Examples:

- `agreement_created`, `version_created`, `review_link_created`, `link_opened`;
- `verification_requested`, `verification_succeeded`, `verification_failed`;
- `changes_requested`, `acceptance_started`, `agreement_accepted`, `agreement_declined`;
- `project_generation_started`, `project_generated`, `milestone_submitted`;
- `revision_requested`, `deliverable_approved`, `invoice_eligible`, `invoice_generated`;
- `payment_reminder_sent`, `payment_recorded`, `dispute_opened`, `evidence_exported`.

Each event includes aggregate/version/actor/subject, server timestamp, event type version, sanitized metadata, request correlation ID, and optional `previousEventHash`/`eventHash`. Hash chaining is tamper evidence, not a legal guarantee or blockchain substitute.

## Project conversion

After acceptance, the provider can preview a deterministic projection:

- create or link a Client/Company/Contact;
- create or link a Project;
- copy accepted milestone definitions and dates;
- create operational tasks from explicitly selected deliverables;
- create calendar events through the existing calendar outbox;
- create budget and invoice schedule records;
- create deposit invoice only after confirmation/policy;
- create project document links and approval checkpoints.

Every conversion has a `ProjectGenerationRecord` keyed by `(agreementId, acceptedVersionId)` and an idempotency key. Repeated requests return the prior result; they never create duplicate project/milestone/invoice rows. The user can preview, accept, retry failed side effects, or roll back only recoverable non-historical projections.

## Agreement-to-project synchronization

| Data | After acceptance |
| --- | --- |
| Accepted scope, parties, economic terms, attachment hashes | Immutable Agreement version; never mutated by project edits. |
| Project title/description/budget | Initial projection; later edits are operational and show a “differs from accepted Agreement” warning. |
| Milestone definitions/deadlines | Initial projection; changes require acknowledgement and, if material, a change request/amendment. |
| Tasks | Operational records; may evolve without changing the Agreement. |
| Calendar events | Projection/outbox records; can be rescheduled operationally without mutating contract dates. |
| Invoice schedule | Derived from accepted terms; changes require an amendment or explicit non-contract adjustment. |
| Deliverable submissions/approvals | New evidence records linked to Agreement/milestone, not edits to the Agreement version. |

## Milestones, deliverables, and approvals

Each Agreement milestone supports:

- deliverable definition and acceptance criteria;
- submission with notes, files, external links, server timestamp, submitter;
- client review session and review decision;
- approval, rejection, or revision request with reason;
- revision count and maximum revision rule;
- approver identity/verification metadata;
- completion timestamp;
- invoice-eligibility decision.

Approval is a domain event and evidence record. A task marked done is never enough to produce a client approval event.

## Change requests and amendments

A change request is a first-class record with requested scope, reason, requester, schedule impact, pricing impact, milestone impact, revised terms, additional cost/time, required approvers, and status. A comment may link to a change request but cannot itself change scope or pricing.

An approved amendment:

1. references the accepted base version;
2. creates an immutable amendment version/document;
3. requires the configured parties to accept;
4. emits `agreement_amendment_accepted`;
5. deterministically updates only approved project/invoice projections;
6. preserves the historical base version and all previous evidence.

## Invoicing and payment

Agreement terms generate invoice eligibility, not automatic “paid” status. Domain concepts remain separate:

- contractual obligation/status;
- invoice/status/delivery;
- payment event/status/provider reconciliation;
- revenue forecast.

Supported terms should include deposit, milestone, fixed-date, recurring, final, tax, due period, reminder policy, and currency. Invoice generation is idempotent by `(agreementPaymentTermId, occurrenceKey)`. A payment is recorded only through a validated manual receipt or provider/webhook flow, with actor/source/reference/time, and then projects to invoice/Agreement signals.

## Evidence pack

An evidence export is a server-generated asynchronous package with:

- accepted agreement/amendment PDFs;
- version metadata, canonical/render hashes, and diffs;
- signatory/verification/consent records;
- audit timeline and event hashes;
- milestones, submissions, files/links, reviews, approvals, and revisions;
- change requests/amendments;
- invoices, delivery attempts, reminders, and payment events;
- attachment manifest and file hashes;
- reviewed declarations/certificate templates where counsel approves them.

The export is stored in private object storage, has an expiry and download audit event, and is available only to authorized workspace members. Product copy says it preserves reliable records for review by counsel; it does not guarantee admissibility or a litigation outcome.

## Verified Work / portfolio

After `completed`, the provider may propose a Verified Work record. It can reference the Agreement and accepted milestones without exposing confidential terms. The client separately approves the public fields:

- project/category/title;
- outcome summary;
- completed date;
- optional testimonial;
- optional revenue range, never exact terms by default;
- optional public verification badge/link.

Disputed, terminated, confidential, or client-revoked records are not public by default. Public verification exposes a safe projection, not the agreement or evidence bundle.

## Product metrics and guardrails

North-star workflow measures:

- draft-to-review completion;
- review-to-acceptance conversion;
- time from acceptance to project generation;
- milestone submission-to-approval time;
- invoice eligibility-to-send time;
- payment collection rate;
- evidence-pack success rate;
- Verified Work opt-in and client approval rate.

Guardrails:

- no accepted version content mutation;
- zero cross-workspace reads/writes;
- zero duplicate project/milestone/invoice generation in retry tests;
- no unverified acceptance presented as regulated signature;
- PII minimized in public responses and exports.

## Founder/legal dependencies

The product cannot finalize acceptance language, verification tier, retention, clause templates, tax behavior, or public verification claims without founder/legal decisions. Until those are decided, ship “recorded acceptance” behind a feature flag and keep external e-sign/OTP adapters unconfigured rather than implying stronger evidence.
