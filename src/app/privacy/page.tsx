import PageShell from "@/components/PageShell";

const fontD = { fontFamily: "var(--font-display)" };
const font  = { fontFamily: "var(--font-body)" };

const toc = [
  { id: "intro",      label: "1. Introduction" },
  { id: "collect",    label: "2. Information we collect" },
  { id: "use",        label: "3. How we use it" },
  { id: "retention",  label: "4. Data retention" },
  { id: "third",      label: "5. Third-party services" },
  { id: "rights",     label: "6. Your rights" },
  { id: "children",   label: "7. Children's privacy" },
  { id: "changes",    label: "8. Changes to this policy" },
  { id: "contact",    label: "9. Contact us" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24 mb-10">
      <h2 className="text-xl font-bold text-foreground dark:text-white mb-3 pb-2 border-b border-slate-100 dark:border-slate-800" style={fontD}>{title}</h2>
      <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed space-y-3" style={font}>{children}</div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-8 py-16">
        {/* Header */}
        <div className="mb-12">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest" style={font}>Legal</span>
          <h1 className="text-5xl font-bold text-foreground dark:text-white tracking-tight mt-2 mb-3" style={fontD}>Privacy policy</h1>
          <p className="text-slate-400 dark:text-slate-500 text-sm" style={font}>Last updated: July 13, 2026</p>
        </div>

        <div className="flex gap-12">
          {/* Sticky TOC */}
          <aside className="hidden md:block w-56 shrink-0">
            <div className="sticky top-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none p-5 transition-colors">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4" style={font}>On this page</p>
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

              <Section id="intro" title="1. Introduction">
                <p>rive. (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your personal information. This Privacy Policy explains what data we collect, why we collect it, and how we handle it when you use our website and workspace.</p>
                <p>By using rive. or creating an account, you agree to the practices described in this policy.</p>
              </Section>

              <Section id="collect" title="2. Information we collect">
                <p>We collect the following types of information:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Email addresses</strong> — When you create an account, use the workspace, or contact us.</li>
                  <li><strong>Usage analytics</strong> — Page views, session duration, and navigation patterns (aggregated, not personally linked).</li>
                  <li><strong>Browser and device information</strong> — Browser type, OS, screen resolution, for product compatibility purposes.</li>
                  <li><strong>Cookies</strong> — See our <a href="/cookies" className="text-blue-600 dark:text-blue-400 hover:underline">Cookie Policy</a> For details.</li>
                </ul>
                <p>We do not collect payment details, government IDs, or sensitive personal data at this stage.</p>
              </Section>

              <Section id="use" title="3. How we use your information">
                <p>We use the data we collect solely to:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Provide, secure, and improve the workspace and its features.</li>
                  <li>Understand onboarding, activation, workflow depth, and feedback so we can improve the product.</li>
                  <li>Respond to support requests or inquiries sent to us.</li>
                  <li>Detect and prevent spam, abuse, or unauthorized access.</li>
                </ul>
                <p>We <strong>never sell your data</strong> or share it with third-party advertisers.</p>
              </Section>

              <Section id="retention" title="4. Data retention">
                <p>We retain account and workspace information for as long as you use the Service or as needed for legitimate business, security, and legal purposes. You can request access, correction, or deletion at any time by emailing <a href="mailto:hello@rive.work" className="text-blue-600 dark:text-blue-400 hover:underline">hello@rive.work</a>.</p>
              </Section>

              <Section id="third" title="5. Third-party services">
                <p>We use privacy-respecting infrastructure providers for web hosting and database management. These services process data on our behalf under strict confidentiality terms.</p>
              </Section>

              <Section id="rights" title="6. Your rights">
                <p>Depending on your jurisdiction, you may have the right to access, correct, or delete your personal data. To exercise these rights, email us at <a href="mailto:hello@rive.work" className="text-blue-600 dark:text-blue-400 hover:underline">hello@rive.work</a>.</p>
              </Section>

              <Section id="children" title="7. Children's privacy">
                <p>rive. is not directed at children under the age of 16. We do not knowingly collect personal information from anyone under 16. If you believe we have inadvertently collected data from a minor, please contact us immediately at <a href="mailto:hello@rive.work" className="text-blue-600 dark:text-blue-400 hover:underline">hello@rive.work</a>.</p>
              </Section>

              <Section id="changes" title="8. Changes to this policy">
                <p>We may update this Privacy Policy from time to time. When we do, we will revise the &quot;last updated&quot; date at the top of this page. For significant changes, we will notify account holders through the Service or by email.</p>
                <p>Your continued use of rive. after any changes constitutes acceptance of the updated policy.</p>
              </Section>

              <Section id="contact" title="9. Contact us">
                <p>For any privacy-related questions, requests, or concerns:</p>
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 mt-2 transition-colors">
                  <p><strong>Email:</strong> <a href="mailto:hello@rive.work" className="text-blue-600 dark:text-blue-400 hover:underline">hello@rive.work</a></p>
                  <p className="mt-1"><strong>Response time:</strong> Within 72 hours</p>
                </div>
              </Section>

            </div>
          </main>
        </div>
      </div>
    </PageShell>
  );
}
