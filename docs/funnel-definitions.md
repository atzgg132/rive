# Rive funnel definitions — v1

These definitions are the product-operating contract for open beta. The admin dashboard and user explorer must use the same implementation in `src/utils/funnelDefinitions.ts`.

## Qualified user

A non-internal, non-test, non-demo account that has:

- successfully registered and is email-ready;
- completed or intentionally skipped onboarding;
- supplied a valid business type/profession;
- selected a primary goal and starting path; and
- captured an acquisition source, including an explicit `direct` source.

Qualification means plausible customer and clear intent. It does not mean value has been delivered.

## Activated user

A qualified user who, within seven days of signup, completes the union of at least one real-data value path:

- native: a real client, a real project, and a connected invoice, deadline/calendar event, or project-linked expense;
- migration: committed imported data across at least two connected entity types with review resolved or accepted; or
- portfolio: a published portfolio with at least one non-private real project and usable contact details.

The headline activation rate is the union. Path counts are diagnostic and can overlap.

## Deeply activated user

An activated user who, within fourteen days:

- uses at least three meaningful modules;
- returns on at least two distinct active days; and
- completes a connected workflow where context moves between surfaces.

Agreement review/acceptance is a high-intent event, but Agreement acceptance is not base activation by itself.

## Real-data user

A user with at least one genuine created, imported, or committed business record. Records require explicit `dataOrigin` of `user` or `imported`; seeded demo, internal, E2E, synthetic, and unknown-origin legacy rows are excluded.

## WAU / MAU and retention

WAU/MAU count qualified users with a meaningful authenticated product event. Marketing page views do not count. W1 retention is a mature qualified cohort active on days 7–13 after signup; it remains unavailable until a cohort reaches fourteen days.

## Change control

Changing a definition requires bumping `FUNNEL_DEFINITION_VERSION`, updating this document, and recording the denominator/numerator impact in the product operating log before comparing periods.
