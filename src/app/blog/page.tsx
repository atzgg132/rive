"use client";
import PageShell from "@/components/PageShell";
import { useState } from "react";
import { submitToWaitlist } from "@/utils/api";
import { Loader2, Clock } from "lucide-react";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

const tagColors: Record<string,string> = {
  "founders note": "bg-purple-50 text-purple-600 border border-purple-100",
  engineering:     "bg-blue-50 text-blue-600 border border-blue-100",
  design:          "bg-pink-50 text-pink-600 border border-pink-100",
  research:        "bg-amber-50 text-amber-600 border border-amber-100",
};

const posts = [
  { tag: "founders note", title: "why the freelance economy needs a real operating system", date: "july 10, 2026", featured: true, excerpt: "freelancers represent the fastest-growing segment of the global workforce. yet the tools available to them are fragmented, clunky, and built for someone else. we started rive. because we lived this problem." },
  { tag: "engineering",   title: "how we built the remit payments engine", date: "july 5, 2026", featured: false, excerpt: "building a cross-border payments layer from scratch is not for the faint of heart. here's how we did it." },
  { tag: "design",        title: "designing for trust: ux lessons from building rive.", date: "june 28, 2026", featured: false, excerpt: "when your product handles money and client relationships, trust is everything. here's what we learned." },
  { tag: "research",      title: "the gig economy by numbers: 2026 report", date: "june 15, 2026", featured: false, excerpt: "over 1.1 billion freelancers worldwide. $1.5T in annual output. and almost no great software." },
];

export default function BlogPage() {
  const [email, setEmail] = useState("");
  const [subState, setSubState] = useState<"idle"|"loading"|"success"|"already-joined">("idle");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || subState === "loading") return;
    setSubState("loading");
    const res = await submitToWaitlist(email, "waitlist");
    setSubState(res.alreadyJoined ? "already-joined" : res.success ? "success" : "idle");
  };

  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <PageShell>
      <section className="relative py-24 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[400px] h-[300px] bg-blue-100/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 mb-5" style={font}>rive. blog</div>
          <h1 className="text-6xl font-bold text-[#0C1E36] tracking-tight mb-4" style={fontD}>thoughts &amp; updates.</h1>
          <p className="text-slate-500 text-lg mb-14 max-w-md leading-relaxed" style={font}>from our team: product insights, engineering deep-dives, and research.</p>

          {/* Featured post */}
          <a href="#" className="group block bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg hover:shadow-blue-100/30 transition-all duration-300 p-8 md:p-10 mb-8 hover:-translate-y-0.5">
            <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold mb-4 ${tagColors[featured.tag]}`} style={font}>{featured.tag}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0C1E36] mb-3 group-hover:text-blue-700 transition-colors" style={fontD}>{featured.title}</h2>
            <p className="text-slate-500 leading-relaxed mb-4" style={font}>{featured.excerpt}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium" style={font}>{featured.date}</span>
              <span className="text-blue-600 text-sm font-semibold group-hover:translate-x-1 transition-transform inline-block" style={fontD}>read more →</span>
            </div>
          </a>

          {/* Rest */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {rest.map(post => (
              <a key={post.title} href="#" className="group block bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:shadow-blue-100/30 transition-all duration-300 p-6 hover:-translate-y-0.5">
                <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold mb-3 ${tagColors[post.tag]}`} style={font}>{post.tag}</span>
                <h3 className="text-lg font-bold text-[#0C1E36] mb-2 group-hover:text-blue-700 transition-colors leading-snug" style={fontD}>{post.title}</h3>
                <p className="text-slate-400 text-xs mb-4 leading-relaxed" style={font}>{post.excerpt}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400" style={font}>{post.date}</span>
                  <span className="text-blue-600 text-xs font-semibold group-hover:translate-x-0.5 transition-transform inline-block" style={fontD}>read →</span>
                </div>
              </a>
            ))}
          </div>

          {/* Subscribe */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center max-w-md mx-auto">
            <h3 className="text-xl font-bold text-[#0C1E36] mb-1" style={fontD}>stay updated</h3>
            <p className="text-slate-500 text-sm mb-5" style={font}>get new posts in your inbox. no spam, ever.</p>
            {subState === "success" ? (
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-semibold" style={font}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> subscribed! we&apos;ll email you when we publish.
              </div>
            ) : subState === "already-joined" ? (
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold" style={font}>
                <Clock className="w-4 h-4" /> you&apos;re already on our list.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" disabled={subState === "loading"}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-blue-400 transition-all disabled:opacity-60" style={font} />
                <button type="submit" disabled={subState === "loading"}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm hover:from-blue-700 hover:to-sky-600 transition-all shadow-lg shadow-blue-600/15 disabled:opacity-75 inline-flex items-center gap-2" style={fontD}>
                  {subState === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : "subscribe"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
