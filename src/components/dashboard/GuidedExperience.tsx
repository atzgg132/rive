"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleHelp,
  Clock3,
  Compass,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import Portal from "@/components/ui/Portal";
import {
  ACTIVATION_GOALS,
  ACTIVATION_GOAL_META,
  type ActivationAction,
  type ActivationGoal,
  type ActivationPlan,
  type GuideProgressMap,
} from "@/lib/activation";
import {
  GUIDE_CATALOG,
  getGuideCatalogItem,
  getGuideDefinition,
  getGuideGoal,
  getGuideStep,
  isGuideId,
  snapshotGuide,
  type GuideId,
  type GuideSnapshot,
  type GuideStep,
} from "@/lib/guides";

type GuideMode = "automatic" | "manual";
type GuidanceEvent = "started" | "skipped" | "completed" | "replayed" | "minimized" | "resumed" | "step_opened" | "step_completed";
type TargetState = "not_needed" | "waiting" | "found" | "missing";

type GuidedExperienceProps = {
  activation: ActivationPlan | null;
  pathname: string;
  onActivationChange: (plan: ActivationPlan) => void;
};

const LAST_GUIDE_STORAGE_KEY = "rive:guide:last";
const DEFERRED_GUIDANCE_STORAGE_KEY = "rive:guide:auto-deferred";
const TARGET_BY_ACTION: Record<string, string> = {
  first_client: "clients-create",
  first_project: "projects-create",
  add_deadline: "projects-deadline",
  create_invoice: "revenue-create",
  send_invoice: "revenue-send",
  add_expense: "expenses-create",
  connect_calendar: "calendar-connect",
  complete_profile: "portfolio-profile",
  select_project: "portfolio-project",
  publish_portfolio: "portfolio-publish",
};

const FEEDBACK_BY_ACTION: Record<string, string> = {
  first_client: "Client added. Now create the work you are doing for them.",
  first_project: "Project created. Its deadline can now appear in Calendar.",
  add_deadline: "Deadline added. Calendar can now show when the work needs attention.",
  create_invoice: "Invoice created. Revenue will now track its status.",
  send_invoice: "Invoice status updated. Revenue now shows what is outstanding or paid.",
  add_expense: "Expense added. Your financial context now includes project costs.",
  import_work: "Import complete. Review what came across before relying on the totals.",
  resolve_import: "Import review complete. Your workspace is ready to use.",
  complete_profile: "Profile ready. Now choose the work you want people to see.",
  select_project: "Project added to your portfolio draft. Preview it before publishing.",
  publish_portfolio: "Portfolio published. Your work is now available as public proof.",
};

function readStoredGuide(): GuideId | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(LAST_GUIDE_STORAGE_KEY);
    return stored && isGuideId(stored) ? stored : null;
  } catch {
    return null;
  }
}

function readDeferredGuidance(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(DEFERRED_GUIDANCE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function targetIdForAction(actionId: string, pathname: string): string | null {
  // The dashboard's activation card owns the recommended action. Keep the
  // guide anchored to that single, visible action instead of pointing at a
  // page-specific control that is not rendered on the dashboard.
  if (pathname === "/dashboard") return "activation-primary";
  if (actionId === "create_invoice" && pathname === "/workflow/invoices/new") return "invoice-details";
  if (actionId === "import_work") {
    if (pathname === "/migrate") return "migration-upload";
  }
  if (actionId === "resolve_import") {
    if (pathname === "/migrate") return "migration-review";
  }
  return TARGET_BY_ACTION[actionId] || null;
}

function syntheticAction(step: GuideStep): ActivationAction {
  return {
    id: step.actionIds[0] || step.id,
    label: step.fallbackLabel,
    description: step.fallbackDescription,
    href: step.fallbackHref,
  };
}

function actionForStep(step: GuideStep | null, plan: ActivationPlan | null): ActivationAction | null {
  if (!step) return null;
  const recommended = plan?.recommendedAction;
  if (recommended && step.actionIds.includes(recommended.id)) return recommended;
  return syntheticAction(step);
}

function guideStatusLabel(snapshot: GuideSnapshot): string {
  if (snapshot.status === "completed") return "Completed · review";
  if (snapshot.status === "needs_attention") return "Needs attention";
  if (snapshot.status === "in_progress") return `In progress · ${snapshot.completed}/${snapshot.total}`;
  return "Start when useful";
}

function guideIntro(plan: ActivationPlan | null, mode: GuideMode, guideId: GuideId): string {
  if (guideId === "orientation") {
    return "Rive keeps the client, the work, the money, and the proof connected so you spend less time maintaining context.";
  }
  if (!plan) return "This guide will reopen at the first step that still needs your attention.";
  if (mode === "automatic") return `One useful step at a time toward ${plan.goalLabel.toLowerCase()}. You can minimize this whenever you want.`;
  return "This guide follows the facts in your workspace. It never advances just because you opened a screen.";
}

export function GuidedExperience({ activation, pathname, onActivationChange }: GuidedExperienceProps) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideCollapsed, setGuideCollapsed] = useState(false);
  const [guideAnimating, setGuideAnimating] = useState(false);
  const [activeMode, setActiveMode] = useState<GuideMode>("automatic");
  const [activeGuideId, setActiveGuideId] = useState<GuideId>("getting_started");
  const [guidePlan, setGuidePlan] = useState<ActivationPlan | null>(activation);
  const [guideProgress, setGuideProgress] = useState<GuideProgressMap>(activation?.guideProgress || {});
  const [lastGuideId, setLastGuideId] = useState<GuideId | null>(() => readStoredGuide());
  const [autoDeferred, setAutoDeferred] = useState(() => readDeferredGuidance());
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [targetState, setTargetState] = useState<TargetState>("not_needed");

  const dialogRef = useRef<HTMLDivElement>(null);
  const helpPanelRef = useRef<HTMLDivElement>(null);
  const dockButtonRef = useRef<HTMLButtonElement>(null);
  const previousTargetRef = useRef<HTMLElement | null>(null);
  const previousPlanRef = useRef<ActivationPlan | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const autoStartedRef = useRef(false);
  const minimizeTimerRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  const selectedGuide = useMemo(() => getGuideDefinition(activeGuideId), [activeGuideId]);
  const currentGoal = getGuideGoal(activeGuideId, activation?.goal);
  const storedProgress = guideProgress[activeGuideId] || null;
  const guideSnapshot = useMemo(
    () => snapshotGuide(activeGuideId, guidePlan, storedProgress),
    [activeGuideId, guidePlan, storedProgress],
  );
  const selectedStep = getGuideStep(activeGuideId, selectedStepId);
  const currentStep = selectedStep || guideSnapshot.currentStep;
  const currentAction = actionForStep(currentStep, guidePlan);
  const targetId = currentAction ? targetIdForAction(currentAction.id, pathname) : null;
  const targetSelector = targetId ? `[data-guide-target="${targetId}"]` : null;
  const guideFinished = guideSnapshot.status === "completed";
  const isReviewing = guideFinished && Boolean(selectedStepId);
  const guideTotal = guideSnapshot.total || selectedGuide.stepCount;
  const resumeGuideId = lastGuideId || (activation && isGuideId(activation.goal) ? activation.goal : "organize");

  const rememberGuide = useCallback((id: GuideId) => {
    setLastGuideId(id);
    try {
      window.sessionStorage.setItem(LAST_GUIDE_STORAGE_KEY, id);
    } catch {
      // Session storage is an enhancement; guide state is server-backed.
    }
  }, []);

  const recordEvent = useCallback(async (
    event: GuidanceEvent,
    mode: GuideMode,
    guideIdOverride?: GuideId,
    stepId?: string | null,
    completedStepIds?: string[],
  ) => {
    const eventGuideId = guideIdOverride || activeGuideId;
    const response = await fetch("/api/guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, mode, guideId: eventGuideId, stepId: stepId || undefined, completedStepIds }),
    }).catch(() => null);
    if (!response) return null;
    const data = await response.json().catch(() => null);
    if (response.ok && data?.guideProgress) setGuideProgress(data.guideProgress as GuideProgressMap);
    return data;
  }, [activeGuideId]);

  const applyPlan = useCallback((next: ActivationPlan, mode: GuideMode) => {
    const previous = previousPlanRef.current;
    if (previous && next.completed > previous.completed && previous.recommendedAction?.id) {
      const feedback = FEEDBACK_BY_ACTION[previous.recommendedAction.id];
      if (feedback) toast.success(feedback, { id: `activation-feedback-${previous.recommendedAction.id}` });
    }
    previousPlanRef.current = next;
    setGuidePlan(next);
    setGuideProgress(next.guideProgress || {});
    if (mode === "automatic") onActivationChange(next);
  }, [onActivationChange]);

  const refreshPlan = useCallback(async (goal?: ActivationGoal, mode: GuideMode = activeMode) => {
    const requestId = ++requestIdRef.current;
    const query = goal ? `?goal=${encodeURIComponent(goal)}` : "";
    try {
      const response = await fetch(`/api/activation${query}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (requestId === requestIdRef.current && response.ok && data?.success && data.activation) {
        applyPlan(data.activation as ActivationPlan, mode);
      }
    } catch {
      // Guidance is optional. The workspace remains usable if its snapshot is late.
    }
  }, [activeMode, applyPlan]);

  const closeGuide = useCallback((options: { dismissAutomatic?: boolean; deferAutomatic?: boolean } = {}) => {
    const dismissAutomatic = options.dismissAutomatic === true && activeMode === "automatic";
    const deferAutomatic = options.deferAutomatic === true && activeMode === "automatic";
    if (dismissAutomatic) {
      void recordEvent("skipped", "automatic");
      if (activation) onActivationChange({ ...activation, guidanceDismissed: true, automaticGuidanceStatus: "dismissed" });
      window.dispatchEvent(new CustomEvent("rive:guidance-changed", { detail: { status: "dismissed" } }));
    }
    if (deferAutomatic) {
      setAutoDeferred(true);
      try {
        window.sessionStorage.setItem(DEFERRED_GUIDANCE_STORAGE_KEY, "true");
      } catch {
        // Session storage is optional.
      }
    }
    if (minimizeTimerRef.current) window.clearTimeout(minimizeTimerRef.current);
    setGuideOpen(false);
    setGuideCollapsed(true);
    setGuideAnimating(false);
    setSelectedStepId(null);
    setActiveMode("automatic");
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  }, [activeMode, activation, onActivationChange, recordEvent]);

  const minimizeGuide = useCallback(() => {
    if (!guideOpen || guideCollapsed) return;
    setGuideCollapsed(true);
    setGuideAnimating(true);
    void recordEvent("minimized", activeMode, activeGuideId, currentStep?.id);
    if (minimizeTimerRef.current) window.clearTimeout(minimizeTimerRef.current);
    minimizeTimerRef.current = window.setTimeout(() => {
      setGuideAnimating(false);
      minimizeTimerRef.current = null;
    }, 180);
  }, [activeGuideId, activeMode, currentStep?.id, guideCollapsed, guideOpen, recordEvent]);

  const resumeGuide = useCallback(() => {
    setHelpOpen(false);
    if (!guideOpen) {
      const id = resumeGuideId;
      const stored = guideProgress[id];
      setActiveMode("manual");
      setActiveGuideId(id);
      setSelectedStepId(stored?.currentStepId || (stored?.status === "completed" ? getGuideDefinition(id).steps[0]?.id || null : null));
      setGuidePlan(id === "orientation" ? activation : null);
      previousPlanRef.current = null;
      setGuideOpen(true);
      setGuideCollapsed(false);
      setGuideAnimating(false);
      rememberGuide(id);
      void recordEvent("replayed", "manual", id, stored?.currentStepId);
      if (id !== "orientation") void refreshPlan(getGuideGoal(id, activation?.goal), "manual");
    } else {
      setGuideCollapsed(false);
      setGuideAnimating(false);
      void recordEvent("resumed", activeMode, activeGuideId, currentStep?.id);
      void refreshPlan(currentGoal, activeMode);
    }
  }, [activation, activeGuideId, activeMode, currentGoal, currentStep?.id, guideOpen, guideProgress, recordEvent, refreshPlan, rememberGuide, resumeGuideId]);

  const startGuide = useCallback((id: GuideId) => {
    const mode: GuideMode = "manual";
    const stored = guideProgress[id];
    setActiveMode(mode);
    setActiveGuideId(id);
    setSelectedStepId(stored?.currentStepId || (stored?.status === "completed" ? getGuideDefinition(id).steps[0]?.id || null : null));
    rememberGuide(id);
    setHelpOpen(false);
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setGuideOpen(true);
    setGuideCollapsed(false);
    setGuideAnimating(false);
    setGuidePlan(id === "orientation" ? activation : null);
    previousPlanRef.current = null;
    void recordEvent("replayed", mode, id, stored?.currentStepId);
    if (id !== "orientation") void refreshPlan(getGuideGoal(id, activation?.goal), mode);
  }, [activation, guideProgress, recordEvent, refreshPlan, rememberGuide]);

  const completeGuide = useCallback(() => {
    const completedStepIds = guideSnapshot.completedStepIds.length
      ? guideSnapshot.completedStepIds
      : selectedGuide.steps.map((step) => step.id);
    if (activeGuideId !== "orientation" && guideSnapshot.status !== "completed") return;
    void recordEvent("completed", activeMode, activeGuideId, null, completedStepIds).then((data) => {
      if (data?.success) {
        if (activeMode === "automatic") {
          if (activation) onActivationChange({ ...activation, guidanceCompleted: true, automaticGuidanceStatus: "completed" });
          window.dispatchEvent(new CustomEvent("rive:guidance-changed", { detail: { status: "completed" } }));
        }
        setGuideOpen(false);
        setGuideCollapsed(true);
        setGuideAnimating(false);
        setSelectedStepId(null);
        setActiveMode("automatic");
        window.setTimeout(() => returnFocusRef.current?.focus(), 0);
      } else if (data?.message) {
        toast.error(data.message);
      }
    });
  }, [activation, activeGuideId, activeMode, guideSnapshot.completedStepIds, guideSnapshot.status, onActivationChange, recordEvent, selectedGuide.steps]);

  useEffect(() => {
    if (!activation) return;
    // This mirrors the server snapshot into the manual/replayable guide
    // state; it is intentionally a state synchronization effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGuideProgress(activation.guideProgress || {});
    if (activeMode !== "automatic") return;
    // The activation prop is the authoritative snapshot for the automatic
    // guide; manual guides own their selected goal until they close.
    setGuidePlan(activation);
    previousPlanRef.current = activation;
    if (activation.guidanceDismissed && guideOpen) {
      setGuideOpen(false);
      setGuideCollapsed(true);
      return;
    }
    if (
      pathname === "/dashboard" &&
      !guideOpen &&
      !autoStartedRef.current &&
      !autoDeferred &&
      activation.automaticGuidanceStatus === "available" &&
      activation.activationStage !== "activated"
    ) {
      const automaticGuideId: GuideId = isGuideId(activation.goal) ? activation.goal : "organize";
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setActiveGuideId(automaticGuideId);
      setSelectedStepId(null);
      rememberGuide(automaticGuideId);
      setGuideOpen(true);
      // Automatic guidance starts as a small prompt. The user chooses when to expand it.
      setGuideCollapsed(true);
      setGuideAnimating(false);
      autoStartedRef.current = true;
      void recordEvent("started", "automatic", automaticGuideId);
    }
  }, [activation, activeMode, autoDeferred, guideOpen, pathname, recordEvent, rememberGuide]);

  useEffect(() => {
    if (!guideOpen || guideCollapsed || activeGuideId === "orientation") return;
    const interval = window.setInterval(() => {
      void refreshPlan(currentGoal, activeMode);
    }, 2500);
    return () => window.clearInterval(interval);
  }, [activeGuideId, activeMode, currentGoal, guideCollapsed, guideOpen, refreshPlan]);

  useEffect(() => {
    if (!guideOpen || guideCollapsed || guideAnimating) return;
    if (guideSnapshot.status !== "completed" || guideProgress[activeGuideId]?.status === "completed") return;
    // Completion is sent as a side effect of the factual workspace snapshot;
    // the response updates persisted guide state through recordEvent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recordEvent("completed", activeMode, activeGuideId, null, guideSnapshot.completedStepIds).then((data) => {
      if (!data?.success || activeMode !== "automatic") return;
      if (activation) onActivationChange({ ...activation, guidanceCompleted: true, automaticGuidanceStatus: "completed" });
      window.dispatchEvent(new CustomEvent("rive:guidance-changed", { detail: { status: "completed" } }));
    });
  }, [activation, activeGuideId, activeMode, guideAnimating, guideCollapsed, guideOpen, guideProgress, guideSnapshot.completedStepIds, guideSnapshot.status, onActivationChange, recordEvent]);

  useEffect(() => {
    if (!selectedStepId || !guideSnapshot.currentStep) return;
    if (selectedStepId !== guideSnapshot.currentStep.id && guideSnapshot.completedStepIds.includes(selectedStepId)) {
      // Once the user completes a reviewed step, put the dock back on the next
      // useful step instead of making them rediscover it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedStepId(guideSnapshot.currentStep.id);
    }
  }, [guideSnapshot.completedStepIds, guideSnapshot.currentStep, selectedStepId]);

  useEffect(() => {
    const clearHighlight = () => {
      if (previousTargetRef.current) previousTargetRef.current.removeAttribute("data-guide-highlight");
      previousTargetRef.current = null;
    };
    if (!guideOpen || guideCollapsed || guideAnimating || !targetSelector) {
      clearHighlight();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTargetState(targetSelector ? "waiting" : "not_needed");
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let retry: number | null = null;
    const findTarget = () => {
      if (cancelled) return;
      const element = Array.from(document.querySelectorAll<HTMLElement>(targetSelector)).at(-1) || null;
      if (previousTargetRef.current && previousTargetRef.current !== element) previousTargetRef.current.removeAttribute("data-guide-highlight");
      if (element) {
        element.setAttribute("data-guide-highlight", "true");
        previousTargetRef.current = element;
        setTargetState("found");
        return;
      }
      previousTargetRef.current = null;
      attempts += 1;
      setTargetState(attempts < 12 ? "waiting" : "missing");
      if (attempts < 12) retry = window.setTimeout(findTarget, 180);
    };
    findTarget();
    const observer = typeof MutationObserver !== "undefined"
      ? new MutationObserver(findTarget)
      : null;
    observer?.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-guide-target"] });
    window.addEventListener("resize", findTarget);
    return () => {
      cancelled = true;
      if (retry) window.clearTimeout(retry);
      observer?.disconnect();
      window.removeEventListener("resize", findTarget);
      clearHighlight();
    };
  }, [guideAnimating, guideCollapsed, guideOpen, pathname, targetSelector]);

  useEffect(() => {
    if (!guideOpen || guideCollapsed || guideAnimating) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (dialogRef.current?.contains(target) || helpPanelRef.current?.contains(target)) return;
      // Outside interaction is a pause, never an accidental completion or
      // dismissal. The chip keeps the exact step available in one click.
      minimizeGuide();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [guideAnimating, guideCollapsed, guideOpen, minimizeGuide]);

  useEffect(() => {
    if (!guideOpen && !helpOpen) return;
    const timer = window.setTimeout(() => {
      if (helpOpen) helpPanelRef.current?.focus();
      else if (!guideCollapsed) dialogRef.current?.focus();
      else dockButtonRef.current?.focus();
    }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (helpOpen) setHelpOpen(false);
      else closeGuide({ deferAutomatic: activeMode === "automatic" });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeMode, closeGuide, guideCollapsed, guideOpen, helpOpen]);

  useEffect(() => {
    const openFromShell = () => {
      setHelpOpen(true);
      if (guideOpen) minimizeGuide();
    };
    window.addEventListener("rive:open-help", openFromShell);
    return () => window.removeEventListener("rive:open-help", openFromShell);
  }, [guideOpen, minimizeGuide]);

  useEffect(() => () => {
    if (minimizeTimerRef.current) window.clearTimeout(minimizeTimerRef.current);
  }, []);

  const openRecommendedStep = useCallback(() => {
    if (!currentAction) return;
    void recordEvent("step_opened", activeMode, activeGuideId, currentStep?.id);
    const target = targetSelector
      ? Array.from(document.querySelectorAll<HTMLElement>(targetSelector)).at(-1)
      : null;
    const targetPath = new URL(currentAction.href, window.location.href).pathname;
    if (target && targetPath === window.location.pathname) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      // Uploading is intentionally a user-controlled file choice. Point at
      // the drop zone without opening a native file picker on their behalf;
      // the same target id can still represent the explicit commit button in
      // the later plan step.
      const canActivateTarget = target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement;
      if (targetId !== "migration-upload" && canActivateTarget) target.click();
      return;
    }
    // Every href comes from the local guide/action registry; do not accept
    // arbitrary URLs from the server or user input here.
    router.push(currentAction.href, { scroll: false });
  }, [activeGuideId, activeMode, currentAction, currentStep?.id, recordEvent, router, targetId, targetSelector]);

  const helpPanel = helpOpen ? (
    <Portal>
      <div
        ref={helpPanelRef}
        id="help-guides-panel"
        tabIndex={-1}
        className="fixed inset-x-3 bottom-3 z-[70] max-h-[min(40rem,calc(100vh-1.5rem))] w-auto overflow-y-auto rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-overlay outline-none md:bottom-auto md:left-auto md:right-4 md:top-20 md:w-[min(25rem,calc(100vw-2rem))]"
        role="dialog"
        aria-modal="false"
        aria-labelledby="help-guides-title"
        data-testid="help-guides-panel"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="help-guides-title" className="text-sm font-black">Help &amp; guides</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Pick a useful outcome. You can pause, revisit, or restart any guide.</p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close Help & guides" onClick={() => setHelpOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <button
          type="button"
          onClick={resumeGuide}
          aria-label={`Continue where you left off with ${getGuideCatalogItem(resumeGuideId).label}`}
          className="mt-4 w-full rounded-2xl border border-primary/20 bg-primary/5 p-3 text-left transition hover:border-primary/35 hover:bg-primary/10"
          data-testid="guide-resume"
        >
          <span className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 items-start gap-2.5">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-black text-foreground">Continue where you left off</span>
                <span className="mt-1 block text-xs leading-4 text-muted-foreground">{getGuideCatalogItem(resumeGuideId).label}</span>
              </span>
            </span>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-primary" />
          </span>
          {guideProgress[resumeGuideId] && (
            <span className="mt-3 flex items-center justify-between gap-3 text-[11px] font-bold text-muted-foreground">
              <span>{guideStatusLabel(snapshotGuide(resumeGuideId, resumeGuideId === activation?.goal ? activation : null, guideProgress[resumeGuideId]))}</span>
              <span>{snapshotGuide(resumeGuideId, resumeGuideId === activation?.goal ? activation : null, guideProgress[resumeGuideId]).percentage}%</span>
            </span>
          )}
        </button>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">Start with a real outcome</p>
          <span className="text-[11px] font-semibold text-muted-foreground">Nothing changes until you act</span>
        </div>
        <div className="mt-2 grid gap-1.5" role="list">
          {GUIDE_CATALOG.filter((option) => option.id !== "orientation").map((option) => {
            const optionPlan = activation && getGuideGoal(option.id, activation.goal) === activation.goal ? activation : null;
            const optionSnapshot = snapshotGuide(option.id, optionPlan, guideProgress[option.id]);
            return (
              <Button
                key={option.id}
                type="button"
                variant="ghost"
                onClick={() => startGuide(option.id)}
                aria-label={`Start ${option.label}`}
                data-testid={`guide-option-${option.id}`}
                className="h-auto min-h-16 w-full items-start justify-start gap-3 whitespace-normal rounded-xl px-3 py-2.5 text-left hover:text-foreground"
              >
                {optionSnapshot.status === "completed" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <Compass className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="text-xs font-bold leading-4 text-foreground">{option.label}</span>
                    <span className={`text-[10px] font-bold ${optionSnapshot.status === "needs_attention" ? "text-warning" : "text-primary"}`}>{guideStatusLabel(optionSnapshot)}</span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{option.description}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {option.duration}</span>
                    <span>{option.stepCount} {option.stepCount === 1 ? "step" : "steps"}</span>
                    {optionSnapshot.status === "in_progress" && <span>{optionSnapshot.completed}/{optionSnapshot.total} done</span>}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => startGuide("orientation")}
          className="mt-4 flex w-full items-start gap-3 rounded-xl border border-border bg-muted/30 px-3 py-3 text-left transition hover:border-primary/25 hover:bg-muted/60"
          data-testid="guide-option-orientation"
        >
          <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="block text-xs font-bold text-foreground">{getGuideCatalogItem("orientation").label}</span>
            <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{getGuideCatalogItem("orientation").description}</span>
          </span>
        </button>
      </div>
    </Portal>
  ) : null;

  const guidePanel = guideOpen && (!guideCollapsed || guideAnimating) ? (
    <Portal>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="guide-dock-title"
        aria-describedby="guide-dock-description"
        tabIndex={-1}
        data-testid="guide-dock"
        data-guide-state={guideCollapsed ? "collapsed" : "expanded"}
        data-guide-phase={guideAnimating ? "collapsing" : guideCollapsed ? "collapsed" : "expanded"}
        className={`pointer-events-auto fixed bottom-3 right-3 z-[65] max-h-[min(38rem,calc(100vh-5rem))] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-primary/20 bg-popover p-4 text-popover-foreground shadow-overlay outline-none transition-[opacity,transform] duration-[180ms] ease-out motion-reduce:transition-none md:bottom-4 md:right-4 ${guideCollapsed ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-primary">
            <Sparkles className="h-4 w-4 shrink-0" />
            {activeMode === "manual" ? "Guide" : "A useful next step"}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Minimize guide" onClick={minimizeGuide}>
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={activeMode === "automatic" ? "Close guidance" : "Close guide"} onClick={() => closeGuide({ deferAutomatic: activeMode === "automatic" })}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!guidePlan && activeGuideId !== "orientation" ? (
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-muted/50 p-3 text-xs font-semibold text-muted-foreground" data-testid="guide-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            Looking at your workspace and choosing the step that still matters…
          </div>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Connected workflow">
              {selectedGuide.flow.map((item, index) => (
                <span key={`${item}-${index}`} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">{item}</span>
                  {index < selectedGuide.flow.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/60" />}
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-start justify-between gap-3">
              <h2 id="guide-dock-title" className="text-base font-black">
                {currentStep?.label || (guideFinished ? "Guide completed" : selectedGuide.label)}
              </h2>
              {guideFinished && <span className="shrink-0 rounded-full bg-success/10 px-2 py-1 text-[10px] font-bold text-success">Completed</span>}
            </div>
            <p className="mt-1.5 text-xs font-bold leading-5 text-primary">{guidePlan?.goalLabel || selectedGuide.outcome}</p>
            <p id="guide-dock-description" className="mt-1.5 text-xs leading-5 text-muted-foreground">{guideIntro(guidePlan, activeMode, activeGuideId)}</p>

            {guideSnapshot.status === "needs_attention" && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2.5 text-xs font-semibold leading-5 text-warning" role="status">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>This guide was completed before, but the workspace changed. We brought back the step that needs attention.</span>
              </div>
            )}
            {currentStep && !guideFinished && (
              <div className="mt-3 rounded-xl bg-accent px-3 py-2.5" data-testid="guide-next-step">
                <p className="text-[11px] font-black uppercase tracking-[0.1em] text-primary">Step {Math.min(guideSnapshot.completed + 1, guideTotal)} of {guideTotal}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-foreground">{currentStep.description}</p>
              </div>
            )}
            {activeGuideId === "orientation" && !guideFinished && (
              <div className="mt-3 rounded-xl bg-accent px-3 py-2.5">
                <p className="text-[11px] font-black uppercase tracking-[0.1em] text-primary">The connected story</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-foreground">Start with a real client when you are ready. Rive carries that context through the work, money, and proof.</p>
              </div>
            )}
            {guideFinished && !isReviewing && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-xs font-bold leading-5 text-success" role="status">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                <span>All required steps are true in your workspace. You can keep working or review any step again.</span>
              </div>
            )}
            {targetState === "missing" && currentAction && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/5 px-3 py-2.5 text-xs leading-5 text-muted-foreground" data-testid="guide-target-recovery">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <span>This step is not visible on this version of the page yet. The guide is still here — open the full step and continue from there.</span>
              </div>
            )}
            {targetState === "waiting" && currentAction && (
              <p className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground" role="status">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for the step to appear…
              </p>
            )}

            <ol className="mt-4 space-y-1.5" aria-label="Guide steps" data-testid="guide-checklist">
              {selectedGuide.steps.map((step) => {
                const complete = guideSnapshot.completedStepIds.includes(step.id);
                const selected = currentStep?.id === step.id;
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedStepId(step.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition ${selected ? "bg-primary/[0.08] text-foreground" : "text-muted-foreground hover:bg-muted/60"}`}
                    >
                      {complete ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
                      <span className={complete ? "line-through decoration-success/40" : ""}>{step.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => closeGuide({ deferAutomatic: activeMode === "automatic" })} className="text-xs">
                Maybe later
              </Button>
              <div className="flex items-center gap-2">
                {guideFinished && !isReviewing ? (
                  <Button type="button" size="sm" onClick={completeGuide} className="text-xs">Done</Button>
                ) : isReviewing ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedStepId(null)} className="text-xs">Close review</Button>
                ) : activeGuideId === "orientation" ? (
                  <Button type="button" size="sm" onClick={completeGuide} className="text-xs">I understand <ArrowRight className="h-3.5 w-3.5" /></Button>
                ) : currentAction ? (
                  <Button type="button" size="sm" onClick={openRecommendedStep} className="text-xs">{targetState === "missing" ? currentAction.label : "Open step"} <ArrowRight className="h-3.5 w-3.5" /></Button>
                ) : null}
              </div>
            </div>
            {activeMode === "automatic" && (
              <Button type="button" variant="link" size="sm" onClick={() => closeGuide({ dismissAutomatic: true })} className="mt-2 h-auto px-0 text-[11px] font-semibold text-muted-foreground">
                Don&apos;t show automatic guidance again
              </Button>
            )}
          </>
        )}
      </div>
    </Portal>
  ) : null;

  const guideChip = guideOpen && guideCollapsed && !guideAnimating ? (
    <Portal>
      <div className="pointer-events-none fixed bottom-3 right-3 z-[65] md:bottom-4 md:right-4">
        <button
          ref={dockButtonRef}
          type="button"
          onClick={resumeGuide}
          aria-expanded={false}
          aria-label="Expand guide"
          data-testid="guide-dock"
          data-guide-state="collapsed"
          className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-primary/20 bg-popover px-3.5 py-2.5 text-left text-xs font-bold text-foreground shadow-overlay transition-[transform,border-color,background-color] duration-[180ms] hover:-translate-y-px hover:border-primary/40 hover:bg-primary/5"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            {guideFinished ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
          </span>
          <span className="min-w-0 truncate">
            {guideFinished ? `${selectedGuide.label} · completed` : `${selectedGuide.label} · ${Math.min(guideSnapshot.completed, guideTotal)}/${guideTotal}`}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
        </button>
      </div>
    </Portal>
  ) : null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={helpOpen}
        aria-controls="help-guides-panel"
        onClick={() => {
          setHelpOpen((open) => !open);
          if (!helpOpen && guideOpen) minimizeGuide();
        }}
        className="hidden gap-2 text-xs font-semibold text-muted-foreground md:inline-flex"
      >
        <CircleHelp className="h-4 w-4" />
        Help &amp; guides
      </Button>
      {helpPanel}
      {guidePanel}
      {guideChip}
    </>
  );
}

export function openHelpFromMobileShell() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("rive:open-help"));
}

export const ACTIVATION_GUIDE_GOALS = ACTIVATION_GOALS;
export const ACTIVATION_GUIDE_META = ACTIVATION_GOAL_META;
