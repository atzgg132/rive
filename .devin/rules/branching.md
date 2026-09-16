# Branch policy (hard)

Three kinds of branches: `main` (production), `dev` (staging), and short-lived
typed work branches — `feature/`, `fix/`, `chore/`, `hotfix/`, `docs/`,
`sync/`. Never create a branch outside the typed set.

## The flow

1. `git checkout dev && git pull --ff-only origin dev`
2. `git checkout -b feature/<slug>` (or `fix/`, `chore/`, `docs/`)
3. Commit and push the work branch — `Quality` runs the full suite on it
4. PR to `dev` — branch-policy requires the `type/slug` name
5. **Squash merge** — one commit per feature; head auto-deletes
6. The merge push deploys dev.rive.work — verify there before promoting
7. Promote in batches: merge-commit PR `dev` → `main` → rive.work

## Never

- No direct commits or pushes to `dev` or `main`
- No cherry-picking onto `main` — it skips the `dev` deploy gate
- No worktrees or untyped scratch branches

## Hotfixes

`hotfix/<slug>` off `main` → PR to `main` → merge commit → then `sync/main-back`
off `main` → PR to `dev` → squash merge, so staging keeps up with production.
