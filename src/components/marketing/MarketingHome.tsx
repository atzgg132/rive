import type { ReactNode } from "react";
import { RecordArtifact } from "@/components/marketing/RecordArtifact";
import { TypeRegister } from "@/components/marketing/TypeRegister";
import { RecordJourney, type RegistryDepartment } from "@/components/marketing/RecordJourney";
import { ManifestoLine } from "@/components/marketing/ManifestoLine";
import { RevealOnScroll } from "@/components/marketing/RevealOnScroll";
import { ResponsiveWorkspacePreview } from "@/components/marketing/ResponsiveWorkspacePreview";
import { PortfolioSpecimen } from "@/components/marketing/PortfolioShowcase";
import { SpecimenFrame } from "@/components/marketing/SpecimenFrame";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import {
  DeptRule,
  InstMark,
  MarketingButton,
  MarketingLink,
  RegisterRow,
} from "@/components/marketing/primitives";

const DEPARTMENTS: readonly RegistryDepartment[] = [
  {
    key: "client",
    mark: "circle",
    name: "Client",
    summary: "The relationship goes on file first.",
    detail: "Contact details, notes, and every piece of work attach to the same client — not scattered across inboxes and spreadsheets.",
  },
  {
    key: "project",
    mark: "square",
    name: "Project",
    summary: "The work attaches to the relationship.",
    detail: "Tasks, milestones, deadlines, and budget sit on the client's record, so the plan and the history stay in one place.",
  },
  {
    key: "agreement",
    mark: "triangle",
    name: "Agreement",
    summary: "The promise lands in writing.",
    detail: "Scope and terms are sent for review, and acceptance is recorded against the project it covers.",
  },
  {
    key: "invoice",
    mark: "diamond",
    name: "Invoice",
    summary: "The money points back to the work.",
    detail: "Invoices, recorded payments, and expenses stay linked to the client and project they belong to.",
  },
  {
    key: "proof",
    mark: "semi",
    name: "Proof",
    summary: "The record goes public.",
    detail: "Finished work publishes to a portfolio that brings the next enquiry back onto the same record.",
  },
];

const FIGURES = [
  { view: "dashboard", no: "Fig. 01", name: "The overview", caption: "Cash in, costs out, and the signals worth acting on — one morning read." },
  { view: "revenue", no: "Fig. 02", name: "Revenue & invoices", caption: "What has been invoiced, collected, and needs attention across every currency." },
  { view: "calendar", no: "Fig. 03", name: "The timeline", caption: "Project dates, Google Calendar sync, and a private Apple Calendar feed." },
] as const;

const SPECIFICATION: readonly { term: string; name: string; detail: ReactNode }[] = [
  {
    term: "Clients & projects",
    name: "A relationship, not a row",
    detail: "Client details, project plans, tasks, milestones, and budgets stay attached to each other.",
  },
  {
    term: "Agreements",
    name: "Terms with a recorded answer",
    detail: (
      <>
        Draft, send, and record acceptance against the work.{" "}
        <em>Recorded acceptance is not a guarantee of enforceability in every jurisdiction.</em>
      </>
    ),
  },
  {
    term: "Invoices & expenses",
    name: "Money on the record",
    detail: (
      <>
        Issue invoices, log payments, and track expenses per client and project.{" "}
        <em>Rive records money. It does not collect or transfer funds.</em>
      </>
    ),
  },
  {
    term: "Calendar",
    name: "The dates in view",
    detail: "A workspace calendar with Google Calendar sync and a private feed for Apple Calendar.",
  },
  {
    term: "Portfolio",
    name: "The public face",
    detail: "Publish finished work and receive enquiries on the same record as the rest of the business.",
  },
  {
    term: "Import",
    name: "Bring the old file",
    detail: "CSV and XLSX import for supported records, so the record starts with history attached.",
  },
  {
    term: "Operator",
    name: "Built for one",
    detail: (
      <>
        One operator per account. <em>Shared team access is not available yet.</em>
      </>
    ),
  },
];

const ADMISSIONS_INCLUDES = [
  "Clients, projects, tasks, and milestones",
  "Agreements with recorded acceptance",
  "Invoices, payment records, and expenses",
  "Calendar with Google sync and Apple feed",
  "Portfolio publishing and enquiries",
];

const ENQUIRIES = [
  {
    question: "What does Rive cost?",
    answer: "Rive is free during the open beta. No credit card is required to register.",
  },
  {
    question: "Does Rive collect payments for me?",
    answer: "No. Rive records invoices, payments, and expenses so the money side of the work stays on the record. It does not collect or transfer funds.",
  },
  {
    question: "Is an accepted agreement legally binding?",
    answer: "Rive records the terms and the acceptance. Whether that is enforceable depends on your jurisdiction, and it is not a guarantee in every one.",
  },
  {
    question: "Can my team use one account?",
    answer: "Not yet. Rive currently supports one operator per account; shared team access is not available.",
  },
  {
    question: "Can I bring existing data?",
    answer: "Yes. CSV and XLSX import is supported for the records Rive handles, so the record can start with your history attached.",
  },
];

/** Homepage — "The Institution of One". The page reads like a public
 * register: a title page, a registry that files the business onto one
 * record, figure plates of the real workspace, a specification of
 * capabilities and limits, admissions, enquiries, and a closing plate. */
export function MarketingHome() {
  return (
    <div className="inst-home">
      {/* — Title page ———————————————————————————————————————— */}
      <section data-testid="marketing-hero" className="inst-titlepage">
        <div className="inst-container">
          <RevealOnScroll className="inst-reveal inst-titlepage__index" y={12}>
            <span className="inst-mono"><InstMark mark="circle" accent />For freelancers & small practices</span>
            <span className="inst-mono">Clients · Projects · Agreements · Invoices · Calendar · Portfolio</span>
            <span className="inst-mono">Open beta — free, no card</span>
          </RevealOnScroll>
          <div className="inst-titlepage__body">
            <div className="inst-titlepage__lead">
              <RevealOnScroll className="inst-reveal" delay={0.05}>
                <h1 className="inst-display inst-titlepage__statement">
                  One <em>record</em><br />for the whole<br />business.
                </h1>
              </RevealOnScroll>
              <RevealOnScroll className="inst-reveal inst-titlepage__abstract" delay={0.1} y={14}>
                <p>
                  Rive keeps every client, project, agreement, invoice, and deadline on a single
                  record — the workspace for freelancers and independent businesses who manage
                  several clients at once.
                </p>
              </RevealOnScroll>
            </div>
            <RevealOnScroll className="inst-reveal inst-titlepage__specimen" delay={0.12} y={18}>
              <span className="inst-mono inst-titlepage__specimen-tag">Exhibit — the register in motion</span>
              <TypeRegister />
              <span className="inst-mono inst-titlepage__specimen-note">Every department ends up filed.</span>
            </RevealOnScroll>
            <RevealOnScroll className="inst-reveal inst-titlepage__foot" delay={0.18} y={14}>
              <div className="inst-titlepage__actions">
                <MarketingButton href="/register">Start free</MarketingButton>
                <MarketingLink href="#registry">Read the register</MarketingLink>
              </div>
              <p className="inst-titlepage__assurance inst-mono">
                <InstMark mark="square" accent />Free during beta. No credit card required.
              </p>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* — Dept. 01 · The registry ———————————————————————————— */}
      <RecordJourney departments={DEPARTMENTS} />

      {/* — Dept. 02 · Figures ————————————————————————————————— */}
      <section className="inst-section inst-figures marketing-deferred-section" aria-label="Workspace figures">
        <div className="inst-container">
          <DeptRule index="02" name="Figures" note="Plates from the real workspace · sample studio" />
          <h2 className="inst-display inst-display--section inst-section__head">The workspace, on record.</h2>
          <div className="inst-figures__grid">
            {FIGURES.map((figure, index) => (
              <figure key={figure.view} className="inst-plate">
                <RevealOnScroll className="inst-reveal" delay={index * 0.06}>
                  <div className="inst-plate__frame">
                    <ResponsiveWorkspacePreview view={figure.view} />
                  </div>
                  <figcaption className="inst-plate__caption">
                    <span className="inst-mono">{figure.no} — {figure.name}</span>
                    <span>{figure.caption}</span>
                  </figcaption>
                </RevealOnScroll>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* — Manifesto —————————————————————————————————————————— */}
      <section className="inst-band inst-band--ink inst-manifesto marketing-deferred-section" aria-label="Statement">
        <div className="inst-container">
          <p className="inst-mono inst-manifesto__kicker"><InstMark mark="semi" accent />The office of one</p>
          <ManifestoLine text="The work is the record. The record is the business." />
          <p className="inst-manifesto__note">
            An independent business is a long document — who you work for, what you promised,
            what you charged, what you made. Rive keeps it in one hand.
          </p>
        </div>
      </section>

      {/* — Dept. 03 · The published record ————————————————————— */}
      <section className="inst-section inst-figures marketing-deferred-section" aria-label="Published portfolio">
        <div className="inst-container">
          <DeptRule index="03" name="The published record" note="Drafted in the workspace — set in public" />
          <h2 className="inst-display inst-display--section inst-section__head">The record, set in public.</h2>
          <div className="inst-figures__grid inst-figures__grid--doc">
            <RevealOnScroll className="inst-reveal">
              <figure className="inst-plate">
                <div className="inst-plate__frame">
                  <div className="inst-doc inst-doc--full">
                    <SpecimenFrame>
                      <PortfolioSpecimen templateKey="minimal-pro" />
                    </SpecimenFrame>
                  </div>
                  <div className="inst-doc inst-doc--opening">
                    <SpecimenFrame>
                      <PortfolioSpecimen templateKey="minimal-pro" opening />
                    </SpecimenFrame>
                  </div>
                </div>
                <figcaption className="inst-plate__caption">
                  <span className="inst-mono">Fig. 04 — Public page</span>
                  <span>Minimal pro · live render</span>
                </figcaption>
              </figure>
            </RevealOnScroll>
            <div className="inst-file">
              <RevealOnScroll className="inst-reveal" delay={0.08}>
                <div className="inst-register inst-register--dossier" data-testid="portfolio-showcase">
                  <div className="inst-register__row"><span className="inst-mono"><InstMark mark="circle" accent />Portfolio</span><span className="inst-register__name">Maya Rao — independent product designer</span></div>
                  <div className="inst-register__row"><span className="inst-mono"><InstMark mark="square" />Filed under</span><span className="inst-register__name">Product design · Bengaluru, India</span></div>
                  <div className="inst-register__row"><span className="inst-mono"><InstMark mark="triangle" />Status</span><span className="inst-register__name">Available for select engagements</span></div>
                  <div className="inst-register__row"><span className="inst-mono"><InstMark mark="diamond" />Settings</span><span className="inst-register__name">6 templates — Minimal pro shown</span></div>
                </div>
              </RevealOnScroll>
              <RevealOnScroll className="inst-reveal" delay={0.2}>
                <div className="inst-panel">
                  <span className="inst-mono inst-panel__label"><InstMark mark="circle" />Enquiries return to the record</span>
                  <h3 className="inst-panel__title">The next client arrives where the last one was filed.</h3>
                  <p className="inst-panel__body">
                    Portfolio enquiries land in the same workspace as clients, projects, and invoices —
                    so a new relationship starts on the record instead of in an inbox.
                  </p>
                  <MarketingLink href="/product/portfolio">Read the portfolio entry</MarketingLink>
                </div>
              </RevealOnScroll>
            </div>
          </div>
        </div>
      </section>

      {/* — Dept. 04 · Specification ——————————————————————————— */}
      <section className="inst-section marketing-deferred-section" aria-label="Specification">
        <div className="inst-container">
          <DeptRule index="04" name="Specification" note="Blue ink marks a boundary, not a sales line" />
          <h2 className="inst-display inst-display--section inst-section__head">Capabilities and limits, on the record.</h2>
          <RevealOnScroll className="inst-reveal">
            <div className="inst-register">
              {SPECIFICATION.map((row) => (
                <RegisterRow key={row.term} term={row.term} name={row.name} detail={row.detail} />
              ))}
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* — Dept. 05 · Admissions ————————————————————————————— */}
      <section className="inst-section marketing-deferred-section" aria-label="Admissions">
        <div className="inst-container">
          <DeptRule index="05" name="Admissions" note="Open registration during the beta" />
          <h2 className="inst-display inst-display--section inst-section__head">No fee. No card. One operator.</h2>
          <div className="inst-admit">
            <RevealOnScroll className="inst-reveal">
              <div className="inst-admit__fee">
                <div className="inst-admit__fee-head">
                  <span className="inst-mono"><InstMark mark="square" accent />Fee schedule</span>
                  <span className="inst-mono">Beta</span>
                </div>
                <span className="inst-admit__fee-value">Free</span>
                <span className="inst-admit__fee-sub">During open beta — no credit card required.</span>
                <div className="inst-admit__fee-foot">
                  <MarketingButton href="/register">Register the practice</MarketingButton>
                </div>
              </div>
            </RevealOnScroll>
            <RevealOnScroll className="inst-reveal" delay={0.06}>
              <div>
                <ul className="inst-admit__list">
                  {ADMISSIONS_INCLUDES.map((item, index) => (
                    <li key={item}>
                      <span className="inst-mono">{String(index + 1).padStart(2, "0")}</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="inst-admit__note">
                  One operator per account. Shared team access is not available yet.
                </p>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* — Dept. 06 · Enquiries ——————————————————————————————— */}
      <section className="inst-section marketing-deferred-section" aria-label="Enquiries">
        <div className="inst-container">
          <DeptRule index="06" name="Enquiries" note="Answered on the record" />
          <h2 className="inst-display inst-display--section inst-section__head">Questions asked most.</h2>
          <FaqAccordion items={ENQUIRIES} />
        </div>
      </section>

      {/* — Closing plate —————————————————————————————————————— */}
      <section className="inst-band inst-band--ink inst-closing marketing-deferred-section" aria-label="Begin">
        <div className="inst-container inst-closing__grid">
          <RevealOnScroll className="inst-reveal">
            <p className="inst-mono"><InstMark mark="semi" accent />File no. 001 awaits a name</p>
            <h2 className="inst-display inst-display--section" style={{ marginTop: "1rem" }}>
              Start your record.
            </h2>
            <p className="inst-body" style={{ marginTop: "1.25rem" }}>
              Registration is free during the open beta. Bring a client; the record does the rest.
            </p>
            <div className="inst-closing__action">
              <MarketingButton href="/register">Start free</MarketingButton>
              <MarketingLink href="/product/clients-projects">Read the register</MarketingLink>
            </div>
          </RevealOnScroll>
          <RevealOnScroll className="inst-reveal" delay={0.08}>
            <RecordArtifact phase={4} inline />
          </RevealOnScroll>
        </div>
      </section>
    </div>
  );
}
