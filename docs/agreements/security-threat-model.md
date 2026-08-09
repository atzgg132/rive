# Agreements security and abuse threat model

Scope: current Contracts implementation and target Agreements architecture.
Risk scale: `P0` blocks production acceptance; `P1` blocks broad rollout; `P2` requires remediation in the relevant phase; `P3` hardening/backlog.

## Security boundaries

- Authenticated workspace requests: current `getSessionUser(req)` plus `userId` filters; target workspace membership/role authorization.
- Public review/acceptance: opaque bearer link, then target public session and optional verification.
- Provider webhooks: target raw-body signature verification and event-ID deduplication.
- Object storage: private bucket, signed URLs, malware scan, immutable manifests.
- Background jobs: cron secret/current AWS HTTP runner; target leased idempotent workers/outbox.
- Evidence: restricted workspace roles, expiring downloads, download events, retention/legal hold.

## Threat register

| Threat | Impact | Likelihood | Current controls | Missing controls | Recommended mitigation | Test strategy |
| --- | --- | --- | --- | --- | --- | --- |
| Public-link guessing | Contract/PII disclosure or unauthorized mutation | Low with random token, high impact | 32-byte random tokens, hash at rest, expiry | No public session, access log, distributed abuse budget | CSPRNG tokens, HMAC/hash lookup, generic errors, shared rate limits, short-lived session | Generate 1M tokens and assert no collision; fuzz token route; verify 404/410 indistinguishability and 429 budget |
| Token leakage via logs/referrer/browser history | Acceptance or evidence disclosure | Medium | Token not stored raw in DB; no-store response | Referrer policy is global only; no one-time session exchange | Exchange token for HttpOnly session, strip token from browser URL, `Referrer-Policy: no-referrer`, never log URL | Browser trace/referrer test; log redaction test |
| Client impersonation | False review/acceptance/signature | High for bearer/basic typed flow | Typed name must match signer; email/name visible | OTP/provider verification, recipient binding, challenge state | Email/phone OTP or provider e-sign; bind session to intended recipient; label recorded acceptance | Attempt with wrong email/name/OTP/link and assert no acceptance |
| OTP abuse | Cost, spam, account takeover, denial of acceptance | Medium | Current system has no OTP | Per-recipient/IP limits, code hash, retry lock, resend cooldown | Hash codes, max 5 attempts/challenge, cooldown, daily budget, abuse alerts, provider delivery records | Brute-force, resend storm, race, expired/replayed challenge tests |
| Phone-number recycling | Wrong person receives OTP | Medium | None | Number ownership/reputation, method disclosure | Treat phone OTP as one factor; require email/strong provider for high-risk; store verification date and method | Simulate changed phone, stale challenge, recovery flow |
| Email compromise | Compromised mailbox accepts/signs | Medium | Link expiry/revocation | Stronger step-up, provider risk controls | Require OTP/provider for high-value agreements; show signer identity and version hash; support void/reissue | Compromised-link tabletop and step-up E2E |
| Replayed acceptance | Duplicate or stale acceptance event | Medium | Unique signature `(signerId, versionId)`, current status checks | Idempotency record/session consumed flag | Consume challenge atomically; unique provider event/acceptance key; return stored result | Double POST and concurrent POST test |
| Accepting stale version | Wrong terms become accepted | Medium | Links include version; old links revoked on edit | Expected current-version check in one domain command | Require current actionable version and hash match; reject old sessions after new version | Flow B and stale-link race tests |
| Silent document modification | Evidence no longer matches accepted terms | High impact | JSON snapshot/hash, final status guards | DB immutability, rendered bytes hash/storage, no raw update path | Accepted-version DB trigger/privilege, immutable artifact manifest, hash verification before download | Direct DB update attempt, renderer byte/hash fixture |
| Admin/support modification after acceptance | Historical record tampering | Medium | No normal API edit of executed contract | Separate support role, break-glass audit, DB deny update | Immutable storage/DB privileges, append-only correction event, dual approval | Support role authorization and audit review test |
| Attachment replacement | Evidence points to changed file | Medium | No Contract uploads yet | File hash/object version/scan state | Content hash, immutable object key, accepted-version attachment manifest, no overwrite | Upload same key/bytes/different bytes; verify hash mismatch rejected |
| Malicious file upload | XSS, malware, parser exploit | Medium | Image-only portfolio upload path, not Contracts | MIME sniffing, antivirus, sandboxed render, size limits | Allowlist types, signature sniffing, scan/quarantine, no inline public serving, download Content-Disposition | EICAR/polyglot/oversize/malformed archive tests |
| IDOR on authenticated Agreement IDs | Cross-workspace read/write | High impact | Current routes mostly filter `userId` | Central authorization service and workspace DB policy | Require workspace-scoped repository methods; test every route and nested relation | Two-user matrix for every GET/POST/PATCH/DELETE |
| Cross-workspace client/project relation | Data leakage or incorrect billing | Medium | Route-level ownership checks | DB same-owner constraints/workspace FK | Add workspace columns/constraints and transaction-level validation | Malicious mixed client/project payload and migration query |
| Forged approval events | False evidence/notification | Medium | Server creates current events | Append-only writer/event hash/provider identity | Only command service writes events; actor/session/provider evidence; event sequence/hash | Attempt client event POST/no route; direct DB privilege test |
| Duplicate project generation | Duplicate work, milestones, tasks, calendars | High operational impact | No generation exists | Idempotency key/unique generation record/transaction | Preview + generation record + deterministic natural keys + outbox | Flow C concurrent execute/retry |
| Duplicate invoices | Double demand and accounting errors | High financial impact | Unique one-shot occurrence/invoice link, claim status | General idempotency key and amendment occurrence model | Unique `(term, occurrenceKey)`, claim/lease, transactional link, reconciliation | Concurrent worker and timeout/retry test |
| Event-log tampering | Evidence credibility loss | Medium/high impact | No normal edit route; events cascade with Contract | DB append-only constraints/hash chain/retention | Insert-only role, chain hashes, periodic anchor/export hash, restricted delete | Update/delete SQL privilege test and chain verification |
| Evidence-export manipulation | Misleading or incomplete dispute pack | Medium | No export currently | Server-side snapshot, manifest/hash, export job status | Generate only from trusted records, sign manifest/hash, immutable object, export/download event | Alter source during export; verify snapshot consistency/hash |
| Unauthorized evidence download | PII/confidentiality breach | Medium | Owner route filters userId; public token expiry | Role-based export permission, signed URLs, download audit | Separate `evidence:read`, short-lived URLs, no public default, revoke/expire | Member/guest/public download matrix and expired URL test |
| PII leakage in public response | Privacy harm | Medium | `no-store`; bearer link | Field minimization/redaction/verified escalation | Return pseudonymous/minimum data until session/verification; never raw IP/provider payload | Snapshot response schema assertions |
| DoS through public routes | Availability/cost | Medium | POST per-link in-memory limits | Global/IP/link budgets, GET protection, body limits, queueing | Edge/WAF/shared limiter, max JSON/body, cache safe static parts, anomaly alert | Load/rate tests across multiple app processes |
| Spam agreement sending | Reputation and email cost | Medium | Email calls are explicit | Per-workspace quotas, recipient cooldown, abuse detection | Send budget, dedupe key, unsubscribe/complaint handling, admin kill switch | Burst-send and repeated retry tests |
| Webhook spoofing | False acceptance/payment state | High | No webhook route | Signature verification/raw body/provider event dedupe | Provider adapter verifies secret/signature/timestamp, reject unsigned, replay cache | Forged signature, old timestamp, duplicate event tests |
| Provider outage | Stuck/incorrect acceptance | Medium | Local/Rive stubs; cleanup on failure | Provider state reconciliation and retry | Keep pending, retry with backoff, manual recovery, no optimistic acceptance | Timeout/5xx/webhook-late tests |
| Background-job duplication | Duplicate expiry/billing/export/email | Medium | Billing claim/stale recovery | Outbox idempotency and leases for all jobs | `FOR UPDATE SKIP LOCKED`, attempt/lease, idempotency keys, DLQ | Kill worker after side effect and retry |
| Race during acceptance | Partial signatures/inconsistent status | Medium | Transaction, unique signature, status update | Lock/expected version/transition command | Lock current version/party rows, conditional transition, serializable where needed | Parallel signer/decline/void/version tests |
| Deleted client/workspace edge case | Broken evidence/foreign key or leaked record | Medium | Client restricts Contract delete; project delete guarded | Workspace archival/retention/legal hold | Archive, never delete accepted root, null only non-contract operational refs | Delete/archive matrix at each lifecycle state |
| Compromised team member | Unauthorized send/void/export/amend | High after teams | No teams today | RBAC/ABAC, reauth/step-up, audit | Least privilege, approval for sensitive commands, session revocation | Role matrix and compromised-member tabletop |
| Excessive internal permissions | PII/evidence misuse | Medium | Single user only | Role/field-level policy | Separate finance/legal/support scopes, break-glass audit, quarterly review | Permission fuzz/matrix tests |
| Session forgery | Entire workspace compromise | High impact | HMAC session, HttpOnly cookie | Strong secret enforcement, revocation, rotation, CSRF posture | Fail closed without production `SESSION_SECRET`, rotate/revoke sessions, same-site + origin checks on mutations | Tamper/expiry/secret-rotation/CSRF tests |
| Cron secret leakage | Maintenance mutation/DoS | Medium | Exact bearer secret | Secret rotation, network allowlist, job signature/idempotency | Rotate via SSM, scoped endpoint, request ID, replay window | Wrong/replayed/missing secret and duplicate maintenance tests |
| SQL/JSON abuse through large payloads | Resource exhaustion or stored XSS | Medium | Some length limits | Schema validation, body limits, output escaping | Strict schemas, max sections/attachments/body, render-safe text | Oversize/fuzz/HTML/script payload tests |

## Current high-risk conclusions

1. The current public signing flow must be described as a first-party recorded typed-signing flow, not OTP or regulated identity verification.
2. The missing provider callback route is an implementation gap before any external provider is enabled.
3. `ContractArtifact` is evidence metadata, not a durable immutable PDF byte record.
4. Process-local rate limits are not a production control for a multi-instance app.
5. Workspace/team permissions must precede agency/team Agreements.

## Security acceptance gates

- P0 threats have automated tests and operational runbooks.
- Public payload schema is minimized and reviewed.
- Every workspace query and nested relation has an authorization test.
- Provider webhook verification and duplicate handling are tested with raw payloads.
- Accepted versions and artifact hashes are immutable in application and database permissions.
- Evidence export access is role-gated, expiring, audited, and retention-aware.
- Legal copy explicitly states the acceptance/verification method and limitations.
