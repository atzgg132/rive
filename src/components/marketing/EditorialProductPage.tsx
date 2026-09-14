import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { InstMark } from "@/components/marketing/primitives";
import { ClosingCta, ReadingHero } from "@/components/marketing/shells";
import { PortfolioSpecimen } from "@/components/marketing/PortfolioShowcase";
import { type WorkspacePreviewView } from "@/components/marketing/WorkspacePreview";
import { ResponsiveWorkspacePreview } from "@/components/marketing/ResponsiveWorkspacePreview";
import { ResponsivePlate } from "@/components/marketing/ResponsivePlate";
import { AcceptanceDocument } from "@/components/marketing/AcceptanceDocument";
import { InvoiceDocument } from "@/components/marketing/InvoiceDocument";
import { RevealOnScroll } from "@/components/marketing/RevealOnScroll";

export type ProductPageKind = "clients" | "agreements" | "portfolio";

type ProductChapter = { eyebrow: string; title: string; body: string; note?: string; plate?: string };

type ProductPageCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  chapters: ProductChapter[];
  clarification?: { title: string; body: string };
  cta: string;
  next: { label: string; href: string };
};

const copy: Record<ProductPageKind, ProductPageCopy> = {
  clients: {
    eyebrow: "Clients & projects",
    title: "Give every client’s work a clear place.",
    intro: "Manage client details, projects, tasks, and milestones in Rive. Keep the work organized by the relationship it belongs to.",
    chapters: [
      { eyebrow: "The relationship", title: "See what belongs to each client.", body: "Keep client records alongside the projects and business records connected to them. Open the client instead of reconstructing their work from memory." },
      { eyebrow: "The work", title: "Break the project into manageable work.", body: "Create tasks and milestones, set dates, and update progress as the engagement develops." },
      { eyebrow: "The timeline", title: "Bring deadlines into view.", body: "Use Rive’s calendar to review project deadlines and tasks. Connect Google Calendar for two-way sync, or subscribe to the private Apple Calendar feed." },
    ],
    cta: "Start with the client you’re working with today.",
    next: { label: "Agreements & invoices", href: "/product/agreements-invoices" },
  },
  agreements: {
    eyebrow: "Agreements & invoices",
    title: "Keep the terms and the invoice with the work.",
    intro: "Prepare agreements, share them for review, record acceptance, and create invoices linked to the client and project.",
    chapters: [
      { eyebrow: "Agreement", title: "Put the agreement in writing.", body: "Define the scope, terms, and payment schedule. Review the agreement before sharing it with your client." },
      { eyebrow: "Review", title: "Give the client a clear review step.", body: "Share a review link and record acceptance through Rive’s agreement workflow.", plate: "Sent to the client" },
      { eyebrow: "Invoice", title: "Prepare the invoice.", body: "Use supported agreement billing actions to create linked draft invoices. Review the details before sending.", plate: "Shared with the client" },
      { eyebrow: "Records", title: "Keep an eye on the money.", body: "Track invoices, record payments, and log expenses. Rive does not currently collect payments or transfer funds." },
    ],
    clarification: { title: "What recorded acceptance means", body: "Rive records the client’s acceptance through its agreement flow. This is not a promise of enforceability in every jurisdiction or a substitute for legal advice." },
    cta: "Bring the next agreement and invoice into one workspace.",
    next: { label: "Portfolio Studio", href: "/product/portfolio" },
  },
  portfolio: {
    eyebrow: "Portfolio Studio",
    title: "A place for the work you want more of.",
    intro: "Build a public portfolio in Rive. Publish selected projects, present your services, and receive enquiries from prospective clients.",
    chapters: [
      { eyebrow: "Selected work", title: "Choose what to publish.", body: "Select the projects you want to show and shape how they appear in your portfolio." },
      { eyebrow: "Your practice", title: "Make your services easy to understand.", body: "Present your work and practices in a public site that helps visitors understand what you do.", plate: "The live site" },
      { eyebrow: "The next client", title: "Give people a way to reach you.", body: "Let visitors enquire through your portfolio and review the analytics available in Rive." },
    ],
    cta: "Give your next client somewhere to look.",
    next: { label: "Clients & projects", href: "/product/clients-projects" },
  },
};

const wp = (view: WorkspacePreviewView) => <ResponsiveWorkspacePreview key={view} view={view} />;

/* One artifact per chapter: workspace views show the operator's side; the
   client-facing plates reproduce the real public surfaces — the acceptance
   page, the shared invoice, the published site. */
const ARTIFACTS: Record<ProductPageKind, ReactNode[]> = {
  clients: [wp("clients"), wp("projects"), wp("calendar")],
  agreements: [
    wp("agreements"),
    <ResponsivePlate key="acceptance" wide={{ w: 1024, h: 800 }} narrow={{ w: 460, h: 980 }}><AcceptanceDocument /></ResponsivePlate>,
    <ResponsivePlate key="invoice" wide={{ w: 780, h: 900 }} narrow={{ w: 430, h: 1000 }}><InvoiceDocument /></ResponsivePlate>,
    wp("revenue"),
  ],
  portfolio: [
    wp("portfolio"),
    <ResponsivePlate key="live-site" wide={{ w: 1024, h: 700 }} narrow={{ w: 430, h: 880 }}><PortfolioSpecimen templateKey="minimal-pro" /></ResponsivePlate>,
    wp("enquiries"),
  ],
};

export function EditorialProductPage({ kind }: { kind: ProductPageKind }) {
  const content = copy[kind];
  return (
    <>
      <ReadingHero eyebrow={content.eyebrow} title={content.title} intro={content.intro} />
      <div>
        {content.chapters.map((chapter, index) => (
          <section key={chapter.title} className="inst-section" aria-label={chapter.title}>
            <div className="inst-container">
              <div className="inst-dept">
                <span className="inst-mono">{chapter.eyebrow}</span>
                <span className="inst-mono">{chapter.plate ?? "Plate from the workspace"}</span>
              </div>
              <div className="inst-product-plate">
                <RevealOnScroll className="inst-reveal">
                  <div className="inst-entry">
                    <div>
                      <h2 className="inst-display inst-display--sub inst-entry__title">{chapter.title}</h2>
                      <p className="inst-body" style={{ marginTop: "1rem" }}>{chapter.body}</p>
                      {chapter.note ? <p className="inst-admit__note">{chapter.note}</p> : null}
                    </div>
                    <figure className="inst-plate">
                      <div className="inst-plate__frame">
                        {ARTIFACTS[kind][index]}
                      </div>
                    </figure>
                  </div>
                </RevealOnScroll>
              </div>
            </div>
          </section>
        ))}
      </div>
      {content.clarification ? (
        <section className="inst-section" aria-label="Clarification">
          <div className="inst-container">
            <div className="inst-panel">
              <span className="inst-mono inst-panel__label"><InstMark mark="triangle" accent />On the record</span>
              <h2 className="inst-panel__title">{content.clarification.title}</h2>
              <p className="inst-panel__body" style={{ marginBottom: 0 }}>{content.clarification.body}</p>
            </div>
          </div>
        </section>
      ) : null}
      <section className="inst-section" aria-label="Next entry">
        <div className="inst-container">
          <Link href={content.next.href} className="marketing-focus inst-next">
            <span className="inst-mono">Next entry in the register</span>
            <span className="inst-next__label">{content.next.label}<ArrowRight className="h-5 w-5" aria-hidden="true" /></span>
          </Link>
        </div>
      </section>
      <ClosingCta headline={content.cta} href="/register" label="Create your free account" />
    </>
  );
}
