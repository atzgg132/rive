# Three-surface read-only audit — git / prod / staging

**Status:** read-only. No product, CSS, test, or copy patches. Nothing merged. Nothing pushed to `main`. PR 42 was not reopened. No terraform. No spend.

**Auditor:** Cursor cloud worker (`cursor-grok-4.6-xhigh`), run https://cursor.com/agents/bc-04deb69b-048e-4b2b-9620-fccf5eb33e64  
**Captured:** 2026-08-26 23:33–23:47 UTC (2026-08-27 ~05:03–05:17 IST). Deadline given: 06:15 IST 2026-08-27.  
**Preferred local checkout** `C:\Users\Arnav Bhattacharya\.gemini\antigravity\scratch\zeno` was **not present** on this Linux VM. Surfaces below are this repo’s git remotes plus live HTTP.

**Method:** `git fetch origin main dev`; `gh` / GitHub API for PR 42 (closed, unmerged); `curl` of `https://rive.work/`, `https://www.rive.work/`, `https://dev.rive.work/` and `/api/health`, `/cookies`, `/roadmap`, `/changelog`; headless Chromium stills at **1280×720**. HTML string counts are against the SSR/prerendered homepage, not a logged-in workspace.

**Product review of draft PR 47:** §1 SHA map and §2 Remit leftover vs staging preview stand. Two writeup misses corrected below — §3 shutter definition, and §4.3 / §7.1 first-screen 1280×720 (capture miss, not a fold fail).

---

## 1. SHA map

| Surface | Commit / deploy id | Notes |
|---|---|---|
| **git `origin/main`** | `cfe7b31726c4b112cc556fd2a3510514972c3d60` | “Promote SMTP outbox fix to production (#40)”, 2026-08-25T04:26:29Z. Local `main` matches. |
| **git `origin/dev`** | `b48985d763de5d1626223753b88ad9538f13f816` | “Merge pull request #46 from atzgg132/fix/scrolly-last-chapter”, 2026-08-25T21:31:50Z. |
| **working tree** | `b48985d763de5d1626223753b88ad9538f13f816` | Branch was `dev`, **clean** (`git status` empty). Same SHA as `origin/dev`. |
| **prod `https://rive.work`** | 301 → `https://www.rive.work/` | Caddy `redir … permanent`. Empty body. |
| **prod `https://www.rive.work`** | SHA `cfe7b31726c4b112cc556fd2a3510514972c3d60` | Matches `origin/main`. |
| **staging `https://dev.rive.work`** | SHA `b48985d763de5d1626223753b88ad9538f13f816` | Matches `origin/dev` / working tree. |

**How the live SHAs were read (two IDs each):**

1. Next asset query `dpl=` is the **build-time** `deploymentId` (`next.config.ts`: `deploymentId: process.env.DEPLOYMENT_VERSION`). Homepage CSS/JS:
   - www: `?dpl=cfe7b31726c4b112cc556fd2a3510514972c3d60`
   - dev: `?dpl=b48985d763de5d1626223753b88ad9538f13f816`
2. `/api/health` is the **runtime** image tag from deploy (`Dockerfile` `ARG DEPLOYMENT_VERSION`; workflow `build-args: DEPLOYMENT_VERSION=${{ github.sha }}`; host env then becomes `prod-$SHA` / `dev-$SHA`):
   - www: `{"status":"ok","environment":"prod","deployment":"prod-cfe7b31726c4b112cc556fd2a3510514972c3d60"}`
   - dev: `{"status":"ok","environment":"dev","deployment":"dev-b48985d763de5d1626223753b88ad9538f13f816"}`

**GitHub Actions “Deploy to AWS” (the job that produced those images):**

- prod: run `32808974693` on `main` — *Promote SMTP outbox fix to production (#40)* — success, 2026-08-25T04:26:32Z  
  https://github.com/atzgg132/rive/actions/runs/32808974693
- staging: run `32901495740` on `dev` — *Merge pull request #46 …* — success, 2026-08-25T21:31:53Z  
  https://github.com/atzgg132/rive/actions/runs/32901495740

**Routing (not changed in this audit):** `infrastructure/aws/caddy/Caddyfile`

```
rive.work { redir https://www.rive.work{uri} permanent }
www.rive.work { reverse_proxy 127.0.0.1:3000 }
dev.rive.work { reverse_proxy 127.0.0.1:3002 }
```

**Divergence:** `git merge-base origin/main origin/dev` = `8126c4e06ee201a9cb10015493d4235d8c5b6e81` (“Fix dark mode currency options”). `origin/dev` is **ahead** by the marketing overhaul through PR 46. `origin/main` has extra **promote merge commits** (`cfe7b31`, `2a5c7f5`, `#36`–`#33`); the SMTP/bot-gate *content* is already on `dev` (`73d1aac`, `0d12576`). `git diff --stat origin/main...origin/dev` → **158 files, +8261 / −3774**.

**PR 42 (do not reopen):** https://github.com/atzgg132/rive/pull/42 — **closed unmerged** 2026-08-26T23:22:16Z. Base `main` @ `cfe7b317`. Head `cursor/remit-preview-copy-7d0c` @ `3ec7646e00b01066900f5a1719dcf2856034dac1`. Copy-only `RemitSection.tsx` + `tests/e2e/marketing-responsive.spec.ts`. It is **not** on any of the three live/git surfaces above.

---

## 2. Marketing honesty (Remit leftover vs preview-only)

### 2.1 `src/components/RemitSection.tsx`

**Exists only on `origin/main` / prod.** Missing on `origin/dev`, working tree, and staging.

Quotes from `origin/main:src/components/RemitSection.tsx` (and **verbatim on https://www.rive.work/** SSR HTML, count=1 each):

| Leftover | Quote |
|---|---|
| Heading | `Know the payout before you send it.` |
| Body | `Remit is next: international payouts next to the invoice. Live ECB rates here. No money moves yet.` |
| Promise | `Payouts should follow the Agreement, not a separate app.` |
| Amount label | `You send` |
| Result label | `They receive` |
| Footer (honest) | `Preview only. Not a transfer.` |

Prod HTML also has `Tied to the invoice` and `No money moves yet`. The widget is a **preview calculator that still talks like a payout**.

Closed PR 42 would have swapped that heading to `Preview the conversion. Nothing moves yet.`, body to `Remit is a preview next to the invoice…`, labels to `From` / `To`. **Not shipped. Not reopened.**

### 2.2 `src/components/marketing/RemitPreview.tsx`

**Exists only on `origin/dev` / working tree / staging.** File comment:

> Live FX conversion preview for Remit (in development). … Preview only: it never claims to move money.

Labels on `origin/dev`: `Source amount`, `Converted amount`, footer `Preview only. Not a transfer.`  
**Not** `You send` / `They receive`.  
Live `https://dev.rive.work/`: `Source amount`=1, `Converted amount`=1, leftover payout strings = **0**.

### 2.3 `src/content/marketing` — `remitNext`

**Present on `origin/dev` only** (`src/content/marketing/home.ts`). **Absent on `origin/main`.**

```316:327:src/content/marketing/home.ts
  remitNext: {
    eyebrow: "NEXT: REMIT",
    title: "Preview the FX rate. Remit is not a transfer.",
    body: "Remit is in development. This homepage preview uses live ECB mid-market rates to convert an amount from one currency into another. Preview only. Not a transfer.",
    status: "In development",
    promises: [
      { label: "Preview only", sub: "Converts an amount at the mid-market rate. It does not move money." },
      { label: "The rate is the rate", sub: "No hidden FX markup. This preview uses ECB mid-market." },
      { label: "Not shipped", sub: "Remit transfers are not shipped. Follow the roadmap for what is next." },
    ],
```

Wired in `src/components/marketing/MarketingHome.tsx` (`homeContent.remitNext.*`, `data-testid="remit-next-section"`, `#remit-transfers`).

The **ledger** block on staging (`homeContent.remit`) is also honest:

```273:277:src/content/marketing/home.ts
  remit: {
    eyebrow: "MONEY ACROSS CURRENCIES",
    title: "Know what crossed the books—even when money crossed borders.",
    body: "Rive keeps each invoice and expense in its native currency, then gives the workspace a chosen display currency for a comparable view. Remit transfers are not presented as a shipped product.",
```

Live `https://dev.rive.work/`: `Preview the FX rate`=2, `Remit is not a transfer`=2, `Remit is in development`=2, `Know the payout`=0, `international payouts`=0, `You send`=0, `They receive`=0.

### 2.4 Both live URLs (homepage)

| String | www (prod = main) | dev.rive.work (staging = dev) |
|---|---|---|
| `Know the payout before you send it.` | **1** | 0 |
| `international payouts` | **1** | 0 |
| `You send` | **1** | 0 |
| `They receive` | **1** | 0 |
| `Payouts should follow` | **1** | 0 |
| `Preview only` | 1 (footer only) | **6** |
| `Preview the FX rate` / `Remit is not a transfer` | 0 | **2 / 2** |
| `data-testid="remit-section"` | 1 (old payout block) | 1 (ledger, not payouts) |
| `data-testid="remit-preview"` | 0 | **1** |

**Verdict:** Leftover payout language is **live on production** and **in `origin/main`**. Staging and `origin/dev` already sell a conversion preview. Apex `rive.work` has no copy (301).

---

## 3. Shutter vs scrolly

**The shutter is the sticky `data-testid="scrollytelling-rail"`.** It is live on staging / `origin/dev` (`b48985d`). Count **1**. Prod / `origin/main` count **0**. Do not treat the test’s “column, not shutter” carve-out as the definition. `coveringStickyShutter()` ignoring that testid is the cheat, not evidence the shutter is dead. Chapters being `min-h-[70vh]` does not clear it.

### 3.1 Count `data-testid=scrollytelling-rail`

| Surface | Count of `data-testid="scrollytelling-rail"` |
|---|---|
| `origin/main` (whole tree) | **0** |
| `origin/dev` / working tree — component | **1** (`src/components/marketing/ScrollytellingSection.tsx:180`) |
| `origin/dev` — tests asserting the HTML string | **2** (`tests/e2e/marketing-experience.spec.ts` lines 121 and 838) |
| `origin/dev` — `getByTestId("scrollytelling-rail")` | **8** (same spec) |
| `https://rive.work/` | **0** (redirect body empty) |
| `https://www.rive.work/` | **0** |
| `https://dev.rive.work/` | **1** in HTML (`data-testid="scrollytelling-rail"`). Total substring `scrollytelling-rail` = **2** (testid + class). |

Files named in the brief:

- `src/components/marketing/ScrollytellingSection.tsx` — **dev only** (this is the shutter)
- `src/components/marketing/MarketingHome.tsx` — **dev only** (mounts `<ScrollytellingSection … />` under `#product`)
- `src/components/marketing/HeroPipeline.tsx` — **dev only** (hero CLIENT→PROOF pipeline, not the shutter)

On main the home is `src/app/page.tsx` composing `Hero`, `Features`, `RemitSection`, etc. **No scrolly file. Shutter count 0.**

### 3.2 The shutter: sticky `scrollytelling-rail` on staging

**Staging / `origin/dev` / live `https://dev.rive.work/` (HTML matches source), count = 1:**

```180:180:src/components/marketing/ScrollytellingSection.tsx
      <div data-testid="scrollytelling-rail" className="scrollytelling-rail sticky top-0 h-screen min-w-0 place-items-center">
```

Live `https://dev.rive.work/`: `sticky top-0 h-screen` count = **1**, on that rail. That pinned `h-screen` node **is** the shutter. It is back on `b48985d`.

PR **41** (`c550606`, “Stop selling Remit payouts and kill the marketing shutter”) removed that rail. It returned on the current `dev` SHA (PRs 43/44/46 restored and then SSR’d it so it cannot vanish). **None of the rail is on prod.**

Chapters on the left are `min-h-[70vh]`, not `min-h-screen`:

```161:161:src/components/marketing/ScrollytellingSection.tsx
            className={cn("flex min-h-[70vh] scroll-mt-0 flex-col justify-center py-14 …
```

The file comment (PR 46 tail) claims that clears the shutter:

> Chapters are 70vh, not 100vh (no shutter). Without a tail the last beat never crosses the 18% activation line…

**It does not.** Shortening the chapter articles does not remove the sticky `h-screen` rail. Tail: `data-testid="scrollytelling-tail"` `h-[60vh]`, live on staging — that only gives the last beat scroll room.

CSS (`src/app/globals.css`): rail `display: none` by default; `display: grid` at `min-width: 1024px`; hidden again for `prefers-reduced-motion: reduce`. Comment at line 721: JS must not mount/unmount it (that is how it vanished across reloads). So on desktop with motion, the shutter is **in the HTML and shown**.

**Prod / `origin/main`:** shutter count **0**. No `data-testid="scrollytelling-rail"`. Homepage `<main className="min-h-screen overflow-hidden bg-background">` only. Live www `min-h-screen` = 2 (main + RSC payload). That is a normal page min-height, not this shutter.

### 3.3 The test carve-out is the cheat

`tests/e2e/marketing-experience.spec.ts`:

> Full-viewport sticky/fixed overlay covering the page. The chapter rail may be sticky and viewport-tall, but it is a column — not a page shutter.

`coveringStickyShutter()` then skips the shutter by testid:

```45:45:tests/e2e/marketing-experience.spec.ts
      if (testid === "site-header" || testid === "scrollytelling-rail") return [];
```

That ignore list is **how the gate stays green while the shutter is live**, not proof the shutter is dead. Chapter `min-height` must not be `100vh|100svh|100dvh|100lvh` — a second check that also does not look at the rail.

### 3.4 GSAP / ScrollTrigger

| Surface | Present? |
|---|---|
| `origin/main` / prod HTML / prod `package.json` | **No** (`git grep gsap origin/main` empty) |
| `origin/dev` `package.json` | `"gsap": "^3.15.0"` |
| `ScrollytellingSection.tsx` | dynamic `import("gsap")` + `import("gsap/ScrollTrigger")`, `ScrollTrigger.create({ trigger: root, start: "top top", end: "bottom bottom", … })` |
| `SmoothAnchor.tsx` | dynamic `import("gsap")` + `ScrollToPlugin` |
| Live homepage HTML (www and dev) | **0** occurrences of `gsap` / `ScrollTrigger` (expected: client chunks, not SSR) |

On staging, GSAP runs **after** hydration on desktop with motion allowed. Reduced-motion / `< lg` uses `IntersectionObserver` and forces opacity 1.

---

## 4. First screen 1280×720

**Cycle-on-load is intended.** `src/components/marketing/HeroPipeline.tsx`: `useState(0)`, `autoAdvance` starts `true`, `STAGE_ADVANCE_MS = 2500`, interval `(index + 1) % stages.length`. Tests say so:

```225:229:tests/e2e/marketing-experience.spec.ts
  // SHIP-GATE ONLY: 1920×1080 @ 150% Windows ≈ 1280×720 CSS, and 1920×1200 @ 150% ≈ 1280×800.
  // First screen at scrollY=0: headline, both CTAs, and the full CLIENT→PROOF rail.
  // Extra short lines under the labels may drop at 720. Do not hide the labels.
  // Do not add 1366×768 or 1440×900 to this loop.
  // Do not assert which pipeline node is active — interval autoplay may already be on WORK.
```

Loop sizes in that ship-gate: **`1280×720` and `1280×800` only.** Not 1366.

### 4.1 What the tests assert (`tests/e2e/marketing-experience.spec.ts`)

At 1280×720 / 1280×800, after `goto("/")`, `scrollTo(0,0)`, `document.fonts.ready`:

- `data-testid="marketing-hero"` h1 visible
- links `Build your workspace` and `See the unpaid role` in the first screen
- `data-testid="hero-pipeline"` visible, 5 stages
- labels `CLIENT`, `WORK`, `AGREEMENT`, `INVOICE`, `PROOF` visible, not `display:none` / `visibility:hidden`, bottoms ≤ `innerHeight+1`
- proof chips (Open signup / Free during beta / Your data stays yours) in the first screen
- no horizontal overflow  
Short lines under labels **may** drop at 720; labels must not.

Separate test: 1707×960 @ `deviceScaleFactor: 1.5` (QHD 150%). Asserts h1 `font-size < 72px` and shorts **not** `display:none`.

Playwright project default in `playwright.config.ts` is `devices["Desktop Chrome"]` (Playwright’s published viewport for that device is **1280×720**). Tests that call `setViewportSize` override it. Visual baselines do **not** use 1280 (see §6).

**This spec file does not exist on `origin/main`.** Prod CI never runs the 1280 ship-gate.

### 4.2 What the hero CSS actually does (`src/app/globals.css` + `MarketingHome.tsx`)

Default markup:

```22:24:src/components/marketing/MarketingHome.tsx
        <section
          data-testid="marketing-hero"
          className="marketing-hero relative flex min-h-[100svh] items-center overflow-x-clip pb-10 pt-20 …
```

Compress for short CSS viewports (this is what 1280×720 hits):

```764:776:src/app/globals.css
/* Short first screens. Playwright 1280×720 / 1280×800 is `max-height: 800px`
   at 1x. …
@media (max-height: 800px) {
  section.marketing-hero {
    align-items: flex-start;
    min-height: 100dvh;
```

Headline/body/CTA/rail margins all `clamp(…svh…)`. At `max-height: 720px`, shorts hide:

```864:868:src/app/globals.css
@media (max-height: 720px) {
  .hero-pipeline [data-hero-stage-short] {
    display: none;
  }
}
```

Taller high-dpr laptops (`min-height: 801px` and `max-height: 1100px` and `min-resolution: 1.25dppx`) shrink the ~104px headline so the rail still clears the fold, **without** dropping shorts.

**`origin/main` / prod** uses `src/components/Hero.tsx`: `pt-32`, `fontSize: clamp(3rem, 7vw, 6.4rem)`, **no** `max-height: 800px` compress, **no** `hero-pipeline`. Headline: `Run your services without the chaos.`

### 4.3 Live 1280×720 (QA pass; headless still is a capture miss)

**1280×720 is not a fold fail.** QA passed first screen on `https://dev.rive.work` at SHA `b48985d`: **nav, badge, headline, sub, CTAs, labeled CLIENT→PROOF**. Viewport for that ship-gate stays **1280×720 / 1280×800 only** (`tests/e2e/marketing-experience.spec.ts`; do not add 1366×768). Cycle-on-load stays intended (`HeroPipeline.tsx` `STAGE_ADVANCE_MS = 2500`; tests: “Do not assert which pipeline node is active — interval autoplay may already be on WORK.”).

- Prod (`https://www.rive.work/`): first screen is the **old** hero — badge `Open beta is live`, h1 `Run your services without the chaos.`, CTA `Create a free account`, microcopy `Open signup · no invitation required · verify your email to start`. No CLIENT→PROOF pipeline on this SHA (that rail is staging-only). Matches `origin/main`. Nav includes **Remit**.
- Staging (`https://dev.rive.work/`): first screen is the **new** hero. QA: nav, `OPEN BETA` badge, headline, sub, both CTAs, labeled **CLIENT→PROOF**. A headless Chromium `--screenshot` at document load showed only the first hero line (`Your business`) and omitted the pipeline. That still is a **capture miss** (webfonts / `hero-line-in`; tests wait `document.fonts.ready`; `--screenshot` does not). **Not a ship-gate fail. Not a live fold fail.**

Cycle-on-load cannot be read from a still taken before paint finishes. Source still autoplays every 2.5s.

---

## 5. Claims vs shipped

### 5.1 Open beta — claimed and shipped

Both surfaces claim open signup; register exists on both.

- Prod hero (`origin/main:src/components/Hero.tsx`): `Open beta is live` / `Open signup · no invitation required · verify your email to start`
- Staging (`home.ts`): eyebrow `OPEN BETA`, chips `Open signup`, `Free during beta`; FAQ “Rive is in open beta with open signup”
- Changelog/roadmap on both: heading `Open beta` / `Open beta is live. Next we make it dependable.`
- Product: `/register` is public; `RegisterForm.tsx` “Free access during open beta”

**Honest**, on both URLs.

### 5.2 Apple Calendar only — claimed; Google is code-gated

Shipped: `src/app/api/calendar/feed/[token]/route.ts` (`Content-Type: text/calendar`), `src/app/api/calendar/subscription/route.ts` (`webcalUrl: webcal://…`). Marketing: “A private Apple Calendar subscription feed is live.”

Google: **implementation exists** (`src/utils/googleCalendar.ts`, onboarding copy “Google Calendar connected…”) but is **off unless** all of these are set (`src/utils/connectorConfig.ts`):

```19:24:src/utils/connectorConfig.ts
export function googleCalendarAvailable(): boolean {
  return connectorFeatureEnabled(process.env.GOOGLE_CALENDAR_ENABLED) &&
    connectorCredentialConfigured(process.env.GOOGLE_CALENDAR_CLIENT_ID) &&
    connectorCredentialConfigured(process.env.GOOGLE_CALENDAR_CLIENT_SECRET) &&
    calendarEncryptionKeyConfigured();
}
```

`/api/connectors` is **401** on both live hosts (session required). This audit did not read SSM (no spend / no terraform). Marketing is consistent with “not presented as available”:

- Staging home FAQ: `Google Calendar is pending approval and is not presented as available.`
- Staging `/roadmap`: `Calendar connection work once Google approves the integration` (no “Google Calendar” heading; live count of the string `Google Calendar` on `/roadmap` = **0**)
- Prod `/roadmap` live HTML **does** name it: `Google Calendar, once Google approves the integration` (string count 3)
- Press (`pages.ts`): `Apple Calendar subscription feed available; Google Calendar pending approval`

Homepage tests only forbid a **heading** named `Google Calendar`, so FAQ/roadmap sentences still pass.

### 5.3 Remit is preview, not payouts — **false on prod, true on staging**

- **Prod / main:** leftover payout heading, “international payouts”, “You send” / “They receive”, promise “Payouts should follow the Agreement…”, **while** the footer says `Preview only. Not a transfer.` Mixed, net **dishonest**.
- **Staging / dev:** `Remit transfers are not presented as a shipped product.` / `Preview the FX rate. Remit is not a transfer.` Widget: Source/Converted. **Honest.**
- Product: `/api/rates` is a mid-market preview (`resources.ts`: “not a transfer API”). No payout/Wise/Stripe-connect transfer product in this tree.

Staging widget still shows `0.5% illustrative fee` (`FEE_RATE = 0.005` in `RemitPreview.tsx`) next to “No hidden FX markup.” The fee is labeled illustrative; it is **not** a live payout fee. Prod calculator uses the same 0.5% math behind `You send` / `They receive`.

### 5.4 Other claim gaps (site or copy vs product)

| Claim | Where | Shipped? |
|---|---|---|
| **Vercel Analytics** | `src/app/(marketing)/cookies/page.tsx` (dev) and `src/app/cookies/page.tsx` (main). Live `/cookies` on **both** hosts: `Vercel Analytics` count **6**. | **Not in `package.json`.** App is AWS + Caddy (`deploy.yml`, `infrastructure/aws/caddy/Caddyfile`). Same false vendor on prod *and* staging. |
| **AI co-pilot** | Guides/press explicitly deny it. Prod still has a component **named** `AISection` but the visible copy is “Connected by design” / “One record. Every workflow in sync.” Live `co-pilot` count = 0 on both homes. | Honest *as copy*. Filename is leftover. |
| **e-signature** | Staging FAQ *question* “Does Rive send contracts for e-signature?” Answer: recorded acceptance, not DocuSign. Live `e-signature` = 4 on staging home (question + RSC). | Honest if read as Q&A; easy to skim as a feature list. |
| **Public API** | Staging roadmap LATER: “A public API, broader calendar connections, and new money movement surfaces require operational guarantees we will not fake…” Prod roadmap still lists `Mobile applications and public API access` as a later bullet (live snippet). | Honest as future. Prod wording is easier to misread as a roadmap item rather than a refusal. |
| **Watch Demo** | Tests assert count 0. Live both homes: 0. | Honest. |

`pages.ts` press bullet is the intended honesty contract: `No shipped Remit transfer product and no claimed AI co-pilot`. **Prod home violates the Remit half.** Staging home honors it.

---

## 6. Tests

CI that matters: `.github/workflows/deploy.yml` `verify` on **push to `main` and `dev`** (same Playwright suite, `PLAYWRIGHT_SERVER=production`). `.github/workflows/quality.yml` runs on PRs, **not** on `main`/`dev` pushes.

Tests always hit **the branch’s own built app**, not `https://rive.work`. Green CI on `main` does not mean production copy is honest.

### 6.1 Honest gates (would fail if the branch still sold the lie)

On **`origin/dev` only:**

- `tests/e2e/public-routes.spec.ts` — `marketing homepage does not sell Remit as a transfer or payout product`  
  asserts count 0 for `Know the payout before you send it.`, `Payouts should follow the Agreement.`, `international payouts`, `You send`, `They receive`
- `tests/e2e/marketing-experience.spec.ts` (no-JS describe) — `getByText("Know the payout before you send it.")` count 0 **and** rail present in HTML
- Scrolly/shutter tests (they **carve out** `data-testid="scrollytelling-rail"` in `coveringStickyShutter()`, so they can pass while the shutter is live; see §3.3)
- 1280×720 / 1280×800 hero ship-gate (pipeline labels in the first screen)
- Google Calendar heading + `once Google approves the integration` on `/roadmap`
- Open-beta changelog/roadmap headings; guides must not say `ai co-pilot` or `sending your first payment with remit`

If these ran **against https://www.rive.work**, the Remit leftover tests would **fail today**. They never do.

### 6.2 Gates that pass while a false claim is live

**This is the production hole.** `origin/main` has **no** `marketing-experience.spec.ts` and **no** Remit leftover assertions. `git grep 'Know the payout' origin/main -- tests` → none.

So the last prod deploy (`cfe7b317`, SMTP #40) could be fully green while www still shows `Know the payout before you send it.`

Other pass-while-lying patterns:

| Gate | Why it stays green |
|---|---|
| `getByRole("heading", { name: "Google Calendar" })` count 0 | FAQ/roadmap *sentences* are not that heading. Prod `/roadmap` still names Google Calendar in a list item. |
| Guides “no ai co-pilot” | Does not inspect cookies “Vercel Analytics” or Remit payout heading. |
| `marketing-responsive.spec.ts` on **main** | Layout of `#remit` only. Closed PR 42 would have added leftover-copy asserts **here**; they never landed. |
| Visual regression (`tests/e2e/visual-regression.spec.ts`) | Sizes **1440×900, 768×900, 390×844**. `reducedMotion: "reduce"` — **no cycle-on-load**, **no 1280 fold**, **no 1366**. Baselines are the *new* marketing on `dev` only. |
| `coveringStickyShutter()` / “no sticky shutter” | Ignores `data-testid="scrollytelling-rail"`. Green while the shutter is live on staging. See §3.3. |
| Playwright default 1280×720 | Many tests immediately `setViewportSize({ 1440, 900 })`, so they never see the 150% Windows fold. |

### 6.3 Which sizes are in the loop (1280 vs 1366)

| Loop | Sizes | File |
|---|---|---|
| **Hero 150% ship-gate** | **1280×720, 1280×800** | `marketing-experience.spec.ts` — comment: *Do not add 1366×768 or 1440×900 to this loop.* |
| QHD 150% | **1707×960 @ dpr 1.5** | same file |
| “No sticky shutter” loop | **1920×1080, 1280×720** | same file — carves out the rail testid; see §3.3 |
| Scrolly activation / stick | **1440×900, 1920×1080** | same file — **not 1280** |
| Marketing visual baselines | **1440×900, 768×900, 390×844** | `visual-regression.spec.ts` |
| Marketing overflow | 390, 768, **1440** | `marketing-responsive.spec.ts` |
| **1366×768** | **nowhere** | explicitly excluded from the 1280 ship-gate |

Default Playwright Chromium project viewport is **1280×720** unless a test overrides it.

---

## 7. Ship risk

**Do not promote staging. Do not merge to `main`. Do not reopen PR 42.** This section is risk if someone else does.

### 7.1 If someone promotes staging (`dev` → `main` → www)

They would replace prod SHA `cfe7b317` with `b48985d7` (or a later `dev` SHA). That is the **full marketing overhaul** (158 files), not a copy tweak.

**What users on www would gain**

- Honest Remit preview (`remitNext` + `RemitPreview`). Leftover payout strings go away.
- New homepage IA, kinetic hero, CLIENT→PROOF pipeline, last-chapter tail (PR 46).
- The **dev** test suite would start running on **main** deploys, so leftover payout copy could no longer ship unnoticed.

**What would break or change**

- **First screen:** not a 1280×720 fold fail. QA already passed nav, badge, headline, sub, CTAs, labeled CLIENT→PROOF on `https://dev.rive.work` at `b48985d`. The headless still that omitted the pipeline was a capture miss (fonts / `hero-line-in`), not a ship-gate fail. Viewport stays **1280×720 / 1280×800 only**. Cycle-on-load stays intended. Staging home is prerender-cached (`s-maxage=31536000`, `x-nextjs-cache: HIT`); prod home is `no-store`.
- **Sticky `scrollytelling-rail` shutter** ships to www. That node is `sticky top-0 h-screen` (`ScrollytellingSection.tsx:180`), count **1** on staging / `origin/dev`, count **0** on prod / `origin/main`. PR 41 killed it; it is back on `b48985d`. Tests calling it a “column, not a page shutter” and skipping it in `coveringStickyShutter()` do not make it not a shutter. Chapters `min-h-[70vh]` do not clear it. Reduced motion hides it; desktop with motion shows it.
- **GSAP** (~`^3.15.0`) loads on the public homepage (ScrollTrigger + ScrollToPlugin). Not on prod today. Failure mode is a stuck/opacity-wrong chapter, not a payout.
- **Visual identity** and nav (`Product / Company / Learn` vs today’s `Features … Remit`) change overnight. Old `#remit` payout block is replaced; a new `#remit-transfers` preview is added. Inbound links to `#remit` still exist but the story is a ledger, not “You send”.
- **Git:** merge is a fat `dev`→`main` PR. Histories diverged at `8126c4e`; SMTP/bot-gate *content* is on both, but main’s promote-merge commits are not in `dev`. Do not cherry-pick onto `main` (release convention). Do not terraform; this overhaul is app image only.
- **Cookies** still claim Vercel Analytics after promote (already live on prod).
- Last-chapter bug without PR 46: `06 / PROOF` copy with rail stuck on `05 / MOMENTUM`. Current staging **includes** PR 46; promoting *now* keeps that fix. Promoting an older `dev` image would not.

### 7.2 If someone merges `dev` the other way, or merges `main` into `dev`

No product need. `main` has no unique marketing. A reverse merge would only bring promote-merge commits.

### 7.3 PR 42 (closed unmerged — leave it closed)

If it were merged to `main` it would **only** relabel `RemitSection.tsx` (`Preview the conversion. Nothing moves yet.` / `From` / `To`) and add leftover-copy asserts to **main’s** `marketing-responsive.spec.ts`. It would **not** bring scrolly, GSAP, or the new hero. It would also **not** target `dev`. That was a production-only copy exception. **Closed on purpose. Do not reopen.** Staging already has a stronger honesty model; the leftover is on prod because 42 never merged and `dev` was not promoted.

### 7.4 If anyone pushes to `main` at all

`deploy.yml` deploys `prod-${{ github.sha }}` through SSM to the production process on `:3000` (`www.rive.work`). That is a production ship. There is no separate “preview main”.

---

## Appendix — file index for Product review

| Topic | Path (dev unless noted) |
|---|---|
| Prod Remit leftover | `origin/main:src/components/RemitSection.tsx` |
| Staging Remit preview | `src/components/marketing/RemitPreview.tsx` |
| `remitNext` copy | `src/content/marketing/home.ts` |
| Home composition | `src/components/marketing/MarketingHome.tsx` |
| Shutter (`scrollytelling-rail`) | `src/components/marketing/ScrollytellingSection.tsx` |
| Hero pipeline / cycle | `src/components/marketing/HeroPipeline.tsx` |
| Hero CSS 1280 | `src/app/globals.css` (`max-height: 800px` / `720px`) |
| 1280 ship-gate | `tests/e2e/marketing-experience.spec.ts` |
| Leftover-copy tests | `tests/e2e/public-routes.spec.ts` |
| Prod home (old) | `origin/main:src/app/page.tsx`, `origin/main:src/components/Hero.tsx` |
| Deploy IDs | `src/app/api/health/route.ts`, `.github/workflows/deploy.yml`, `next.config.ts` |
| Closed copy PR | https://github.com/atzgg132/rive/pull/42 |

**Bottom line for Product:** git `main` = prod = `cfe7b317`. git `dev` = staging = working tree = `b48985d7`. Production still sells Remit as a payout. Staging does not. Sticky `data-testid="scrollytelling-rail"` **is the shutter** and is still live on staging (count 1 on `b48985d` / `https://dev.rive.work`; count 0 on prod/main). PR 41 killed that rail; it came back. The test carve-out is the cheat. 1280×720 first screen **passed QA** on staging (nav, badge, headline, sub, CTAs, labeled CLIENT→PROOF); the headless still was a capture miss, not a fold fail. Promoting staging would fix the Remit lie and **ship the shutter**. It is still a ship, not a copy patch. PR 42 stays closed.
