"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import Portal from "@/components/ui/Portal";
import {
  ACTIVATION_GOALS,
  ACTIVATION_GOAL_META,
  type ActivationGoal,
  type ActivationPlan,
} from "@/lib/activation";
import {
  GUIDE_CATALOG,
  getGuideCatalogItem,
  getGuideGoal,
  type GuideId,
} from "@/lib/guides";

type GuideMode = "automatic" | "manual";
type GuidanceEvent = "started" | "skipped" | "completed" | "replayed" | "minimized" | "resumed" | "step_opened";

type GuidedExperienceProps = {
  activation: ActivationPlan | null;
  pathname: string;
  onActivationChange: (plan: ActivationPlan) => void;
};

const TARGET_BY_ACTION: Record<string, string> = {
  first_client: "clients-create",
  first_project: "projects-create",
  add_deadline: "projects-deadline",
  create_invoice: "revenue-create",
  send_invoice: "revenue-create",
  add_expense: "expenses-create",
  complete_profile: "portfolio-profile",
  select_project: "portfolio-project",
  publish_portfolio: "portfolio-publish",
  import_work: "activation-primary",
  resolve_import: "activation-primary",
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

const LAST_GUIDE_STORAGE_KEY = "rive:guide:last";
const DEFERRED_GUIDANCE_STORAGE_KEY = "rive:guide:auto-deferred";

function readStoredGuide(): GuideId | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(LAST_GUIDE_STORAGE_KEY);
    return stored && GUIDE_CATALOG.some((guide) => guide.id === stored) ? stored as GuideId : null;
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

function targetIdForPlan(plan: ActivationPlan, pathname: string, guideId: GuideId): string | null {
  if (guideId === "orientation") return null;
  if (pathname === "/dashboard") return plan.recommendedAction ? "activation-primary" : null;
  return plan.recommendedAction ? TARGET_BY_ACTION[plan.recommendedAction.id] || null : null;
}

function guideIntro(plan: ActivationPlan, mode: GuideMode, guideId: GuideId) {
  if (guideId === "orientation") {
    return "Rive keeps the client, the work, the money, and the proof connected so you can spend less time maintaining context.";
  }
  if (plan.activationStage === "activated") {
    return mode === "manual"
      ? "You already have the essentials for this outcome in place. Use the workspace links to keep going."
      : "You reached a useful first outcome. Rive will stay out of the way while you run the work.";
  }
  if (!plan.recommendedAction) return "Rive will keep this guide aligned with the context already in your workspace.";
  return mode === "automatic"
    ? `We will take one useful step at a time toward ${plan.goalLabel.toLowerCase()}.`
    : "This guide adapts to what is already in your workspace and starts at the next useful step.";
}

function guideStepDescription(plan: ActivationPlan): string {
  if (!plan.recommendedAction) return "Your workspace is ready for a quick review.";
  return plan.recommendedAction.description;
}

function optionStatus(
  id: GuideId,
  activeGuideId: GuideId,
  guideOpen: boolean,
  guideFinished: boolean,
  activation: ActivationPlan | null,
): string {
  if (guideOpen && id === activeGuideId) return guideFinished ? "Complete" : "In progress";
  if (activation?.activationStage === "activated" && getGuideGoal(id, activation.goal) === activation.goal) return "Ready to revisit";
  return "Start when useful";
}

export function GuidedExperience({ activation, pathname, onActivationChange }: GuidedExperienceProps) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideCollapsed, setGuideCollapsed] = useState(false);
  const [activeMode, setActiveMode] = useState<GuideMode>("automatic");
  const [activeGuideId, setActiveGuideId] = useState<GuideId>("getting_started");
  const [guidePlan, setGuidePlan] = useState<ActivationPlan | null>(activation);
  const [lastGuideId, setLastGuideId] = useState<GuideId | null>(() => readStoredGuide());
  const [autoDeferred, setAutoDeferred] = useState(() => readDeferredGuidance());
  const dialogRef = useRef<HTMLDivElement>(null);
  const helpPanelRef = useRef<HTMLDivElement>(null);
  const dockButtonRef = useRef<HTMLButtonElement>(null);
  const previousPlanRef = useRef<ActivationPlan | null>(null);
  const previousTargetRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const autoStartedRef = useRef(false);
  const lastEventKeyRef = useRef("");

  const selectedGuide = useMemo(() => getGuideCatalogItem(activeGuideId), [activeGuideId]);
  const currentGoal = getGuideGoal(activeGuideId, activation?.goal);
  const targetId = guidePlan ? targetIdForPlan(guidePlan, pathname, activeGuideId) : null;
  const targetSelector = targetId ? `[data-guide-target="${targetId}"]` : null;
  const guideStep = guidePlan?.completed || 0;
  const guideTotal = guidePlan?.total || selectedGuide.stepCount;
  const guideFinished = Boolean(guidePlan && guidePlan.activationStage === "activated");

  const rememberGuide = useCallback((id: GuideId) => {
    setLastGuideId(id);
    try {
      window.sessionStorage.setItem(LAST_GUIDE_STORAGE_KEY, id);
    } catch {
      // Session storage is an enhancement; guidance must work without it.
    }
  }, []);

  const applyPlan = useCallback((next: ActivationPlan, mode: GuideMode) => {
    const previous = previousPlanRef.current;
    if (previous && next.completed > previous.completed && previous.recommendedAction?.id) {
      const feedback = FEEDBACK_BY_ACTION[previous.recommendedAction.id];
      if (feedback) toast.success(feedback, { id: `activation-feedback-${previous.recommendedAction.id}` });
    }
    previousPlanRef.current = next;
    setGuidePlan(next);
    if (mode === "automatic") onActivationChange(next);
  }, [onActivationChange]);

  const refreshPlan = useCallback(async (goal?: ActivationGoal, mode: GuideMode = activeMode) => {
    const query = goal ? `?goal=${encodeURIComponent(goal)}` : "";
    try {
      const response = await fetch(`/api/activation${query}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success && data.activation) applyPlan(data.activation as ActivationPlan, mode);
    } catch {
      // Guidance is optional. A temporary plan refresh failure must never block the workspace.
    }
  }, [activeMode, applyPlan]);

  const recordEvent = useCallback(async (event: GuidanceEvent, mode: GuideMode, guideIdOverride?: GuideId) => {
    const eventGuideId = guideIdOverride || activeGuideId;
    const eventKey = `${event}:${mode}:${eventGuideId}`;
    if (["started", "minimized", "resumed"].includes(event) && lastEventKeyRef.current === eventKey) return;
    lastEventKeyRef.current = eventKey;
    await fetch("/api/guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, mode, guideId: eventGuideId }),
    }).catch(() => undefined);
  }, [activeGuideId]);

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
    setGuideOpen(false);
    setGuideCollapsed(true);
    setActiveMode("automatic");
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  }, [activation, activeMode, onActivationChange, recordEvent]);

  const minimizeGuide = useCallback(() => {
    setGuideCollapsed(true);
    void recordEvent("minimized", activeMode);
  }, [activeMode, recordEvent]);

  const resumeGuide = useCallback(() => {
    setHelpOpen(false);
    if (!guideOpen) {
      const id = lastGuideId || "getting_started";
      setActiveMode("manual");
      setActiveGuideId(id);
      setGuidePlan(null);
      previousPlanRef.current = null;
      setGuideOpen(true);
      setGuideCollapsed(false);
      void recordEvent("replayed", "manual", id);
      void refreshPlan(getGuideGoal(id, activation?.goal), "manual");
    } else {
      setGuideCollapsed(false);
      void recordEvent("resumed", activeMode);
    }
  }, [activation?.goal, activeMode, guideOpen, lastGuideId, recordEvent, refreshPlan]);

  const startGuide = useCallback((id: GuideId) => {
    const mode: GuideMode = "manual";
    setActiveMode(mode);
    setActiveGuideId(id);
    rememberGuide(id);
    setHelpOpen(false);
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setGuideOpen(true);
    setGuideCollapsed(false);
    setGuidePlan(null);
    previousPlanRef.current = null;
    void recordEvent("replayed", mode, id);
    void refreshPlan(getGuideGoal(id, activation?.goal), mode);
  }, [activation?.goal, recordEvent, refreshPlan, rememberGuide]);

  const completeGuide = useCallback(() => {
    void recordEvent("completed", activeMode);
    if (activeMode === "automatic") {
      if (activation) onActivationChange({ ...activation, guidanceCompleted: true, automaticGuidanceStatus: "completed" });
      window.dispatchEvent(new CustomEvent("rive:guidance-changed", { detail: { status: "completed" } }));
    }
    setGuideOpen(false);
    setGuideCollapsed(true);
    setActiveMode("automatic");
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  }, [activation, activeMode, onActivationChange, recordEvent]);

  useEffect(() => {
    if (!activation || activeMode !== "automatic") return;
    // The plan is an external server snapshot; mirror it before deciding whether auto guidance should open.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setActiveGuideId("getting_started");
      rememberGuide("getting_started");
      setGuideOpen(true);
      // Automatic guidance starts as a small, respectful prompt. The user chooses when to expand it.
      setGuideCollapsed(true);
      autoStartedRef.current = true;
      void recordEvent("started", "automatic", "getting_started");
    }
  }, [activation, activeMode, autoDeferred, guideOpen, pathname, recordEvent, rememberGuide]);

  useEffect(() => {
    if (!guideOpen) return;
    const interval = window.setInterval(() => {
      void refreshPlan(activeMode === "manual" ? currentGoal : undefined, activeMode);
    }, 2500);
    return () => window.clearInterval(interval);
  }, [activeMode, currentGoal, guideOpen, refreshPlan]);

  useEffect(() => {
    const clearHighlight = () => {
      if (previousTargetRef.current) previousTargetRef.current.removeAttribute("data-guide-highlight");
      previousTargetRef.current = null;
    };
    if (!guideOpen || guideCollapsed || !targetSelector) {
      clearHighlight();
      return;
    }
    const updateHighlight = () => {
      const element = Array.from(document.querySelectorAll<HTMLElement>(targetSelector)).at(-1) || null;
      if (previousTargetRef.current && previousTargetRef.current !== element) {
        previousTargetRef.current.removeAttribute("data-guide-highlight");
      }
      if (element) element.setAttribute("data-guide-highlight", "true");
      previousTargetRef.current = element;
    };
    updateHighlight();
    const retry = window.setTimeout(updateHighlight, 250);
    window.addEventListener("resize", updateHighlight);
    return () => {
      window.clearTimeout(retry);
      window.removeEventListener("resize", updateHighlight);
      clearHighlight();
    };
  }, [guideCollapsed, guideOpen, pathname, targetSelector, guidePlan]);

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
      if (guideOpen) setGuideCollapsed(true);
    };
    window.addEventListener("rive:open-help", openFromShell);
    return () => window.removeEventListener("rive:open-help", openFromShell);
  }, [guideOpen]);

  const openRecommendedStep = useCallback(() => {
    const href = guidePlan?.recommendedAction?.href;
    if (!href) return;
    void recordEvent("step_opened", activeMode);
    const target = targetSelector
      ? Array.from(document.querySelectorAll<HTMLElement>(targetSelector)).at(-1)
      : null;
    const targetPath = new URL(href, window.location.href).pathname;
    if (target && targetPath === window.location.pathname) {
      target.click();
      return;
    }
    router.push(href);
  }, [activeMode, guidePlan?.recommendedAction?.href, recordEvent, router, targetSelector]);

  const resumeLabel = guidePlan && guideOpen
    ? guideFinished ? "Review your completed guide" : `Resume ${selectedGuide.label}`
    : lastGuideId ? `Resume ${getGuideCatalogItem(lastGuideId).label}` : "Start with your next useful step";

  const helpPanel = helpOpen ? (
    <Portal>
      <div
        ref={helpPanelRef}
        id="help-guides-panel"
        tabIndex={-1}
        className="fixed inset-x-3 bottom-3 z-[70] max-h-[min(38rem,calc(100vh-1.5rem))] w-auto overflow-y-auto rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-overlay outline-none md:bottom-auto md:left-auto md:right-4 md:top-20 md:w-[min(24rem,calc(100vw-2rem))]"
        role="dialog"
        aria-modal="false"
        aria-labelledby="help-guides-title"
        data-testid="help-guides-panel"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="help-guides-title" className="text-sm font-black">Help &amp; guides</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">What would you like to make easier today?</p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close Help & guides" onClick={() => setHelpOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <button
          type="button"
          onClick={resumeGuide}
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
                <span className="mt-1 block text-xs leading-4 text-muted-foreground">{resumeLabel}</span>
              </span>
            </span>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-primary" />
          </span>
          {guidePlan && (
            <span className="mt-3 flex items-center justify-between gap-3 text-[11px] font-bold text-muted-foreground">
              <span>{Math.min(guideStep, guideTotal)} of {guideTotal} steps complete</span>
              <span>{guidePlan.percentage}%</span>
            </span>
          )}
        </button>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">Start with a real outcome</p>
          <span className="text-[11px] font-semibold text-muted-foreground">Nothing changes until you act</span>
        </div>
        <div className="mt-2 grid gap-1.5" role="list">
          {GUIDE_CATALOG.filter((option) => option.id !== "orientation").map((option) => {
            const optionPlan = activation && option.goal === activation.goal ? activation : null;
            const status = optionStatus(option.id, activeGuideId, guideOpen, guideFinished, activation);
            return (
              <Button
                key={option.id}
                type="button"
                variant="ghost"
                onClick={() => startGuide(option.id)}
                data-testid={`guide-option-${option.id}`}
                className="h-auto min-h-16 w-full items-start justify-start gap-3 whitespace-normal rounded-xl px-3 py-2.5 text-left hover:text-foreground"
              >
                <Compass className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="text-xs font-bold leading-4 text-foreground">{option.label}</span>
                    <span className="text-[10px] font-bold text-primary">{status}</span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{option.description}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {option.duration}</span>
                    <span>{option.stepCount} {option.stepCount === 1 ? "step" : "steps"}</span>
                    {optionPlan && <span>{optionPlan.completed}/{optionPlan.total} for your goal</span>}
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

  const guidePanel = guideOpen && !guideCollapsed ? (
    <Portal>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="guide-dock-title"
        aria-describedby="guide-dock-description"
        tabIndex={-1}
        data-testid="guide-dock"
        data-guide-state="expanded"
        className="pointer-events-auto fixed bottom-3 right-3 z-[65] max-h-[min(32rem,calc(100vh-5rem))] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-primary/20 bg-popover p-4 text-popover-foreground shadow-overlay outline-none motion-reduce:transition-none md:bottom-4 md:right-4"
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

        {!guidePlan ? (
          <div className="mt-5 rounded-xl bg-muted/50 p-3 text-xs font-semibold text-muted-foreground" data-testid="guide-loading">
            Looking at your workspace and choosing the next useful step…
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
            <h2 id="guide-dock-title" className="mt-4 text-base font-black">
              {guideFinished ? "You are ready to run with it" : activeGuideId === "orientation" ? selectedGuide.label : (guidePlan.recommendedAction?.label || selectedGuide.label || guidePlan.goalLabel)}
            </h2>
            <p className="mt-1.5 text-xs font-bold leading-5 text-primary">{guidePlan.goalLabel}: {guidePlan.outcome}</p>
            <p id="guide-dock-description" className="mt-1.5 text-xs leading-5 text-muted-foreground">{guideIntro(guidePlan, activeMode, activeGuideId)}</p>

            {activeGuideId === "orientation" && !guideFinished && (
              <div className="mt-3 rounded-xl bg-accent px-3 py-2.5">
                <p className="text-[11px] font-black uppercase tracking-[0.1em] text-primary">The connected story</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-foreground">Start with a real client when you are ready. Rive will carry that context through the work, money, and proof.</p>
              </div>
            )}
            {activeGuideId !== "orientation" && !guideFinished && guidePlan.recommendedAction && (
              <div className="mt-3 rounded-xl bg-accent px-3 py-2.5" data-testid="guide-next-step">
                <p className="text-[11px] font-black uppercase tracking-[0.1em] text-primary">Step {Math.min(guideStep + 1, guideTotal)} of {guideTotal}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-foreground">{guideStepDescription(guidePlan)}</p>
              </div>
            )}
            {guideFinished && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-xs font-bold leading-5 text-success" role="status">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Meaningful first outcome reached. You can keep working; this guide will stay out of the way.</span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => closeGuide({ deferAutomatic: activeMode === "automatic" })} className="text-xs">
                Maybe later
              </Button>
              <div className="flex items-center gap-2">
                {guideFinished ? (
                  <Button type="button" size="sm" onClick={completeGuide} className="text-xs">Done</Button>
                ) : activeGuideId === "orientation" ? (
                  <Button type="button" size="sm" onClick={() => startGuide(activation?.goal || "organize")} className="text-xs">Start with my next step <ArrowRight className="h-3.5 w-3.5" /></Button>
                ) : guidePlan.recommendedAction ? (
                  <Button type="button" size="sm" onClick={openRecommendedStep} className="text-xs">Open step <ArrowRight className="h-3.5 w-3.5" /></Button>
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

  const guideChip = guideOpen && guideCollapsed ? (
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
          className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-primary/20 bg-popover px-3.5 py-2.5 text-left text-xs font-bold text-foreground shadow-overlay transition hover:border-primary/40 hover:bg-primary/5"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            {guideFinished ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
          </span>
          <span className="min-w-0 truncate">
            {guideFinished ? "Your first useful outcome is ready" : `${selectedGuide.label} · ${Math.min(guideStep, guideTotal)}/${guideTotal}`}
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
          if (!helpOpen && guideOpen) setGuideCollapsed(true);
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
