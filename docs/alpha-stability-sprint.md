# Alpha stability sprint

Status: implementation complete; database-backed fresh-user verification passed against the AWS development environment on 2026-08-10.

## Implementation checklist

- [x] Inspect Next.js, Prisma, auth, portfolio routes, storage, email, and shared UI patterns.
- [x] Stabilize save/reload behavior and public portfolio state.
- [x] Audit upload authorization, object delivery, and cross-user boundaries.
- [x] Improve first-run activation, portfolio progression, readiness, and work-type modeling.
- [x] Simplify selected-work entry and clarify cover/gallery media.
- [x] Add the smallest historical testimonial model and controlled appearance options.
- [x] Run lint, typecheck, build, and browser regression checks.
- [x] Run the full database-backed fresh-account journey against AWS development infrastructure with a disposable E2E user.

## P0 findings and fixes

### Portfolio save and data loss

The editor previously kept edits in React state until an explicit, hard-to-find PATCH action. It had no durable local recovery, leave warning, or visible save state. The editor now has a sticky save/publish area with `Saved`, `Saving...`, `Unsaved changes`, and `Save failed` states; revision conflicts and API errors remain visible; `beforeunload` warns on dirty state; and a per-portfolio local recovery snapshot offers restore/discard after reload. Drafts may remain incomplete, while publishing requires display name, headline, introduction, and contact email. Newer edits are not overwritten when a save response races with another edit.

### Public portfolio URLs

The public route already intentionally served published portfolios only. The editor was still making a draft URL look live, which made a valid draft appear broken. The editor now exposes/copies a URL only after the saved portfolio is published and labels drafts explicitly. Unknown or unpublished slugs use an explanatory portfolio not-found page.

### Upload and object storage

The Terraform configuration blocks public bucket access, uses server-side encryption, and grants object permissions to the application role rather than browser users. Presigned writes require the signed session cookie, are scoped to `portfolio/<authenticated-user-id>/<random-uuid>.<extension>`, accept only JPEG/PNG/WebP/GIF with a size limit, and are rate-limited. Public delivery is an intentionally public, read-only server proxy with a strict portfolio-key pattern, fixed image content types, inline disposition, caching, and `nosniff`. Normal editor fields show “Uploaded image” instead of an implementation storage key.

Uploads are intentionally independent assets: the object is created before the portfolio JSON is saved, and the returned managed URL is associated only when the portfolio save succeeds. This preserves upload progress and avoids holding large files in the portfolio PATCH. Completed-but-never-associated objects can still remain in storage; the existing lifecycle only cleans incomplete multipart uploads and old noncurrent versions, so an ownership registry or reconciliation job is a follow-up.

### Email copy

Obvious waitlist capitalization/grammar and the contract-completion “created in Rive” wording were corrected. Dynamic title/intro values now go through the shared template escaping boundary without double-escaping. The existing email architecture was retained.

## Activation and UX changes

- New accounts see a focused dashboard activation state rather than the established-user metric wall. It uses the existing Rive entities: profile readiness, client, project, financial context, and schedule.
- The portfolio editor is organized as Profile, Selected work, Services, Testimonials, and Appearance, with completion/readiness signals and optional advanced fields kept behind progressive disclosure.
- Profile readiness is based on useful signals, not every optional field. Core substantial completion is four of five: identity, headline/introduction, service, public project, and contact.
- Registration, onboarding start, substantial profile completion, portfolio publication, first client, first project, and first meaningful workflow are recorded as idempotent AuditEvent actions. Signup is not treated as activation.
- Work type is now a multi-select UI/API with a compatibility-preserving legacy `businessType` value.
- Selected work has essential fields first; case-study context and gallery are optional. Cover image and gallery controls now explain their distinct purposes.
- Historical testimonials support quote, name, role/company, source, project association, visibility, and a clear “not Rive-verified” label. Private testimonials are excluded from the public renderer.
- Appearance remains constrained to existing template/accent/mode/corner controls. Typography adjustments are scoped to dense workspace surfaces; shared controls and existing reduced-motion behavior remain in use.

## Product decisions

- Draft save is allowed to be incomplete; publishing is the small, explicit quality gate. This prevents accidental publication without making profile setup require every optional field.
- Portfolio media is public by design once referenced by a public portfolio, while upload/write access remains authenticated and user-scoped.
- Historical testimonials are imported social proof, never presented as Rive-verified reputation.
- No freeform website builder, recommendation ranking, Anime.js dependency, wholesale shadcn migration, or billing implementation was added.
- Availability taxonomy and paid-plan branding removal remain product decisions because the current domain/entitlement model is not ready to support them safely.

## Remaining issues

- A completed upload that is never associated with a saved portfolio can be orphaned. Add an asset registry/reconciliation policy before private media or high-volume use.
- `tests/e2e/release-critical.spec.ts` covers portfolio persistence/publication and private-content boundaries, revision conflicts, S3 upload authorization and delivery, expense ownership, calendar/client/project ownership, onboarding multi-select, idempotent activation, password-reset session revocation, the client-to-invoice path, and explicit dashboard/editor failures. The suite passed 9/9 against the migrated AWS development PostgreSQL service; the full Playwright suite passed 91/91 with email intentionally disabled for dev.
- Availability remains free text pending a domain decision; no rigid database enum was introduced.

## Database/API compatibility

Migration `20260809120000_add_user_business_types` adds `users.business_types TEXT[] NOT NULL DEFAULT []` and backfills the existing nullable `business_type` into a one-element array. Migration `20260809150000_harden_sessions_and_activation_events` adds `users.session_version` for password-reset session revocation, removes duplicate per-user activation rows, and adds the per-user/action uniqueness constraint used by idempotent activation writes. The legacy `business_type` column remains populated with the first selected value for existing consumers. Portfolio APIs now reject invalid content and incomplete publication, expose explicit status errors, filter private content from public JSON, and emit the readiness/activation fields described above.
