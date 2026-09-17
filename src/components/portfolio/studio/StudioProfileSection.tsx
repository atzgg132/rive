"use client";

import { Input, Textarea } from "@/components/ui";
import { MAX_TAGLINE_LENGTH, templateEyebrow, type PortfolioContent } from "@/utils/portfolio";
import { inputClass, labelClass, sectionClass } from "@/components/portfolio/studio/studioStyles";
import StudioProfileImageEditor from "@/components/portfolio/studio/StudioProfileImageEditor";

type Props = {
  content: PortfolioContent;
  slug: string;
  slugError?: string;
  templateKey: string;
  saving: boolean;
  onUpdateContent: (update: Partial<PortfolioContent>) => void;
  onUpdateSlug: (value: string) => void;
  onUploadProfileImage: (file: File | undefined, sourceFile?: File) => Promise<boolean>;
  onPersistProfileImage: (profileImageUrl: string, message: string, profileImageSourceUrl?: string) => void;
};

export default function StudioProfileSection({
  content,
  slug,
  slugError,
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
        <h2 className="font-bold text-foreground">Basic profile</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Add a name, headline, introduction, and contact email before you publish. Location and availability are optional.</p>
      </div>
      <StudioProfileImageEditor
        imageUrl={content.profileImageUrl}
        sourceImageUrl={content.profileImageSourceUrl}
        name={content.name}
        showOnPortfolio={content.showProfileImage}
        saving={saving}
        onShowOnPortfolioChange={(showProfileImage) => onUpdateContent({ showProfileImage })}
        onUpload={onUploadProfileImage}
        onRemove={() => onPersistProfileImage("", "profile photo removed")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2"><span className={labelClass}>Display name</span><Input className={inputClass} value={content.name || ""} placeholder="Your name" onChange={(event) => onUpdateContent({ name: event.target.value })} /></label>
        <label className="flex flex-col gap-2"><span className={labelClass}>Public URL</span><div className="flex items-center"><span className="rounded-none border border-r-0 border-input bg-muted px-3 py-2.5 text-xs text-muted-foreground">/p/</span><Input className={`${inputClass} rounded-l-none`} value={slug} placeholder="your-name" onChange={(event) => onUpdateSlug(event.target.value)} aria-invalid={Boolean(slugError)} aria-describedby={slugError ? "portfolio-slug-help portfolio-slug-error" : "portfolio-slug-help"} /></div><span id="portfolio-slug-help" className="text-xs leading-4 text-muted-foreground">Live at /p/{slug || "your-name"} · lowercase letters, numbers, and dashes.</span>{slugError && <span id="portfolio-slug-error" role="alert" className="text-xs font-semibold text-destructive">{slugError}</span>}</label>
        {/* Above the headline here because it is above the headline there. The
            placeholder is the template's own line, so the field explains where
            that text on the live site is coming from just by existing. */}
        <label className="flex flex-col gap-2 sm:col-span-2">
          <span className={labelClass}>Tagline <span className="font-normal normal-case tracking-normal text-muted-foreground">the small line above your headline</span></span>
          <Input className={inputClass} value={content.tagline || ""} maxLength={MAX_TAGLINE_LENGTH} placeholder={templateEyebrow(templateKey)} onChange={(event) => onUpdateContent({ tagline: event.target.value })} />
          <span className="text-xs leading-4 text-muted-foreground">Leave it blank to use your template&apos;s wording — currently &ldquo;{templateEyebrow(templateKey)}&rdquo;.</span>
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
