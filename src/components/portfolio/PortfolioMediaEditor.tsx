"use client";

import { Button, Input, Textarea } from "@/components/ui";
import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  Check,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Link2,
  Loader2,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { uploadMedia } from "@/utils/clientUploads";
import { parseEmbedInput } from "@/utils/portfolioEmbeds";
import { MAX_MEDIA_PER_PROJECT, PORTFOLIO_MEDIA_LIMITS } from "@/utils/portfolioMedia";
import type { PortfolioMedia } from "@/utils/portfolio";

/* Validated portfolio uploads and remote hosts cannot use a static Next image allowlist. */
/* eslint-disable @next/next/no-img-element */

const inputClass = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-blue-950";
const labelClass = "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:text-slate-400";

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Short, provider-specific instructions. Copying an embed is a menu path
 *  people rarely remember, and guessing wrong is the main reason a paste
 *  fails, so the steps sit right next to the field. */
const EMBED_GUIDE: { group: string; items: { name: string; steps: string }[] }[] = [
  {
    group: "Video",
    items: [
      { name: "YouTube", steps: "Open the video → Share → Embed → Copy. Paste the whole code, or just the video link." },
      { name: "Vimeo", steps: "Open the video → Share → Embed → Copy. Private videos keep working: paste the link with its ?h= code." },
      { name: "Loom", steps: "Open the recording → Share → Embed → Copy, or paste the loom.com/share link." },
      { name: "Dailymotion", steps: "Open the video → Share → Embed video → Copy." },
    ],
  },
  {
    group: "Audio",
    items: [
      { name: "SoundCloud", steps: "Open the track → Share → Embed → Copy the code, or paste the track link." },
      { name: "Spotify", steps: "Track or album → ⋯ → Share → Copy link to track." },
      { name: "Bandcamp", steps: "Open the album → Share / Embed → Embed this album → copy the code. Bandcamp needs the full code, not the page link." },
      { name: "Apple Music", steps: "Song or album → ⋯ → Share → Copy Link." },
      { name: "Mixcloud", steps: "Open the show → Share → Embed → Copy." },
    ],
  },
];

const KIND_ICON = {
  image: ImageIcon,
  video: Video,
  audio: AudioLines,
  document: FileText,
  embed: Link2,
} as const;

function uploadHint(): string {
  const { video, audio, image, document: pdf } = PORTFOLIO_MEDIA_LIMITS;
  const mb = (bytes: number) => Math.floor(bytes / 1024 / 1024);
  return `Images to ${mb(image.maxBytes)} MB · video to ${mb(video.maxBytes)} MB and ${(video.maxDurationSeconds || 0) / 60} min · audio to ${mb(audio.maxBytes)} MB · PDF to ${mb(pdf.maxBytes)} MB`;
}

type StorageUsage = { usedBytes: number; quotaBytes: number; percentUsed: number };

function formatMegabytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 100 ? `${Math.round(megabytes)} MB` : `${megabytes.toFixed(1)} MB`;
}

/** Shows what the account is using, so the cap is never a surprise 409. */
function StorageMeter({ usage }: { usage: StorageUsage }) {
  const tight = usage.percentUsed >= 80;
  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className="text-slate-600 dark:text-slate-300">Upload storage</span>
        <span className={tight ? "text-amber-600 dark:text-amber-400" : "text-slate-500"}>
          {formatMegabytes(usage.usedBytes)} of {formatMegabytes(usage.quotaBytes)}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-full rounded-full transition-all ${tight ? "bg-amber-500" : "bg-blue-600"}`}
          style={{ width: `${Math.max(usage.percentUsed, 2)}%` }}
        />
      </div>
      {tight && (
        <p className="mt-2 text-[11px] leading-4 text-amber-700 dark:text-amber-300">
          Running low. Pasted links are hosted by their platform and use none of this.
        </p>
      )}
    </div>
  );
}

type Props = {
  media: PortfolioMedia[];
  onChange: (media: PortfolioMedia[]) => void;
};

export default function PortfolioMediaEditor({ media, onChange }: Props) {
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [linkValue, setLinkValue] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<StorageUsage | null>(null);

  /* An upload can run for a minute, and only the file input is disabled while
     it does — the visitor can still reorder, retitle, or delete existing items.
     Appending to the `media` captured when the upload started would throw all
     of that away the moment it finished, so the append reads the latest list
     instead. */
  const latestMedia = useRef(media);
  useEffect(() => { latestMedia.current = media; }, [media]);

  const refreshUsage = useCallback(() => {
    fetch("/api/portfolio/storage")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (data?.success) setUsage(data.storage); })
      .catch(() => undefined);
  }, []);

  // Only fetched when the upload panel is open; linked media never uses storage.
  useEffect(() => {
    if (mode === "upload" && !usage) refreshUsage();
  }, [mode, usage, refreshUsage]);

  const preview = linkValue.trim() ? parseEmbedInput(linkValue) : null;
  const atLimit = media.length >= MAX_MEDIA_PER_PROJECT;

  const addEmbed = () => {
    if (!preview) {
      toast.error("That link is not from a supported platform.");
      return;
    }
    if (atLimit) {
      toast.error(`You can add up to ${MAX_MEDIA_PER_PROJECT} media items per project.`);
      return;
    }
    onChange([...media, {
      id: id("media"),
      kind: "embed",
      url: preview.embedUrl,
      sourceUrl: preview.pageUrl,
      provider: preview.provider,
      posterUrl: preview.posterUrl,
      embedHeight: preview.embedHeight,
      alt: "",
      caption: "",
    }]);
    setLinkValue("");
    toast.success("Media added.");
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files).slice(0, Math.max(0, MAX_MEDIA_PER_PROJECT - media.length));
    if (selected.length === 0) {
      toast.error(`You can add up to ${MAX_MEDIA_PER_PROJECT} media items per project.`);
      return;
    }
    setBusy(true);
    const added: PortfolioMedia[] = [];
    for (const file of selected) {
      try {
        const asset = await uploadMedia(file);
        added.push({
          id: id("media"),
          kind: asset.kind,
          url: asset.url,
          // Capped to the same 300 characters the server enforces, so an
          // unusually long filename cannot turn into a rejected save.
          alt: file.name.replace(/\.[^.]+$/, "").slice(0, 300),
          caption: "",
          posterUrl: asset.posterUrl,
          durationSeconds: asset.durationSeconds,
          aspectRatio: asset.aspectRatio,
          peaks: asset.peaks,
          bytes: asset.bytes,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `${file.name} could not be uploaded.`);
      }
    }
    setBusy(false);
    if (added.length > 0) {
      // Re-check the cap against the current list: edits made while the upload
      // ran could have already filled it.
      const room = Math.max(0, MAX_MEDIA_PER_PROJECT - latestMedia.current.length);
      const kept = added.slice(0, room);
      if (kept.length < added.length) {
        toast.error(`Only ${kept.length} could be added — a project holds up to ${MAX_MEDIA_PER_PROJECT} media items.`);
      }
      if (kept.length > 0) {
        onChange([...latestMedia.current, ...kept]);
        toast.success(`${kept.length} file${kept.length === 1 ? "" : "s"} added.`);
      }
    }
    refreshUsage();
  };

  const update = (mediaId: string, patch: Partial<PortfolioMedia>) => {
    onChange(media.map((item) => (item.id === mediaId ? { ...item, ...patch } : item)));
  };

  const move = (index: number, delta: number) => {
    const next = [...media];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const acceptedUploadTypes = Object.values(PORTFOLIO_MEDIA_LIMITS)
    .flatMap((limit) => Object.keys(limit.types))
    .join(",");

  return (
    <div className="border-t border-slate-200 p-4 dark:border-slate-700">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-foreground dark:text-white">Project media</p>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            {media.length} of {MAX_MEDIA_PER_PROJECT} added · images, video, audio, and PDFs
          </p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
          {([
            { key: "link", label: "Paste a link", icon: Link2 },
            { key: "upload", label: "Upload files", icon: Upload },
          ] as const).map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              aria-pressed={mode === key}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                mode === key ? "bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300" : "text-slate-500"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </Button>
          ))}
        </div>
      </div>

      {mode === "link" ? (
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Video or audio link</span>
            <Textarea
              rows={2}
              className={inputClass}
              value={linkValue}
              placeholder="Paste a YouTube, Vimeo, SoundCloud, or Spotify link — or the full embed code"
              onChange={(event) => setLinkValue(event.target.value)}
            />
          </label>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-h-6 text-[11px] font-semibold">
              {linkValue.trim() && preview && (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Recognised as {preview.provider === "applemusic" ? "Apple Music" : preview.provider}
                </span>
              )}
              {linkValue.trim() && !preview && (
                <span className="text-amber-600 dark:text-amber-400">
                  Not a supported link yet. Check the steps below for your platform.
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => setGuideOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                <HelpCircle className="h-3.5 w-3.5" /> How do I get this?
              </Button>
              <Button
                type="button"
                onClick={addEmbed}
                disabled={!preview || atLimit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
              >
                Add media
              </Button>
            </div>
          </div>

          {guideOpen && (
            <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 dark:border-slate-700 sm:grid-cols-2">
              {EMBED_GUIDE.map((section) => (
                <div key={section.group}>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">{section.group}</p>
                  <dl className="mt-2 flex flex-col gap-2">
                    {section.items.map((item) => (
                      <div key={item.name}>
                        <dt className="text-[11px] font-bold text-foreground dark:text-white">{item.name}</dt>
                        <dd className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">{item.steps}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
              <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400 sm:col-span-2">
                Linked media is hosted by the platform, so there is no size or length limit and it does not use your storage.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
          <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition ${busy ? "border-slate-300 opacity-60" : "border-blue-300 hover:border-blue-500 dark:border-blue-700"}`}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> : <Upload className="h-5 w-5 text-blue-600" />}
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
              {busy ? "Uploading…" : "Choose files to upload"}
            </span>
            <span className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">{uploadHint()}</span>
            <Input
              type="file"
              multiple
              accept={acceptedUploadTypes}
              disabled={busy}
              className="sr-only"
              onChange={(event) => { void addFiles(event.target.files); event.currentTarget.value = ""; }}
            />
          </label>
          {usage && <StorageMeter usage={usage} />}
          <p className="mt-3 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            For longer or higher-quality video and audio, paste a link instead — the platform hosts it, so no limits apply.
          </p>
        </div>
      )}

      {media.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {media.map((item, index) => {
            const Icon = KIND_ICON[item.kind] || ImageIcon;
            const thumbnail = item.kind === "image" ? item.url : item.posterUrl;
            return (
              <li key={item.id} className="grid gap-3 py-3 sm:grid-cols-[56px_1fr_auto]">
                <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
                  {thumbnail ? <img src={thumbnail} alt="" className="h-full w-full object-cover" /> : <Icon className="h-5 w-5" />}
                </div>
                <div className="grid min-w-0 gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <Icon className="h-3 w-3" /> {item.provider || item.kind}
                    </span>
                    {item.durationSeconds ? (
                      <span className="text-[10px] font-bold tabular-nums text-slate-400">
                        {Math.floor(item.durationSeconds / 60)}:{String(item.durationSeconds % 60).padStart(2, "0")}
                      </span>
                    ) : null}
                  </div>
                  <Input
                    className={inputClass}
                    value={item.alt}
                    placeholder={item.kind === "audio" ? "Track title" : "Accessible description"}
                    onChange={(event) => update(item.id, { alt: event.target.value })}
                  />
                  <Input
                    className={inputClass}
                    value={item.caption}
                    placeholder="Caption (optional)"
                    onChange={(event) => update(item.id, { caption: event.target.value })}
                  />
                </div>
                <div className="flex gap-1 self-start">
                  <Button type="button" title="Move up" aria-label="Move media up" disabled={index === 0} onClick={() => move(index, -1)} className="rounded-lg p-2 text-slate-400 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" title="Move down" aria-label="Move media down" disabled={index === media.length - 1} onClick={() => move(index, 1)} className="rounded-lg p-2 text-slate-400 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" title="Remove media" aria-label="Remove media" onClick={() => onChange(media.filter((entry) => entry.id !== item.id))} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
