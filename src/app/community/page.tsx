"use client";
import PageShell from "@/components/PageShell";
import { useState } from "react";
import { submitToWaitlist } from "@/utils/api";
import { Loader2, Clock, MessageSquare, Code2, Mail } from "lucide-react";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

export default function CommunityPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "already-joined">("idle");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || state === "loading") return;
    setState("loading");
    const res = await submitToWaitlist(email, "waitlist");
    setState(res.alreadyJoined ? "already-joined" : res.success ? "success" : "idle");
  };

  return (
    <PageShell>
      <section className="relative py-24 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-blue-100/15 rounded-full blur-[110px] pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-8">

          {/* Header */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 mb-5" style={font}>
            community
          </div>
          <h1 className="text-6xl font-bold text-[#0C1E36] tracking-tight mb-4" style={fontD}>
            join the rive. community.
          </h1>
          <p className="text-slate-500 text-lg mb-16 max-w-lg leading-relaxed" style={font}>
            connect with freelancers, share workflows, and shape the product with your feedback.
          </p>

          {/* Community cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {/* Discord */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-[#0C1E36] text-lg mb-1" style={fontD}>discord</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-5" style={font}>
                  real-time chat, early previews, feedback loops, and direct access to the team.
                </p>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
                  className="w-full py-2.5 rounded-xl border border-indigo-200 text-indigo-600 text-sm font-bold hover:bg-indigo-50 transition-all duration-200"
                  style={fontD}
                >
                  join discord (coming soon)
                </button>
              </div>
            </div>

            {/* GitHub */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                <Code2 className="w-6 h-6 text-slate-700" />
              </div>
              <div>
                <h3 className="font-bold text-[#0C1E36] text-lg mb-1" style={fontD}>github discussions</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-5" style={font}>
                  open source feedback — suggest features, report bugs, and vote on the roadmap.
                </p>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-all duration-200"
                  style={fontD}
                >
                  open github (coming soon)
                </button>
              </div>
            </div>

            {/* Newsletter */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-[#0C1E36] text-lg mb-1" style={fontD}>rive. letter</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-5" style={font}>
                  monthly: product updates, freelance insights, community spotlight. no spam, ever.
                </p>

                {state === "success" ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-semibold w-full justify-center" style={font}>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    subscribed!
                  </div>
                ) : state === "already-joined" ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold w-full justify-center" style={font}>
                    <Clock className="w-4 h-4" />
                    already on the list
                  </div>
                ) : (
                  <form onSubmit={handleSubscribe} className="flex flex-col gap-2">
                    <input
                      type="email" required value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      disabled={state === "loading"}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-60"
                      style={font}
                    />
                    <button
                      type="submit" disabled={state === "loading"}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm hover:from-blue-700 hover:to-sky-600 transition-all shadow-md shadow-blue-600/15 disabled:opacity-75 flex items-center justify-center gap-2"
                      style={fontD}
                    >
                      {state === "loading" ? <><Loader2 className="w-4 h-4 animate-spin" />subscribing...</> : "subscribe →"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Join badge */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-500 text-sm" style={font}>
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              community launches alongside the platform — join the waitlist to be first in.
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
