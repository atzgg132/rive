import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { MarketingCtaPlacement } from "@/lib/domain-vocabulary";

/** The site's one call to action. Every signup link on the v2 site is this
 * component: it reads "Start free", points at /register (the auth overlay
 * intercepts it) and carries its placement for CtaTracker. */
export function StartFree({
  placement,
  size = "md",
  className = "",
  label = "Start free",
  href = "/register",
}: {
  placement: MarketingCtaPlacement;
  size?: "md" | "lg";
  className?: string;
  label?: "Start free";
  href?: "/register" | `/register?${string}`;
}) {
  return (
    <Link
      href={href}
      className={`s-btn ${size === "lg" ? "s-btn--lg" : ""} ${className}`}
      data-cta-placement={placement}
    >
      <span>{label}</span>
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}

export const ASSURANCE = "Free during beta. No credit card required.";
