import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function EditorialLabel({ children, inverse = false, className }: { children: ReactNode; inverse?: boolean; className?: string }) {
  return <span className={cn("edition-kicker", inverse && "edition-kicker--inverse", className)}>{children}</span>;
}

export function GlowingBadge({ children, className }: { children: ReactNode; pulse?: boolean; className?: string }) {
  return <EditorialLabel className={className}>{children}</EditorialLabel>;
}

export function NoiseOverlay() {
  return (
    <svg className="marketing-noise pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <filter id="rive-marketing-noise"><feTurbulence type="fractalNoise" baseFrequency="0.88" numOctaves="3" stitchTiles="stitch" /></filter>
      <rect width="100%" height="100%" filter="url(#rive-marketing-noise)" />
    </svg>
  );
}

export function GridField({ className }: { className?: string }) {
  return <div className={cn("marketing-grid-mask pointer-events-none absolute inset-0", className)} aria-hidden="true" />;
}

export function GradientText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={className}>{children}</span>;
}

export function HairlineDivider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-[var(--edition-line)]", className)} aria-hidden="true" />;
}

export function GlassPanel({ children, className }: { children: ReactNode; tier?: 1 | 2 | 3; className?: string }) {
  return <div className={cn("edition-panel", className)}>{children}</div>;
}

export function LogoMarquee({ items, label }: { items: readonly string[]; label: string }) {
  return <div aria-label={label} className="flex flex-wrap gap-x-8 gap-y-3">{items.map((item) => <span key={item} className="edition-kicker">{item}</span>)}</div>;
}

export function FeatureList({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={cn("grid gap-3", className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-base leading-7 text-[var(--edition-muted)]">
          <span className="mt-1.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--edition-blue)] text-white"><Check className="h-2.5 w-2.5" aria-hidden="true" /></span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function MarketingButton({ href, children, variant = "primary", className }: { href: string; children: ReactNode; variant?: "primary" | "secondary"; className?: string }) {
  return (
    <Link href={href} className={cn("marketing-focus edition-button", variant === "primary" ? "edition-button--primary" : "edition-button--ghost", className)}>
      <span>{children}</span><ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
