# Rive design

Source of truth: [`docs/ui-system.md`](docs/ui-system.md). Follow that file. This page is the always-on summary Droid should load.

Rive is a working tool for independent operators, not a marketing playground inside the authenticated app. Workspace UI should feel calm, dense enough to run a business, and consistent in light and dark.

## Rules

1. Import controls from `@/components/ui`. Do not drop raw `button`, `input`, `textarea`, or `select` into application screens.
2. Use semantic tokens: `background`, `foreground`, `card`, `muted`, `primary`, `border`, `success`, `warning`, `destructive`. Do not add new raw brand hex values on pages.
3. Prefer `PageHeader`, `Card`, `Badge`, `EmptyState`, and `FormField` before inventing a page-local equivalent.
4. Every interactive control needs an accessible name, visible keyboard focus, disabled behavior, and a usable touch target.
5. Check light and dark, and a narrow (phone) plus wide layout.
6. Marketing pages and public portfolio templates may be more expressive. Their controls still use the shared primitives.
7. Components under `src/components/ui` are owned here. Compose Base UI for focus, keyboard, dismissal, and ARIA. Variants use `class-variance-authority` and `cn()` from `src/lib/utils.ts`.

## When changing UI

- Do not restyle the whole product to ship one feature.
- Do not regenerate Playwright screenshot baselines locally.
- If a visual change is intentional, say so in the spec or PR notes and call out `tests/e2e/visual-regression.spec.ts`.

## Working Edition (app theme)

Warm paper surfaces (`--background` 243 240 232 light / 9 17 31 dark ink),
bright-paper `--card`, one hairline `border-border` instead of shadows (only
floating layers keep `shadow-overlay`), radius 0 everywhere except
pills/avatars/dots. Eyebrows are `<Kicker>` (uppercase 800, `.14em`, leading
dot). Currency, invoice numbers, IDs, dates, and KPI values render in
`font-mono tabular-nums`. The primary CTA may use the `inverse` button (ink
fill). Status chips come only from `statusTone()` + `<StatusBadge>` — never
inline color maps. Full token table: [`docs/ui-system.md`](docs/ui-system.md).
