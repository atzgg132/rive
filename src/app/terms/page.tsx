import PageShell from "@/components/PageShell";

const fontD = { fontFamily: "var(--font-display)" };
const font  = { fontFamily: "var(--font-body)" };

const toc = [
  { id: "acceptance",  label: "1. acceptance of terms" },
  { id: "service",     label: "2. description of service" },
  { id: "waitlist",    label: "3. waitlist & alpha access" },
  { id: "conduct",     label: "4. user conduct" },
  { id: "ip",          label: "5. intellectual property" },
  { id: "disclaimer",  label: "6. disclaimers & liability" },
  { id: "termination", label: "7. termination" },
  { id: "law",         label: "8. governing law" },
  { id: "changes",     label: "9. changes to terms" },
  { id: "contact",     label: "10. contact" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24 mb-10">
      <h2 className="text-xl font-bold text-[#0C1E36] dark:text-white mb-3 pb-2 border-b border-slate-100 dark:border-slate-800" style={fontD}>{title}</h2>
      <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed space-y-3" style={font}>{children}</div>
    </div>
  );
}

export default function TermsPage() {
  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-8 py-16">
        <div className="mb-12">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest" style={font}>legal</span>
          <h1 className="text-5xl font-bold text-[#0C1E36] dark:text-white tracking-tight mt-2 mb-3" style={fontD}>terms of service</h1>
          <p className="text-slate-400 dark:text-slate-500 text-sm" style={font}>last updated: July 13, 2026</p>
        </div>

        <div className="flex gap-12">
          {/* Sticky TOC */}
          <aside className="hidden md:block w-56 shrink-0">
            <div className="sticky top-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none p-5 transition-colors">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4" style={font}>on this page</p>
              <nav className="flex flex-col gap-2">
                {toc.map(item => (
                  <a key={item.id} href={`#${item.id}`}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium py-0.5"
                    style={font}>{item.label}</a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1 max-w-2xl">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none p-8 md:p-10 transition-colors">

              <Section id="acceptance" title="1. acceptance of terms">
                <p>By accessing the rive. website, joining the waitlist, or using any part of the rive. platform (collectively, the &quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, please do not use the Service.</p>
              </Section>

              <Section id="service" title="2. description of service">
                <p>rive. is an early-stage freelance operating system currently in active alpha development. The platform provides (or will provide) tools for project management, client management, invoicing, AI-powered workflows, and international payments.</p>
                <p>Features, functionality, and availability may change at any time without notice during the alpha phase. rive. makes no guarantees about uptime, feature completeness, or suitability for any particular purpose during this stage.</p>
              </Section>

              <Section id="waitlist" title="3. waitlist and alpha access">
                <p>Joining the rive. waitlist indicates your interest in early access. It does not constitute a guarantee of access, a reservation, or a contractual right to use the platform.</p>
                <p>Alpha access is granted at rive.&apos;s sole discretion in batches. We reserve the right to modify, delay, or cancel waitlist invitations at any time.</p>
              </Section>

              <Section id="conduct" title="4. user conduct">
                <p>By using the Service, you agree not to:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Spam, scrape, or abuse the platform or its APIs.</li>
                  <li>Attempt to gain unauthorised access to any part of the Service.</li>
                  <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
                  <li>Impersonate rive. or any member of the rive. team.</li>
                  <li>Reverse-engineer or decompile any portion of the platform.</li>
                </ul>
              </Section>

              <Section id="ip" title="5. intellectual property">
                <p>All content, design, code, trademarks, and brand assets on the rive. platform are the exclusive property of rive. and its founders. Nothing in these Terms grants you any rights to use rive.&apos;s intellectual property without explicit written permission.</p>
                <p>Any feedback, suggestions, or ideas you submit to rive. may be used by us freely without any obligation or compensation to you.</p>
              </Section>

              <Section id="disclaimer" title="6. disclaimers and limitation of liability">
                <p>The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied. During the alpha phase, we make no warranties about reliability, accuracy, fitness for a particular purpose, or non-infringement.</p>
                <p>To the fullest extent permitted by law, rive. shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, even if we have been advised of the possibility of such damages.</p>
              </Section>

              <Section id="termination" title="7. termination">
                <p>rive. reserves the right to suspend or terminate your access to the Service at any time, for any reason, without notice. During the alpha phase in particular, access may be revoked as we iterate on the platform.</p>
                <p>Upon termination, provisions that by their nature should survive (including IP, disclaimers, and governing law) will remain in effect.</p>
              </Section>

              <Section id="law" title="8. governing law">
                <p>These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions. Any disputes shall be subject to the exclusive jurisdiction of the courts of India.</p>
              </Section>

              <Section id="changes" title="9. changes to terms">
                <p>We may revise these Terms at any time. Material changes will be communicated to waitlist members via email. The &quot;last updated&quot; date at the top of this page reflects the most recent revision. Continued use of the Service after changes constitutes acceptance.</p>
              </Section>

              <Section id="contact" title="10. contact">
                <p>For questions about these Terms:</p>
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 mt-2 transition-colors">
                  <p><strong>email:</strong> <a href="mailto:legal@rive.app" className="text-blue-600 dark:text-blue-400 hover:underline">legal@rive.app</a></p>
                  <p className="mt-1"><strong>response time:</strong> within 72 hours</p>
                </div>
              </Section>

            </div>
          </main>
        </div>
      </div>
    </PageShell>
  );
}
