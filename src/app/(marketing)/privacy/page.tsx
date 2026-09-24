import { LegalToc, ProseShell } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive privacy policy", "How Rive handles and protects personal and workspace data.", "/privacy");

const fontD = { fontFamily: "var(--inst-font)" };
const font  = { fontFamily: "var(--font-body)" };

const toc = [
  { id: "intro",      label: "1. Introduction" },
  { id: "collect",    label: "2. Information we collect" },
  { id: "use",        label: "3. How we use your information" },
  { id: "google",     label: "4. Google user data" },
  { id: "client-emails", label: "5. Emails we send to your clients on your behalf" },
  { id: "security",   label: "6. How we protect your data" },
  { id: "retention",  label: "7. Data retention" },
  { id: "third",      label: "8. Third-party services" },
  { id: "rights",     label: "9. Your rights" },
  { id: "children",   label: "10. Children's privacy" },
  { id: "changes",    label: "11. Changes to this policy" },
  { id: "contact",    label: "12. Contact us" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="mb-10 scroll-mt-28">
      <h2 className="mb-3 border-b border-[var(--inst-hairline)] pb-2 text-xl font-bold text-[var(--inst-ink)]" style={fontD}>{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-[var(--inst-ink-soft)]" style={font}>{children}</div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <ProseShell eyebrow="LEGAL" title="Privacy Policy" updated="Last updated · September 24, 2026">
        <div className="flex flex-col gap-8 md:flex-row md:gap-12">
          <LegalToc items={toc} />
          <div className="min-w-0 max-w-2xl flex-1 overflow-x-clip">
            <div>

              <Section id="intro" title="1. Introduction">
                <p>Rive (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your personal information. This Privacy Policy explains what data we collect, why we collect it, and how we handle it when you use our website and workspace.</p>
                <p>By using Rive or creating an account, you agree to the practices described in this policy.</p>
              </Section>

              <Section id="collect" title="2. Information we collect">
                <p>We collect the following types of information:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Email addresses</strong> — When you create an account, use the workspace, or contact us.</li>
                  <li><strong>Account and workspace data</strong> — Information you enter in Rive, such as clients, projects, invoices, expenses, and calendar events.</li>
                  <li><strong>Google account data</strong> — If you sign in with Google or connect Google Calendar. Details are in section 4.</li>
                  <li><strong>Usage analytics</strong> — First-party page and product events, including the route visited, a browser-session identifier, acquisition tags, referrer origin and path, browser user agent, and the signed-in account ID when applicable. These records are not advertising profiles and are not shared with advertisers.</li>
                  <li><strong>Browser and device information</strong> — Browser and device category derived from the user agent, for product compatibility purposes.</li>
                  <li><strong>Cookies</strong> — See our <a href="/cookies" className="text-primary hover:underline">Cookie Policy</a> for details.</li>
                </ul>
                <p>We do not collect payment details or government IDs. Synced calendar events can include the titles, times, and details you or others put on those events.</p>
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

              <Section id="google" title="4. Google user data">
                <p>If you choose to sign in with Google or connect Google Calendar, Rive accesses Google user data only with your consent, only for the feature you turned on, and only to the extent that feature needs.</p>
                <p>Sign in with Google and Google Calendar are separate. Connecting Calendar is optional. Sign-in does not grant Calendar access.</p>
                <p><strong>Google sign-in.</strong> When you sign in with Google, we request OpenID, email, and profile access. We receive your Google account identifier, email address, and name so we can create or authenticate your Rive account. We do not keep Google sign-in access or refresh tokens after that sign-in request finishes. We store the Google account identifier so later sign-ins can recognize the same account.</p>
                <p><strong>Google Calendar.</strong> When you connect Google Calendar from the workspace, we request read-only access to your calendar list and access to calendar events (create, read, update, and delete) on the calendars you connect. We use that access so Rive can list those calendars and keep workspace events in sync with Google Calendar for your business workflow. We store the connected account email, the calendars you select, synced event data in your workspace, and the OAuth tokens needed to keep that connection working.</p>
                <p>We use Google user data only to provide and improve these user-facing sign-in and calendar features. We do not use Google user data for advertising, personalized ads, retargeting, interest-based ads, selling to data brokers, credit-worthiness, lending, or any other unrelated purpose. We do not use Google user data to develop, improve, or train generalized or third-party AI or machine-learning models.</p>
                <p>We do not sell Google user data. We do not share, transfer, or disclose Google user data to third parties for purposes other than providing the Service, except where required by law. Infrastructure we use to host the Service (see section 8) may process that data on our behalf under confidentiality terms, solely to run Rive.</p>
                <p>Rive&apos;s use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-primary hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
              </Section>

              <Section id="client-emails" title="5. Emails we send to your clients on your behalf">
                <p>When you use invoice reminders or paid receipts, Rive sends automated emails to your clients using the client contact details you enter. These emails cover: a scheduled reminder about an unpaid invoice (on the schedule you choose — up to 3 days before the due date and 1, 7, or 14 days after), and a receipt confirming an invoice has been paid in full. Both are off by default and only send if you turn them on.</p>
                <p>For this purpose, Rive acts as a data processor on your behalf: we send the message using the invoice and client data already in your workspace, we do not use it for any other purpose, and we do not sell it. You are responsible for the accuracy of the client contact details you provide and for having the right to contact that client — see our <a href="/terms" className="text-primary hover:underline">Terms of Service</a>.</p>
                <p>Every automated reminder email includes an unsubscribe link that is specific to that client. Using it stops future reminder emails to that client from your account; it does not affect the original invoice-sent email, a paid receipt, or any other correspondence. Reminders are also capped: at most four per invoice, and a daily limit per account.</p>
              </Section>

              <Section id="security" title="6. How we protect your data">
                <p>Security procedures are in place to protect the confidentiality of your data, including Google user data stored in Rive&apos;s environment rather than only inside Google.</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Encryption in transit</strong> — The website, APIs, and database connections use TLS (HTTPS in the browser; TLS required to the database).</li>
                  <li><strong>Encryption at rest</strong> — Workspace data is stored in a private, encrypted PostgreSQL database that is not publicly reachable. Google Calendar OAuth access and refresh tokens are encrypted at rest with AES-256-GCM using a dedicated application key, separate from session secrets.</li>
                  <li><strong>Access limited to the feature</strong> — Google data is used only to provide sign-in or calendar sync. Authenticated workspace queries are scoped to the signed-in account. The database is private, the application host does not accept inbound SSH, and operator access uses authenticated AWS sessions recorded in the AWS audit trail.</li>
                  <li><strong>Account credentials</strong> — Passwords are stored as salted scrypt hashes, not in plain text. Sessions use signed HttpOnly cookies (Secure in production, SameSite restrictions) rather than tokens exposed to page scripts.</li>
                </ul>
                <p>No method of transmission or storage is perfectly secure. We apply these controls as a small SaaS operating on AWS; we do not claim third-party security certifications in this policy.</p>
              </Section>

              <Section id="retention" title="7. Data retention">
                <p>We retain account and workspace information for as long as you use the Service or as needed for legitimate business, security, and legal purposes. You can request access, correction, or deletion at any time by emailing <a href="mailto:hello@rive.work" className="text-primary hover:underline">hello@rive.work</a>.</p>
                <p>If you disconnect Google Calendar in the workspace, we revoke Rive&apos;s Google grant and delete the stored connection tokens and calendars imported from that connection. You can also revoke Rive&apos;s access in your Google Account permissions. If you ask us to delete your Rive account, we delete the account and associated workspace data, including any Google account identifier and remaining Google Calendar connection data, unless a longer retention period is required or permitted by law.</p>
              </Section>

              <Section id="third" title="8. Third-party services">
                <p>We use privacy-respecting infrastructure providers for web hosting and database management. These services process data on our behalf under strict confidentiality terms. Production hosting and the encrypted database run on Amazon Web Services.</p>
                <p>Usage analytics are first-party and stored on Rive&apos;s AWS infrastructure; no third-party analytics service processes them.</p>
                <p>If you sign in with Google or connect Google Calendar, Google provides those APIs under Google&apos;s terms. Rive then stores and protects the Google user data described in sections 4 and 6 in order to provide the feature you enabled.</p>
              </Section>

              <Section id="rights" title="9. Your rights">
                <p>Depending on your jurisdiction, you may have the right to access, correct, or delete your personal data. To exercise these rights, email us at <a href="mailto:hello@rive.work" className="text-primary hover:underline">hello@rive.work</a>.</p>
              </Section>

              <Section id="children" title="10. Children's privacy">
                <p>Rive is not directed at children under the age of 16. We do not knowingly collect personal information from anyone under 16. If you believe we have inadvertently collected data from a minor, please contact us immediately at <a href="mailto:hello@rive.work" className="text-primary hover:underline">hello@rive.work</a>.</p>
              </Section>

              <Section id="changes" title="11. Changes to this policy">
                <p>We may update this Privacy Policy from time to time. When we do, we will revise the &quot;last updated&quot; date at the top of this page. For significant changes, we will notify account holders through the Service or by email.</p>
                <p>Your continued use of Rive after any changes constitutes acceptance of the updated policy.</p>
              </Section>

              <Section id="contact" title="12. Contact us">
                <p>For any privacy-related questions, requests, or concerns — including Google user data — email <a href="mailto:hello@rive.work" className="text-primary hover:underline">hello@rive.work</a>.</p>
                <div className="mt-2 rounded-xl bg-[var(--surface-glass)] p-4 text-[var(--inst-ink)]">
                  <p><strong>Email:</strong> <a href="mailto:hello@rive.work" className="text-primary hover:underline">hello@rive.work</a></p>
                  <p className="mt-1"><strong>Response time:</strong> Within 72 hours</p>
                </div>
              </Section>

            </div>
          </div>
      </div>
    </ProseShell>
  );
}
