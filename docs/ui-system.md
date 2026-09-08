# Rive UI system

Rive uses source-owned, shadcn-style components backed by Base UI primitives.
The product keeps its own visual identity; the library supplies accessible
interaction behavior and a consistent API.

## Rules

1. Import controls from `@/components/ui` instead of rendering native
   `button`, `input`, `textarea`, or `select` elements in application code.
2. Use semantic colors such as `background`, `foreground`, `card`, `muted`,
   `primary`, `border`, `success`, `warning`, and `destructive`. Do not add new
   raw brand hex values to pages.
3. Prefer `PageHeader`, `Card`, `Badge`, `EmptyState`, and `FormField` before
   creating a page-local equivalent.
4. Every interactive element must have an accessible name, visible keyboard
   focus, disabled behavior, and a usable touch target.
5. Validate light and dark themes as well as narrow and wide layouts.
6. Keep marketing art direction and public portfolio templates expressive.
   Their controls should still use the shared interaction primitives.

## Component ownership

Components under `src/components/ui` belong to the repository. They may be
adapted to Rive requirements without waiting on an upstream theme package.
Behavior-heavy components should compose Base UI rather than reimplementing
focus management, keyboard navigation, dismissal, and ARIA semantics.

## Adding a component

- Define visual variants with `class-variance-authority`.
- Merge classes with `cn()` from `src/lib/utils.ts`.
- Consume semantic Tailwind tokens from `tailwind.config.js`.
- Export the component from `src/components/ui/index.ts`.
- Check TypeScript, ESLint, the production build, both themes, and responsive
  behavior before using it across features.

## Working Edition theme

The authenticated app uses the marketing "Working Edition" language: warm paper,
hairlines instead of shadows, square corners, Outfit display type with kickers,
and JetBrains Mono for data.

### Tokens (`src/app/globals.css`, consumed via `tailwind.config.js`)

| Token | Light | Dark |
| --- | --- | --- |
| `background` | 243 240 232 (warm paper) | 9 17 31 (ink) |
| `card` / `popover` | 251 250 246 (bright paper) | 13 24 42 / 16 28 48 |
| `foreground` | 12 30 54 | 241 238 230 |
| `muted` / `muted-foreground` | 235 231 221 / 83 96 113 | 20 33 55 / 154 166 184 |
| `primary` / `primary-strong` | 37 99 235 / 24 71 189 | 96 144 255 / 130 168 255 |
| `secondary` / `accent` | 226 231 243 | 24 43 78 |
| `success` / `warning` / `destructive` / `info` / `violet` | 8 117 84 / 148 83 12 / 179 55 55 / 24 71 189 / 98 54 167 | 52 199 150 / 232 168 64 / 240 112 112 / 130 168 255 / 171 140 232 |
| `border` / `input` | hairline via `--border-alpha` 0.20 / 0.32 | 0.14 / 0.22 |
| `ring` | 37 99 235 | 96 144 255 |

`--radius` is `0`; `rounded-md/lg/xl/2xl/3xl` all resolve to 0. `rounded-full`
survives only on pills, avatars, dots, and the switch. `--shadow-card` is `none`;
`shadow-overlay` is reserved for Dialog, CommandPalette, popovers, menus, toasts,
and slide-overs.

### Rules

1. One hairline `border-border` separates surfaces — never `border-slate-*`,
   `border-*-NN`, or `border-border/NN`.
2. No raw palette classes in app scope (`bg-blue-50`, `text-slate-500`,
   `dark:bg-slate-800`, hex). `tests/domain/design-tokens.test.mjs` guards this.
3. Every eyebrow is `<Kicker>`; every status chip is `<StatusBadge>` via
   `statusTone()` in `src/lib/status-tone.ts` (single source of truth).
4. Amounts, invoice numbers, IDs/hashes, table dates, and KPI values use
   `font-mono tabular-nums`.
5. Notices are left-rule `Alert`s (`border-l-[3px]`), not tinted boxes.
6. Buttons: `default` (blue), `inverse` (ink fill), `outline` (inverts on hover);
   `hover:-translate-y-px`, 150ms `ease-rive-out`.
