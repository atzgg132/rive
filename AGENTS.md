<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:product-engineering-judgment -->
# Product & engineering judgment

Think like an excellent Product leader and an excellent Engineering Manager. Start
from the user problem, product value, evidence, audience, and desired outcome.
Prefer the simplest solution that creates meaningful value. Do not overengineer
imaginative ideas, decorative machinery, abstractions, or speculative features.
Consider scope, maintainability, performance, accessibility, testing, rollout risk,
and reversibility. Make tradeoffs and uncertainty explicit. Do not invent product
behavior, fake data, integrations, or proof. Suggest options before committing to
subjective design decisions.
<!-- END:product-engineering-judgment -->

<!-- BEGIN:release-conventions -->
# Shipping

## Only `main` and `dev`. All work happens on `dev`.

This repository has exactly two branches. Never create another one.

`dev` is the working branch. Commit and push there — not on a feature branch,
not on a hotfix branch, not on a cloud-agent branch. Pushing `dev` deploys to
https://dev.rive.work. That environment is the pre-production gate and runs the
same browser suite `main` does.

`main` is production. Nothing is committed or pushed to it. The only update
path is a merge-commit pull request from `dev` to `main` after `dev.rive.work`
is good. Even a one-line urgent fix goes this route.

Do not cherry-pick a commit onto `main` to ship it sooner. The cherry-pick
creates a second commit with the same content under a different SHA, so `main`
and `dev` both carry the change and neither history matches the other. It merges
cleanly the first time and gets harder to reason about with every repeat — and
it silently skips the `dev` deploy that would have caught an environment problem.

If `dev` carries work you are not ready to promote, that is a reason to finish
or revert that work, not a reason to route around `dev`.

Do not create git worktrees or extra branches for a tooling session, whatever
tool it is (`git checkout -b`, `-w`/worktree flags, cloud-agent branches).
Stay on `dev`.

## Screenshot baselines

Regenerate them with the `Regenerate visual baselines` workflow, never locally:
Chromium's Linux font stack on the CI runner rendered the committed images and no
developer machine reproduces it.

`.github/workflows/visual-baselines.yml` must stay on the default branch. GitHub
offers a `workflow_dispatch` trigger only for workflows present there, so while
it lived only on `dev` it could not be started at all — the API answered 404 and
it never appeared in the Actions UI.

## Deploys can fail for reasons that are not yours

`verify` has a 30-minute ceiling and `playwright install --with-deps` shells out
to `apt`. A stalled Ubuntu mirror has consumed the entire budget with the job
otherwise healthy. Check where the time went before assuming the change is at
fault: if a step sat silent and the code-level gates all passed, re-run it.
<!-- END:release-conventions -->

# Rive

Rive is the operating system for independent work: projects, clients, revenue,
expenses, calendar, portfolio, agreements, and business signals in one workspace.
Users are freelancers and small practices. Prefer the simplest change that
creates real value for that person. Do not invent product behavior.

# Commands

- Install: `npm install`
- Local Postgres: `docker compose up -d db` then `DATABASE_URL=postgresql://rive:rive_local@localhost:5432/rive` in `.env.local`
- Generate client: `npm run db:generate`
- Apply tracked migrations: `npm run db:migrate` (local) or `npm run db:migrate:aws` (dev DB via SSM)
- Dev server: `npm run dev` or `npm run dev:aws`
- Lint: `npm run lint`
- Domain tests: `npm run test:domain` (or `npm run test:unit`)
- Focused e2e: `npx playwright test tests/e2e/<file>.spec.ts`
- Release-critical e2e: `npm run test:integration`
- Full e2e: `npm run test:e2e` (slow; do not use as the first check)
- Production build: `npm run build`
- Combined gate: `npm run check` (lint + full browser suite + build; slow — not a first check)

# Layout

- `src/app/` — Next.js App Router: `(auth)`, `(dashboard)`, `(marketing)`, public token routes, `api/`
- `src/app/api/workflow/` — authenticated workspace CRUD (clients, projects, invoices, expenses, contracts)
- `src/app/api/public/` — tokenized client-facing invoice, contract, and portfolio routes
- `src/components/ui/` — source-owned UI primitives; import from `@/components/ui`
- `src/utils/` — server auth, invoices, contracts, email, calendar, tenancy
- `src/lib/` — domain vocabulary, pagination, migration helpers, product analytics
- `prisma/schema.prisma` — schema; `prisma/migrations/` — tracked SQL only
- `tests/domain/` — fast domain tests (`.test.mjs`)
- `tests/e2e/` — Playwright; `tests/e2e/release-critical.spec.ts` is the ship gate
- `docs/` — product and ops contracts; read before changing the matching area
- `infrastructure/` — AWS Terraform; see `infrastructure/AGENTS.md`

# Conventions

- Match existing files. Do not add a dependency if the current stack can do it.
- Workspace APIs must scope to the session user (`getSessionUser` / `userId`). Never query another tenant's rows.
- Status, priority, category, and field limits live in `src/lib/domain-vocabulary.ts`. Import them. Do not declare parallel enums in routes or the importer.
- Funnel / activation definitions: `docs/funnel-definitions.md` and `src/utils/funnelDefinitions.ts` must stay the same contract.
- Agreements: structured canonical data is the source of truth; PDFs are artifacts. Read `docs/agreements/target-product-spec.md` before changing contract flows.
- UI: follow `DESIGN.md` and `docs/ui-system.md`.
- TypeScript path alias is `@/` → `src/`.
- Use ESM `import`/`export` syntax in `src`.
- Use `.js`, `.jsx`, `.ts`, or `.tsx` extensions for files in `src/`.

# Verification

Before calling work done:

1. `npm run lint`
2. `npm run test:domain` when domain, API, or Prisma behavior changed
3. The smallest relevant Playwright spec under `tests/e2e/`
4. `npm run build` for type or production-path changes
5. Add or extend a domain or e2e test when changing behavior or fixing a bug

Do not regenerate visual baselines locally. Use the `Regenerate visual baselines` GitHub workflow.

# Safety

- Do not commit secrets, `.env*`, Terraform state, or `*.tfplan`.
- Do not run `prisma db push` against a shared or AWS database. Use tracked migrations.
- Do not apply Terraform without an inspected plan and an explicit request. Stop on destroy/replace.
- Do not push or commit to `main`. Do not `git push --force`.
- Do not delete database records, run cleanup purges, or `prisma migrate reset`. Use uniquely labelled synthetic fixtures instead of resetting data.
- Do not enable a production feature flag without an explicit go-ahead.
- Local email: `EMAIL_PROVIDER=console` unless the user asked otherwise.
- Public forms, signing links, and invoice tokens are abuse-sensitive. Keep rate limits and existing gates.

# Working agreement

For a real feature or a multi-step change, agree the outcome before writing code:
state the user problem, the proposed behavior, and what is explicitly out of
scope. Get that agreed, then implement. Questions, small bugfixes, and read-only
checks do not need this.

Report honestly. "Implemented", "verified locally", and "verified on `dev`" are
different states — never substitute one for another. If something is blocked,
say what is missing and what the exact resume step is; finish the independent
work rather than going quiet.

# Docs map

| Topic | Read first |
| --- | --- |
| Product / agreements | `docs/agreements/target-product-spec.md` |
| Architecture | `docs/agreements/target-architecture.md` |
| Testing | `docs/agreements/testing-strategy.md` |
| Security | `docs/agreements/security-threat-model.md` |
| UI | `docs/ui-system.md`, `DESIGN.md` |
| Funnels | `docs/funnel-definitions.md` |
| Local beta | `docs/open-beta-local-testing.md` |
| AWS | `infrastructure/README.md` |

# Codebase questions

When `graphify-out/graph.json` exists, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` before wide grep. After code changes, run `graphify update .` if graphify is available.
