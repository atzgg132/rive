import assert from "node:assert/strict";
import test from "node:test";

import {
  ANY_PROMPT_COOLDOWN_MS,
  FEEDBACK_PROMPTS,
  FEEDBACK_SUBMIT_COOLDOWN_MS,
  PROMPT_REASK_COOLDOWN_MS,
  feedbackSubmitCooldownKey,
  formatCooldownClock,
  formatCooldownRemaining,
  isPromptAvailable,
  promptForKey,
} from "../../src/utils/feedback.ts";

const NOW = new Date("2026-08-17T12:00:00.000Z");
const ago = (ms) => new Date(NOW.getTime() - ms);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function state(overrides = {}) {
  return {
    promptKey: "workspace_general",
    shownAt: null,
    dismissedAt: null,
    snoozedUntil: null,
    respondedAt: null,
    ...overrides,
  };
}

test("a person who has never been asked is eligible", () => {
  assert.equal(isPromptAvailable([], "workspace_general", NOW), true);
});

test("being shown and ignored suppresses the prompt, which is the whole bug", () => {
  // Eligibility used to read only dismissed/snoozed/responded, so closing the
  // tab or ignoring the modal meant being asked again on the very next load.
  const shown = [state({ shownAt: ago(5 * 60 * 1000) })];
  assert.equal(isPromptAvailable(shown, "workspace_general", NOW), false);
});

test("an ignored prompt comes back, but only after the re-ask window", () => {
  const justInside = [state({ shownAt: ago(PROMPT_REASK_COOLDOWN_MS - HOUR) })];
  assert.equal(isPromptAvailable(justInside, "workspace_general", NOW), false);

  const justOutside = [state({ shownAt: ago(PROMPT_REASK_COOLDOWN_MS + HOUR) })];
  assert.equal(isPromptAvailable(justOutside, "workspace_general", NOW), true);
});

test("a recent prompt silences the other prompts too", () => {
  /* The key is derived from the path, so without a cross-key floor, moving
     from the dashboard to invoices simply swapped in a fresh prompt with its
     own state and asked again. */
  const invoiceShownYesterday = [state({ promptKey: "invoice_workflow", shownAt: ago(DAY) })];
  assert.equal(isPromptAvailable(invoiceShownYesterday, "workspace_general", NOW), false);

  const invoiceShownLongAgo = [state({ promptKey: "invoice_workflow", shownAt: ago(ANY_PROMPT_COOLDOWN_MS + HOUR) })];
  assert.equal(isPromptAvailable(invoiceShownLongAgo, "workspace_general", NOW), true);
});

test("the cross-key floor is shorter than the same-key one", () => {
  // A different prompt may follow sooner than a repeat of the same question.
  assert.ok(ANY_PROMPT_COOLDOWN_MS < PROMPT_REASK_COOLDOWN_MS);
  const other = [state({ promptKey: "invoice_workflow", shownAt: ago(5 * DAY) })];
  assert.equal(isPromptAvailable(other, "workspace_general", NOW), true);
  const same = [state({ promptKey: "workspace_general", shownAt: ago(5 * DAY) })];
  assert.equal(isPromptAvailable(same, "workspace_general", NOW), false);
});

test("a settled answer is permanent, whatever the cooldowns say", () => {
  const long = PROMPT_REASK_COOLDOWN_MS + 365 * DAY;
  for (const field of ["dismissedAt", "respondedAt"]) {
    const settled = [state({ shownAt: ago(long), [field]: ago(long) })];
    assert.equal(isPromptAvailable(settled, "workspace_general", NOW), false, `${field} should suppress forever`);
  }
});

test("a snooze holds until it expires, then the re-ask window still applies", () => {
  const snoozed = [state({ shownAt: ago(30 * DAY), snoozedUntil: new Date(NOW.getTime() + DAY) })];
  assert.equal(isPromptAvailable(snoozed, "workspace_general", NOW), false);

  const expired = [state({ shownAt: ago(30 * DAY), snoozedUntil: ago(DAY) })];
  assert.equal(isPromptAvailable(expired, "workspace_general", NOW), true);
});

test("every prompt the dashboard asks for is actually defined", () => {
  /* The layout has always requested calendar_workflow on calendar pages while
     no such prompt existed, so the lookup and the submit both rejected it. */
  for (const key of ["workspace_general", "invoice_workflow", "calendar_workflow"]) {
    assert.ok(promptForKey(key), `${key} must resolve to a prompt`);
  }
  assert.equal(promptForKey("not_a_real_prompt"), null);
});

test("prompt keys are unique, so state rows cannot collide", () => {
  const keys = Object.values(FEEDBACK_PROMPTS).map((prompt) => prompt.key);
  assert.equal(new Set(keys).size, keys.length);
});

/* --------------------------------------------------------------------- */
/* Submission cooldown                                                   */
/* --------------------------------------------------------------------- */

test("the submit cooldown is a full day, keyed per account", () => {
  assert.equal(FEEDBACK_SUBMIT_COOLDOWN_MS, 24 * 60 * 60 * 1000);
  assert.equal(feedbackSubmitCooldownKey("user-1"), "feedback:submit:user-1");
  assert.notEqual(
    feedbackSubmitCooldownKey("user-1"),
    feedbackSubmitCooldownKey("user-2"),
    "one account's allowance must never spend another's",
  );
});

test("the wait is described in human terms, always rounded up", () => {
  assert.equal(formatCooldownRemaining(5), "in under a minute");
  assert.equal(formatCooldownRemaining(60), "in under a minute");
  assert.equal(formatCooldownRemaining(61), "in 2 minutes");
  assert.equal(formatCooldownRemaining(60 * 59), "in 59 minutes");
  assert.equal(formatCooldownRemaining(60 * 90), "in about 2 hours");
  assert.equal(formatCooldownRemaining(60 * 60 * 23), "in about 23 hours");
  assert.equal(formatCooldownRemaining(60 * 60 * 24), "in about a day");
});

test("the countdown clock degrades from hours to seconds", () => {
  assert.equal(formatCooldownClock(60 * 60 * 23 + 14 * 60), "23h 14m");
  assert.equal(formatCooldownClock(60 * 45 + 30), "45m 30s");
  assert.equal(formatCooldownClock(30), "30s");
  assert.equal(formatCooldownClock(0), "0s");
  assert.equal(formatCooldownClock(-5), "0s", "an elapsed wait never reads as negative");
});
