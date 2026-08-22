"use client";

import { Button } from "@/components/ui";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const themeOrder = ["light", "dark", "system"] as const;
type ThemeMode = (typeof themeOrder)[number];

const themeIcons = {
  // Keep the established light/dark action glyphs so explicit dashboard
  // themes retain their visual baseline. System gets its own current-state
  // glyph because it follows the operating system rather than a fixed palette.
  light: Moon,
  dark: Sun,
  system: Monitor,
} satisfies Record<ThemeMode, typeof Sun>;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-9 w-9" aria-hidden="true" />; // placeholder to prevent layout shift
  }

  const activeTheme: ThemeMode = themeOrder.includes(theme as ThemeMode)
    ? (theme as ThemeMode)
    : "system";
  const nextTheme = themeOrder[(themeOrder.indexOf(activeTheme) + 1) % themeOrder.length];
  const Icon = themeIcons[activeTheme];

  return (
    <Button
      onClick={() => setTheme(nextTheme)}
      variant="ghost"
      size="icon-sm"
      className="rounded-xl border border-border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
      aria-label={`Theme: ${activeTheme}. Switch to ${nextTheme}`}
      title={`Theme: ${activeTheme}`}
      data-theme-mode={activeTheme}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
