import type { PortfolioMedia, PortfolioMediaSettings } from "@/utils/portfolio";
import MediaAudio from "./MediaAudio";
import MediaDocument from "./MediaDocument";
import MediaEmbed from "./MediaEmbed";
import MediaImage from "./MediaImage";
import MediaVideo from "./MediaVideo";

type Props = {
  media: PortfolioMedia;
  settings: PortfolioMediaSettings;
  className?: string;
  inline?: boolean;
  /** Fill an already-framed slot, such as a project card's cover area. */
  fill?: boolean;
};

/** Route one media item to the presentation built for its type. */
export default function PortfolioMediaBlock({ media, settings, className, inline, fill }: Props) {
  if (!media.url) return null;
  switch (media.kind) {
    case "video":
      return <MediaVideo media={media} settings={settings} className={className} fill={fill} />;
    case "audio":
      return <MediaAudio media={media} settings={settings} className={className} />;
    case "embed":
      return <MediaEmbed media={media} settings={settings} className={className} fill={fill} />;
    case "document":
      return <MediaDocument media={media} settings={settings} className={className} inline={inline} />;
    default:
      return <MediaImage media={media} settings={settings} className={className} />;
  }
}

const LAYOUT_CLASS: Record<PortfolioMediaSettings["layout"], string> = {
  grid: "grid gap-6 md:grid-cols-2",
  masonry: "columns-1 gap-6 sm:columns-2 [&>*]:mb-6 [&>*]:break-inside-avoid",
  carousel: "flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [&>*]:w-[85%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-[48%]",
};

/** Arrange a project's media in the owner's chosen layout. */
export function PortfolioMediaGallery({
  media,
  settings,
  className = "",
}: {
  media: PortfolioMedia[];
  settings: PortfolioMediaSettings;
  className?: string;
}) {
  const items = media.filter((item) => item.url);
  if (items.length === 0) return null;

  return (
    <div className={`${LAYOUT_CLASS[settings.layout] || LAYOUT_CLASS.grid} ${className}`}>
      {items.map((item, index) => (
        <PortfolioMediaBlock
          key={item.id}
          media={item}
          settings={settings}
          /* In a grid, a lone leading image earns the full width. */
          className={settings.layout === "grid" && index % 3 === 0 && item.kind !== "audio" && item.kind !== "document" ? "md:col-span-2" : ""}
        />
      ))}
    </div>
  );
}
