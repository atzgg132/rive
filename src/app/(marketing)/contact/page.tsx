import { ArrowUpRight, Mail } from "lucide-react";
import { ContactForm } from "@/components/marketing/ContactForm";
import { contactContent } from "@/content/marketing/resources";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Contact Rive", "Ask a product question, get help, or share feedback with the people building Rive.", "/contact");

export default function ContactPage() {
  return (
    <section className="inst-reading">
      <div className="inst-container">
        <div className="inst-reading__head">
          <span className="inst-mono">{contactContent.eyebrow}</span>
          <h1 className="inst-display" style={{ marginTop: "1.25rem" }}>{contactContent.title}</h1>
          <p className="inst-body">{contactContent.intro}</p>
        </div>
        <div className="inst-reading__body inst-contact-grid">
          <div className="inst-panel" style={{ padding: "clamp(1.5rem, 3vw, 2.5rem)" }}>
            <ContactForm copy={contactContent.form} />
          </div>
          <aside className="inst-panel">
            <span className="inst-mono inst-panel__label">Direct line</span>
            <Mail className="h-5 w-5" aria-hidden="true" style={{ color: "var(--inst-ink)" }} />
            <h2 className="inst-panel__title" style={{ marginTop: "1rem" }}>{contactContent.asideTitle}</h2>
            <a href={`mailto:${contactContent.email}`} className="marketing-focus inst-link">
              {contactContent.email}<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <p className="inst-panel__body" style={{ marginTop: "1.25rem", marginBottom: 0 }}>{contactContent.asideBody}</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
