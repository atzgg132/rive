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
} as const;

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

