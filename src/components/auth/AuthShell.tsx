import type { ReactNode } from "react";
import Link from "next/link";
import RiveLogo from "@/components/RiveLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuroraGlow } from "@/components/marketing/AuroraGlow";
import { GridField, NoiseOverlay } from "@/components/marketing/primitives";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div data-surface="marketing" className="marketing-root relative flex min-h-dvh flex-col overflow-x-clip bg-[var(--surface-void)] text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <GridField />
        <AuroraGlow className="-left-48 -top-40 h-[42rem] w-[42rem]" strength={0.035} />
        <AuroraGlow className="-right-64 top-[38rem] h-[36rem] w-[36rem] opacity-60" strength={-0.025} />
        <NoiseOverlay />
      </div>
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40">
          <RiveLogo height={28} />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col items-center px-5 pb-16 pt-8 sm:justify-center sm:px-8 sm:pb-24 sm:pt-0">
        <div
          data-surface="auth-overlay"
          className="w-full max-w-[26.5rem] rounded-[1.6rem] border border-[var(--stroke-hairline)] bg-[color-mix(in_srgb,var(--surface-raised)_92%,transparent)] p-6 text-foreground shadow-overlay backdrop-blur-2xl sm:-translate-y-8 sm:p-8"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
