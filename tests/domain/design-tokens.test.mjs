import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";
import test from "node:test";

/**
 * Working Edition restyle guard (HANDOFF Phase 0, §3.1).
 *
 * The authenticated app must use semantic tokens (background, card, primary,
 * border, success, warning, destructive, ...) instead of raw Tailwind palette
 * classes. Each in-scope file gets a forbidden-match count; the count must not
 * exceed its ALLOWLIST entry. Restyle phases lower finished files to 0; when
 * the restyle is complete the allowlist is empty and every file must be clean.
 *
 * Forbidden patterns (literal from the handoff):
 * - prefix-palette classes: (bg|text|border|ring|fill|stroke|from|via|to|
 *   divide|outline|shadow)-(white|black|slate|...|fuchsia)(shade?)(/alpha?)
 * - hex colors inside [...] arbitrary-value brackets (class strings only;
 *   inline style={{...}} and data colors are not class strings)
 * - bare size shadows shadow-sm/md/lg/xl/2xl (shadow-card/overlay are tokens)
 * - rounded-sm/md/lg/xl/2xl/3xl and rounded-[...] (rounded-full/none survive)
 */

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

const SCOPED_DIRS = [
  "src/app/(dashboard)",
  "src/app/onboarding",
  "src/app/admin",
  "src/app/invoice",
  "src/app/sign",
  "src/app/review",
  "src/app/(auth)",
  "src/components/ui",
  "src/components/dashboard",
  "src/components/invoices",
  "src/components/engagements",
  "src/components/currency",
  "src/components/auth",
  "src/components/contracts",
];

const SCOPED_FILES = [
  "src/components/ThemeToggle.tsx",
  "src/components/FeedbackWidget.tsx",
  "src/components/RiveLogo.tsx",
];

const EXCLUDED_PREFIXES = [
  "src/components/portfolio/",
  "src/app/(dashboard)/portfolio/",
];

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

// Seeded from manual counts at restyle start (total 2424). Lower to 0 per
// finished file; delete everything once the restyle is complete. admin=97 is
// the orchestrator's verified count (subagent reported 93, missing 4 in
// long lines); all other entries are subagent counts cross-checked on
// methodology (seeding high is safe: the test fails only when count > entry).
const ALLOWLIST = {
  "src/app/(dashboard)/layout.tsx": 0,
  "src/app/(dashboard)/dashboard/page.tsx": 0,
  "src/components/dashboard/ActivationCard.tsx": 0,
  "src/components/dashboard/AnalyticsCharts.tsx": 0,
  "src/components/dashboard/CommandPalette.tsx": 0,
  "src/components/dashboard/GuidedExperience.tsx": 0,
  "src/app/(dashboard)/migrate/page.tsx": 0,
  "src/app/(dashboard)/migrate/MigrationHistory.tsx": 0,
  "src/app/(dashboard)/migrate/MigrationWizard.tsx": 0,
  "src/app/(dashboard)/migrate/steps/AnalysisStep.tsx": 0,
  "src/app/(dashboard)/migrate/steps/PlanStep.tsx": 0,
  "src/app/(dashboard)/migrate/steps/ReviewStep.tsx": 0,
  "src/app/(dashboard)/migrate/steps/SuccessStep.tsx": 0,
  "src/app/(dashboard)/migrate/steps/UploadStep.tsx": 0,
  "src/app/(dashboard)/migrate/types.ts": 0,
  "src/app/(dashboard)/workflow/projects/page.tsx": 0,
  "src/app/(dashboard)/workflow/projects/[id]/page.tsx": 0,
  "src/app/(dashboard)/workflow/clients/page.tsx": 0,
  "src/app/(dashboard)/workflow/clients/[id]/page.tsx": 0,
  "src/app/(dashboard)/workflow/revenue/page.tsx": 0,
  "src/app/(dashboard)/workflow/invoices/new/page.tsx": 0,
  "src/app/(dashboard)/workflow/invoices/[id]/page.tsx": 0,
  "src/app/(dashboard)/workflow/invoice-settings/page.tsx": 0,
  "src/components/invoices/InvoiceDetailPanel.tsx": 0,
  "src/app/(dashboard)/workflow/expenses/page.tsx": 0,
  "src/app/(dashboard)/workflow/contracts/page.tsx": 0,
  "src/app/(dashboard)/workflow/contracts/[id]/page.tsx": 0,
  "src/app/(dashboard)/workflow/start-engagement/page.tsx": 0,
  "src/components/engagements/StartEngagementComposer.tsx": 0,
  "src/components/contracts/ContractComposer.tsx": 0,
  "src/components/contracts/ContractWorkSetupCard.tsx": 0,
  "src/app/(dashboard)/calendar/page.tsx": 0,
  "src/components/ui/alert.tsx": 0,
  "src/components/ui/badge.tsx": 0,
  "src/components/ui/button.tsx": 0,
  "src/components/ui/card.tsx": 0,
  "src/components/ui/dialog.tsx": 0,
  "src/components/ui/DropdownPortal.tsx": 0,
  "src/components/ui/empty-state.tsx": 0,
  "src/components/ui/form-field.tsx": 0,
  "src/components/ui/index.ts": 0,
  "src/components/ui/input.tsx": 0,
  "src/components/ui/page-header.tsx": 0,
  "src/components/ui/pagination.tsx": 0,
  "src/components/ui/Portal.tsx": 0,
  "src/components/ui/select.tsx": 0,
  "src/components/ui/separator.tsx": 0,
  "src/components/ui/skeleton.tsx": 0,
  "src/components/ui/switch.tsx": 0,
  "src/components/ui/textarea.tsx": 0,
  "src/app/onboarding/page.tsx": 0,
  "src/app/admin/page.tsx": 0,
  "src/app/(auth)/layout.tsx": 0,
  "src/app/(auth)/reset-password/page.tsx": 0,
  "src/app/(auth)/verify-email/page.tsx": 0,
  "src/app/invoice/[token]/page.tsx": 0,
  "src/app/sign/[token]/page.tsx": 0,
  "src/app/review/[token]/page.tsx": 0,
  "src/components/auth/authClasses.ts": 0,
  "src/components/auth/AuthHeading.tsx": 0,
  "src/components/auth/authIntent.ts": 0,
  "src/components/auth/AuthOverlay.tsx": 0,
  "src/components/auth/AuthOverlayProvider.tsx": 0,
  "src/components/auth/AuthShell.tsx": 0,
  "src/components/auth/ForgotPasswordForm.tsx": 0,
  "src/components/auth/GoogleSignInButton.tsx": 0,
  "src/components/auth/LoginForm.tsx": 0,
  "src/components/auth/RegisterForm.tsx": 0,
  "src/components/currency/CurrencyProvider.tsx": 0,
  "src/components/currency/CurrencySwitcher.tsx": 0,
  "src/components/ThemeToggle.tsx": 0,
  "src/components/FeedbackWidget.tsx": 0,
  "src/components/RiveLogo.tsx": 0,
};

// `violet` is a semantic app token, so unshaded `bg-violet/10` and
// `text-violet` are valid. Keep the shaded form in the forbidden set so a raw
// Tailwind palette class such as `text-violet-700` cannot slip through.
const PALETTE_WITHOUT_VIOLET =
  "(?:white|black|slate|gray|zinc|neutral|stone|blue|indigo|sky|cyan|teal|emerald|green|lime|amber|yellow|orange|red|rose|pink|purple|fuchsia)";
const PALETTE_PREFIX = "(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|shadow)";
const CLASS_RE = new RegExp(
  `\\b${PALETTE_PREFIX}-${PALETTE_WITHOUT_VIOLET}(?:-\\d{1,3})?(?:/\\d+)?\\b|\\b${PALETTE_PREFIX}-violet-\\d{1,3}(?:/\\d+)?\\b`,
  "g",
);
const SHADOW_RE = /\bshadow-(?:sm|md|lg|xl|2xl)\b/g;
const ROUNDED_RE = /\brounded-(?:sm|md|lg|xl|2xl|3xl|\[)/g;
const BRACKET_RE = /\[[^\][]*\]/g;
const HEX_IN_BRACKET_RE = /#[0-9a-fA-F]{3,8}\b/g;

function countMatches(source, pattern) {
  pattern.lastIndex = 0;
  let count = 0;
  while (pattern.exec(source) !== null) count += 1;
  return count;
}

function countForbidden(source) {
  let count = countMatches(source, CLASS_RE);
  count += countMatches(source, SHADOW_RE);
  count += countMatches(source, ROUNDED_RE);
  BRACKET_RE.lastIndex = 0;
  let bracket;
  while ((bracket = BRACKET_RE.exec(source)) !== null) {
    count += countMatches(bracket[0], HEX_IN_BRACKET_RE);
  }
  return count;
}

function extractCssBlock(source, selector) {
  const marker = `${selector} {`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `expected ${selector} block`);
  let depth = 0;
  const openingBrace = source.indexOf("{", start);
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`${selector} block is not closed`);
}

function cssDeclarations(block, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...block.matchAll(new RegExp(`${escapedName}\\s*:\\s*([^;]+);`, "g"))].map(
    (match) => match[1].trim(),
  );
}

function rgbChannels(block, name) {
  const [value] = cssDeclarations(block, name);
  assert.ok(value, `expected ${name} in token block`);
  return value.split(/\s+/).map(Number);
}

function relativeLuminance([red, green, blue]) {
  const linearize = (channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function composite(foreground, background, alpha) {
  return foreground.map((channel, index) => channel * alpha + background[index] * (1 - alpha));
}

function toPosix(absolute) {
  return relative(ROOT, absolute).split(sep).join("/");
}

function collectFiles(absoluteDir, out) {
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const absolute = join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(absolute, out);
    } else if (EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
      const rel = toPosix(absolute);
      if (!EXCLUDED_PREFIXES.some((prefix) => rel.startsWith(prefix))) out.push(rel);
    }
  }
  return out;
}

function discoverScopedFiles() {
  const files = [];
  for (const dir of SCOPED_DIRS) {
    const absolute = join(ROOT, dir);
    try {
      if (statSync(absolute).isDirectory()) collectFiles(absolute, files);
    } catch {
      // A scope dir that does not exist contributes nothing.
    }
  }
  files.push(...SCOPED_FILES);
  return [...new Set(files)].sort();
}

test("app scope stays within its raw-palette allowlist", () => {
  const files = discoverScopedFiles();
  assert.ok(files.length > 0, "expected to discover scoped files");
  const rows = [];
  let total = 0;
  for (const file of files) {
    const source = readFileSync(join(ROOT, file), "utf8");
    const count = countForbidden(source);
    total += count;
    rows.push({ file, count, allowed: ALLOWLIST[file] ?? 0 });
  }
  const offenders = rows.filter((row) => row.count > row.allowed);
  console.log(`design-tokens: ${total} raw-palette matches across ${files.length} scoped files`);
  for (const row of rows.filter((row) => row.count > 0 || row.allowed > 0)) {
    console.log(`  ${row.count}/${row.allowed} ${row.file}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `raw palette above allowlist: ${offenders.map((row) => `${row.file} (${row.count} > ${row.allowed})`).join(", ")}`,
  );
});

test("light and dark app token blocks contain one canonical declaration each", () => {
  const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
  const expected = {
    ":root": {
      "--background": "243 240 232",
      "--foreground": "12 30 54",
      "--card": "251 250 246",
      "--card-foreground": "12 30 54",
      "--popover": "251 250 246",
      "--popover-foreground": "12 30 54",
      "--primary": "37 99 235",
      "--primary-foreground": "255 255 255",
      "--primary-strong": "24 71 189",
      "--secondary": "226 231 243",
      "--secondary-foreground": "24 71 189",
      "--muted": "235 231 221",
      "--muted-foreground": "83 96 113",
      "--accent": "226 231 243",
      "--accent-foreground": "24 71 189",
      "--destructive": "179 55 55",
      "--destructive-foreground": "255 255 255",
      "--success": "8 117 84",
      "--success-foreground": "255 255 255",
      "--warning": "148 83 12",
      "--warning-foreground": "255 255 255",
      "--info": "24 71 189",
      "--violet": "98 54 167",
      "--line": "12 30 54",
      "--border": "12 30 54",
      "--border-alpha": "0.20",
      "--input": "12 30 54",
      "--input-alpha": "0.32",
      "--ring": "37 99 235",
      "--radius": "0",
      "--shadow-card": "none",
      "--shadow-overlay": "0 24px 60px rgb(12 30 54 / 0.16)",
      "--brand-wordmark": "12 30 54",
      "--brand-accent": "37 99 235",
    },
    ".dark": {
      "--background": "9 17 31",
      "--foreground": "241 238 230",
      "--card": "13 24 42",
      "--card-foreground": "241 238 230",
      "--popover": "16 28 48",
      "--popover-foreground": "241 238 230",
      "--primary": "96 144 255",
      "--primary-foreground": "9 17 31",
      "--primary-strong": "130 168 255",
      "--secondary": "24 43 78",
      "--secondary-foreground": "190 208 255",
      "--muted": "20 33 55",
      "--muted-foreground": "154 166 184",
      "--accent": "24 43 78",
      "--accent-foreground": "190 208 255",
      "--destructive": "240 112 112",
      "--destructive-foreground": "9 17 31",
      "--success": "52 199 150",
      "--success-foreground": "9 17 31",
      "--warning": "232 168 64",
      "--warning-foreground": "9 17 31",
      "--info": "130 168 255",
      "--violet": "171 140 232",
      "--line": "241 238 230",
      "--border": "241 238 230",
      "--border-alpha": "0.14",
      "--input": "241 238 230",
      "--input-alpha": "0.22",
      "--ring": "96 144 255",
      "--radius": "0",
      "--shadow-card": "none",
      "--shadow-overlay": "0 24px 60px rgb(0 0 0 / 0.55)",
      "--brand-wordmark": "241 238 230",
      "--brand-accent": "96 144 255",
    },
  };

  for (const [selector, tokens] of Object.entries(expected)) {
    const block = extractCssBlock(css, selector);
    for (const [name, value] of Object.entries(tokens)) {
      assert.deepEqual(cssDeclarations(block, name), [value], `${selector} ${name}`);
    }
    for (const legacy of ["--bg-primary", "--bg-secondary", "--text-primary", "--text-secondary", "--color-blue-primary", "--color-blue-light", "--color-blue-soft", "--color-blue-border"]) {
      assert.deepEqual(cssDeclarations(block, legacy), [], `${selector} retains legacy ${legacy}`);
    }
  }
});

test("semantic violet tokens are allowed while raw violet shades stay forbidden", () => {
  assert.equal(
    countForbidden("bg-violet/10 border-violet/25 text-violet dark:bg-violet/[0.16]"),
    0,
  );
  assert.equal(
    countForbidden("bg-violet-50 border-violet-500 text-violet-700 dark:bg-violet-900/20"),
    4,
  );
});

test("active navigation and primary badges meet the contrast target", () => {
  const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
  const badge = readFileSync(join(ROOT, "src/components/ui/badge.tsx"), "utf8");
  const cases = [":root", ".dark"];

  for (const selector of cases) {
    const block = extractCssBlock(css, selector);
    const accent = rgbChannels(block, "--accent");
    const accentForeground = rgbChannels(block, "--accent-foreground");
    const card = rgbChannels(block, "--card");
    const primary = rgbChannels(block, "--primary");
    const primaryStrong = rgbChannels(block, "--primary-strong");
    const badgeSurface = composite(primary, card, selector === ":root" ? 0.1 : 0.16);

    assert.ok(
      contrastRatio(accentForeground, accent) >= 4.5,
      `${selector} active navigation contrast should be at least 4.5:1`,
    );
    assert.ok(
      contrastRatio(primaryStrong, badgeSurface) >= 4.5,
      `${selector} primary badge contrast should be at least 4.5:1`,
    );
  }

  assert.match(badge, /default: "[^\"]*text-primary-strong/);
  assert.match(badge, /primary: "[^\"]*text-primary-strong/);
  assert.match(css, /\[data-dashboard-shell\] a\.bg-accent\.text-primary[\s\S]*color: rgb\(var\(--accent-foreground\)\)/);
});

test("auth fields keep the edition border alpha across the shared input utility", () => {
  const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
  assert.match(css, /\[data-surface="marketing"\] \[data-surface="auth-overlay"\] \.border-input/);
  assert.match(css, /--input: 12 30 54;/);
  assert.match(css, /--input-alpha: 0\.2;/);
  assert.match(css, /border-color: var\(--edition-line\);/);
});
