# Restyle progress — Working Edition port into the Rive app

## Audit follow-up — 2026-09-08 (locally verified)

The historical shell-blocked notes below describe the implementation session,
not the current verification state. The owner requested a thorough audit and
repair with Luna Max executors and a planner/orchestrator. Work remains on `dev`;
no branch, worktree, commit, push, shared-database mutation, or local baseline
regeneration is part of this pass.

- Initial review reproduced a project-detail JSX parse failure, six subsequent
  TypeScript errors, and the semantic-violet false positive in the token guard.
- Audit ownership: shared tokens/primitives; workspace pages and interactions;
  public/auth surfaces and browser coverage. Changes retain the approved restyle.
- A separate local `rive_restyle_review` database was created and all 22 tracked
  migrations applied. The first full domain run passed 532 of 533 tests with no
  skips; the sole failure was the token guard being repaired in parallel.
- Production build passed after the initial fixes. Lint passed with only the
  existing `opengraph-image.tsx` native-image warning.
- First focused browser run: 14 passed, two old-design assertions failed
  (removed button shadow and old dark currency-option colors). Those assertions
  are being updated without weakening the behavior checks.
- Final full domain rerun: 539 passed, zero skipped. Focused core browser rerun:
  16 passed. The first-invoice keyboard/save/review/issue journey passed, and all
  33 activation/migration tests passed with one worker.
- A four-worker broad run was stopped around test 261/308 because memory
  pressure and development-server reloads made its timeout results unreliable.
  It is not a passing full-suite result. Targeted one-worker reruns supersede it.
- Release-critical assertions ran from an ignored local copy with only fixture
  deletion disabled: 12 passed; the S3 upload test was skipped because local
  storage is not configured. Synthetic records were retained.
- Public capture checks exposed a test initialization race and a real 390px
  review-page overflow. Both are repaired. Final public/marketing run: 44 passed,
  including light/dark public actions, 390/1024px overflow checks, desktop
  captures, and the dark signup-modal backdrop. Screenshots were inspected.
- Portfolio studio and marketing responsiveness: 29 passed. Across the final
  targeted browser runs: 135 passed and one unavailable S3 check skipped.
  These are targeted suites, not a passing full browser/screenshot-baseline run.
- Final production build and lint passed. Lint retains the pre-existing
  `src/app/opengraph-image.tsx:33` native-image warning. `git diff --check`
  passed; Graphify was refreshed (optional SQL/Terraform parsers unavailable).
- Verified local HEAD matches remote `dev` at
  `e44be77de118351cf1f2f9e8dfa38a7b7bedb13a`. Nothing was committed or pushed.
- Local browsers use console email and an isolated database. Production-mode
  startup rejects console email; a local SMTP exception was requested but has
  not been approved. CI remains the production-runtime gate. No provider or
  production startup guard was weakened.
- Existing PNG baselines are compared with updates disabled. Any intentional
  restyle changes still require the `Regenerate visual baselines` CI workflow.

### Repaired during the audit

- Project-detail JSX parsing; Badge status-tone and Tabs prop TypeScript errors.
- Primary actions that unintentionally resolved to unstyled buttons, plus the
  public invoice PDF anchor's Base UI `nativeButton` setting.
- Mobile Agreement-review intrinsic grid overflow; dark auth-modal scrim;
  active-navigation and primary-badge text contrast; auth input border cascade.
- Shared disabled/focus/reduced-motion styling and obsolete animation/status
  declarations. Global square corners and heading treatment remain as explicitly
  requested in the restyle brief; no portfolio-specific redesign was added.
- Tests now use semantic colors, complete mocks, browser-error checks, and
  evidence saved inside ignored test-results instead of handoff screenshot files.

### Remaining release gates

The code is locally verified and ready for staging validation, but it has not
been verified on `dev.rive.work`. Before calling the release green:

1. Commit the intended changes on `dev` and push only when authorized (the
   original handoff explicitly says not to push).
2. Run `Regenerate visual baselines` on that `dev` ref, inspect the Linux-rendered
   artifact, and commit the approved PNGs. Do not regenerate them locally.
3. Require the complete production-mode CI suite, including configured storage,
   to pass and smoke-test the resulting `dev.rive.work` deployment.

Evidence: `test-results/restyle-audit-logs/` contains final logs;
`test-results/restyle-final-public/` contains the final public/mobile captures.
The isolated local database and synthetic fixtures remain retained. No shared
database, feature flag, deployment, or production email setting was changed.


Owner note: shell tool (`muse.powershell`) is broken in this session for ALL agents
(error: `failed to resolve shell environment policy: environment key `=::` must not
contain `=`). Consequences, stated honestly:
- Cannot run `git` (no status/pull/commit/push possible), `npm` (no lint/test/build),
  Playwright, or the dev server. All implementation below is file edits only.
- Branch confirmed as `dev` via `.git/HEAD` (`ref: refs/heads/dev`). `git pull
  --ff-only origin dev` could NOT be run — local `dev` may be behind origin.
- Commits required by the handoff (§4, one per phase) are NOT created. Resume step:
  in a session with a working shell: `git status`, `git pull --ff-only origin dev`,
  review diffs, then commit per phase with the handoff's subjects.
- Nothing has been pushed anywhere. All work stays local, as requested.

## Original plan (verbatim summary of §4 phases — do not edit after creation)

- Phase 0 — Guardrails: this progress file; `tests/domain/design-tokens.test.mjs`
  (per-file forbidden-match counts vs inline ALLOWLIST seeded with today's counts,
  total printed; later phases lower entries to 0; Phase 7 allowlist empty; excludes
  portfolio paths); extend `tests/e2e/visual-regression.spec.ts` (screenshots only, no
  baselines) for /onboarding, /login, /workflow/start-engagement,
  /workflow/invoice-settings, a project detail, a client detail, public
  /invoice/[token], /sign/[token], /review/[token] light+dark @1440x900 with existing
  fixtures (skip + note if missing); update DESIGN.md + docs/ui-system.md with §2.
  Commit: "Add design-token guard and restyle documentation".
- Phase 1 — Tokens & primitives (sequential, orchestrator only): globals.css :root/.dark
  per §2.1 + repoint scrollbar/selection/focus/guide; tailwind.config.js per §2.1 +
  animate-panel-in; @layer components (.workspace-toolbar/.workspace-table/.inverse-block,
  th per §2.2); every src/components/ui/* per §2.4 + new kicker/avatar/status-badge/tabs/
  metric-card; src/lib/status-tone.ts + test; eyeball every dashboard page both themes;
  screenshots to HANDOFF-screens/phase1/ (untracked via .git/info/exclude). Commit:
  "Adopt Working Edition tokens and restyle shared primitives".
- Phase 2 — App shell (sequential): (dashboard)/layout, ThemeToggle, CommandPalette,
  GuidedExperience, FeedbackWidget, CurrencySwitcher, DropdownPortal per spec; Toaster
  toastOptions. Commit: "Restyle workspace shell to Working Edition".
- Phase 3 — Workspace pages (parallel, 1 subagent per item, orchestrator reviews +
  commits once): (1) dashboard page + dashboard components; (2) projects list;
  (3) project detail + projects components; (4) clients list+detail + clients
  components; (5) revenue + invoices new/[id] + invoice-settings + invoices components;
  (6) expenses; (7) contracts list+[id] + start-engagement + engagements/contracts
  components; (8) calendar page + calendar components; (9) migrate page + migration
  components. Each: purge §3.1, eyebrows→Kicker, chips→StatusBadge/Badge,
  KPI→MetricCard (only if already label+value+sub+icon), tabs→Tabs, amounts/IDs→mono,
  square progress, no shadow/radii, zero layout change. Commit: "Restyle workspace
  pages to Working Edition".
- Phase 4 — Onboarding & admin (parallel, 2 subagents) per spec. Commit: "Restyle
  onboarding and admin to Working Edition".
- Phase 5 — Auth & public (parallel, 3 subagents): auth, invoice/[token],
  sign/[token]+review/[token] per spec. Commit: "Restyle auth and public invoice, sign
  and review pages".
- Phase 6 — Marketing product mock only (globals.css .workspace-preview*/.wp-*,
  ProductFrame.tsx) per spec. Commit: "Align marketing product mock with the restyled
  app".
- Phase 7 — Cleanup: delete dead CSS/utils, authClasses.ts, blue.* colors; zero hits
  for legacy vars outside [data-surface="marketing"]; allowlist empty; lint/domain/
  build/e2e; graphify update; review guide; Commit: "Remove legacy palette utilities
  after Working Edition restyle".

## Current phase / current file

- Phase 0–3 DONE (code). Phase 3 allowlist all 0 (23 entries). Verification + commits blocked (no shell).
- Phase 4–7 DONE (code). All verification + commits blocked (no shell).

## Per-phase checklist

### Phase 0 — Guardrails [x] (code done; commit + verification blocked)
- [x] Create HANDOFF-app-restyle.progress.md (this file)
- [x] Seed counts from counter subagents (G1–G6 + gap fills; admin=97 verified by orchestrator vs G5a 93)
- [x] tests/domain/design-tokens.test.mjs (ALLOWLIST + total print; baseline total 2424, not ~1600)
- [x] Extend tests/e2e/visual-regression.spec.ts (screenshots only; /onboarding NOT duplicated — already has light+dark 1440x900 baselines)
- [x] Update DESIGN.md and docs/ui-system.md with §2
- [ ] Commit (BLOCKED: no shell) — "Add design-token guard and restyle documentation"

### Phase 1 — Tokens & primitives [x] (code done; verification blocked)
- [x] globals.css :root/.dark per §2.1; repoint scrollbar/selection/focus/guide
- [x] tailwind.config.js per §2.1 + animate-panel-in
- [x] @layer components: .workspace-toolbar/.workspace-table/.inverse-block, th §2.2
- [x] src/components/ui/* per §2.4 + kicker/avatar/status-badge/tabs/metric-card
- [x] src/lib/status-tone.ts + tests/domain/status-tone.test.mjs
- [ ] Eyeball all dashboard pages both themes (BLOCKED: no shell/dev server — owner previews)
- [ ] Screenshots HANDOFF-screens/phase1/ (BLOCKED: no shell)
- [ ] lint/domain/build (BLOCKED: no shell)
- [ ] Commit (BLOCKED) — "Adopt Working Edition tokens and restyle shared primitives"

### Phase 2 — App shell [x] (code done; verification blocked)
- [x] layout/ThemeToggle/CommandPalette/GuidedExperience/FeedbackWidget/CurrencySwitcher/DropdownPortal + Toaster
- [ ] Commit (BLOCKED) — "Restyle workspace shell to Working Edition"

Phase 2 decisions: D26 navLinkClassName helper (ternary kept, both branches call
it; mobile gains min-h-11). D27 collapse button drops hover:bg-accent/
hover:text-foreground (clashed with outline invert). D28 "New client work" →
inverse on desktop topbar + slide-over; mobile icon-only stays default. D29
search trigger keeps hover:border-primary/30; ⌘K chip squared + text-[.7rem].
D30 mobile menu/help/close → bare text-muted-foreground. D31 loading copy →
"Loading workspace" (explicit spec beats no-copy-change). D32 Toaster
toastOptions = toast class only. D33 CurrencySwitcher keeps [color-scheme]
dark: (functional); options → bg-card/text-card-foreground. D34 ThemeToggle
pill track (rounded-full incl. clip-path round 999px), bg-muted track, bg-card
active, expanded shadow via var(--shadow-overlay), collapsed none. D35
FeedbackWidget backdrop bg-foreground/25 (alpha kept), modal bg-card p-5 +
shadow-overlay, eyebrow → Kicker. D36 palette group headings = Kicker nodes
(cmdk accepts ReactNode; headings now uppercase — specified pattern); rows
unified accent + before: left rule; invoice numbers mono; no shortcut hints
exist (n/a). D37 DropdownPortal.tsx needs NO change (positioning only). D38
Avatar swaps use `<Avatar><div className="contents">` (close tags non-unique;
display:contents = zero box). D39–D40 covered by D36. D41 CommandPalette was
rewritten from the persisted pre-edit read; routes/labels/handlers verified
byte-identical. D42 invoiceStatus helpers KEPT (tests/domain/invoice-status.
test.mjs pins them; project test rules beat the handoff's "delete"; item 5
detoxes invoiceStatusClass internals to static token classes and migrates the
3 page consumers to StatusBadge).
D43 opacity modifiers must be theme-scale values
(0,5,10,15,20,25,30,40,50,60,70,75,80,90,95,100) or bracket decimals
(/[0.35]); bare /8,/12,/16,/35,/45,/55 do NOT generate in Tailwind v3
(verified in node_modules/tailwindcss asColor: unknown alpha → undefined →
class dropped). Fixed 24 spots to brackets (alert/8, badge+invoiceStatus/16,
avatar/12, misc /35/45/55). D44 Phase 6 mock mapping: neutral borders →
rgb(12 30 54/.2), panels → #fbfaf6, muted text → #536071, tone text/fills →
§2.1 light hexes (teal mock events folded into info — teal is not a §2.1
tone), progress/health tracks → rgb(12 30 54/.15), active nav → #e2e7f3 +
2px #2563eb rule; tone-chip wash tints kept (only their text/dots moved to
§2.1 hexes). D45 guard allowlist kept with all-zero entries instead of
deleting the object — identical under `ALLOWLIST[file] ?? 0` semantics.
D46 authClasses.ts KEPT (LoginForm, RegisterForm, ForgotPasswordForm,
GoogleSignInButton, reset-password, verify-email import it; classes style
native auth inputs on edition tokens — replacing with shared primitives
changes auth visuals, which §3.3 forbids). Phase 7 "delete if not already"
does not trigger.

### Phase 3 — Workspace pages [x] (code done; commit + verification blocked)
- [x] Item 1 dashboard+components — done, reviewed (DASH/CARD/CHART 0; fixed missed animate-fade-in→panel-in L181)
- [x] Item 2 projects list — reviewed to LIST=0 (Tabs/Kicker/D20 DialogTitle/priority+status StatusBadges; menu handlers+a11y intact; StatusBadge forwards className)
- [x] Item 3 project detail — done, reviewed (DETAIL 0; FPS note: owner to verify header chip case + inverse financial panel in preview)
- [x] Item 4 clients — reviewed to LIST=0;DETAIL=0 (both rewrites read fully; fixed dropped proj.id in project-row href, list capitalize→uppercase, invoice chip raw lowercase; D43 opacity brackets)
- [x] Item 5 revenue/invoices — reviewed to 0 (REV/NEW/INVID/SET/PANEL/UTIL; full reads of revenue page, [id] page, InvoiceDetailPanel; INVID=[id] printable page, PANEL=panel hunk)
- [x] Item 6 expenses — reviewed to EXP=0 (category StatusBadge; billable Yes/No spans → Badge success/muted by orchestrator; 3-part KPIs correctly not MetricCard)
- [x] Item 7 contracts/engagements — reviewed to 0 (CLIST/CDET/SENG/ECOMP/CCOMP/SETUP; D24 statusMeta kept, D20 DialogTitles, ECOMP inverse-block inherits clean, SENG Centered no-op; CCOMP+SETUP rewritten LF-ended)
- [x] Item 8 calendar — reviewed to CAL=0 (ValueCard violet→accent token rename by orchestrator; Tabs/PageHeader/Badge adopted, gradient flattened)
- [x] Item 9 migrate — reviewed to 0 (all 9 files; both rewrites read fully; fixed 2 white-on-paper text-warning-foreground bugs → text-warning)
- [ ] Orchestrator review + commit (BLOCKED) — "Restyle workspace pages to Working Edition"

Phase 3 review notes: item 1 dashboard rewrite verified (MetricCard swap has all
four parts; hand-rolled client avatar correctly kept — Avatar would change size
h-8→h-9 and text color on data colors). Item 3 verified (imports all used, JSX
balanced, D23 raw-text chips preserved, invoice numbers mono, chipTone helper
for Badge variants). Open preview checks: project-detail header chip uppercase
(no e2e pins case; sibling clients/[id] chip is uppercase); inverse financial
panel (coherent but confirm); tracking-tight h1s intentionally left (out of
scope — global h1 rule does not override utilities).

### Phase 4 — Onboarding & admin [x] (code done; commit + verification blocked)
- [x] onboarding/page.tsx — reviewed to ONB=0 (rewrite read in hunks; stepper/progress/header/completion per spec; FormField omission accepted — DOM rule wins)
- [x] admin/page.tsx — reviewed to ADM=0 (Tabs/Kicker/Badge/workspace-table; Metric tones token-based purple→accent; mono numerals)
- [ ] Commit (BLOCKED) — "Restyle onboarding and admin to Working Edition"

### Phase 5 — Auth & public [x] (code done; commit + verification blocked)
- [x] Auth — reviewed (authClasses 3-line detox + AuthOverlay purge; file KEPT, 6 importers remain)
- [x] invoice/[token] — reviewed to INV=0 (inverse header, mono, amount box; no status field existed, Paid/Due label → Kicker)
- [x] sign/review [token] — reviewed to SIGN=0;REV=0 (SIGN rewrite read fully, balanced; notices → Alert, hashes mono)
- [ ] Commit (BLOCKED) — "Restyle auth and public invoice, sign and review pages"

### Phase 6 — Marketing mock [x] (code done; commit + verification blocked)
- [x] globals.css .workspace-preview*/.wp-* (~85 declaration edits by orchestrator) + ProductFrame.tsx rewritten (canvas #f3f0e8, square, active nav #e2e7f3 + 2px #2563eb rule)
- [ ] Commit (BLOCKED) — "Align marketing product mock with the restyled app"

### Phase 7 — Cleanup [x] (code done; verification + commits blocked)
- [x] Deleted dead .glass + legacy :root/.dark vars (marketing-block copies kept per spec); authClasses.ts KEPT (6 importers; deleting regresses auth visuals — see D46); no custom blue.* in tailwind config; legacy-var grep clean outside marketing
- [x] Allowlist all-zero (D45: kept entries at 0, equivalent to empty under ?? 0 semantics)
- [ ] lint/domain/build/e2e (BLOCKED: no shell)
- [ ] graphify update (BLOCKED: no shell)
- [ ] Review guide in this file (see below)
- [ ] Commit (BLOCKED) — "Remove legacy palette utilities after Working Edition restyle"

## Decisions made where the handoff was silent

### Tool-limitation workarounds (no shell; edit tool cannot express CR bytes)
- D1 Repo files are CRLF; `edit_file` multi-line LF finds never match CRLF
  content, and identical twin lines cannot be disambiguated. All edits use
  single-line anchors or full-file rewrites. Added lines are LF (mixed endings
  in edited regions only; each edited line was already in the diff).
- D2 globals.css `:root`/`.dark` twins (5 light + 9 dark token lines identical
  to the `[data-surface="marketing"]` twins, which must stay untouched) are
  redefined LATER IN THE SAME RULE (last declaration wins; valid CSS). Runtime
  result is exactly §2.1; marketing subtree still wins via later+equal-or-higher
  specificity rules. PROPER FIX (when shell works): replace the :root/.dark
  blocks wholesale per §2.1 and delete the trailing redefinitions.
- D3 tailwind `blue:{...}` (6 lines) → `primary-strong` object + `info` string +
  `violet` object (forced shape: the closing `},` line is triplicated in the
  file and cannot be uniquely targeted; all three are DEFAULT-only as specified).
- D4 `boxShadow.card` mapped to `"none"` (handoff allows remove-or-none; keeps
  `shadow-card` classes valid no-ops until page phases purge them).
- D5 `rounded-sm` Tailwind key left at default (handoff zeroes lg/md/3xl only;
  `rounded-sm` is guard-forbidden and purged everywhere instead).
- D6 `animate-panel-in` has no fill mode (literal `panel-in 220ms var(--ease-out)`;
  end keyframe equals natural state so fill is irrelevant).

### Phase 0 judgments
- D7 Guard hex rule = hex inside `[...]` brackets (inline `style={{}}` and data
  colors excluded; verified: calendar:746 `#4285F4` is a style fallback).
- D8 `/onboarding` not duplicated in the screenshot-only block (already covered
  light+dark @1440x900 by baseline tests); token-page captures use new
  route-interception fixtures shaped by the pages' own TS types.
- D9 Guard test: `ALLOWLIST[file] ?? 0` (empty allowlist = everything must be 0);
  over-seeding is safe (fails only when count > entry).

### Phase 1 judgments
- D10 Button base keeps structural/functional utilities the handoff shorthand
  omits (`shrink-0 select-none whitespace-nowrap leading-none`, `[&_svg]`,
  `data-[disabled]` handling) — dropping them would change layout/disabled
  behavior, which outranks the shorthand. Same reasoning: size `lg`/`icon`
  drop redundant `text-sm`/`p-0` (no visual change).
- D11 `disabled:opacity-55` kept literal though bare off-scale opacity may not
  generate in Tailwind v3 (no precedent in repo; `/35`–`/85` MODIFIERS do work).
  PREVIEW CHECKPOINT: confirm disabled buttons/fields visibly dim; if not,
  switch to `disabled:opacity-[0.55]`.
- D12 Badge `warning` uses `text-warning` (formula) not `text-warning-foreground`.
- D13 Alert keeps a neutral `default` variant (existing API; callers use it).
- D14 Alert text is `text-foreground` on all tonal variants (new
  `{tone}-foreground` tokens are white/ink for fills, unreadable on `/8` tints).
- D15 Choice inputs keep focus ring + disabled + cursor (a11y floor beats the
  minimal shorthand); color input keeps `cursor-pointer bg-transparent p-0`.
- D16 `fieldControlClassName` drops `flex` (literal; all usages are w-full).
- D17 Sticky `.table-scroll-region th` underline uses
  `rgb(var(--border) / var(--border-alpha))` (solid `rgb(var(--border))` would be
  a harsh ink line under new channels).
- D18 `MetricCard` muted tone = `bg-muted text-muted-foreground` (no `/10` form
  exists for muted).
- D19 `Tabs` keeps native buttons (no tab roles: calendar e2e asserts
  `role=button`) + `aria-pressed` + literal `data-[state]` classes.
- D20 No `DialogTitle` wrapper created (call sites style their own titles);
  Phase 3 updates the 4 in-scope call sites to
  `text-lg font-extrabold tracking-[-0.03em]` (keeping mt-/pr- utilities).
- D21 statusTone judgments: `planning→muted`, `in_progress→info`,
  `starting→info`, `expired→warning` (current parity), `urgent→destructive`,
  expense tones preserve current color language (software info, hardware violet,
  travel/meals warning, contractor success, office/other muted).
- D22 status-tone.ts does NOT import domain-vocabulary (handoff mandates
  `value: string`; unused imports break lint; coverage is enforced by the test,
  which imports the vocabularies).
- D23 Chips rendering RAW status text (project-detail/client-detail invoice
  chips, client chips with `uppercase`, `proj.status.replace("_"," ")`) are
  purged to `<Badge variant={statusTone(...)}>` PRESERVING exact text — NOT
  `<StatusBadge>` (which would change "paid"→"Paid", "ACTIVE"→"Active",
  violating the identical-text hard constraint). `capitalize`-class chips
  (expense category, priority) DO match canonical labels, so StatusBadge fits.
- D24 Contract `statusMeta` descriptions are rendered text: Phase 3 keeps them
  (plain record), replacing only badge classes with StatusBadge.
- D25 Signer/comment/version Badge usages already token-based; left for Phase 3
  to keep (no statusTone kind for signer states).

## Raw-palette allowlist count over time

- Baseline (Phase 0): total 2424 (G1 424, G2 804, G3 704, G4 23, G5 442, G6 27).
- After Phase 1: ui/* all 0 (−23) → 2401.
- After Phase 2: layout, CommandPalette, GuidedExperience, FeedbackWidget, CurrencySwitcher, ThemeToggle all 0 (−233) → 2168.
- G1: layout 34, dashboard/page 110, ActivationCard 51, AnalyticsCharts 25, CommandPalette 164, GuidedExperience 13, migrate/page 0, MigrationHistory 1, MigrationWizard 5, AnalysisStep 2, PlanStep 2, ReviewStep 11, SuccessStep 2, UploadStep 4, migrate/types 0.
- G2: projects/page 181, projects/[id] 201, clients/page 108, clients/[id] 184, revenue 43, invoices/new 61, invoices/[id] 1, invoice-settings 4, InvoiceDetailPanel 21.
- G3: expenses 117, contracts/page 19, contracts/[id] 28, start-engagement/page 3, StartEngagementComposer 27, ContractComposer 15, ContractWorkSetupCard 8, calendar/page 487.
- G4: alert 1, badge 0, button 7, card 1, dialog 3, DropdownPortal 0, empty-state 3, form-field 0, index 0, input 3, page-header 0, pagination 1, Portal 0, select 0, separator 0, skeleton 1, switch 3, textarea 0.
- G5b: verify-email 0, invoice/[token] 58, sign/[token] 21, review/[token] 31. G5a (onboarding, admin, (auth)/layout, reset-password) pending.
- G6: authClasses 3, AuthHeading 0, authIntent 0, AuthOverlay 2, AuthOverlayProvider 0, AuthShell 0, ForgotPasswordForm 0, GoogleSignInButton 0, LoginForm 0, RegisterForm 0, CurrencyProvider 0, CurrencySwitcher 6, ThemeToggle 9, FeedbackWidget 7, RiveLogo 0.
- Also-seen (not counted): calendar unbracketed hex L746 is inline style (correctly excluded); bg-gradient invoice/[token]:55 + calendar:585; bare rounded engagcomp:348, calendar:605; rounded-none calendar:858.

## Known visual diffs the owner must review

1. Chips are pills now (Badge/StatusBadge `rounded-full`) where raw spans were
   square — billable Yes/No, client/project/invoice/contract status chips.
2. DialogTitles shrank `text-xl` → `text-lg` (D20) on project coverage,
   contract finalize/void, composer dialogs.
3. Calendar ValueCard "Google & Apple" tile is now `bg-accent` (was violet wash).
4. ECOMP "Rive will create" panel and invoice preview header are inverse ink
   blocks (white-on-ink) — eyeball in both themes.
5. Client LTV panel is an inverse ink block with `border-foreground`.
6. Marketing mock: warm-paper canvas/panels, square corners, #e2e7f3 active
   nav with #2563eb left rule, mono amounts.
7. Onboarding stepper/progress and admin Tabs sidebar restyled per spec.
8. Dark-mode Badge/StatusBadge backgrounds now render (were silently dropped
   bare /16 — D43). Dark theme will look different wherever chips appear.

## Blockers / questions for the owner (factual only, never design taste)

1. Shell is broken session-wide (all agents): no lint/test/build/e2e/dev-server/git.
   Owner (or a future session with working shell) must run: `npm run lint`,
   `npm run test:domain`, `npm run build`, `npm run test:e2e`, per-phase commits,
   and the dev-server preview at 390/1024/1440 in both themes.
2. `git pull --ff-only origin dev` not run: local dev may lag origin. Rebase/pull before
   committing if origin moved.

## Review guide for the owner (per phase, what to look at)

- Phase 1 (tokens/primitives): `Badge`/`StatusBadge`/`Alert` chip washes,
  `dark:` variants now bracketed (`/[0.16]`) — compare a status chip in dark
  mode before/after; `Avatar` wash.
- Phase 2 (shell): dashboard layout, `CommandPalette`, `GuidedExperience`.
- Phase 3: every workspace page at 390/1024/1440 × light/dark — dashboard,
  projects, project detail (header chip case + inverse financial panel),
  clients (list + profile), revenue, invoice editor, printable invoice,
  settings, expenses, contracts, start-engagement, calendar (month/week/agenda
  + event dialog), migrate wizard all steps.
- Phase 4: onboarding stepper flow end-to-end; admin tabs + tables.
- Phase 5: auth screens (must look byte-identical — edition art kept);
  public invoice / sign / review token pages.
- Phase 6: marketing product mock vs the real app side by side.
- Intentional diffs: see "Known visual diffs" above (all approved by the plan).
- Unsure items: (a) invoice chips on the client profile render lowercase
  (`sent`) while sibling chips are uppercase — faithful to the original per
  pre-reads but confirm; (b) `text-warning` (amber-700-ish #94530c) on paper
  for the two fixed warnings — readable but verify; (c) mock tone-chip wash
  tints were kept while text moved to §2.1 hexes — confirm the pairing looks
  right; (d) nothing in this session was executed — no lint, tests, build,
  or browser run — so treat all green claims as static-review only.

## Final report

- All 7 phases code-complete. Every guard-scoped file verified at 0
  forbidden matches by independent guard-equivalent searches (expected guard
  total 0 — the test itself could not be executed).
- Review fixes applied by the orchestrator: calendar violet→accent rename,
  2 white-on-paper warning bugs → `text-warning`, expenses Yes/No → Badge,
  client profile project-row href restored, client chip case unified,
  24 dead opacity modifiers → brackets (D43), invoice chip lowercase kept.
- Phase 7 cleanup: dead `.glass` neutralized + legacy `:root`/`.dark` vars
  removed (marketing copies kept); `authClasses.ts` deliberately kept (D46);
  no custom `blue.*` in tailwind config; allowlist all-zero (D45).
- Blocked (environment, not code): shell (`=::` env bug) prevents
  `npm run lint`, `npm run test:domain`, `npm run build`, `npm run test:e2e`,
  screenshots, dev-server preview, `graphify update`, and all commits.
- Exact resume step (needs a working shell, on `dev`): `git pull
  --ff-only origin dev` (or rebase if diverged), then `npm run lint`,
  `npm run test:domain`, `npm run build`, `npx playwright test
  tests/e2e/release-critical.spec.ts`, dev-server preview at 390/1024/1440
  in both themes, per-phase commits from the handoff, and push `dev` only
  when the preview is satisfactory. Visual-regression diffs are EXPECTED
  (the whole app was restyled) — regenerate baselines via the
  `Regenerate visual baselines` workflow, never locally.
- Nothing was pushed anywhere. All work is local on `dev`, uncommitted.
