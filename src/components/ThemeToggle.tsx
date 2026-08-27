"use client";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const themes = [
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "dark", label: "Dark", Icon: Moon },
  { mode: "system", label: "System", Icon: Monitor },
] as const;

type ThemeMode = (typeof themes)[number]["mode"];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [paneMounted, setPaneMounted] = useState(false);
  const [paneExpanded, setPaneExpanded] = useState(false);
  const [displayedTheme, setDisplayedTheme] = useState<ThemeMode>("system");
  const rootRef = useRef<HTMLDivElement>(null);
  const openFrame = useRef<number | null>(null);
  const closeStartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const activeTheme: ThemeMode = themes.some(({ mode }) => mode === theme)
    ? (theme as ThemeMode)
    : "system";

  useEffect(() => {
    if (!paneMounted) return;

    const closePane = () => {
      setPaneExpanded(false);
      closeEndTimer.current = setTimeout(() => setPaneMounted(false), 360);
    };

    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closePane();
    };
    const dismissWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePane();
    };

    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismissWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismissWithKeyboard);
    };
  }, [paneMounted]);

  useEffect(() => () => {
    if (openFrame.current) cancelAnimationFrame(openFrame.current);
    if (closeStartTimer.current) clearTimeout(closeStartTimer.current);
    if (closeEndTimer.current) clearTimeout(closeEndTimer.current);
  }, []);

  if (!mounted) {
    return <div className="h-7 w-7" aria-hidden="true" />;
  }

  const activeIndex = themes.findIndex(({ mode }) => mode === displayedTheme);
  const ActiveIcon = themes.find(({ mode }) => mode === activeTheme)?.Icon ?? Monitor;
  const collapsedLeft = activeIndex * 32;
  const collapsedRight = 92 - collapsedLeft - 28;
  const collapsedOffset = collapsedRight;

  const clearMotionSchedule = () => {
    if (openFrame.current) cancelAnimationFrame(openFrame.current);
    if (closeStartTimer.current) clearTimeout(closeStartTimer.current);
    if (closeEndTimer.current) clearTimeout(closeEndTimer.current);
  };

  const showOptions = () => {
    clearMotionSchedule();
    setDisplayedTheme(activeTheme);
    setPaneMounted(true);
    setPaneExpanded(false);
    openFrame.current = requestAnimationFrame(() => {
      openFrame.current = requestAnimationFrame(() => setPaneExpanded(true));
    });
  };

  const chooseTheme = (nextTheme: ThemeMode) => {
    clearMotionSchedule();

    if (nextTheme === displayedTheme) {
      setPaneExpanded(false);
      closeEndTimer.current = setTimeout(() => setPaneMounted(false), 360);
      return;
    }

    setDisplayedTheme(nextTheme);
    setTheme(nextTheme);
    closeStartTimer.current = setTimeout(() => setPaneExpanded(false), 360);
    closeEndTimer.current = setTimeout(() => setPaneMounted(false), 720);
  };

  return (
    <div ref={rootRef} className="relative h-7 w-7 shrink-0" data-testid="theme-switcher">
      <Button
        onClick={showOptions}
        variant="ghost"
        size="unstyled"
        className="relative z-0 h-7 w-7 rounded-[11px] border border-border/80 bg-card/80 p-0 text-muted-foreground shadow-sm backdrop-blur-md after:absolute after:-inset-2 after:content-[''] hover:border-primary/25 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring focus-visible:ring-offset-0"
        aria-label={`Theme: ${activeTheme}. Choose theme`}
        aria-haspopup="true"
        aria-expanded={paneExpanded}
        title={`Theme: ${activeTheme}`}
        data-theme-mode={activeTheme}
      >
        <ActiveIcon className="h-3.5 w-3.5" data-testid="theme-current-icon" aria-hidden="true" />
      </Button>

      {paneMounted ? (
        <div
          className="absolute right-0 top-0 z-50 h-7 w-[92px] overflow-hidden rounded-[11px] border border-border/80 bg-card/95 shadow-lg shadow-black/10 backdrop-blur-xl transition-[clip-path,transform,box-shadow] duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            clipPath: paneExpanded
              ? "inset(0 0 0 0 round 11px)"
              : `inset(0 ${collapsedRight}px 0 ${collapsedLeft}px round 11px)`,
            transform: paneExpanded ? "translateX(0)" : `translateX(${collapsedOffset}px)`,
            boxShadow: paneExpanded ? "0 12px 34px rgba(0, 0, 0, 0.22)" : "0 2px 8px rgba(0, 0, 0, 0.1)",
          }}
          role="radiogroup"
          aria-label="Choose color theme"
          data-testid="theme-options"
          data-expanded={paneExpanded}
        >
          <span
            className={cn(
              "pointer-events-none absolute -left-px -top-px h-7 w-7 rounded-[11px] border border-border/80 bg-card/95 shadow-sm transition-opacity duration-150",
              paneExpanded ? "opacity-0" : "opacity-100",
            )}
            style={{ transform: `translateX(${activeIndex * 32}px)` }}
            data-testid="theme-landing-surface"
            aria-hidden="true"
          />
          <span
            className={cn(
              "pointer-events-none absolute -left-px top-[2px] h-[22px] w-[28px] rounded-[9px] border border-primary/25 bg-primary/10 shadow-[0_0_14px_rgba(96,165,250,0.08)] transition-[transform,opacity] duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              paneExpanded ? "opacity-100" : "opacity-0",
            )}
            style={{ transform: `translateX(${activeIndex * 32}px)` }}
            data-testid="theme-indicator"
            aria-hidden="true"
          />
          <div className="relative h-full">
            {themes.map(({ mode, label, Icon }, index) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={displayedTheme === mode}
                aria-label={`${label} theme`}
                title={label}
                onClick={() => chooseTheme(mode)}
                style={{ right: `${(themes.length - index - 1) * 32 - 1}px` }}
                className={cn(
                  "absolute -top-px grid h-7 w-7 place-items-center rounded-[11px] text-muted-foreground transition-[color,opacity] duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring/70",
                  !paneExpanded && displayedTheme !== mode && "opacity-0",
                  displayedTheme === mode && "text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" data-testid={`theme-${mode}-icon`} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
