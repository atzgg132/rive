import { Mail } from "lucide-react";
import { ContactForm } from "@/components/marketing/ContactForm";
import { GlassPanel, GlowingBadge } from "@/components/marketing/primitives";
import { SectionShell } from "@/components/marketing/shells";
import { contactContent } from "@/content/marketing/resources";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Contact Rive", "Bring Rive a question, support request, press inquiry, partnership, or broken operating handoff.", "/contact");

export default function ContactPage() {
  return (
    <SectionShell className="pb-28 pt-36 sm:pt-44">
      <div className="max-w-5xl">
        <GlowingBadge>{contactContent.eyebrow}</GlowingBadge>
        <h1 className="mt-7 text-balance text-5xl font-black leading-[0.98] tracking-[-0.055em] text-white sm:text-7xl">{contactContent.title}</h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300">{contactContent.intro}</p>
      </div>
      <div className="mt-14 grid gap-6 lg:grid-cols-[1.3fr_.7fr] lg:items-start">
        <GlassPanel tier={3} className="p-6 sm:p-8"><ContactForm copy={contactContent.form} /></GlassPanel>
        <GlassPanel tier={2} className="p-6 sm:p-8">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-blue-300/15 bg-blue-400/[0.07] text-blue-300"><Mail className="h-5 w-5" /></span>
          <h2 className="mt-8 text-2xl font-black text-white">{contactContent.asideTitle}</h2>
          <a className="marketing-focus mt-4 inline-block text-xl font-black text-blue-300 hover:text-blue-200" href={`mailto:${contactContent.email}`}>{contactContent.email}</a>
          <p className="mt-4 text-sm leading-7 text-slate-400">{contactContent.asideBody}</p>
        </GlassPanel>
      </div>
    </SectionShell>
  );
}
