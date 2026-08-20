"use client";

import { Button } from "@/components/ui";
import PageShell from "@/components/PageShell";
import Link from "next/link";
import { useRouter } from "next/navigation";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

export default function BlogPage() {
  const router = useRouter();

  return (
    <PageShell>
      <section className="relative py-24 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[400px] h-[300px] bg-blue-100/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/40 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-5" style={font}>Rive blog</div>
          <h1 className="text-6xl font-bold text-foreground dark:text-white tracking-tight mb-4" style={fontD}>Thoughts &amp; updates.</h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg mb-14 max-w-xl leading-relaxed" style={font}>
            We have not published long-form posts yet. What has shipped is on the changelog; what we are building next is on the roadmap.
          </p>

          <div className="flex flex-col gap-4 mb-16">
            <Link
              href="/changelog"
              className="group block bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none hover:shadow-lg dark:hover:shadow-blue-900/20 transition-all duration-300 p-6 hover:-translate-y-0.5"
            >
              <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold mb-3 bg-blue-50 text-blue-600 border border-blue-100" style={font}>Product</span>
              <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors" style={fontD}>Changelog</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-3" style={font}>
                A reverse-chronological log of what is actually in the product, including open beta, Agreements, migration, calendars, invoicing, and portfolios.
              </p>
              <span className="text-blue-600 dark:text-blue-400 text-sm font-semibold group-hover:translate-x-1 transition-transform inline-block" style={fontD}>Read the changelog →</span>
            </Link>
            <Link
              href="/roadmap"
              className="group block bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none hover:shadow-lg dark:hover:shadow-blue-900/20 transition-all duration-300 p-6 hover:-translate-y-0.5"
            >
              <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold mb-3 bg-amber-50 text-amber-600 border border-amber-100" style={font}>Direction</span>
              <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors" style={fontD}>Roadmap</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-3" style={font}>
                What is available now, what we are hardening next, and what stays later until open-beta evidence says otherwise.
              </p>
              <span className="text-blue-600 dark:text-blue-400 text-sm font-semibold group-hover:translate-x-1 transition-transform inline-block" style={fontD}>See the roadmap →</span>
            </Link>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none p-8 text-center max-w-md mx-auto transition-colors">
            <h3 className="text-xl font-bold text-foreground dark:text-white mb-1" style={fontD}>Use the product while it is open</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-5" style={font}>Create a free account and help shape the next product updates.</p>
            <Button
              onClick={() => router.push("/register")}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm hover:from-blue-700 hover:to-sky-600 transition-all duration-200 shadow-lg shadow-blue-600/15"
              style={fontD}
            >
              Create a free account →
            </Button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
