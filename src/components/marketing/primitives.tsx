import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function GlowingBadge({ children, pulse = false, className }: { children: ReactNode; pulse?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary", className)}>
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.06] to-transparent" />
      {pulse ? <span className="relative h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(37,99,235,0.7)] motion-safe:animate-pulse" /> : null}
      <span className="relative">{children}</span>
    </span>
  );
}

export function NoiseOverlay() {
  return (
    <svg className="marketing-noise pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <filter id="rive-marketing-noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.88" numOctaves="3" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#rive-marketing-noise)" />
    </svg>
  );
}

export function GridField({ className }: { className?: string }) {
  return <div className={cn("marketing-grid-mask pointer-events-none absolute inset-0", className)} aria-hidden="true" />;
}

export function GradientText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("marketing-gradient-text", className)}>{children}</span>;
}

export function VignetteOverlay({ className }: { className?: string }) {
  return <div className={cn("marketing-vignette pointer-events-none absolute inset-0", className)} aria-hidden="true" />;
}

export function HairlineDivider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-gradient-to-r from-transparent via-[var(--stroke-hairline)] to-transparent", className)} aria-hidden="true" />;
}

export function GlassPanel({ children, tier = 2, className }: { children: ReactNode; tier?: 1 | 2 | 3; className?: string }) {
  const tiers = {
    1: "border-[var(--stroke-hairline)] bg-[var(--surface-raised)] shadow-[inset_0_1px_0_var(--stroke-highlight)]",
    2: "border-[var(--stroke-hairline)] bg-[var(--surface-raised)] shadow-[inset_0_1px_0_var(--stroke-highlight)]",
    3: "border-primary/20 bg-gradient-to-br from-[var(--surface-raised)] to-primary/[0.02] shadow-[inset_0_1px_0_var(--stroke-highlight)]",
  };
  return <div className={cn("rounded-3xl border backdrop-blur-sm", tiers[tier], className)}>{children}</div>;
}

export function LogoMarquee({ items, label }: { items: readonly string[]; label: string }) {
  const doubled = [...items, ...items];
  return (
    <div className="marketing-edge-mask overflow-hidden" aria-label={label}>
      <div className="flex w-max motion-safe:animate-marquee motion-reduce:flex-wrap motion-reduce:justify-center">
        {doubled.map((item, index) => (
          <span key={`${item}-${index}`} aria-hidden={index >= items.length} className="mx-7 whitespace-nowrap font-mono text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:mx-10">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function FeatureList({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={cn("grid gap-3", className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
          <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/25"><Check className="h-2.5 w-2.5" aria-hidden="true" /></span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function MarketingButton({ href, children, variant = "primary", className }: { href: string; children: ReactNode; variant?: "primary" | "secondary"; className?: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "marketing-focus inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition duration-200 ease-rive-out hover:-translate-y-0.5",
        variant === "primary"
          ? "bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-[0_12px_34px_rgba(15,18,24,0.22)] hover:shadow-[0_16px_44px_rgba(15,18,24,0.28)] dark:bg-[var(--text-primary)] dark:text-[var(--bg-primary)] dark:shadow-[0_12px_34px_rgba(0,0,0,0.45)]"
          : "border border-[var(--stroke-hairline)] bg-[var(--surface-glass)] text-foreground hover:border-primary/25 hover:bg-foreground/[0.07]",
        className,
      )}
    >
      {children}
    </Link>
  );
}
