## Summary
<!-- What changed and why. One or two sentences per bullet. -->

## Test plan
<!-- How was this verified? Check what applies and note what ran. -->
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Domain tests (`npm run test:domain`) — if domain/API/Prisma changed
- [ ] Focused e2e (`npx playwright test tests/e2e/<file>.spec.ts`)
- [ ] Verified on dev.rive.work — required before the dev→main promotion, not for this PR

## Risk
<!-- Migrations, security, payments, or public-token surface? Say so — these ask for a second pair of eyes by convention. -->

Generated with [Devin](https://devin.ai)
