import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type RecordMark = "circle" | "square" | "triangle" | "diamond" | "semi";

/** Geometric department mark — the institution's only ornament. */
export function InstMark({ mark, accent = false, className }: { mark: RecordMark; accent?: boolean; className?: string }) {
  return <span aria-hidden="true" className={cn("inst-mark", `inst-mark--${mark}`, accent && "inst-mark--accent", className)} />;
}

/** Department rule — the heavy 2px rule carrying section signage. */
export function DeptRule({ index, name, note, className }: { index: string; name: string; note?: string; className?: string }) {
  return (
    <div className={cn("inst-dept", className)}>
      <span className="inst-mono">Dept. {index} — {name}</span>
      {note ? <span className="inst-mono">{note}</span> : null}
    </div>
  );
}

/** One row of the specification register: capability, its name, and the
 * honest detail (limits rendered in blue ink via <em>). */
export function RegisterRow({ term, name, detail }: { term: ReactNode; name: ReactNode; detail: ReactNode }) {
  return (
    <div className="inst-register__row">
      <span className="inst-mono">{term}</span>
      <span className="inst-register__name">{name}</span>
      <span className="inst-register__detail">{detail}</span>
    </div>
  );
}

export function MarketingButton({ href, children, variant = "primary", className }: { href: string; children: ReactNode; variant?: "primary" | "ghost" | "secondary"; className?: string }) {
  return (
    <Link href={href} className={cn("marketing-focus inst-btn", variant !== "primary" && "inst-btn--ghost", className)}>
      <span>{children}</span><ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

export function MarketingLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("marketing-focus inst-link", className)}>
      <span>{children}</span><ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

/* ── Legacy exports kept for unmigrated pages and the internal _lab. They
   render the institutional equivalent (or nothing) so secondary routes keep
   compiling while Stage 3 rewrites them. ─────────────────────────────── */

export function EditorialLabel({ children, inverse = false, className }: { children: ReactNode; inverse?: boolean; className?: string }) {
  return <span className={cn("inst-mono", inverse && "text-[var(--inst-soft-on-ink)]", className)}>{children}</span>;
}

export function GlowingBadge({ children, className }: { children: ReactNode; pulse?: boolean; className?: string }) {
  return <EditorialLabel className={className}>{children}</EditorialLabel>;
}

export function NoiseOverlay() {
  return null;
}

export function GridField() {
  return null;
}

export function GradientText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={className}>{children}</span>;
}

export function HairlineDivider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-[var(--inst-hairline)]", className)} aria-hidden="true" />;
}

export function GlassPanel({ children, className }: { children: ReactNode; tier?: 1 | 2 | 3; className?: string }) {
  return <div className={cn("inst-plate", className)}>{children}</div>;
}

export function LogoMarquee({ items, label }: { items: readonly string[]; label: string }) {
  return (
    <div aria-label={label} className="flex flex-wrap gap-x-8 gap-y-3">
      {items.map((item) => <span key={item} className="inst-mono">{item}</span>)}
    </div>
  );
}

export function FeatureList({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={cn("inst-admit__list", className)}>
      {items.map((item, index) => (
        <li key={item}><span className="inst-mono">{String(index + 1).padStart(2, "0")}</span>{item}</li>
      ))}
    </ul>
  );
}
