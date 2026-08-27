"use client";

import type { PortfolioPractice } from "@/utils/portfolio";

/**
 * Tabs across a portfolio's disciplines. Only rendered when there is more
 * than one, so a single-practice portfolio looks exactly as it always has.
 *
 * On the published site, separate-page mode is real navigation: each pill is
 * a link to `/p/{slug}/{practice}`. The studio live preview is a single iframe
 * at `/portfolio-preview` that never has those routes, and the hash targets
 * used in unified mode are not rendered either. Clicking a link there used to
 * do nothing. In preview we keep the same pills but swap the view in place.
 */
export default function PracticeSwitcher({
  practices,
  activeSlug,
  portfolioSlug,
  separate,
  preview = false,
  onSelect,
}: {
  practices: PortfolioPractice[];
  activeSlug?: string;
  portfolioSlug?: string;
  separate: boolean;
  preview?: boolean;
  onSelect?: (slug: string | undefined) => void;
}) {
  const previewSeparate = preview && separate;
  const hrefFor = (slug?: string) => {
    if (!portfolioSlug || !separate) return slug ? `#practice-${slug}` : "#work";
    return slug ? `/p/${portfolioSlug}/${slug}` : `/p/${portfolioSlug}`;
  };
  const pill = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-extrabold transition ${
      active
        ? "border-transparent bg-[var(--portfolio-accent)] text-white shadow-sm"
        : "border-[var(--portfolio-border)] bg-[var(--portfolio-card)] text-[var(--portfolio-ink)] hover:border-[var(--portfolio-accent)]"
    }`;

  const items: { slug?: string; label: string }[] = [
    { slug: undefined, label: "Everything" },
    ...practices.map((practice) => ({ slug: practice.slug, label: practice.name })),
  ];

  return (
    <nav aria-label="Practices" className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = item.slug ? activeSlug === item.slug : !activeSlug;
        const className = pill(active);
        if (previewSeparate) {
          return (
            <button
              key={item.slug ?? "everything"}
              type="button"
              aria-pressed={active}
              className={className}
              onClick={() => onSelect?.(item.slug)}
            >
              {item.label}
            </button>
          );
        }
        return (
          <a key={item.slug ?? "everything"} href={hrefFor(item.slug)} className={className}>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
