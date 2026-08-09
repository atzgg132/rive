# Agreements database migration plan

Status: additive, compatibility-first proposal
Current physical root: `contracts`
Target domain name: `Agreement`

## Migration principles

1. Do not delete or rename current Contract tables, columns, IDs, or public URL mappings before the new domain is proven.
2. Preserve every existing `Contract.id`, `ContractVersion.id`, and token link relationship where possible.
3. Keep canonical structured data separate from rendered PDF bytes.
4. Use PostgreSQL constraints for invariants that are not merely workflow policy.
5. Backfill in small, observable batches and quarantine corrupt/incomplete records instead of inventing legal facts.
6. Use feature flags and compatibility reads; rollback means disabling new commands, not deleting historical rows.
7. Do not start a destructive physical rename until the data-quality report, dual-read comparison, and smoke/E2E suite are green.

## Current schema facts

The existing Contract schema is in `prisma/schema.prisma` and was created by `prisma/migrations/20260731120000_add_contracts_esign_billing/migration.sql`. It has:

- `contracts` with `user_id`, `client_id`, optional `project_id`, status, provider, legal venue, currency, and timestamps;
- `contract_versions.content JSONB` plus `content_hash` and `(contract_id, version)` uniqueness;
- signers, typed signatures, hashed public links, comments, events, artifacts, payment plan items, billing occurrences;
- unique occurrence/payment-item and occurrence/invoice relationships;
- project `contract_coverage`/external metadata from `20260801153000_add_project_contract_coverage`.

The current table should be treated as the compatibility root for the first migration waves. The application domain can call the aggregate Agreement while the Prisma model remains `Contract` and `@@map("contracts")`.

## Target schema decision

Do not create a second root copy of every existing Contract. Use the existing `contracts.id` as the stable `agreement_id` during migration. Add structured child tables keyed to it. If a later physical rename is desirable, use a controlled PostgreSQL rename or compatibility view only after all readers have moved; UUIDs and token URLs remain unchanged.

### Target/current mapping

| Target domain concept | Current compatibility source | Migration action |
| --- | --- | --- |
| `Agreement` | `contracts` | Domain repository maps `Agreement.id` to `contracts.id`; add workspace/aggregate metadata later. |
| `AgreementVersion` | `contract_versions` | Keep IDs/hashes; add canonical/rendered snapshot metadata and revision reason. |
| `AgreementParty` | `contract_signers` + `ContractVersion.content` | Backfill immutable party snapshots per version; retain signer rows for link/sign compatibility. |
| `AgreementSection` | `ContractVersion.content.sections` | Extract enabled/disabled sections into version rows; keep JSON during dual read. |
| `AgreementPaymentTerm` | `contract_payment_plan_items` + content payment plan | Extract structured rows; keep one-shot occurrence compatibility. |
| `AgreementMilestone` | content payment snapshot + `milestones` | Add agreement-level definition/snapshot rows and links to operational milestone. |
| `AgreementPublicLink` | `contract_review_links` | Keep token hashes/IDs; add purpose/session/rotation metadata. |
| `AgreementAcceptance` | `contract_signatures` + events | Add provider-neutral acceptance records; preserve signatures as legacy evidence. |
| `AgreementEvent` | `contract_events` | Add sequence/hash/request metadata; preserve event IDs. |
| `EvidenceExport` | none | New table and private object storage job. |

## Proposed entities and fields

The following is the target logical schema. Exact Prisma names can be adjusted to repository conventions, but no table should be added without a query/use case.

### `contracts` as Agreement root (compatibility phase)

- **Purpose:** stable Agreement aggregate root.
- **Ownership:** `workspace_id` in the team phase; `user_id` remains required during compatibility.
- **Primary key:** existing UUID `id`.
- **Foreign keys:** owner/workspace; client; optional project; all must be workspace-consistent in application and validated during backfill.
- **Uniqueness:** one active Agreement identity per stable source only if product decides; do not add duplicate-blocking constraint yet.
- **Indexes:** `(workspace_id, status, updated_at)`, `(workspace_id, client_id, updated_at)`, `(workspace_id, project_id, updated_at)`, `(status, review_expires_at)`.
- **Status:** target Agreement enum/check; keep current status compatibility mapping until cutover.
- **Timestamps:** created, updated, accepted, completed, cancelled, terminated.
- **Soft delete:** no hard delete for accepted/active/completed; cancelled/void records retained.
- **Sensitive:** title/party links may be sensitive; do not expose root IDs publicly.
- **Immutable:** accepted version reference and accepted timestamp after acceptance.
- **Query patterns:** workspace list/filter, client/project timeline, current actionable Agreement, maintenance expiry.

### `contract_versions` as `agreement_versions`

- **Purpose:** immutable canonical version and render metadata.
- **Ownership:** via Agreement/workspace.
- **Primary key:** existing `id`.
- **Foreign keys:** Agreement; creator/member; optional base/amendment version.
- **Uniqueness:** `(agreement_id, version_number)`; at most one accepted version per Agreement at a time through workflow/partial index policy.
- **Indexes:** `(agreement_id, version_number DESC)`, `(agreement_id, status)`, `(content_hash)`, `(rendered_hash)`.
- **Status:** draft/review/accepted/superseded/void compatibility values.
- **Timestamps:** created, sent, first viewed, finalised, accepted, superseded.
- **Soft delete:** never delete accepted/sent versions; drafts may be retained for history.
- **Sensitive:** canonical JSON, legal text, diffs, rendering metadata.
- **Immutable:** canonical content, content hash, rendered hash, creator, version number after insert.
- **Query patterns:** current version, history, evidence export, public review by version/hash.

### `agreement_parties`

- **Purpose:** version-scoped immutable party/signatory snapshots.
- **Ownership:** via Agreement/workspace.
- **Primary key:** UUID.
- **Foreign keys:** Agreement, version, optional `client_id`, `user_id`, `contact_id`, company.
- **Uniqueness:** `(version_id, role, sequence)`; one required provider and one or more client representatives by policy.
- **Indexes:** `(agreement_id, role, status)`, `(version_id, email_hash)`, `(client_id, agreement_id)`.
- **Status:** proposed/invited/verified/accepted/declined.
- **Timestamps:** created, invited, verified, accepted, declined.
- **Soft delete:** never delete referenced version snapshots.
- **Sensitive:** name, email, phone, authority, company, billing contact, verification references.
- **Immutable:** accepted snapshot values; later CRM edits create a new version/amendment.
- **Query patterns:** current signers, evidence export, party history, public minimised view.

### `agreement_sections`

- **Purpose:** queryable clause/section snapshot for a version.
- **Ownership:** via Agreement/workspace.
- **Primary key:** UUID.
- **Foreign keys:** version; optional template/clause catalog record.
- **Uniqueness:** `(version_id, section_key, sort_order)`; section key stable within a version.
- **Indexes:** `(version_id, sort_order)`, `(template_key, template_version)`.
- **Status:** enabled/disabled; template review status is separate.
- **Timestamps:** created.
- **Soft delete:** no deletion of accepted version rows.
- **Sensitive:** legal text.
- **Immutable:** section title/body/enabled state after accepted.
- **Query patterns:** render, public review, diffs, clause analytics.

### `agreement_milestones`

- **Purpose:** contractual milestone/deliverable snapshot independent of live project milestone.
- **Ownership:** via Agreement/workspace.
- **Primary key:** UUID.
- **Foreign keys:** Agreement/version; optional operational `milestone_id`.
- **Uniqueness:** `(version_id, sequence)`; one operational link per accepted projection unless amendment.
- **Indexes:** `(agreement_id, status, due_at)`, `(version_id, sequence)`, `(milestone_id)`.
- **Status:** planned/active/submitted/in_review/revision_requested/approved/completed/disputed.
- **Timestamps:** created, submitted, approved, completed.
- **Soft delete:** history retained; superseded snapshots not deleted.
- **Sensitive:** acceptance criteria and deliverable details.
- **Immutable:** accepted definition/due date; operational date changes are separately recorded.
- **Query patterns:** client review, billing eligibility, project sync, evidence export.

### `agreement_payment_terms`

- **Purpose:** structured commercial obligation definition.
- **Ownership:** via Agreement/workspace.
- **Primary key:** UUID.
- **Foreign keys:** version; optional agreement milestone.
- **Uniqueness:** `(version_id, sequence)`; `occurrence_key` unique per obligation occurrence.
- **Indexes:** `(agreement_id, status, trigger_type)`, `(version_id, sequence)`, `(milestone_id, trigger_type)`.
- **Status:** planned/active/superseded/cancelled.
- **Timestamps:** created, eligible, superseded.
- **Soft delete:** never delete accepted commercial terms.
- **Sensitive:** amount/currency/tax/due terms.
- **Immutable:** accepted amount/currency/trigger; amendment required for changes.
- **Query patterns:** invoice eligibility, schedule preview, revenue forecast, evidence.

### `agreement_attachments`

- **Purpose:** version-scoped file/link manifest.
- **Ownership:** via Agreement/workspace.
- **Primary key:** UUID.
- **Foreign keys:** Agreement/version; uploader/member.
- **Uniqueness:** `(version_id, content_hash, attachment_role)` where appropriate.
- **Indexes:** `(agreement_id, version_id, visibility)`, `(object_key)`, `(scan_status)`.
- **Status:** pending_scan/available/rejected/revoked.
- **Timestamps:** uploaded, scanned, revoked.
- **Soft delete:** revoke/retain; do not physically delete while under legal hold.
- **Sensitive:** object key, file metadata/content, external URL.
- **Immutable:** accepted-version file hash and object key.
- **Query patterns:** render manifest, download authorization, evidence export.

### `agreement_public_links`

- **Purpose:** purpose-specific opaque link credentials.
- **Ownership:** via Agreement/workspace.
- **Primary key:** existing `contract_review_links.id` during compatibility, UUID thereafter.
- **Foreign keys:** Agreement/version/party/session.
- **Uniqueness:** token hash; at most one active link per `(agreement_id, purpose, recipient_id)` enforced in application plus partial index.
- **Indexes:** `(token_hash)`, `(agreement_id, purpose, revoked_at)`, `(expires_at)`, `(session_id)`.
- **Status:** active/revoked/expired/consumed.
- **Timestamps:** created, first accessed, revoked, expired.
- **Soft delete:** retain credential metadata; never retain raw token.
- **Sensitive:** token hash, recipient, access metadata.
- **Immutable:** purpose/version/creator; revocation is append/update metadata only.
- **Query patterns:** token resolution, active-link rotation, abuse review.

### `agreement_review_sessions`, `agreement_acceptance_attempts`, `agreement_acceptances`

- **Purpose:** separate anonymous review session, verification attempts, and final acceptance evidence.
- **Ownership:** via Agreement/workspace; session references link/version/party.
- **Primary keys:** UUIDs; provider event IDs unique per provider.
- **Foreign keys:** link, version, party, acceptance/provider records.
- **Uniqueness:** one active acceptance per `(version_id, party_id)`; one provider event ID; one consumed challenge.
- **Indexes:** `(link_id, expires_at)`, `(party_id, status, created_at)`, `(provider, provider_event_id)`, `(agreement_id, result, created_at)`.
- **Status:** challenge pending/succeeded/failed/locked; acceptance pending/succeeded/failed/revoked.
- **Timestamps:** issued, verified, accepted, expired.
- **Soft delete:** retain evidence; expire session/challenge rows.
- **Sensitive:** OTP hash, phone/email, provider payload, IP/device hashes.
- **Immutable:** successful acceptance evidence and consent text version.
- **Query patterns:** ceremony state, brute-force controls, evidence export, webhook idempotency.

### `agreement_events`

- **Purpose:** append-only domain/event history.
- **Ownership:** via Agreement/workspace.
- **Primary key:** UUID or existing event ID.
- **Foreign keys:** Agreement/version/actor/member; no cascade deletion for accepted records if legal retention requires it.
- **Uniqueness:** `(agreement_id, sequence)`; optional `(provider, provider_event_id)`.
- **Indexes:** `(agreement_id, sequence)`, `(agreement_id, created_at)`, `(event_type, created_at)`, `(request_id)`.
- **Status:** not mutable; event type/version fields.
- **Timestamps:** server created only.
- **Soft delete:** no normal delete; retention process is separately controlled.
- **Sensitive:** sanitized metadata, network hashes, provider references.
- **Immutable:** all fields after insert.
- **Query patterns:** timeline, evidence export, audit/incident investigation.

### `agreement_change_requests`, `agreement_amendments`

- **Purpose:** formal scope/commercial/schedule changes and accepted amendments.
- **Ownership:** via Agreement/workspace.
- **Primary keys:** UUID.
- **Foreign keys:** Agreement/base version/requester/requested version/accepted amendment.
- **Uniqueness:** amendment number per Agreement; idempotency key per command.
- **Indexes:** `(agreement_id, status, created_at)`, `(base_version_id)`, `(amendment_version_id)`.
- **Status:** proposed/under_review/approved/rejected/withdrawn; amendment draft/sent/accepted/superseded.
- **Timestamps:** requested, approved, rejected, accepted.
- **Soft delete:** retain all decisions.
- **Sensitive:** scope, pricing, schedule, reasons, signatures.
- **Immutable:** approved/rejected decision and accepted amendment version.
- **Query patterns:** change inbox, project/invoice sync, evidence.

### `milestone_submissions`, `milestone_reviews`

- **Purpose:** delivery evidence and client review/approval.
- **Ownership:** via workspace/project/agreement milestone.
- **Primary keys:** UUID.
- **Foreign keys:** agreement milestone, operational milestone, submitter/reviewer, attachment manifests.
- **Uniqueness:** one current submission per revision sequence; review references submission.
- **Indexes:** `(agreement_milestone_id, status, created_at)`, `(project_id, created_at)`, `(reviewer_id, created_at)`.
- **Status:** submitted/in_review/approved/rejected/revision_requested/withdrawn.
- **Timestamps:** submitted, reviewed, approved.
- **Soft delete:** do not delete evidence; mark withdrawn/replaced.
- **Sensitive:** files, links, client comments.
- **Immutable:** submitted content and approval record; a resubmission creates a new revision.
- **Query patterns:** milestone inbox, invoice eligibility, evidence export.

### `project_generation_records`

- **Purpose:** deterministic/idempotent Agreement-to-Project conversion.
- **Ownership:** workspace/Agreement.
- **Primary key:** UUID.
- **Foreign keys:** Agreement, accepted version, generated project/client/milestones/tasks/invoice schedule.
- **Uniqueness:** `(agreement_id, accepted_version_id)`; idempotency key unique per workspace/action.
- **Indexes:** `(agreement_id, status)`, `(workspace_id, status, created_at)`, `(idempotency_key_hash)`.
- **Status:** previewed/queued/running/partially_succeeded/succeeded/failed/rolled_back.
- **Timestamps:** created, started, completed, last attempted.
- **Soft delete:** retain result; compensate projections rather than delete accepted history.
- **Sensitive:** mapping/preview details.
- **Immutable:** input accepted version; output IDs retained.
- **Query patterns:** preview, retry, duplicate prevention, support diagnostics.

### `agreement_invoice_links`, `evidence_exports`, `verified_work_records`

- **Invoice links:** map an immutable payment term/occurrence to an Invoice; unique by occurrence key; index agreement/status; retain invoice relationship.
- **Evidence exports:** track requested/queued/ready/failed/expired, object key, export hash, requested member, expiry, download count; never expose object key publicly.
- **Verified Work:** link accepted/completed Agreement and client-approved public projection; unique active public record per engagement; store consent/revocation timestamps; never copy private legal text by default.

## Data discovery queries

Run against a read-only replica or transaction-safe read-only connection before adding constraints. Replace `:user_id`/date parameters as appropriate.

### Inventory and status drift

```sql
SELECT status, COUNT(*) FROM contracts GROUP BY status ORDER BY status;
SELECT status, COUNT(*) FROM contract_versions GROUP BY status ORDER BY status;
SELECT role, COUNT(*) FROM contract_signers GROUP BY role ORDER BY role;
SELECT type, COUNT(*) FROM contract_review_links GROUP BY type ORDER BY type;
SELECT event_type, COUNT(*) FROM contract_events GROUP BY event_type ORDER BY event_type;
SELECT trigger_type, status, COUNT(*)
FROM contract_payment_plan_items
GROUP BY trigger_type, status
ORDER BY trigger_type, status;
```

### Orphans and cross-owner relationships

```sql
SELECT c.id, c.user_id, c.client_id, cl.user_id AS client_user_id
FROM contracts c
JOIN clients cl ON cl.id = c.client_id
WHERE c.user_id <> cl.user_id;

SELECT c.id, c.user_id, c.project_id, p.user_id AS project_user_id
FROM contracts c
JOIN projects p ON p.id = c.project_id
WHERE c.user_id <> p.user_id;

SELECT p.id, p.project_id, c.user_id, p2.user_id AS project_user_id
FROM contract_payment_plan_items p
JOIN contracts c ON c.id = p.contract_id
JOIN milestones m ON m.id = p.milestone_id
JOIN projects p2 ON p2.id = m.project_id
WHERE c.user_id <> p2.user_id;
```

### Version/content quality

```sql
SELECT c.id, c.status, COUNT(v.id) AS versions,
       MAX(v.version) AS max_version,
       COUNT(*) FILTER (WHERE v.content_hash IS NULL OR v.content_hash = '') AS missing_hashes
FROM contracts c
LEFT JOIN contract_versions v ON v.contract_id = c.id
GROUP BY c.id, c.status
HAVING COUNT(v.id) = 0 OR COUNT(*) FILTER (WHERE v.content_hash IS NULL OR v.content_hash = '') > 0;

SELECT id, contract_id, version, status
FROM contract_versions
WHERE jsonb_typeof(content) <> 'object'
   OR NOT (content ? 'title')
   OR NOT (content ? 'sections');
```

### Signer/acceptance quality

```sql
SELECT contract_id,
       COUNT(*) AS signer_count,
       COUNT(*) FILTER (WHERE role = 'client') AS clients,
       COUNT(*) FILTER (WHERE role = 'owner') AS owners,
       COUNT(*) FILTER (WHERE email IS NULL OR email = '') AS missing_email
FROM contract_signers
GROUP BY contract_id
HAVING COUNT(*) <> 2 OR COUNT(*) FILTER (WHERE role = 'client') <> 1 OR COUNT(*) FILTER (WHERE role = 'owner') <> 1;

SELECT cs.id, cs.contract_id, cs.version_id, cs.signer_id
FROM contract_signatures cs
LEFT JOIN contract_versions v ON v.id = cs.version_id
WHERE v.id IS NULL OR v.contract_id <> cs.contract_id;
```

### Links and artifacts

```sql
SELECT type, COUNT(*) FILTER (WHERE revoked_at IS NULL AND expires_at > NOW()) AS active,
       COUNT(*) FILTER (WHERE expires_at <= NOW()) AS expired,
       COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) AS revoked
FROM contract_review_links
GROUP BY type;

SELECT id, contract_id, version_id, artifact_type, object_key, content_hash
FROM contract_artifacts
WHERE object_key IS NULL OR content_hash IS NULL OR content_hash = '';
```

### Billing/idempotency quality

```sql
SELECT payment_plan_item_id, COUNT(*)
FROM contract_billing_occurrences
GROUP BY payment_plan_item_id
HAVING COUNT(*) > 1;

SELECT c.id, c.status, COUNT(o.id) AS occurrences, COUNT(o.invoice_id) AS invoices
FROM contracts c
LEFT JOIN contract_billing_occurrences o ON o.contract_id = c.id
GROUP BY c.id, c.status
HAVING c.status = 'executed' AND COUNT(o.id) <> (
  SELECT COUNT(*) FROM contract_payment_plan_items i WHERE i.contract_id = c.id
);
```

## Migration order

### Migration 0 — freeze and baseline

- Add an Agreements migration flag and capture current Contract status/provider values.
- Add SQL/query reports and a read-only data-quality job.
- Add unit/API/real smoke baseline around current behavior.
- Do not alter existing tables beyond telemetry fields that are nullable and reversible.

### Migration 1 — compatibility metadata

Add nullable, additive columns/tables:

- `contracts.workspace_id` only when workspace membership migration is ready;
- `contract_versions.revision_reason`, `canonical_schema_version`, `rendered_hash`, `rendered_object_key`, `renderer_version`;
- `contract_events.sequence`, `event_type_version`, `request_id`, `previous_hash`, `event_hash`;
- `contract_review_links.purpose`, `rotation`, `recipient_id`, `session_required`;
- `contract_acceptance_*` tables for provider-neutral evidence.

Backfill only deterministic metadata. Do not claim historical records were OTP-verified or rendered bytes are immutable if they were not.

### Migration 2 — structured version children

Create `agreement_parties`, `agreement_sections`, `agreement_milestones`, `agreement_payment_terms`, and `agreement_attachments` (initially without requiring non-null workspace). Backfill one version at a time from JSON and current relation rows. Store a `source: legacy_json` marker and migration run ID.

New version writes must persist structured rows and legacy JSON in one transaction. Dual reads compare serialized structured output to legacy content; differences are reported, not silently discarded.

### Migration 3 — public sessions and verification

Create review sessions, acceptance attempts, acceptances, and provider event dedupe rows. Existing link tokens continue to resolve through `contract_review_links`; after first access, new sessions are required for mutations behind a flag. Existing recorded signatures remain legacy evidence with an explicit method label.

### Migration 4 — durable artifacts and evidence

Add private object storage manifest rows, rendered PDF hashes, export jobs, and download events. For existing executed contracts, do not overwrite the old evidence hash. Generate a new “re-rendered compatibility artifact” with its own renderer/version/hash and mark its provenance.

### Migration 5 — project generation and operational links

Create generation records and Agreement milestone/submission/review tables. Start with preview/confirm for newly accepted versions. Link existing Projects where present; never infer that a previously executed Contract generated a project when it did not.

### Migration 6 — amendments, payments, Verified Work

Add formal change requests/amendments, invoice links/payment events, evidence pack completion, and client-approved Verified Work. Gate public/prod behavior on product/legal approval.

### Optional physical rename

Only after all app readers/writers and reporting jobs use Agreement domain names:

1. create a compatibility view or rename within a maintenance window;
2. keep old Prisma `Contract` mapping temporarily;
3. preserve all UUIDs and route/token lookup logic;
4. validate foreign keys/indexes/permissions;
5. remove compatibility only in a later release.

## Backfill strategy

1. Create a `migration_run` record with code version, start/end, counts, and failure summary.
2. Select legacy rows by stable ID in batches (for example 250–1,000).
3. Lock only the source version row long enough to read a consistent snapshot; do not block public review for an entire batch.
4. Parse JSON with a strict schema; canonicalize stable ordering; recompute hash and compare to stored `content_hash`.
5. Insert structured rows using deterministic natural keys `(version_id, section_key)`, `(version_id, sequence)` and `ON CONFLICT DO NOTHING`/upsert only for migration retries.
6. Mark `backfill_status` as `succeeded`, `quarantined`, or `skipped` with a reason.
7. Quarantine incomplete party/milestone/payment records; never invent party authority, dates, tax, or acceptance method.
8. Compare structured serialization to legacy content and alert on material differences.
9. Run validation queries after each batch and publish counts by status/owner.

## Compatibility period

- Legacy Contract routes remain read/write adapters.
- New Agreement services write legacy and structured records transactionally.
- Public review/sign URLs keep existing token resolution.
- Existing UI continues to use `/workflow/contracts` until the Agreements UI is ready.
- Feature flag options: `agreements_structured_read`, `agreements_dual_write`, `agreements_verified_acceptance`, `agreements_project_generation`, `agreements_evidence_exports`.
- Dual reads compare but do not overwrite. A mismatch blocks acceptance for newly migrated versions until repaired.

## Rollback and failure handling

Rollback is feature-flag disable plus code rollback; do not drop structured rows. If dual write fails, the entire version transaction rolls back. If a background backfill fails, retry from the stable ID checkpoint. If a provider migration fails, keep existing recorded acceptance and disable only the new provider method.

Potential corrupt records:

- no version: retain Contract but mark `migration_status=quarantined`; owner must open and save a new version;
- invalid hash: preserve original hash, record mismatch, generate a repaired draft only after explicit owner action;
- missing signer email: retain historical evidence; require updated parties for new acceptance;
- cross-owner client/project: do not reassign automatically; quarantine and alert;
- orphan milestone/payment item: retain row, suppress billing, require owner resolution;
- missing artifact object: label evidence as metadata-only; never claim PDF bytes are preserved.

## Validation and exit criteria

- zero cross-owner rows for all newly structured records;
- 100% of accepted/newly-actionable versions have structured party/section/payment rows;
- all content/hash mismatches are zero or explicitly quarantined;
- no duplicate version/section/payment/occurrence/generation natural keys;
- existing smoke script passes with compatibility paths;
- old review/sign URLs resolve or return intentional revoked/expired status;
- feature-flag rollback tested in a staging copy;
- no destructive migration executed until founder/legal retention decision is recorded.
