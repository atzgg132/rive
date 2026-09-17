# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Freelancers and independent service businesses managing several clients, plus
small-studio owners who run the operation personally. One operator per account;
shared team access does not exist yet.

## Product Purpose

Rive is the operating system for independent work: it keeps the client, the
project, the agreement, the invoice, the deadline, and the published proof in
one workspace so context is not re-entered across separate tools. Success means
the operator answers "what is due, agreed, and outstanding" from one place and
converts through `/register` during open beta.

## Positioning

The records stay connected as work moves from client to delivery, money, and
proof. Neighboring tools manage one slice (tasks, invoicing, contracts); Rive's
claim is the single linked record across the whole engagement.

## Operating Context

Evaluated on the public marketing site (`/`, product pages, pricing, migrate,
about, changelog, roadmap, contact, legal). Signup opens an auth overlay
(`?auth=register` deep link, funnel tracking) plus standalone auth pages.
Deployed at https://www.rive.work; `dev` deploys to https://dev.rive.work.

## Capabilities and Constraints

Confirmed: clients, projects, tasks, milestones; agreements with recorded
acceptance (no enforceability guarantee); invoices, payment records, expenses
(Rive records money, does not collect or transfer it); calendar with Google
Calendar sync and private Apple Calendar feed; portfolio publishing with
enquiries; CSV/XLSX import for supported records. Free during open beta, no
credit card. Remit (payouts) is in development and must not be presented as
shipping; it must not appear on the homepage.

## Brand Commitments

Name and wordmark (`RiveLogo`, `/brand/rive-wordmark.svg`) are fixed.
User-approved marketing direction (2026-09): "The Institution of One" —
modernist-institution register; warm-white paper, ink black, registry blue
rationed to marks and active states; one grotesk (Archivo) plus a print mono; a
traveling "Record" artifact as signature mechanic; typography-first hero. The
previous dark/cobalt/network-line direction ("Editorial Signal") is explicitly
rejected and is the anti-reference. Registry blue replaced signal red after
review because red read as an alarm on ordinary actions.

## Evidence on Hand

Real workspace previews (`WorkspacePreview.tsx` — the app's own UI primitives
and page structures with seeded fictional-studio data, labeled as sample),
client-facing plates (`AcceptanceDocument`, `InvoiceDocument` — inert
reproductions of the real `/sign/[token]` and `/invoice/[token]` surfaces),
`PortfolioShowcase`/`PortfolioPublication` (sample
portfolio, must stay labeled). No verified testimonials, customer logos, or
metrics — never fabricate them. Changelog is the honest progress record.

## Product Principles

1. Show the real product; demonstration data is labeled, claims are not
   invented.
2. State limits plainly (one operator, records-not-payments, beta status).
3. One action everywhere: `/register`, "Free during beta. No credit card
   required."
4. Marketing may be expressive; controls stay accessible (keyboard, focus,
   reduced motion, AA contrast).

## Accessibility & Inclusion

WCAG 2.2 AA on all public surfaces; keyboard-complete navigation and tabs;
reduced-motion parity; 44px targets; readable at 200% zoom.
