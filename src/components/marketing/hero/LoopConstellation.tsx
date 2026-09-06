"use client";

import { useEffect, useRef } from "react";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

const STAGES = [
  { id: "client", label: "CLIENT", color: "#2563eb" },
  { id: "work", label: "WORK", color: "#7c3aed" },
  { id: "agreement", label: "AGREEMENT", color: "#0d9488" },
  { id: "invoice", label: "INVOICE", color: "#059669" },
  { id: "proof", label: "PROOF", color: "#d97706" },
] as const;

function resolveThemeColor(hex: string, isDark: boolean) {
  // Desaturate and lighten in dark mode for cinematic subtlety.
  if (!isDark) return hex;
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c * 0.85 + 255 * 0.15);
  return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`;
}

export function LoopConstellation({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = useMarketingReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let isDark = false;
    let visible = true;
    let lastFrame = 0;

    const particles: { stage: number; t: number; speed: number; size: number }[] = [];
    for (let i = 0; i < 24; i += 1) {
      particles.push({
        stage: i % STAGES.length,
        t: Math.random(),
        speed: 0.0006 + Math.random() * 0.0008,
        size: 0.8 + Math.random() * 1.4,
      });
    }

    function resize() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (document.documentElement.classList.contains("dark")) isDark = true;
    }

    function stagePosition(index: number, count: number) {
      const cx = width * 0.5;
      const cy = height * 0.62;
      const radius = Math.min(width, height) * 0.32;
      const sweep = Math.PI * 1.15;
      const start = -Math.PI / 2 - sweep / 2;
      const angle = start + (index / (count - 1)) * sweep;
      return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius * 0.65 };
    }

    function drawStatic() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, width, height);
      const count = STAGES.length;
      const positions = Array.from({ length: count }, (_, i) => stagePosition(i, count));

      // Draw connections.
      ctx.save();
      for (let i = 0; i < count; i += 1) {
        const a = positions[i]!;
        const b = positions[(i + 1) % count]!;
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, resolveThemeColor(STAGES[i]!.color, isDark));
        grad.addColorStop(1, resolveThemeColor(STAGES[(i + 1) % count]!.color, isDark));
        ctx.strokeStyle = grad;
        ctx.globalAlpha = isDark ? 0.22 : 0.18;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();

      // Draw nodes.
      positions.forEach((p, i) => {
        const color = resolveThemeColor(STAGES[i]!.color, isDark);
        ctx.save();
        ctx.globalAlpha = isDark ? 0.9 : 0.85;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = isDark ? 0.2 : 0.16;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    function draw(now: number) {
      if (!canvas || !ctx) return;
      if (!visible || reducedMotion) {
        drawStatic();
        return;
      }
      const dt = Math.min(now - lastFrame, 33);
      lastFrame = now;

      drawStatic();

      const count = STAGES.length;
      const positions = Array.from({ length: count }, (_, i) => stagePosition(i, count));

      // Animate particles along edges.
      ctx.save();
      particles.forEach((particle) => {
        const a = positions[particle.stage]!;
        const b = positions[(particle.stage + 1) % count]!;
        particle.t += particle.speed * (dt / 16);
        if (particle.t >= 1) {
          particle.t = 0;
          particle.stage = (particle.stage + 1) % count;
        }
        const x = a.x + (b.x - a.x) * particle.t;
        const y = a.y + (b.y - a.y) * particle.t;
        const color = resolveThemeColor(STAGES[(particle.stage + 1) % count]!.color, isDark);

        ctx.globalAlpha = isDark ? 0.85 : 0.75;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, particle.size, 0, Math.PI * 2);
        ctx.fill();

        // Trail.
        ctx.globalAlpha = isDark ? 0.18 : 0.14;
        ctx.beginPath();
        ctx.arc(x, y, particle.size * 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      rafId = requestAnimationFrame(draw);
    }

    function onVisibility() {
      visible = document.visibilityState === "visible";
      if (visible && !reducedMotion) {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(draw);
      }
    }

    function onTheme() {
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (document.documentElement.classList.contains("dark")) isDark = true;
    }

    resize();
    const observer = new ResizeObserver(resize);
    if (canvas) observer.observe(canvas);
    window.addEventListener("visibilitychange", onVisibility);
    const darkMq = window.matchMedia("(prefers-color-scheme: dark)");
    darkMq.addEventListener("change", onTheme);
    const mutationObserver = new MutationObserver(onTheme);
    mutationObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("visibilitychange", onVisibility);
      darkMq.removeEventListener("change", onTheme);
      mutationObserver.disconnect();
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="loop-constellation"
      aria-hidden="true"
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
