import PageShell from "@/components/PageShell";
import Image from "next/image";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

export default function PressPage() {
  return (
    <PageShell>
      <section className="relative py-24 overflow-hidden">
        <div className="absolute top-0 right-1/3 w-[400px] h-[250px] bg-blue-100/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 mb-5" style={font}>media</div>
          <h1 className="text-6xl font-bold text-[#0C1E36] tracking-tight mb-4" style={fontD}>press &amp; media.</h1>
          <p className="text-slate-500 text-lg mb-16 leading-relaxed" style={font}>
            for press inquiries, contact <a href="mailto:press@rive.app" className="text-blue-600 hover:underline">press@rive.app</a>
          </p>

          {/* Brand assets */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 mb-6">
            <h2 className="text-xl font-bold text-[#0C1E36] mb-2" style={fontD}>brand assets</h2>
            <p className="text-slate-500 text-sm mb-6" style={font}>available in SVG, PNG, and JPEG. use on white or light backgrounds.</p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="bg-[#F5F8FC] rounded-xl border border-slate-100 p-6 flex items-center justify-center">
                <Image src="/brand-assets/logo.png" alt="rive. logo" width={160} height={64} style={{ objectFit: "contain" }} />
              </div>
              <div className="flex flex-col gap-3">
                <a href="/brand-assets/logo.svg" download
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm hover:from-blue-700 hover:to-sky-600 transition-all shadow-md shadow-blue-600/15 w-fit"
                  style={fontD}>
                  ↓ download svg
                </a>
                <a href="/brand-assets/logo.png" download
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:border-blue-200 hover:text-blue-600 transition-all w-fit"
                  style={fontD}>
                  ↓ download png
                </a>
              </div>
            </div>
          </div>

          {/* Boilerplate */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 mb-6">
            <h2 className="text-xl font-bold text-[#0C1E36] mb-2" style={fontD}>company boilerplate</h2>
            <p className="text-slate-500 text-sm mb-4" style={font}>copy and paste for articles, profiles, and coverage.</p>
            <blockquote className="bg-slate-50 border-l-4 border-blue-500 rounded-r-xl p-5 font-mono text-sm text-slate-700 leading-relaxed select-all">
              rive. is an early-stage freelance operating system — a unified platform for project management, client management, invoicing, ai-powered workflows, and international payments. founded in 2026, rive. is backed by a team of former freelancers building the tools they wish existed.
            </blockquote>
          </div>

          {/* Media contact */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
            <h2 className="text-xl font-bold text-[#0C1E36] mb-4" style={fontD}>media contact</h2>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-lg">📬</div>
              <div>
                <p className="font-bold text-[#0C1E36] text-sm" style={fontD}>press team</p>
                <a href="mailto:press@rive.app" className="text-blue-600 text-sm hover:underline" style={font}>press@rive.app</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
