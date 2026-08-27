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
