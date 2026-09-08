# HANDOFF: Port the "Working Edition" (marketing v3) theme into the Rive app

You are the **executor** for a fully specified visual restyle of the Rive authenticated
app. The design decisions have already been made by the lead designer and approved by the
owner. **Your job is to implement this document exactly — not to redesign, reinterpret,
"improve", or simplify it.** Where this document is specific, follow it literally. Where
it is silent, choose the option that is most consistent with the rest of this document,
write your choice down in the tracking file (see §0), and move on. Do not ask the owner
subjective design questions; they have been answered here.

Repository: `C:\Users\Arnav Bhattacharya\Code\rive` (Next.js App Router, Tailwind 3 with
CSS-variable tokens, `next-themes` class strategy, Base UI + CVA primitives in
`src/components/ui`, Playwright e2e, `.test.mjs` domain tests). Read `AGENTS.md`,
`DESIGN.md`, `docs/ui-system.md` first. Obey `AGENTS.md` in full.

---

## 0. Working protocol (non-negotiable)

### Branch & delivery
- Work on `dev` only (`git checkout dev && git pull --ff-only origin dev`). Never create
  a branch or worktree. Never touch `main`.
- **Commit locally, do NOT push.** The owner reviews locally before anything goes to
  `dev.rive.work`. One commit per phase (§4). Use the commit format in `AGENTS.md`
  conventions (concise "why" subject, Devin trailer).
- Do not regenerate Playwright screenshot baselines locally. Expect
  `tests/e2e/visual-regression.spec.ts` to *fail on pixel diffs* — that is intended and is
  reviewed by the owner. Do not "fix" it by updating PNGs. Do not skip or delete the spec.
- Do not modify `.github/workflows/*`, `prisma/*`, `infrastructure/*`, anything in
  `src/app/api/*`, or any `.env*`.

### Memory & tracking (you must maintain this)
Create `HANDOFF-app-restyle.progress.md` at repo root on your first action and keep it
current after **every** file you finish. It is your memory across context resets and
subagents. Structure:

```
# Restyle progress
## Original plan (verbatim summary of §4 phases — do not edit after creation)
## Current phase / current file
## Per-phase checklist (copy §4 items, tick [x] as done, with commit SHA)
## Decisions made where the handoff was silent (what, where, why)
## Raw-palette allowlist count over time (from the Phase 0 guard test)
## Known visual diffs the owner must review (page, theme, viewport, what changed)
## Blockers / questions for the owner (factual only, never design taste)
```

Re-read the progress file and this handoff at the start of every phase and after any
context reset. If you find the progress file and this handoff disagree, this handoff wins.

### Parallelism
You may spawn as many subagents (same model as you) as useful. Rules:
- Phase 0, 1 and 2 are **sequential** (everything depends on tokens and primitives).
- Phase 3, 4, 5 files are **independent** and should be parallelized: one subagent per
  page/feature file. Give each subagent this entire handoff plus the exact file list. Two
  subagents must never edit the same file. Only you (the orchestrator) edit
  `globals.css`, `tailwind.config.js`, `src/components/ui/*`, and the progress file.
- Each subagent reports back: files changed, before/after count of raw palette matches,
  lint result, and any place it had to make a judgment call. You record these in the
  progress file.

### Verification per file / per phase
1. `npm run lint`
2. `npm run test:domain` (includes the Phase 0 token guard)
3. The smallest relevant spec: `npx playwright test tests/e2e/<page>.spec.ts`
4. Manually open the page in both themes at 390, 1024 and 1440 widths (`npm run dev`,
   toggle theme with the in-app ThemeToggle) and confirm: nothing overflows, every text
   is readable, no white/blue "old" surfaces remain.
5. `npm run build` at the end of Phases 1, 3, 5 and 7.
6. Full `npm run test:e2e` once at the very end. Report pass/fail honestly.

### Hard constraints on what may change
- **Visual only.** Colors, fonts, sizes, weights, letter-spacing, radii, borders,
  shadows, spacing tokens, icons stroke, hover/focus styles, motion.
- **Must not change:** layout/arrangement, DOM order, any data, copy, labels, routes,
  props/API of components (adding optional visual props is fine), state, handlers,
  accessibility names, `data-testid`s, the fixed dashboard shell mechanics
  (`[data-dashboard-shell]`, `.table-scroll-region`), rate limits, auth.
- Swapping a hand-rolled element for a shared primitive (e.g. an inline status `<span>`
  for `<StatusBadge>`) is allowed **only** when the rendered text and position are
  identical.
- **Out of scope, do not touch:** `src/components/portfolio/**`,
  `src/app/(dashboard)/portfolio/**` (page content; its shell restyles via layout),
  `src/app/p/**`, `src/app/portfolio-preview/**`, portfolio templates. Also do not touch
  marketing pages/components **except** in Phase 6 (the product mock CSS only).
- Do NOT add or remove code comments unless the comment becomes false because of your
  change.
- Do not add dependencies.

---

## 1. Context: what the target looks like and why

The marketing site's final ("v3", "Working Edition") direction lives in the `edition-*`
CSS in `src/app/globals.css` (≈ lines 1268–1700 and 1700–2160). Its language:

- **Surfaces:** warm paper `#f3f0e8` canvas, bright paper `#fbfaf6` panels, ink
  `#0c1e36` text, electric blue `#2563eb` (hover `#1847bd`), muted `#536071`.
- **Line, not shadow:** one hairline `rgb(12 30 54 / .2)` separates everything. No card
  shadows. Shadows only on floating layers.
- **Square:** `border-radius: 0` on buttons, panels, header CTA. Only pills (badges),
  avatars and dots are round.
- **Type:** Outfit 800, `letter-spacing -0.04em`, tight line-height for display;
  uppercase 800 `.14em` **kickers** with a leading dot (`.edition-kicker`); JetBrains
  Mono for labels/numbers in product mocks.
- **Buttons:** bordered rectangles, `font-weight 800`, trailing `→`, `translateY(-1px)`
  on hover, 160ms ease. Primary = blue fill; ghost = transparent that inverts to ink on
  hover; header CTA = ink fill ("inverse").
- **Callouts:** left rule `border-left: 3px solid blue` (`.edition-boundary`), not
  tinted boxes.
- **Emphasis blocks:** full ink or full blue sections with white text.
- **Motion:** `--ease-out: cubic-bezier(0.23,1,0.32,1)`, 160–420ms, reduced-motion
  respected.

The app (`src/app/(dashboard)`, onboarding, admin, public invoice/sign/review) is still
the old cool ice-blue, rounded, shadowed shadcn look with ~1,600 raw Tailwind palette
classes (`bg-blue-50`, `text-slate-500`, `dark:bg-slate-800`, hex…) and three different
inline status-color maps. The shared primitives in `src/components/ui` are already ~95%
token-based, so the restyle is: **(a) swap tokens, (b) restyle primitives, (c) purge raw
palette classes page by page, (d) consolidate hand-rolled chips/eyebrows/metrics into a
few new primitives.**

Owner decisions already taken (do not reopen):
1. App adopts **warm paper** surfaces exactly like marketing.
2. **Radius 0** everywhere; pills/avatars/dots stay round.
3. Dark mode is **ink-derived** (navy-black), not the current slate.

---

## 2. Design specification — implement literally

### 2.1 Color tokens (`src/app/globals.css` `:root` and `.dark`)

Replace the current `:root` semantic block (lines ≈ 31–60) and `.dark` block (≈ 111–151)
with the values below. Keep the space-separated RGB convention (`rgb(var(--x) / <alpha>)`
in `tailwind.config.js`). Keep the font and easing variables.

| Token | Light | Dark |
|---|---|---|
| `--background` | `243 240 232` | `9 17 31` |
| `--foreground` | `12 30 54` | `241 238 230` |
| `--card` | `251 250 246` | `13 24 42` |
| `--card-foreground` | `12 30 54` | `241 238 230` |
| `--popover` | `251 250 246` | `16 28 48` |
| `--popover-foreground` | `12 30 54` | `241 238 230` |
| `--muted` | `235 231 221` | `20 33 55` |
| `--muted-foreground` | `83 96 113` | `154 166 184` |
| `--primary` | `37 99 235` | `96 144 255` |
| `--primary-foreground` | `255 255 255` | `9 17 31` |
| `--primary-strong` (new) | `24 71 189` | `130 168 255` |
| `--secondary` | `226 231 243` | `24 43 78` |
| `--secondary-foreground` | `24 71 189` | `190 208 255` |
| `--accent` | `226 231 243` | `24 43 78` |
| `--accent-foreground` | `24 71 189` | `190 208 255` |
| `--success` | `8 117 84` | `52 199 150` |
| `--success-foreground` | `255 255 255` | `9 17 31` |
| `--warning` | `148 83 12` | `232 168 64` |
| `--warning-foreground` | `255 255 255` | `9 17 31` |
| `--destructive` | `179 55 55` | `240 112 112` |
| `--destructive-foreground` | `255 255 255` | `9 17 31` |
| `--info` (new) | `24 71 189` | `130 168 255` |
| `--violet` (new) | `98 54 167` | `171 140 232` |
| `--line` (new, hairline base) | `12 30 54` | `241 238 230` |
| `--border` | **`rgb(var(--line) / 0.20)`** — see note | `rgb(var(--line) / 0.14)` |
| `--input` | `rgb(var(--line) / 0.32)` | `rgb(var(--line) / 0.22)` |
| `--ring` | `37 99 235` | `96 144 255` |
| `--radius` | `0` | `0` |
| `--shadow-card` | `none` | `none` |
| `--shadow-overlay` | `0 24px 60px rgb(12 30 54 / 0.16)` | `0 24px 60px rgb(0 0 0 / 0.55)` |
| `--brand-wordmark` | `12 30 54` | `241 238 230` |
| `--brand-accent` | `37 99 235` | `96 144 255` |

**Note on `--border`/`--input`:** the Tailwind config does `rgb(var(--border) / <alpha>)`,
which needs channels, not a color. Implement as: keep `--border: 12 30 54` (light) /
`241 238 230` (dark) as channels, and change `tailwind.config.js` `border` and `input`
entries to fixed-alpha colors: `border: "rgb(var(--border) / 0.20)"` (light) — since
Tailwind can't switch alpha per theme, add `--border-alpha: 0.20` / `.dark { --border-alpha: 0.14 }`
and `--input-alpha: 0.32` / `.22`, and set `border: "rgb(var(--border) / var(--border-alpha))"`,
`input: "rgb(var(--input) / var(--input-alpha))"`. Then `border-border` is *the* hairline.
Any existing `border-border/90`, `/60`, `/50` etc. → plain `border-border`.

Tailwind additions (`theme.extend.colors`): `"primary-strong"`, `info`, `violet` (with
`DEFAULT` only), keep `success/warning/destructive` with `foreground`. **Remove** the
`blue: { primary, light, soft, border }` block. **Remove** `boxShadow.card` (or map to
`none`) — keep `boxShadow.overlay`. `borderRadius`: keep `xl: var(--radius)`,
`"2xl": var(--radius)` (both 0), and add `lg: var(--radius)`, `md: var(--radius)`,
`"3xl": var(--radius)` so any straggler literal radius class also resolves to 0. Leave
`rounded-full` alone.

Delete legacy variables `--bg-primary`, `--bg-secondary`, `--text-primary`,
`--text-secondary`, `--color-blue-primary/light/soft/border` from `:root` and `.dark`
**after** repointing their consumers in `globals.css`:
- `::-webkit-scrollbar-track` → `rgb(var(--background))`; thumb →
  `rgb(var(--line) / 0.25)`; thumb hover → `rgb(var(--muted-foreground))`.
- `::selection` → `rgb(var(--primary) / 0.18)` / `color: inherit`.
- `:focus-visible` → `outline: 2px solid rgb(var(--ring)); outline-offset: 2px`.
- `[data-guide-highlight]` → `rgb(var(--primary) / .35)` and `/ .08`.
- `.glass`, `.gradient-text`, `.rive-primary-button`, `.rive-secondary-button`,
  `.rive-eyebrow`, `.animate-fade-in-up/.animate-fade-in/.animate-float/.animate-pulse-ring`
  and their keyframes: grep for usages; migrate usages to primitives (Phase 2/3), then
  delete in Phase 7. `pulse-ring` keyframe uses hard blue — delete with it.
- The `[data-surface="marketing"]` blocks (both the "cinematic" one at ≈157–249 and the
  `edition` one at ≈1268–1297) are **left untouched** except in Phase 6.

Status chips use one formula, never a separate hex per tone:
light `border-{tone}/25 bg-{tone}/10 text-{tone}`, dark `border-{tone}/30 bg-{tone}/16 text-{tone}`
(implement via `dark:` variants inside the Badge CVA once).

### 2.2 Typography
- Fonts unchanged: Outfit (`font-sans`), JetBrains Mono (`font-mono`). Mono file is
  weight 600 only — fine.
- `h1,h2,h3…` global rule: change `letter-spacing: -0.02em` → keep for h3+; set
  `h1, h2 { letter-spacing: -0.04em; line-height: 1.02; }`.
- `PageHeader` title: `text-[1.75rem] sm:text-[2rem] font-extrabold tracking-[-0.04em] leading-[1.02]`.
  Description: `text-sm leading-6 text-muted-foreground max-w-3xl` (unchanged size).
- Card section titles (`CardTitle`): `text-[1.05rem] font-bold tracking-[-0.02em]`.
- **Kicker** primitive replaces every eyebrow pattern like
  `text-xs font-bold uppercase tracking-[0.16em] text-primary` /
  `text-[0.7rem] uppercase tracking-wide text-slate-500`:
  `inline-flex items-center gap-[.55rem] text-[.72rem] font-extrabold uppercase tracking-[.14em] leading-[1.25] text-primary-strong before:content-[''] before:h-2 before:w-2 before:rounded-full before:bg-current`.
  Prop `tone?: "primary" | "muted"` (muted = `text-muted-foreground`). Prop `dot?: boolean`
  default true.
- Table headers (`.workspace-table th` in `@layer components`): `font-size: .6875rem;
  font-weight: 750; letter-spacing: .08em; text-transform: uppercase; color: rgb(var(--muted-foreground))`.
  Keep the existing phone floor rule (`max-width: 639px` → 1rem).
- **Mono for data:** all currency amounts, invoice numbers (`INV-…`), IDs/hashes, table
  dates, KPI values → add `font-mono tabular-nums`. KPI values: `text-2xl font-mono font-semibold tracking-[-0.01em]`.
  Do not change what the text says.
- Form labels (`FormField`): `text-xs font-bold text-foreground` (unchanged).
- Body text sizes unchanged.

### 2.3 Shape, line, depth
- Radius: tokens make `rounded-md/lg/xl/2xl/3xl` = 0. Also **remove** literal
  `rounded-[…px]` / `rounded-sm` occurrences in app scope. Keep `rounded-full` only for:
  avatars, status dots, badges/pills, switch and its thumb, progress bars **→ NO: progress
  bars become square** (track and fill `rounded-none`, height 4px), notification dot,
  kicker dot, spinner.
- Borders: exactly one hairline `border-border`. Remove all `border-slate-*`,
  `border-blue-*`, `border-border/NN`, `ring-1 ring-*-100` decorative rings.
- Shadows: remove `shadow-sm`, `shadow-card`, `shadow-xl`, `shadow-*/NN` in app scope.
  Only `shadow-overlay` remains, and only on: Dialog, CommandPalette, notifications
  popover, DropdownPortal menus, toasts, ThemeToggle expanded, mobile slide-over panel.
- Depth is expressed as bright paper (`bg-card`) on paper (`bg-background`) plus the
  hairline. Inset wells (table heads, code, disabled) use `bg-muted`.
- **Inverse block** utility (add to `@layer components`): `.inverse-block { background: rgb(var(--foreground)); color: rgb(var(--background)); }`.
  Used by: Button `inverse` variant, public invoice header, onboarding completion panel.
- **Left-rule callout**: Alert variants render `border-l-[3px] border-l-{tone} bg-{tone}/8 border-y-0 border-r-0 px-4 py-3` (radius 0).
- Active nav item (sidebar + mobile): `relative bg-accent text-primary` **plus**
  `before:absolute before:left-0 before:top-[30%] before:bottom-[30%] before:w-[2px] before:bg-primary`.
  Inactive: `text-muted-foreground hover:bg-foreground/[.05] hover:text-foreground`.
  Remove the `ring-1 ring-inset ring-primary/10` and all `dark:bg-blue-900/20`,
  `dark:text-slate-400`, `dark:hover:bg-slate-800` overrides.
- Tabs (new primitive, underline style): list `flex gap-6 border-b border-border`;
  trigger `relative -mb-px pb-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary`;
  optional count chip `ml-2 rounded-full bg-muted px-1.5 text-[.7rem] font-mono`.
  Visual-only: implement as a controlled component that wraps existing button lists;
  pages keep their own state/handlers.

### 2.4 Primitives (`src/components/ui/*`) — exact targets
- **button.tsx**: base `inline-flex items-center justify-center gap-2 rounded-none text-sm font-bold tracking-[-0.01em] transition-[transform,background-color,color,border-color] duration-150 ease-rive-out hover:-translate-y-px active:translate-y-0 disabled:opacity-55 disabled:translate-y-0 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background`.
  Variants: `default`: `bg-primary text-primary-foreground border border-primary hover:bg-primary-strong hover:border-primary-strong`;
  `inverse` (new): `inverse-block border border-foreground hover:bg-primary hover:border-primary hover:text-primary-foreground`;
  `outline`: `border border-border bg-transparent text-foreground hover:bg-foreground hover:text-background hover:border-foreground`;
  `secondary`: `border border-border bg-card text-foreground hover:bg-muted`;
  `ghost`: `text-foreground hover:bg-foreground/[.06] hover:translate-y-0`;
  `destructive`: `bg-destructive text-destructive-foreground border border-destructive hover:opacity-90`;
  `link`: `text-primary underline-offset-4 hover:underline hover:translate-y-0 h-auto p-0`.
  Sizes unchanged (`default h-10 px-4`, `sm h-8 px-3 text-xs`, `lg h-11 px-5`, `icon h-10 w-10`, `icon-sm h-8 w-8`), remove `rounded-lg` from `sm`.
- **input.tsx / textarea.tsx / select.tsx**: `fieldControlClassName` =
  `w-full rounded-none border border-input bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-55 disabled:bg-muted`.
  Remove `shadow-sm`. Choice inputs (checkbox/radio): `h-4 w-4 rounded-none border-input accent-primary` (radio stays `rounded-full`). Color input: `h-10 w-10 border border-input`.
- **card.tsx**: `Card` = `rounded-none border border-border bg-card text-card-foreground` (no shadow). Add optional `divided?: boolean` on `CardHeader` → `border-b border-border`. Padding unchanged (`p-5 sm:p-6`).
- **badge.tsx**: base `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[.72rem] font-bold leading-5 whitespace-nowrap`.
  Variants via the formula in §2.1: `default`→primary, `secondary`→`border-border bg-muted text-muted-foreground`, `success`, `warning`, `destructive`, `info`, `violet`, `muted` (= secondary), `outline`→`border-border bg-transparent text-foreground`.
  Add `dot?: boolean` → leading `<span class="h-1.5 w-1.5 rounded-full bg-current">`.
- **alert.tsx**: left-rule style from §2.3. Variants `info|success|warning|destructive`.
- **dialog.tsx**: backdrop `bg-foreground/50 backdrop-blur-sm` (remove `slate-950`); popup `rounded-none border border-border bg-popover p-6 shadow-overlay`; title `text-lg font-extrabold tracking-[-0.03em]`; add hairline under header if a header exists.
- **empty-state.tsx**: `rounded-none border border-border bg-muted/40 px-6 py-12` (solid, not dashed); content order unchanged; title `font-extrabold tracking-[-0.02em]`.
- **form-field.tsx**: unchanged except error/hint colors via tokens (already).
- **page-header.tsx**: §2.2 sizes; optional `kicker?: string` prop rendering `<Kicker>` above the title (do not add kickers to pages unless the page already has an eyebrow there).
- **pagination.tsx**: `border-t border-border`, mono page numbers, buttons `variant="outline" size="sm"`.
- **skeleton.tsx**: `rounded-none bg-muted`.
- **switch.tsx**: track `rounded-full bg-muted border border-border data-[checked]:bg-primary data-[checked]:border-primary`; thumb `rounded-full bg-card` (remove `bg-white dark:bg-slate-100`).
- **separator.tsx**: `bg-border`.
- **New files** (export from `index.ts`): `kicker.tsx` (§2.2), `avatar.tsx` (round;
  `bg-primary/12 text-primary font-extrabold uppercase`; sizes `sm h-7 w-7 text-[.6rem]`, `md h-9 w-9 text-xs`, `lg h-12 w-12 text-sm`; accepts `color` style override for client colors), `status-badge.tsx` (see §3.2), `tabs.tsx` (§2.3), `metric-card.tsx`:
  `Card` with `p-5`, top row = `<Kicker tone="muted" dot={false}>{label}</Kicker>` + tone icon square `h-8 w-8 grid place-items-center bg-{tone}/10 text-{tone}` (square, not rounded), value `mt-3 text-2xl font-mono font-semibold tabular-nums`, sub `mt-1 text-xs text-muted-foreground`. Tones: `primary|success|warning|destructive|info|violet|muted`.

### 2.5 Motion
Use `ease-rive-out`, 150–250ms. Replace `animate-fade-in-up` / `animate-fade-in` usages
with a single `animate-panel-in` (add to Tailwind: keyframes from `opacity:0; translateY(6px)`
to `1; 0`, 220ms `var(--ease-out)`). No scale. Reduced-motion is already global.

### 2.6 Icons
`lucide-react` only. Sizes: `h-4 w-4` default, `h-5 w-5` nav/topbar, `h-3.5 w-3.5` in
badges. Add `strokeWidth={1.75}` on sidebar nav icons and MetricCard icons only.

### 2.7 Accessibility floor
All text ≥ 4.5:1 on its surface in both themes (tokens above satisfy this; if you change
a value you must re-check). Focus ring always visible (§2.4). Touch targets ≥ 44px keep
their current `min-h-11` where present.

---

## 3. Cross-cutting rules for page work

### 3.1 Raw palette purge
In scope: `src/app/(dashboard)/**`, `src/app/onboarding/**`, `src/app/admin/**`,
`src/app/invoice/**`, `src/app/sign/**`, `src/app/review/**`, `src/app/(auth)/**`,
`src/components/{ui,dashboard,workflow,invoices,engagements,currency,auth,migration,contracts,clients,projects,expenses,calendar}/**` (whatever of these exist — list with `Get-ChildItem src/components`), `src/components/ThemeToggle.tsx`, `FeedbackWidget.tsx`, `RiveLogo.tsx` (check it uses `--brand-*`).
Forbidden patterns: `(bg|text|border|ring|fill|stroke|from|via|to|divide|outline|shadow)-(white|black|slate|gray|zinc|neutral|stone|blue|indigo|sky|cyan|teal|emerald|green|lime|amber|yellow|orange|red|rose|pink|purple|violet|fuchsia)(-\d{2,3})?(/\d+)?\b`, `#[0-9a-fA-F]{3,8}\b` in class strings, `shadow-(sm|md|lg|xl|2xl)`, `rounded-(sm|md|lg|xl|2xl|3xl|\[)`.
Mapping cheat-sheet:
- `bg-white`, `bg-slate-50` (as panel) → `bg-card`; `bg-slate-50/100` (as canvas/well) → `bg-background` / `bg-muted`
- `text-slate-900/800` → `text-foreground`; `text-slate-500/600/400` → `text-muted-foreground`
- `border-slate-200/100`, `border-gray-*` → `border-border`
- `bg-blue-600`, `text-blue-600/700`, `bg-blue-50 text-blue-700` → `bg-primary`, `text-primary`, `bg-accent text-accent-foreground` (or `Badge variant="info"` if it's a chip)
- `emerald` → `success`; `amber`/`orange`/`yellow` → `warning`; `red`/`rose` → `destructive`; `violet`/`purple`/`indigo` → `violet`; `sky`/`cyan`/`teal` → `info`
- `hover:bg-slate-100/50` → `hover:bg-foreground/[.05]`
- every `dark:` color override → delete (tokens handle dark). Keep `dark:` only if it changes alpha per §2.1 formula inside primitives.
- Client/user avatar colors that come from **data** (e.g. `client.color`) stay as inline `style`, they are content not theme.

### 3.2 Status colors — single source of truth
Create `src/lib/status-tone.ts` exporting `statusTone(kind: "project"|"invoice"|"contract"|"client"|"priority"|"expense", value: string): "success"|"warning"|"destructive"|"info"|"violet"|"muted"|"primary"` and `statusLabel(...)` that returns the **exact label strings currently rendered** (collect them from the pages before deleting the inline maps — labels must not change). Statuses come from `src/lib/domain-vocabulary.ts`; import them, never redeclare. Mapping:
- project: `active`→info ("In progress"), `paused`→warning, `completed`→success, `archived`→muted
- invoice: `draft`→muted, `sent`→info, `viewed`→info, `partially_paid`→warning, `paid`→success, `overdue`→destructive, `voided`/`cancelled`→muted
- contract/agreement stages: draft→muted, in review→warning, acceptance/awaiting→info, accepted/signed→success, declined/void→destructive
- client: `active`→success, `inactive`→muted
- priority: high→warning, medium→muted, low→info
`StatusBadge` = `<Badge variant={tone} dot>{label}</Badge>`. Replace all three inline
maps (`workflow/projects/page.tsx` ≈ 82–84, `workflow/projects/[id]/page.tsx` ≈ 124–126
and ≈ 368–369, plus any in clients/revenue/contracts/expenses) with it. Add a domain
test `tests/domain/status-tone.test.mjs` asserting every vocabulary value has a tone.

### 3.3 Things that look like exceptions but are not
- `authClasses.ts` already uses edition tokens → after Phase 1 replace with the shared
  primitives and delete the file. `AuthShell` may drop `data-surface="marketing"` **only
  if** the auth page still renders identically on paper tokens; otherwise leave it and
  note in progress file.
- The `.workspace-preview` / `.wp-*` / `[data-product-frame]` CSS is marketing — Phase 6 only.
- `Toaster` (sonner) in the dashboard layout: pass `toastOptions={{ classNames: { toast: "rounded-none border border-border bg-popover text-foreground shadow-overlay", … } }}` — visual only.

---

## 4. Phases (execute in order; one local commit per phase)

### Phase 0 — Guardrails
- [ ] Create `HANDOFF-app-restyle.progress.md` (§0).
- [ ] `tests/domain/design-tokens.test.mjs`: walks the §3.1 scope, counts forbidden
      matches per file, fails if any file's count exceeds its entry in an inline
      `ALLOWLIST` object seeded with today's counts. Print the total. Each later phase
      lowers entries to 0 for files it finished; Phase 7 requires the allowlist to be empty.
      Exclude `src/components/portfolio/**` and `src/app/(dashboard)/portfolio/**`.
- [ ] Extend `tests/e2e/visual-regression.spec.ts` (screenshots only, no baselines) to
      also capture in light+dark @1440×900: `/onboarding`, `/login`, `/workflow/start-engagement`,
      `/workflow/invoice-settings`, a project detail, a client detail, and public
      `/invoice/[token]`, `/sign/[token]`, `/review/[token]` using whatever fixture the
      existing e2e suite already creates. If a fixture doesn't exist, skip that page and
      note it.
- [ ] Update `DESIGN.md` and `docs/ui-system.md` with §2 (concise: tokens table, radius
      0, hairline-not-shadow, kicker, mono for data, inverse CTA, status-tone rule).
- [ ] Commit: "Add design-token guard and restyle documentation".

### Phase 1 — Tokens & primitives (sequential, orchestrator only)
- [ ] `globals.css` `:root` / `.dark` per §2.1; repoint scrollbar/selection/focus/guide.
- [ ] `tailwind.config.js` per §2.1 + `animate-panel-in`.
- [ ] `@layer components`: `.workspace-toolbar` → `rounded-none border border-border bg-card p-4` (no shadow); `.workspace-table` → same, `thead` `bg-muted`; `th` per §2.2; `.table-scroll-region` sticky `th` bg stays `rgb(var(--muted))`; add `.inverse-block`.
- [ ] Every file in `src/components/ui/` per §2.4; create `kicker`, `avatar`, `status-badge`, `tabs`, `metric-card`; `src/lib/status-tone.ts` + test.
- [ ] Open every dashboard page in both themes; nothing broken. Screenshot Overview,
      Projects, Calendar light+dark to `HANDOFF-screens/phase1/` (untracked; add the
      folder to `.git/info/exclude`, not `.gitignore`).
- [ ] lint, test:domain, build. Commit: "Adopt Working Edition tokens and restyle shared primitives".

### Phase 2 — App shell (sequential)
Files: `src/app/(dashboard)/layout.tsx`, `src/components/ThemeToggle.tsx`,
`src/components/dashboard/CommandPalette.tsx`, `GuidedExperience.tsx`,
`src/components/FeedbackWidget.tsx`, `src/components/currency/CurrencySwitcher.tsx`,
`src/components/ui/DropdownPortal.tsx`.
- [ ] Sidebar: `bg-card border-r border-border`; nav per §2.3; plan chip → `<Badge variant="outline">`; user row → `<Avatar size="md">`; sign-out → `Button variant="ghost"` with `text-destructive hover:bg-destructive/10` (no red-*); collapse button `variant="outline" size="icon-sm"` (no shadow).
- [ ] Topbar & mobile header: `bg-card border-b border-border`; search trigger `variant="outline"` with mono `⌘K` chip `border border-border bg-muted px-1.5 font-mono text-[.7rem]`; "New client work" → `variant="inverse"`; notification dot `bg-primary`; notifications popover `rounded-none border border-border bg-popover shadow-overlay animate-panel-in`, items separated by `border-border`.
- [ ] Mobile slide-over: backdrop `bg-foreground/50 backdrop-blur-sm`; panel `bg-card shadow-overlay animate-panel-in`; nav uses same `renderNavLink` classes (unify the two branches so mobile has no raw palette).
- [ ] Loading screen: `<Kicker>Loading workspace</Kicker>` + spinner `text-primary`.
- [ ] `Toaster` toastOptions per §3.3.
- [ ] CommandPalette: `bg-popover border-border shadow-overlay`, group headers → `<Kicker tone="muted" dot={false}>`, selected row `bg-accent text-accent-foreground` + left rule, shortcut hints mono.
- [ ] ThemeToggle: same geometry, `rounded-full` track (it's a pill control), `bg-muted border-border`, active `bg-card text-foreground`; expanded state `shadow-overlay`.
- [ ] Commit: "Restyle workspace shell to Working Edition".

### Phase 3 — Workspace pages (parallel; one subagent per numbered item; orchestrator reviews and commits once)
Each subagent: purge per §3.1, swap eyebrows→`Kicker`, chips→`StatusBadge`/`Badge`, KPI blocks→`MetricCard` (only when the block already is label+value+sub+icon), tab strips→`Tabs`, amounts/IDs→mono, progress bars square, remove shadows/radii. Zero layout changes.
1. [ ] `src/app/(dashboard)/dashboard/page.tsx` + `src/components/dashboard/AnalyticsCharts.tsx` (bars `bg-primary` / `bg-destructive`, square tops, axis labels mono muted) + `ActivationCard.tsx` + any other `src/components/dashboard/*` not done in Phase 2.
2. [ ] `src/app/(dashboard)/workflow/projects/page.tsx`
3. [ ] `src/app/(dashboard)/workflow/projects/[id]/page.tsx` (+ any `src/components/projects/*`)
4. [ ] `src/app/(dashboard)/workflow/clients/page.tsx` + `clients/[id]/page.tsx` (+ `src/components/clients/*`)
5. [ ] `src/app/(dashboard)/workflow/revenue/page.tsx`, `invoices/new/page.tsx`, `invoices/[id]/page.tsx`, `invoice-settings/page.tsx`, `src/components/invoices/**`
6. [ ] `src/app/(dashboard)/workflow/expenses/page.tsx` (+ components)
7. [ ] `src/app/(dashboard)/workflow/contracts/page.tsx`, `contracts/[id]/page.tsx`, `start-engagement/page.tsx`, `src/components/engagements/**`, `src/components/contracts/**`
8. [ ] `src/app/(dashboard)/calendar/page.tsx` (+ `src/components/calendar/**`). Event chips: `border-l-2 border-l-{tone} bg-{tone}/10 text-{tone} rounded-none px-1.5 py-1 text-xs font-semibold`; time in mono `text-[.65rem] opacity-75`; today column `bg-accent/40`; grid lines `border-border`; view switch (month/week/agenda) → `Tabs`; "Today" → `Button variant="outline" size="sm"`; nav arrows `variant="ghost" size="icon-sm"`. Keep every layout/height value.
9. [ ] `src/app/(dashboard)/migrate/page.tsx` + `src/components/migration/**`
Per item: lint, focused e2e spec, both themes at 390/1024/1440, update allowlist to 0 for finished files, record in progress file.
- [ ] Orchestrator: full `npm run test:domain`, `npm run build`, screenshots to `HANDOFF-screens/phase3/`. Commit: "Restyle workspace pages to Working Edition".

### Phase 4 — Onboarding & admin (parallel, 2 subagents)
- [ ] `src/app/onboarding/page.tsx`: delete local `inputClass`; use `Input/Select/Textarea/FormField`; header `bg-card border-b border-border`, progress bar square `bg-muted` / fill `bg-primary` 4px; stepper: numbers `text-primary font-extrabold text-[.75rem]`, current step `border-l-2 border-primary bg-accent`, completed `text-success`, upcoming `text-muted-foreground`, connectors `border-border`; main panel `Card`; completion panel `inverse-block`; primary CTA `variant="default"`, back `variant="ghost"`.
- [ ] `src/app/admin/page.tsx` (+ `src/components/admin/*` if any): `Panel` eyebrow → `Kicker`; tab bar → `Tabs`; tables → `.workspace-table` classes if not already; metrics → `MetricCard`.
- [ ] Commit: "Restyle onboarding and admin to Working Edition".

### Phase 5 — Auth & public client surfaces (parallel, 3 subagents)
- [ ] Auth (`src/app/(auth)/**`, `src/components/auth/**`): replace `authClasses.ts` with primitives; keep the blue art panel and `edition-display` heading; §3.3 rule on `data-surface`.
- [ ] `src/app/invoice/[token]/page.tsx`: canvas `bg-background`; document `Card` (no `rounded-3xl`, no `shadow-xl`); header block `inverse-block p-8` (replaces the slate/blue gradient), invoice number & dates mono; amount box `border border-border bg-muted p-6`, total `font-mono text-3xl font-semibold`; line items separated by `border-border`; status → `StatusBadge`; pay/download → `Button default/outline`.
- [ ] `src/app/sign/[token]/page.tsx` and `src/app/review/[token]/page.tsx`: shell `bg-background text-foreground`; amber/red notices → `Alert`; hashes mono (already); all cards `Card`.
- [ ] Commit: "Restyle auth and public invoice, sign and review pages".

### Phase 6 — Reconcile the marketing product mock (sequential, after Phase 3 review)
Only these: `src/app/globals.css` `.workspace-preview*` and `.wp-*` rules (≈ lines 1970–2410), `src/components/marketing/product/ProductFrame.tsx`.
- [ ] Map mock colors to the app: canvas `#f3f0e8`, panels `#fbfaf6`, borders `rgb(12 30 54 / .2)`, text `#0c1e36`, muted `#536071`, active nav `#e2e7f3` + 2px left rule `#2563eb`, all `border-radius` → 0 except `.wp-badge`, `.wp-avatar`, dots; remove `box-shadow` on `.wp-metric/.wp-card/.wp-rows`; keep outer frame shadow; `.wp-amount`/`.wp-metric strong` → `font-family: var(--font-mono)`; tone colors → the §2.1 light hex values. `ProductFrame`: `bg-[#f3f0e8]`, `rounded-none`, active nav item square with left rule.
- [ ] Do not change marketing layout, copy, or any other marketing component.
- [ ] Commit: "Align marketing product mock with the restyled app".

### Phase 7 — Cleanup
- [ ] Delete dead CSS/utilities listed in §2.1; delete `authClasses.ts` if not already; remove `blue.*` Tailwind colors; grep for leftover `--bg-primary|--text-primary|--color-blue` (zero hits outside `[data-surface="marketing"]` blocks).
- [ ] Token guard allowlist must be empty. `npm run lint`, `npm run test:domain`, `npm run build`, `npm run test:e2e` (report visual-regression diffs as expected failures with a list of pages; any *functional* e2e failure must be fixed or explained).
- [ ] Run `graphify update .` if available.
- [ ] Finalize the progress file with a **review guide** for the owner: per phase, what to look at, known intentional diffs, anything you were unsure of.
- [ ] Commit: "Remove legacy palette utilities after Working Edition restyle".

---

## 5. Final report format (append to progress file and print)
- Commits (SHA + subject), all local on `dev`, **not pushed**.
- Totals: raw palette matches before → after (must be 0 in scope).
- Verification actually run and results (lint / domain / build / e2e), stated honestly
  as "implemented" vs "verified locally". Never claim "verified on dev".
- List of screenshots in `HANDOFF-screens/`.
- Decisions made where this document was silent.
- Anything left undone and the exact resume step.
