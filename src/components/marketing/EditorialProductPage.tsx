import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { PortfolioPublication } from "@/components/marketing/WorkingEditionStage";
import { type WorkspacePreviewView } from "@/components/marketing/WorkspacePreview";
import { ResponsiveWorkspacePreview } from "@/components/marketing/ResponsiveWorkspacePreview";
import { EditorialLabel, MarketingButton } from "@/components/marketing/primitives";

export type ProductPageKind = "clients" | "agreements" | "portfolio";

type ProductChapter = { eyebrow: string; title: string; body: string; note?: string };

type ProductPageCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  chapters: ProductChapter[];
  clarification?: { title: string; body: string };
  cta: string;
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
  },
  agreements: {
    eyebrow: "Agreements & invoices",
    title: "Keep the terms and the invoice with the work.",
    intro: "Prepare agreements, share them for review, record acceptance, and create invoices linked to the client and project.",
    chapters: [
      { eyebrow: "01 / Agreement", title: "Put the agreement in writing.", body: "Define the scope, terms, and payment schedule. Review the agreement before sharing it with your client." },
      { eyebrow: "02 / Review", title: "Give the client a clear review step.", body: "Share a review link and record acceptance through Rive’s agreement workflow." },
      { eyebrow: "03 / Invoice", title: "Prepare the invoice.", body: "Use supported agreement billing actions to create linked draft invoices. Review the details before sending." },
      { eyebrow: "04 / Records", title: "Keep an eye on the money.", body: "Track invoices, record payments, and log expenses. Rive does not currently collect payments or transfer funds." },
    ],
    clarification: { title: "What recorded acceptance means", body: "Rive records the client’s acceptance through its agreement flow. This is not a promise of enforceability in every jurisdiction or a substitute for legal advice." },
    cta: "Bring the next agreement and invoice into one workspace.",
  },
  portfolio: {
    eyebrow: "Portfolio Studio",
    title: "A place for the work you want more of.",
    intro: "Build a public portfolio in Rive. Publish selected projects, present your services, and receive enquiries from prospective clients.",
    chapters: [
      { eyebrow: "Selected work", title: "Choose what to publish.", body: "Select the projects you want to show and shape how they appear in your portfolio." },
      { eyebrow: "Your practice", title: "Make your services easy to understand.", body: "Present your work and practices in a public site that helps visitors understand what you do." },
      { eyebrow: "The next client", title: "Give people a way to reach you.", body: "Let visitors enquire through your portfolio and review the analytics available in Rive." },
    ],
    cta: "Give your next client somewhere to look.",
  },
};

function Visual({ kind, index }: { kind: ProductPageKind; index: number }) {
  if (kind === "portfolio" && index === 2) return <PortfolioPublication />;
  const views: Record<ProductPageKind, WorkspacePreviewView[]> = {
    clients: ["clients", "projects", "calendar"],
    agreements: ["agreements", "agreements", "revenue", "revenue"],
    portfolio: ["portfolio", "portfolio", "portfolio"],
  };
  return <ResponsiveWorkspacePreview view={views[kind][index] ?? views[kind][0]} />;
}

export function EditorialProductPage({ kind }: { kind: ProductPageKind }) {
  const content = copy[kind];
  return (
    <>
      <section className="edition-product-hero"><div className="edition-container"><EditorialLabel>{content.eyebrow}</EditorialLabel><h1 className="edition-display">{content.title}</h1><div><p>{content.intro}</p><MarketingButton href="/register">Start free</MarketingButton></div></div></section>
      <div className="edition-product-chapters">
        {content.chapters.map((chapter, index) => (
          <section key={chapter.title} className="edition-product-chapter"><div className="edition-container"><div className="edition-product-chapter__copy"><EditorialLabel inverse>{chapter.eyebrow}</EditorialLabel><h2 className="edition-display">{chapter.title}</h2><p>{chapter.body}</p>{chapter.note ? <small>{chapter.note}</small> : null}</div><div className="edition-product-stage"><Visual kind={kind} index={index} /></div></div></section>
        ))}
      </div>
      {content.clarification ? <section className="edition-clarification"><div className="edition-container"><Check className="h-6 w-6" /><h2>{content.clarification.title}</h2><p>{content.clarification.body}</p></div></section> : null}
      <section className="edition-page-cta"><div className="edition-container"><h2 className="edition-display">{content.cta}</h2><div><MarketingButton href="/register">Create your free account</MarketingButton><Link href="/#product" className="marketing-focus edition-text-link">See the product overview <ArrowRight className="h-4 w-4" /></Link></div></div></section>
    </>
  );
}
