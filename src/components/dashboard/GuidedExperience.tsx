"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleHelp, Compass, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import Portal from "@/components/ui/Portal";
import {
  ACTIVATION_GOALS,
  ACTIVATION_GOAL_META,
  type ActivationGoal,
  type ActivationPlan,
} from "@/lib/activation";

type GuideId = "getting_started" | "calendar" | ActivationGoal;
type GuideMode = "automatic" | "manual";

type GuidedExperienceProps = {
  activation: ActivationPlan | null;
  pathname: string;
  onActivationChange: (plan: ActivationPlan) => void;
};

const GUIDE_OPTIONS: Array<{ id: GuideId; label: string; description: string; goal?: ActivationGoal }> = [
  { id: "getting_started", label: "Getting started with Rive", description: "A short, workspace-aware first run." },
  { id: "organize", label: "Organize clients & projects", description: "Connect relationships, delivery, and deadlines.", goal: "organize" },
  { id: "calendar", label: "Calendar & scheduling", description: "See deadlines and scheduled work together.", goal: "organize" },
  { id: "get_paid", label: "Invoices & revenue", description: "Move from active work to a sendable invoice.", goal: "get_paid" },
  { id: "understand_finances", label: "Expenses & profitability", description: "Build a useful financial picture without fake data.", goal: "understand_finances" },
  { id: "publish_portfolio", label: "Build your portfolio", description: "Turn selected work into public proof.", goal: "publish_portfolio" },
  { id: "migrate", label: "Import existing business data", description: "Preview, confirm, and review what came across.", goal: "migrate" },
];

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

function getGuideGoal(id: GuideId, current: ActivationPlan | null): ActivationGoal {
  if (id === "getting_started") return current?.goal || "organize";
  if (id === "calendar") return "organize";
  return id;
}

function targetIdForPlan(plan: ActivationPlan, pathname: string): string | null {
  if (pathname === "/dashboard") return plan.recommendedAction ? "activation-primary" : null;
  return plan.recommendedAction ? TARGET_BY_ACTION[plan.recommendedAction.id] || null : null;
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

function guideIntro(plan: ActivationPlan, mode: GuideMode) {
  if (plan.activationStage === "activated") {
    return mode === "manual"
      ? "You already have the essentials for this outcome in place. Use the workspace links to keep going."
      : "You reached a useful first outcome. Rive will stay out of the way while you run the work.";
  }
  if (!plan.recommendedAction) return "Rive will keep this guide aligned with the context already in your workspace.";
  return mode === "automatic"
    ? `We will take one useful step at a time toward ${plan.goalLabel.toLowerCase()}.`
    : `This guide adapts to what is already in your workspace and starts at the next useful step.`;
}

export function GuidedExperience({ activation, pathname, onActivationChange }: GuidedExperienceProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<GuideMode>("automatic");
  const [activeGuideId, setActiveGuideId] = useState<GuideId>("getting_started");
  const [guidePlan, setGuidePlan] = useState<ActivationPlan | null>(activation);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [mobile, setMobile] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const helpPanelRef = useRef<HTMLDivElement>(null);
  const [helpHoverReady, setHelpHoverReady] = useState(false);
  const previousPlanRef = useRef<ActivationPlan | null>(null);
  const previousTargetRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const autoWasOpenRef = useRef(false);
  const lastEventKeyRef = useRef("");

  const currentGoal = getGuideGoal(activeGuideId, activation);
  const targetId = guidePlan ? targetIdForPlan(guidePlan, pathname) : null;
  const targetSelector = targetId ? `[data-guide-target="${targetId}"]` : null;

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

  const recordEvent = useCallback(async (event: "started" | "skipped" | "completed" | "replayed", mode: GuideMode, guideIdOverride?: GuideId) => {
    const eventGuideId = guideIdOverride || activeGuideId;
    const eventKey = `${event}:${mode}:${eventGuideId}`;
    if (event === "started" && lastEventKeyRef.current === eventKey) return;
    lastEventKeyRef.current = eventKey;
    await fetch("/api/guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, mode, guideId: eventGuideId }),
    }).catch(() => undefined);
  }, [activeGuideId]);

  const closeGuide = useCallback((dismissAutomatic: boolean) => {
    if (dismissAutomatic && activeMode === "automatic") {
      void recordEvent("skipped", "automatic");
      if (activation) onActivationChange({ ...activation, guidanceDismissed: true, automaticGuidanceStatus: "dismissed" });
      window.dispatchEvent(new CustomEvent("rive:guidance-changed", { detail: { status: "dismissed" } }));
    }
    setGuideOpen(false);
    if (activeMode === "automatic") autoWasOpenRef.current = false;
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  }, [activation, activeMode, onActivationChange, recordEvent]);

  const startGuide = useCallback((id: GuideId) => {
    const mode: GuideMode = "manual";
    setActiveMode(mode);
    setActiveGuideId(id);
    setHelpOpen(false);
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setGuideOpen(true);
    setGuidePlan(null);
    previousPlanRef.current = null;
    void recordEvent("replayed", mode, id);
    void refreshPlan(getGuideGoal(id, activation), mode);
  }, [activation, recordEvent, refreshPlan]);

  const completeGuide = useCallback(() => {
    if (activeMode === "automatic") {
      void recordEvent("completed", "automatic");
      if (activation) onActivationChange({ ...activation, guidanceCompleted: true, automaticGuidanceStatus: "completed" });
      window.dispatchEvent(new CustomEvent("rive:guidance-changed", { detail: { status: "completed" } }));
    }
    setGuideOpen(false);
    autoWasOpenRef.current = false;
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  }, [activation, activeMode, onActivationChange, recordEvent]);

  useEffect(() => {
    if (!activation) return;
    if (activeMode === "automatic" && !guideOpen) {
      // The plan is an external server snapshot; mirror it before deciding whether auto guidance should open.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGuidePlan(activation);
      previousPlanRef.current = activation;
      if (activation.automaticGuidanceStatus === "available" && activation.activationStage !== "activated") {
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setActiveGuideId("getting_started");
        setGuideOpen(true);
        autoWasOpenRef.current = true;
        void recordEvent("started", "automatic");
      }
    } else if (activeMode === "automatic") {
      if (activation.guidanceDismissed && guideOpen) {
        // A dismissal can arrive from the activation card while the non-modal guide is open.
        setGuideOpen(false);
        autoWasOpenRef.current = false;
        return;
      }
      applyPlan(activation, "automatic");
    }
  }, [activation, activeMode, applyPlan, guideOpen, recordEvent]);

  useEffect(() => {
    if (!guideOpen) return;
    const interval = window.setInterval(() => {
      void refreshPlan(activeMode === "manual" ? currentGoal : undefined, activeMode);
    }, 2500);
    return () => window.clearInterval(interval);
  }, [activeMode, currentGoal, guideOpen, pathname, refreshPlan]);

  useEffect(() => {
    if (!guideOpen) return;
    const updatePosition = () => {
      const nextMobile = isMobileViewport();
      setMobile(nextMobile);
      const candidates = targetSelector ? Array.from(document.querySelectorAll<HTMLElement>(targetSelector)) : [];
      const element = candidates[candidates.length - 1] || null;
      if (element && nextMobile) element.scrollIntoView({
        block: pathname === "/dashboard" ? "nearest" : "center",
        inline: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
      setAnchorRect(element?.getBoundingClientRect() || null);
      if (previousTargetRef.current && previousTargetRef.current !== element) {
        previousTargetRef.current.removeAttribute("data-guide-highlight");
      }
      if (element) element.setAttribute("data-guide-highlight", "true");
      previousTargetRef.current = element;
    };
    updatePosition();
    const retryPosition = window.setInterval(updatePosition, 300);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.clearInterval(retryPosition);
      if (previousTargetRef.current) previousTargetRef.current.removeAttribute("data-guide-highlight");
      previousTargetRef.current = null;
    };
  }, [guideOpen, pathname, targetSelector, guidePlan]);

  useEffect(() => {
    if (!guideOpen && !helpOpen) return;
    const timer = window.setTimeout(() => {
      if (guideOpen) dialogRef.current?.focus();
      else helpPanelRef.current?.focus();
    }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (guideOpen) closeGuide(activeMode === "automatic");
        else setHelpOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeMode, closeGuide, guideOpen, helpOpen]);

  useEffect(() => {
    const openFromShell = () => {
      setHelpHoverReady(false);
      setHelpOpen(true);
    };
    window.addEventListener("rive:open-help", openFromShell);
    return () => window.removeEventListener("rive:open-help", openFromShell);
  }, []);

  const selectedGuide = useMemo(() => GUIDE_OPTIONS.find((option) => option.id === activeGuideId), [activeGuideId]);
  const guideStep = guidePlan?.completed || 0;
  const guideTotal = guidePlan?.total || 0;
  const guideFinished = Boolean(guidePlan && guidePlan.activationStage === "activated");
  const openRecommendedStep = useCallback(() => {
    const href = guidePlan?.recommendedAction?.href;
    if (!href) return;
    const target = targetSelector
      ? Array.from(document.querySelectorAll<HTMLElement>(targetSelector)).at(-1)
      : null;
    const targetPath = new URL(href, window.location.href).pathname;
    if (target && targetPath === window.location.pathname) {
      target.click();
      return;
    }
    window.location.assign(href);
  }, [guidePlan?.recommendedAction?.href, targetSelector]);
  const popoverStyle = useMemo(() => {
    if (mobile) return undefined;
    const width = 340;
    if (!anchorRect) return { left: 12, top: 88, width };
    const left = Math.max(12, Math.min(anchorRect.left, window.innerWidth - width - 12));
    const below = anchorRect.bottom + 14;
    const top = below + 250 < window.innerHeight ? below : Math.max(12, anchorRect.top - 264);
    return { left, top, width };
  }, [anchorRect, mobile]);

  const helpPanel = helpOpen ? (
    <Portal>
      <div
        ref={helpPanelRef}
        id="help-guides-panel"
        tabIndex={-1}
        className="fixed inset-x-3 bottom-3 z-[70] w-auto rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-overlay outline-none md:bottom-auto md:left-auto md:right-4 md:top-20 md:w-80"
        role="dialog"
        aria-labelledby="help-guides-title"
        data-testid="help-guides-panel"
        onPointerMove={() => { if (!helpHoverReady) setHelpHoverReady(true); }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="help-guides-title" className="text-sm font-black">Help &amp; guides</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Replay a short guide whenever you need it. Your workspace stays unchanged.</p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close Help & guides" onClick={() => setHelpOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-3 grid gap-1" role="list">
          {GUIDE_OPTIONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant="ghost"
              onClick={() => startGuide(option.id)}
              className={`h-auto min-h-11 w-full items-start justify-start gap-3 whitespace-normal rounded-xl px-3 py-2.5 text-left hover:text-foreground ${helpHoverReady ? "hover:bg-muted/70" : "hover:bg-transparent"}`}
            >
              <Compass className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block text-xs font-bold leading-4 text-foreground">{option.label}</span>
                <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{option.description}</span>
              </span>
            </Button>
          ))}
        </div>
      </div>
    </Portal>
  ) : null;

  const guidePopover = guideOpen && guidePlan ? (
    <Portal>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="guide-popover-title"
        aria-describedby="guide-popover-description"
        tabIndex={-1}
        data-testid="guide-popover"
        className={`pointer-events-none fixed z-[65] rounded-2xl border border-primary/25 bg-popover p-4 text-popover-foreground shadow-overlay outline-none motion-reduce:transition-none ${mobile ? "bottom-3 left-3 right-3 pb-14" : ""}`}
        style={popoverStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-primary">
            <CircleHelp className="h-4 w-4 shrink-0" />
            {activeMode === "manual" ? "Guide" : "A useful next step"}
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={activeMode === "automatic" ? "Close guidance" : "Close guide"} onClick={() => closeGuide(activeMode === "automatic")}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <h2 id="guide-popover-title" className="mt-3 text-base font-black">{guideFinished ? "You are ready to run with it" : (guidePlan.recommendedAction?.label || selectedGuide?.label || guidePlan.goalLabel)}</h2>
        <p className="mt-1.5 text-xs font-semibold leading-5 text-primary">{guidePlan.goalLabel}: {guidePlan.outcome}</p>
        <p id="guide-popover-description" className="mt-1.5 text-xs leading-5 text-muted-foreground">{guideFinished ? guideIntro(guidePlan, activeMode) : (guidePlan.recommendedAction?.description || guideIntro(guidePlan, activeMode))}</p>
        {!guideFinished && guidePlan.recommendedAction && (
          <p className="mt-3 rounded-xl bg-accent px-3 py-2.5 text-xs font-semibold leading-5 text-foreground">This is step {Math.min(guideStep + 1, guideTotal)} of {guideTotal}. Complete it in the workspace, then Rive will point you to what comes next.</p>
        )}
        {guideFinished && <div className="mt-3 flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-xs font-bold text-success"><Check className="h-4 w-4" /> Meaningful first outcome reached.</div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => closeGuide(activeMode === "automatic")} className="text-xs">{activeMode === "automatic" ? "Skip" : "Close"}</Button>
          <div className="flex items-center gap-2">
            {activeMode === "manual" && guidePlan.recommendedAction && <Button type="button" variant="ghost" size="sm" onClick={() => void refreshPlan(currentGoal, "manual")} className="text-xs"><ArrowLeft className="h-3.5 w-3.5" /> Refresh</Button>}
            {guideFinished ? <Button type="button" size="sm" onClick={completeGuide} className="text-xs">Done</Button> : guidePlan.recommendedAction ? <Button type="button" size="sm" onClick={openRecommendedStep} className="text-xs">Open step <ArrowRight className="h-3.5 w-3.5" /></Button> : null}
          </div>
        </div>
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
          setHelpHoverReady(false);
          setHelpOpen((open) => !open);
        }}
        className="hidden gap-2 text-xs font-semibold text-muted-foreground md:inline-flex"
      >
        <CircleHelp className="h-4 w-4" />
        Help &amp; guides
      </Button>
      {helpPanel}
      {guidePopover}
    </>
  );
}

export function openHelpFromMobileShell() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("rive:open-help"));
}

export const ACTIVATION_GUIDE_GOALS = ACTIVATION_GOALS;
export const ACTIVATION_GUIDE_META = ACTIVATION_GOAL_META;
