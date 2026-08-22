"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

export function CodeSnippetBlock({ code, label, language, typewriter = false, className }: { code: string; label: string; language?: string; typewriter?: boolean; className?: string }) {
  const reduceMotion = useMarketingReducedMotion();
  const [copied, setCopied] = useState(false);
  const [visibleCharacters, setVisibleCharacters] = useState(typewriter && !reduceMotion ? 0 : code.length);

  useEffect(() => {
    if (reduceMotion && visibleCharacters < code.length) {
      const timeout = window.setTimeout(() => setVisibleCharacters(code.length), 0);
      return () => window.clearTimeout(timeout);
    }
    if (!typewriter || visibleCharacters >= code.length) return;
    const timeout = window.setTimeout(() => setVisibleCharacters((count) => Math.min(code.length, count + 3)), 18);
    return () => window.clearTimeout(timeout);
  }, [code.length, reduceMotion, typewriter, visibleCharacters]);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-white/10 bg-[#070a11] shadow-2xl shadow-black/30", className)}>
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-2 truncate font-mono text-[0.66rem] uppercase tracking-[0.14em] text-slate-400">{label}{language ? ` · ${language}` : ""}</span>
        <button type="button" onClick={() => void copy()} className="marketing-focus ml-auto grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-200" aria-label={copied ? "Copied" : `Copy ${label}`}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="max-w-full overflow-x-auto p-5 font-mono text-xs leading-6 text-blue-100"><code>{code.slice(0, visibleCharacters)}{visibleCharacters < code.length ? <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-cyan-300 align-middle" /> : null}</code></pre>
    </div>
  );
}
