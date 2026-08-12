# Rive Migration Engine

Bring an existing service business into Rive from the CSV and XLSX exports it
already runs on, and reconstruct a connected workspace — clients, projects,
invoices, and expenses — without asking the owner to start again.

The engine is entirely deterministic. There is no LLM, no network call, and no
external service; every decision it makes can be reproduced from the same input.
[Adding an LLM resolver](#adding-the-future-llm-resolver) later does not require
changing the rest of the pipeline.

---

## Pipeline

```
UPLOAD → INGEST → PROFILE → CLASSIFY → MAP → NORMALIZE
       → RESOLVE RELATIONSHIPS → DEDUPE → VALIDATE → BUILD PLAN
       → USER REVIEW → COMMIT → VERIFY → OPTIONAL ROLLBACK
```

Uploaded rows are never translated straight into production records. They become
an intermediate representation first, and only validated IR is compiled into an
import plan.

| Stage | Module | Responsibility |
| --- | --- | --- |
| Ingest | `src/utils/migration/ingest.ts` | Byte limits, MIME and extension checks, CSV/XLSX parsing, provenance |
| Parse | `src/lib/migration/parse/` | Delimiter sniffing, quoting, header detection, one table per sheet |
| Profile | `src/lib/migration/profile.ts` | Per-column statistics and inferred type |
| Classify | `src/lib/migration/classify.ts` | What each file or sheet holds, with confidence |
| Map | `src/lib/migration/mapping.ts` | Source column → canonical field, with confidence |
| Normalize | `src/lib/migration/normalize/` | Text, email, phone, date, money, status |
| Relate | `src/lib/migration/relationships.ts` | Cross-file identity and relationship reconstruction |
| Dedupe | `src/lib/migration/dedupe.ts` | Within the upload, and against the workspace |
| Validate | `src/lib/migration/validate.ts` | The product's own business rules |
| Plan | `src/lib/migration/plan.ts` | Immutable operation list plus hash |
| Commit | `src/utils/migration/commit.ts` | Batched, idempotent execution against a ledger |
| Rollback | `src/utils/migration/rollback.ts` | Undo, narrowly and safely |

`src/lib/migration/**` is **pure**: no database, no `server-only`, no
environment access. That is what lets the whole engine run under `node --test`
with no Postgres, and it is worth preserving. `src/utils/migration/**` adds
persistence and authorization on top.

---

## Intermediate representation

`MigrationRecordIR` (`src/lib/migration/types.ts`) is the canonical shape every
source is compiled into:

```ts
{
  entity, source: { sourceId, fileName, sheetName, sourceRow, sourceKey, externalId },
  raw,                      // original cell values, never discarded
  normalized,               // canonical Rive values
  fieldMappings, confidence,
  warnings, errors,
  relationshipCandidates, resolvedRelationships,
  duplicateCandidates, groupKey,
  status, action,
}
```

It is **persisted** (`migration_records`). That is the single most important
architectural decision here, and it buys four things at once:

- commit never re-parses an upload, so preview and commit provably agree;
- a user can close the browser and resume;
- provenance survives to the committed record and beyond;
- re-mapping is a recompute, not a re-upload.

`raw` is kept forever alongside `normalized`. Debugging, rollback, auditing,
improved mappings, and future LLM routing all depend on it.

---

## Confidence

Confidence is a first-class value in 0–1, used for classification, field
mapping, relationships, and duplicates. Weights and thresholds live in
`src/lib/migration/config.ts` and are unit-tested.

Field mapping combines five signals:

| Signal | Weight | Notes |
| --- | --- | --- |
| Header similarity | 0.40 | Token-set and edit distance over normalized headers |
| Data-type compatibility | 0.20 | Also a **hard veto** — see below |
| Value-pattern match | 0.15 | Measured, not assumed |
| Cross-column context | 0.15 | Bonus only |
| Source adapter hint | 0.10 | Bonus only |

Two details matter more than the numbers:

**Type incompatibility is a veto, not a penalty.** A column of dates can never
map to an amount field, however similar the headers look. The pair is discarded
before scoring.

**Context and adapter hints only ever add.** The first implementation treated a
missing sibling column as evidence *against* a mapping, and `total` lost to
`taxAmount` on a sheet with no tax column purely because `total` has a
contextual rule and `taxAmount` does not. Header, type, and value form a core
score renormalized to 0–1; context and adapter hints then close the remaining
gap (`core + bonus × (1 − core)`).

Thresholds: **≥ 0.78** auto-maps, **≥ 0.55** is suggested and shown during
review, and anything lower is returned `UNRESOLVED` with `target: null`.

---

## What the engine refuses to decide

This boundary is the product, not a limitation. Each of these is deterministic
behaviour with a test.

| Situation | Behaviour |
| --- | --- |
| `$` on an amount | Never resolved. USD, CAD, AUD, SGD, HKD, NZD and MXN are all offered. |
| Currency absent everywhere | Falls back through row → source → migration default → workspace default, in that order, and says which was used. |
| `03/04/2026` with no other evidence | Both readings recorded; the user is asked. One unambiguous sibling row (a day above 12) settles the whole column without asking. |
| A status with no clear equivalent | Left unset with a warning and canonical options. `settled → paid` is safe; "Escalated to legal" is not. |
| A name that merely resembles a client | Offered as a merge candidate. Fuzzy similarity **never** merges on its own. |
| A classification below high confidence | Records are still built so the preview is real, but the user confirms the record type before the migration is ready. |
| A column that is ambiguous by header *and* by values | `UNRESOLVED`. The engine does not pick the least-bad option. |

Historical amounts are **never** converted between currencies.

---

## Relationships

Runs once, after every file is parsed — which is why upload order does not
matter. An invoice can reference a client defined in a file read later, or in no
file at all.

Client identity is resolved by union-find over *deterministic* keys only:
external ID, tax ID, email address, and the normalized company name with legal
suffixes removed (`Acme Technologies Pvt Ltd` → `acme technologies`). Weaker
signals — shared web domain, shared phone number — corroborate but never merge.
Public mailbox domains (`gmail.com` and friends) are excluded, so two clients
sharing a provider are not related.

Resolution precedence:

1. an existing workspace record matched on a strong key → **link**
2. an identity group formed from deterministic keys → **link**
3. a fuzzy name match → **review**
4. nothing → **create** or **review**

Steps 1 and 2 resolve automatically; step 3 never does. `ACME` beside
`Acme Technologies Pvt Ltd` scores ~90% and is offered as a merge, because being
the only plausible candidate is itself evidence — but it is still a question.

**Implied clients.** A migration of invoices alone still reconstructs its
clients, from information the invoice actually carried. Nothing is invented: a
derived client has a name, and an email only if one was present. A reference
that already has plausible matches is *not* derived — that would silently answer
the very question the user should be asked.

---

## Deduplication

Two directions, one rule: **existing data is never modified.** The only outcomes
are `create`, `link`, `skip`, and `review`. There is no update path in V1, so a
migration cannot damage records the user already trusts.

| Entity | Strong keys | Ambiguous outcome |
| --- | --- | --- |
| Clients | email, external ID, identical normalized name | `review` with a merge candidate |
| Projects | external ID, name within a client | `link` to the existing project |
| Invoices | external ID, invoice number | `skip` — the number is unique per user in the schema, so creating would fail |
| Expenses | external transaction ID, or description + amount + date | `review` — two identical purchases in one day are plausible |

---

## Plan and hashing

The plan is the contract between preview and commit. It lists every operation in
execution order (clients → projects → invoices → expenses) and carries a
`sha256` of its own contents.

Each operation also carries a `payloadHash` over the values it will write,
including resolved relationships. Without it the plan hash would only cover
*which* records are created, and a re-mapping that changed a field's value could
slip between preview and commit unnoticed.

`createdAt` is deliberately outside the hash: regenerating an identical plan a
minute later must produce the same hash, or resuming would look like a change
the user never made.

Commit quotes the hash back. A mismatch returns `409` and sends the user to look
again, rather than executing something they never saw.

---

## Commit and idempotency

Every planned operation is written to `migration_operations` before anything is
created, and flipped to `applied` **inside the same transaction** as the record
it creates.

- **Double-click / retry.** The session is claimed with a conditional
  `updateMany`; a second concurrent request matches zero rows and gets `409`.
- **Resume.** A commit that died mid-flight stays `committing`. After five
  minutes it may be resumed; the ledger is re-read, applied operations are
  skipped, and the client/project id maps are rebuilt from what already landed.
- **Batching.** Work runs in batches of 200, each its own transaction, rather
  than one long transaction that could time out with an uncertain outcome.
- **Partial failure.** Everything before the failing batch is committed and
  recorded. The response says how many records landed and that nothing after
  the failure was written — never a bare 500 over uncertain data.
- **Belt and braces.** `imported_records` is unique on
  `(migration, sourceType, sourceKey)`, and a `P2002` during creation is treated
  as "already imported" and skipped rather than failing the batch.

---

## Rollback

Scope is narrow and stated plainly: **records this migration created, which
nobody has touched since.**

`imported_records.target_stamp` records the created row's `updatedAt` at import
time. Rollback compares it against the current value; anything edited since is
reported as a conflict and kept. A record with no stamp is also kept — without
evidence either way, refusing is the safe answer.

Rollback never deletes records that existed before the migration (a `link`
created nothing), records created by anything else, or a parent that surviving
records still depend on. Deletion runs children-first so a client is never
removed while an invoice still points at it.

`GET /api/migrations/:id/rollback` previews exactly what would happen, so the
confirmation the user sees is the truth rather than an estimate.

---

## Security

- Every query is scoped by `userId`; ownership is part of the `where` clause,
  never a check afterwards.
- All state transitions are server-controlled. The client asks for an action; it
  can never assert a state.
- Uploads are validated by extension, declared MIME type, and actual parse
  result, with byte, row, column, sheet, and file-count caps. Oversized
  migrations are **rejected with an explicit message**, never truncated.
- Review payloads return only records needing attention, paginated — a
  20,000-row migration does not become a 20,000-row JSON response.
- Analytics properties carry counts, rates, and durations. Never cell values.
- `neutralizeFormula` in `normalize/text.ts` is available for any generated CSV
  export or downloadable preview, so imported data cannot become a payload in
  the user's own spreadsheet later.

---

## Adding things later

### A source adapter

Implement `SourceAdapter` (`adapters/types.ts`) and register it in
`adapters/registry.ts`. An adapter may only *contribute signals* —
`detect`, `classify`, `provideHeaderAliases`, `normalizeStatuses`,
`identifyExternalIds`, `provideRelationshipHints`. It can never write records or
override a validation rule. Vendor rules stay separate from generic rules, or
every source slowly inherits every vendor's quirks.

V1 ships `GenericTabularAdapter` only. There are deliberately no Zoho Books,
QuickBooks, Bonsai, FreshBooks, or Xero adapters; the seam is proven by the
generic adapter flowing through it.

### A canonical entity

1. Add its fields to `CANONICAL_FIELDS` in `fields.ts`.
2. Add classification signatures and name hints in `classify.ts`.
3. Add normalization for any new semantic type in `build.ts`.
4. Add validation in `validate.ts`, sourcing vocabularies from
   `src/lib/domain-vocabulary.ts` — never restate a rule the product already
   enforces.
5. Add a creator branch in `commit.ts` and a delete branch in `rollback.ts`.
6. Add fixtures and tests.

### Adding the future LLM resolver

The seam is `src/lib/migration/resolver.ts`. Three properties are load-bearing:

1. **A resolver only ever sees `UNRESOLVED` items.** High and medium confidence
   mappings never reach it, so it cannot overturn deterministic work.
2. **A resolver returns proposals, not decisions.** `applyProposals` re-validates
   every proposal against the same field catalogue, drops unknown or
   already-claimed targets, and **caps confidence below the auto-map threshold**
   so a proposal always lands in user review.
3. **No resolver writes to the database.** Resolution happens before plan
   construction; the plan remains the only thing commit can execute.

To add one: implement `MappingResolver`, call it between `buildMappingPlan` and
`buildRecords` in `pipeline.ts`, and feed the result through `applyProposals`.
Nothing else changes.

`deterministicResolver` proposes nothing today. That is the correct behaviour,
not a placeholder — unresolved means "ask the user".

---

## Configuration

```bash
MIGRATION_ENGINE_ENABLED="false"   # gates the route, the APIs, and the onboarding hand-off
MAX_UPLOAD_BYTES="10485760"        # platform-wide cap; migration takes the lower of this and its own
```

While the flag is off the route 404s and the original onboarding importer
remains the only import path, which keeps the rollback story to a single flag.

Limits (`MIGRATION_LIMITS`): 10 files, 12 sheets per workbook, 5 MB per file,
20 MB total, 10,000 rows per source, 20,000 rows total, 128 columns.

---

## Tests

```bash
npm run test:domain     # engine unit + integration tests, no database needed
npm run test:e2e        # browser journey; needs a database, a seeded user, and the flag on
node scripts/build-migration-fixtures.mjs   # regenerate the XLSX fixtures
```

Fixtures live in `tests/fixtures/migration/` and are entirely synthetic. They
include the adversarial cases on purpose: weird headers, duplicates, missing
emails, multiple currencies, unknown statuses, ambiguous and invalid dates,
negative expenses, semicolon delimiters, empty and headers-only files, and a
multi-sheet workbook with a title row above the real header.
