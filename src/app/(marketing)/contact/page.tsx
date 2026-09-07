import { ArrowUpRight, Mail } from "lucide-react";
import { ContactForm } from "@/components/marketing/ContactForm";
import { EditorialLabel } from "@/components/marketing/primitives";
import { contactContent } from "@/content/marketing/resources";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Contact Rive", "Ask a product question, get help, or share feedback with the people building Rive.", "/contact");

export default function ContactPage() {
  return (
    <section className="edition-contact-page"><div className="edition-container"><div className="edition-contact-heading"><EditorialLabel>{contactContent.eyebrow}</EditorialLabel><h1 className="edition-display">{contactContent.title}</h1><p>{contactContent.intro}</p></div><div className="edition-contact-grid"><div className="edition-contact-form"><ContactForm copy={contactContent.form} /></div><aside><Mail className="h-5 w-5" /><h2>{contactContent.asideTitle}</h2><a href={`mailto:${contactContent.email}`} className="marketing-focus">{contactContent.email}<ArrowUpRight className="h-4 w-4" /></a><p>{contactContent.asideBody}</p></aside></div></div></section>
  );
}
