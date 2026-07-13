import PageShell from "@/components/PageShell";

const fontD = { fontFamily: "var(--font-display)" };
const font  = { fontFamily: "var(--font-body)" };

const toc = [
  { id: "intro",      label: "1. introduction" },
  { id: "collect",    label: "2. information we collect" },
  { id: "use",        label: "3. how we use it" },
  { id: "retention",  label: "4. data retention" },
  { id: "third",      label: "5. third-party services" },
  { id: "rights",     label: "6. your rights" },
  { id: "children",   label: "7. children's privacy" },
  { id: "changes",    label: "8. changes to this policy" },
  { id: "contact",    label: "9. contact us" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24 mb-10">
      <h2 className="text-xl font-bold text-[#0C1E36] mb-3 pb-2 border-b border-slate-100" style={fontD}>{title}</h2>
      <div className="text-slate-600 text-sm leading-relaxed space-y-3" style={font}>{children}</div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-8 py-16">
        {/* Header */}
        <div className="mb-12">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest" style={font}>legal</span>
          <h1 className="text-5xl font-bold text-[#0C1E36] tracking-tight mt-2 mb-3" style={fontD}>privacy policy</h1>
          <p className="text-slate-400 text-sm" style={font}>last updated: July 13, 2026</p>
        </div>

        <div className="flex gap-12">
          {/* Sticky TOC */}
          <aside className="hidden md:block w-56 shrink-0">
            <div className="sticky top-24 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4" style={font}>on this page</p>
              <nav className="flex flex-col gap-2">
                {toc.map(item => (
                  <a key={item.id} href={`#${item.id}`}
                    className="text-sm text-slate-500 hover:text-blue-600 transition-colors font-medium py-0.5"
                    style={font}>{item.label}</a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1 max-w-2xl">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 md:p-10">

              <Section id="intro" title="1. introduction">
                <p>rive. (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your personal information. This Privacy Policy explains what data we collect, why we collect it, and how we handle it when you use our website and waitlist.</p>
                <p>By using rive. or joining our waitlist, you agree to the practices described in this policy.</p>
              </Section>

              <Section id="collect" title="2. information we collect">
                <p>We collect the following types of information:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Email addresses</strong> — when you join our waitlist or contact us.</li>
                  <li><strong>Usage analytics</strong> — page views, session duration, and navigation patterns (aggregated, not personally linked).</li>
                  <li><strong>Browser and device information</strong> — browser type, OS, screen resolution, for product compatibility purposes.</li>
                  <li><strong>Cookies</strong> — see our <a href="/cookies" className="text-blue-600 hover:underline">Cookie Policy</a> for details.</li>
                </ul>
                <p>We do not collect payment details, government IDs, or sensitive personal data at this stage.</p>
              </Section>

              <Section id="use" title="3. how we use your information">
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>To send you waitlist updates, batch invitations, and product announcements.</li>
                  <li>To improve and iterate on rive. based on usage patterns.</li>
                  <li>To communicate important changes to the platform or these policies.</li>
                  <li>To prevent fraud, spam, and abuse.</li>
                </ul>
                <p>We will never sell your personal information to third parties.</p>
              </Section>

              <Section id="retention" title="4. data retention">
                <p>We retain your email address and associated data for as long as you remain on the waitlist or have an active account. You may request deletion at any time by emailing <a href="mailto:privacy@rive.app" className="text-blue-600 hover:underline">privacy@rive.app</a>.</p>
                <p>If rive. ceases operations, all personal data will be securely deleted within 30 days.</p>
              </Section>

              <Section id="third" title="5. third-party services">
                <p>We use the following third-party services that may process your data:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Vercel Analytics</strong> — for aggregated, privacy-friendly website analytics. No cookies are used by Vercel Analytics.</li>
                  <li><strong>PostgreSQL (self-hosted)</strong> — for waitlist data storage on our own infrastructure.</li>
                </ul>
                <p>We do not use Google Analytics, Facebook Pixel, or any advertising trackers.</p>
              </Section>

              <Section id="rights" title="6. your rights">
                <p>You have the right to:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Access</strong> — request a copy of all data we hold about you.</li>
                  <li><strong>Deletion</strong> — ask us to delete your data at any time.</li>
                  <li><strong>Correction</strong> — correct any inaccurate information.</li>
                  <li><strong>Export</strong> — receive your data in a portable format.</li>
                  <li><strong>Opt-out</strong> — unsubscribe from all communications at any time.</li>
                </ul>
                <p>To exercise any of these rights, email <a href="mailto:privacy@rive.app" className="text-blue-600 hover:underline">privacy@rive.app</a>.</p>
              </Section>

              <Section id="children" title="7. children's privacy">
                <p>rive. is not directed at children under the age of 16. We do not knowingly collect personal information from anyone under 16. If you believe we have inadvertently collected data from a minor, please contact us immediately at <a href="mailto:privacy@rive.app" className="text-blue-600 hover:underline">privacy@rive.app</a>.</p>
              </Section>

              <Section id="changes" title="8. changes to this policy">
                <p>We may update this Privacy Policy from time to time. When we do, we will revise the &quot;last updated&quot; date at the top of this page. For significant changes, we will notify waitlist members via email.</p>
                <p>Your continued use of rive. after any changes constitutes acceptance of the updated policy.</p>
              </Section>

              <Section id="contact" title="9. contact us">
                <p>For any privacy-related questions, requests, or concerns:</p>
                <div className="bg-slate-50 rounded-xl p-4 mt-2">
                  <p><strong>email:</strong> <a href="mailto:privacy@rive.app" className="text-blue-600 hover:underline">privacy@rive.app</a></p>
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
