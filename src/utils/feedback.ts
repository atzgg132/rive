import { Prisma } from "@prisma/client";

export const FEEDBACK_PROMPTS = {
  workspace: {
    key: "workspace_general",
    type: "general",
    question: "How is Rive helping you so far?",
    detail: "A short, honest answer helps us decide what to improve next.",
  },
  onboarding: {
    key: "onboarding_completed",
    type: "onboarding",
    question: "What were you hoping to accomplish first?",
    detail: "Tell us what brought you here, even if you did not finish setup.",
  },
  activation: {
    key: "activation_value",
    type: "activation",
    question: "Did Rive help you complete that workflow?",
    detail: "Your answer helps us understand whether the connected workspace is useful.",
  },
  invoice: {
    key: "invoice_workflow",
    type: "workflow",
    question: "How did the invoice workflow feel?",
    detail: "Tell us what was clear, confusing, or missing.",
  },
  /* The dashboard layout has always asked for this key on calendar pages, but
     it was never defined here, so both the prompt lookup and the submit
     rejected it as unknown: the calendar prompt never appeared and its
     "Calendar feedback" button failed with "That feedback prompt is not
     available." */
  calendar: {
    key: "calendar_workflow",
    type: "workflow",
    question: "How did scheduling feel?",
    detail: "Tell us what was clear, confusing, or missing.",
  },
} as const;

/**
 * How long a prompt stays quiet after it has been put in front of someone.
 *
 * Being shown and ignored is a soft "no", so it has to suppress the prompt on
 * its own. Eligibility used to depend only on an explicit dismiss, snooze, or
 * response — `shownAt` was recorded and never read — so anyone who closed the
 * tab, reloaded, or simply ignored the modal was asked again on the next page
 * load, indefinitely.
 */
export const PROMPT_REASK_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * The floor between any two prompts, whichever prompts they are.
 *
 * The prompt key is derived from the current path, so moving between the
 * dashboard, invoices, and the calendar swaps in a different key with its own
 * independent state. Without a cooldown that spans every key, dismissing one
 * prompt just handed the next page's prompt a clear run.
 */
export const ANY_PROMPT_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

/** The subset of a stored prompt state the pacing rule depends on. */
export type FeedbackPromptStateLike = {
  promptKey: string;
  shownAt: Date | null;
  dismissedAt: Date | null;
  snoozedUntil: Date | null;
  respondedAt: Date | null;
};

/**
 * Whether `promptKey` may be put in front of this person right now.
 *
 * Pure, so the pacing can be tested exhaustively without a database. Every
 * suppressing condition is deliberate:
 *   responded / dismissed — a settled answer, never ask again
 *   snoozed               — an explicit "later"
 *   asked recently        — shown and ignored is a soft no
 *   any prompt recently   — paces the whole set, not one key at a time
 */
export function isPromptAvailable(
  states: readonly FeedbackPromptStateLike[],
  promptKey: string,
  now: Date = new Date(),
): boolean {
  const current = now.getTime();
  const elapsed = (at: Date | null) => (at ? current - at.getTime() : Number.POSITIVE_INFINITY);
  const state = states.find((row) => row.promptKey === promptKey);

  if (state?.respondedAt || state?.dismissedAt) return false;
  if (state?.snoozedUntil && state.snoozedUntil.getTime() > current) return false;
  if (elapsed(state?.shownAt ?? null) < PROMPT_REASK_COOLDOWN_MS) return false;
  if (states.some((row) => elapsed(row.shownAt) < ANY_PROMPT_COOLDOWN_MS)) return false;
  return true;
}

export function promptForKey(key: string) {
  return Object.values(FEEDBACK_PROMPTS).find((prompt) => prompt.key === key) || null;
}

export function safeFeedbackContext(value: unknown): Prisma.InputJsonValue | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const allowed = ["path", "module", "trigger", "activationPath", "status", "source"];
  const result: Record<string, string> = {};
  for (const key of allowed) {
    const item = (value as Record<string, unknown>)[key];
    if (typeof item === "string" && item.trim()) result[key] = item.trim().slice(0, 160);
  }
  return Object.keys(result).length ? result : undefined;
}

