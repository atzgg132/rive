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
