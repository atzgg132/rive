"use client";

import { Button } from "@/components/ui";
import PageShell from "@/components/PageShell";
import { MessageSquare, Code2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

export default function CommunityPage() {
  const router = useRouter();

  return (
    <PageShell>
      <section className="relative py-24 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-blue-100/15 rounded-full blur-[110px] pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-8">

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 mb-5" style={font}>
            Community
          </div>
          <h1 className="text-6xl font-bold text-foreground dark:text-white tracking-tight mb-4" style={fontD}>
            Join the rive. community.
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg mb-16 max-w-lg leading-relaxed" style={font}>
            Use the workspace, send feedback from the product, and help shape what we harden next.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none p-7 flex flex-col gap-4 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-foreground dark:text-white text-lg mb-1" style={fontD}>Discord</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-5" style={font}>
                  A public Discord is not open yet. Email us if you want an invite when it is.
                </p>
                <a
                  href="mailto:hello@rive.work"
                  className="block w-full py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all duration-200 text-center"
                  style={fontD}
                >
                  Email hello@rive.work
                </a>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none p-7 flex flex-col gap-4 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Code2 className="w-6 h-6 text-slate-700 dark:text-slate-300" />
              </div>
              <div>
                <h3 className="font-bold text-foreground dark:text-white text-lg mb-1" style={fontD}>GitHub Discussions</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-5" style={font}>
                  Suggest features, report bugs, and vote on the roadmap in the open.
                </p>
                <a
                  href="https://github.com/atzgg132/rive/discussions"
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 text-center"
                  style={fontD}
                >
                  Open GitHub Discussions
                </a>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none p-7 flex flex-col gap-4 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
                <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-foreground dark:text-white text-lg mb-1" style={fontD}>Use the open beta</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-5" style={font}>
                  Create a free account and send feedback from the workflows you actually use.
                </p>
                <Button
                  onClick={() => router.push("/register")}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white text-sm font-bold hover:from-blue-700 hover:to-sky-600 transition-all shadow-md shadow-blue-600/15"
                  style={fontD}
                >
                  Create a free account →
                </Button>
              </div>
            </div>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-sm transition-colors" style={font}>
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              The product is open. Use it, then tell us what to improve.
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
