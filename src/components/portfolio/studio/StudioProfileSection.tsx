"use client";

import { Button, Input, Textarea } from "@/components/ui";
import { Upload } from "lucide-react";
import { MAX_TAGLINE_LENGTH, templateEyebrow, type PortfolioContent } from "@/utils/portfolio";
import { inputClass, labelClass, sectionClass } from "@/components/portfolio/studio/studioStyles";

/* Validated portfolio uploads and remote image hosts cannot use a static Next image allowlist. */
/* eslint-disable @next/next/no-img-element */

type Props = {
  content: PortfolioContent;
  slug: string;
  templateKey: string;
  saving: boolean;
  onUpdateContent: (update: Partial<PortfolioContent>) => void;
  onUpdateSlug: (value: string) => void;
  onUploadProfileImage: (file: File | undefined) => void;
  onPersistProfileImage: (profileImageUrl: string, message: string) => void;
};

export default function StudioProfileSection({
  content,
  slug,
  templateKey,
  saving,
  onUpdateContent,
  onUpdateSlug,
  onUploadProfileImage,
  onPersistProfileImage,
}: Props) {
  return (
    <section className={sectionClass}>
      <div className="mb-5">
        <h2 className="font-bold text-foreground dark:text-white">Basic profile</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">Add a name, headline, introduction, and contact email before you publish. Location and availability are optional.</p>
      </div>
      <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 dark:border-slate-800 sm:flex-row sm:items-center">
        <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 text-2xl font-black text-slate-400 dark:bg-slate-800">
          {content.profileImageUrl ? <img src={content.profileImageUrl} alt="" className="h-full w-full object-cover" /> : (content.name || "Y").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground dark:text-white">Profile photo</p>
          <p className="mt-1 max-w-lg text-xs leading-5 text-slate-500 dark:text-slate-400">Used in your public portfolio hero and synced from onboarding. A square portrait with a simple background works best.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
              <Upload className="h-3.5 w-3.5" /> Upload photo
              <Input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { onUploadProfileImage(event.target.files?.[0]); event.currentTarget.value = ""; }} />
            </label>
            {content.profileImageUrl && <Button type="button" onClick={() => onPersistProfileImage("", "profile photo removed")} disabled={saving} className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Remove</Button>}
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2"><span className={labelClass}>Display name</span><Input className={inputClass} value={content.name || ""} placeholder="Your name" onChange={(event) => onUpdateContent({ name: event.target.value })} /></label>
        <label className="flex flex-col gap-2"><span className={labelClass}>Public URL</span><div className="flex items-center"><span className="rounded-l-xl border border-r-0 border-border bg-slate-50 px-3 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800">/p/</span><Input className={`${inputClass} rounded-l-none`} value={slug} placeholder="your-name" onChange={(event) => onUpdateSlug(event.target.value)} /></div></label>
        {/* Above the headline here because it is above the headline there. The
            placeholder is the template's own line, so the field explains where
            that text on the live site is coming from just by existing. */}
        <label className="flex flex-col gap-2 sm:col-span-2">
          <span className={labelClass}>Tagline <span className="font-normal normal-case tracking-normal text-slate-400">the small line above your headline</span></span>
          <Input className={inputClass} value={content.tagline || ""} maxLength={MAX_TAGLINE_LENGTH} placeholder={templateEyebrow(templateKey)} onChange={(event) => onUpdateContent({ tagline: event.target.value })} />
          <span className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">Leave it blank to use your template&apos;s wording — currently &ldquo;{templateEyebrow(templateKey)}&rdquo;.</span>
        </label>
        <label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>Headline</span><Input className={inputClass} value={content.headline || ""} placeholder="e.g. product designer and developer building clear, useful products" onChange={(event) => onUpdateContent({ headline: event.target.value })} /></label>
        <label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>About</span><Textarea rows={4} className={inputClass} value={content.bio || ""} placeholder="Tell people what you do, who you help, and what makes your work different." onChange={(event) => onUpdateContent({ bio: event.target.value })} /></label>
        <label className="flex flex-col gap-2"><span className={labelClass}>Location</span><Input className={inputClass} value={content.location || ""} placeholder="e.g. Bengaluru, India · working worldwide" onChange={(event) => onUpdateContent({ location: event.target.value })} /></label>
        <label className="flex flex-col gap-2"><span className={labelClass}>Availability</span><Input className={inputClass} value={content.availability || ""} placeholder="e.g. available for select projects" onChange={(event) => onUpdateContent({ availability: event.target.value })} /></label>
        <label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>Contact email</span><Input type="email" className={inputClass} value={content.contactEmail || ""} onChange={(event) => onUpdateContent({ contactEmail: event.target.value })} placeholder="you@example.com" /></label>
      </div>
    </section>
  );
}
