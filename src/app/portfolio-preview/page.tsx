"use client";

import { useEffect, useState } from "react";
import PortfolioRenderer from "@/components/portfolio/PortfolioRenderer";
import {
  DEFAULT_PORTFOLIO_CONTENT,
  DEFAULT_PORTFOLIO_THEME,
  getVisiblePractices,
  mergePortfolioContent,
  type PortfolioContent,
  type PortfolioTheme,
} from "@/utils/portfolio";

type PreviewPayload = {
  content: PortfolioContent;
  theme: PortfolioTheme;
  templateKey: string;
};

function isPreviewPayload(value: unknown): value is PreviewPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<PreviewPayload>;
  return Boolean(payload.content && payload.theme && typeof payload.templateKey === "string");
}

export default function PortfolioPreviewPage() {
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [activePracticeSlug, setActivePracticeSlug] = useState<string | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/portfolio", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the portfolio preview.");
        return response.json();
      })
      .then((data) => {
        if (!data.portfolio) return;
        setPreview({
          content: mergePortfolioContent(data.portfolio.content),
          theme: { ...DEFAULT_PORTFOLIO_THEME, ...(data.portfolio.theme || {}) },
          templateKey: data.portfolio.templateKey || "minimal-pro",
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPreview({
          content: DEFAULT_PORTFOLIO_CONTENT,
          theme: DEFAULT_PORTFOLIO_THEME,
          templateKey: "minimal-pro",
        });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const receivePreview = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const message = event.data as { type?: unknown; payload?: unknown };
      if (message?.type !== "rive:portfolio-preview" || !isPreviewPayload(message.payload)) return;
      setPreview({
        content: mergePortfolioContent(message.payload.content),
        theme: { ...DEFAULT_PORTFOLIO_THEME, ...message.payload.theme },
        templateKey: message.payload.templateKey,
      });
    };
    window.addEventListener("message", receivePreview);
    return () => window.removeEventListener("message", receivePreview);
  }, []);

  useEffect(() => {
    if (!preview || !activePracticeSlug) return;
    const stillVisible = getVisiblePractices(preview.content).some((practice) => practice.slug === activePracticeSlug);
    if (!stillVisible) setActivePracticeSlug(undefined);
  }, [preview, activePracticeSlug]);

  const choosePractice = (slug: string | undefined) => {
    setActivePracticeSlug(slug);
    window.scrollTo(0, 0);
  };

  if (!preview) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-semibold text-slate-500">Loading portfolio preview…</div>;
  }

  return (
    <PortfolioRenderer
      {...preview}
      preview
      activePracticeSlug={activePracticeSlug}
      onSelectPractice={choosePractice}
    />
  );
}
