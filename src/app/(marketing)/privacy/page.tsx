import { ProseShell } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive privacy policy", "How Rive handles and protects personal and workspace data.", "/privacy");

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
      <h2 className="mb-3 border-b border-white/[0.08] pb-2 text-xl font-bold text-white" style={fontD}>{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-300" style={font}>{children}</div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <ProseShell eyebrow="LEGAL" title="Privacy Policy" updated="Last updated · July 13, 2026">
        <div className="flex flex-col gap-8 md:flex-row md:gap-12">
          {/* Sticky TOC */}
          <aside className="hidden md:block w-56 shrink-0">
            <div className="sticky top-24 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400" style={font}>On this page</p>
              <nav className="flex flex-col gap-2">
                {toc.map(item => (
                  <a key={item.id} href={`#${item.id}`}
                    className="py-0.5 text-sm font-medium text-slate-400 transition-colors hover:text-blue-300"
                    style={font}>{item.label}</a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="min-w-0 max-w-2xl flex-1">
            <div>

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
          </div>
      </div>
    </ProseShell>
  );
}
