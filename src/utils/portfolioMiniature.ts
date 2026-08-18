import type { PortfolioContent } from "@/utils/portfolio";

/**
 * A portfolio cut down to what a thumbnail can actually show.
 *
 * The template gallery renders the real renderer with the owner's real work,
 * because six gradient swatches tell you nothing about six templates. But a
 * miniature is a still image of a layout, not a working page: at a fifth of
 * full size nobody reads the fourth testimonial, and mounting the untrimmed
 * portfolio would load every video, every audio waveform and every YouTube
 * embed — each embed being another iframe — for a card the size of a postcard.
 *
 * So the miniature keeps the shape and drops the payload. Enough projects to
 * show how the grid behaves, images only, and playback off. What differs
 * between templates is the composition, and the composition survives all of it.
 */

/** Enough to show a grid, few enough to stay cheap. */
export const MINIATURE_PROJECTS = 3;
export const MINIATURE_SERVICES = 3;
export const MINIATURE_MEDIA_PER_PROJECT = 2;

export function miniatureContent(content: PortfolioContent): PortfolioContent {
  return {
    ...content,
    projects: content.projects.slice(0, MINIATURE_PROJECTS).map((project) => ({
      ...project,
      // Images only: video, audio and embeds cost network and extra frames to
      // render something illegible at this size.
      media: (project.media || []).filter((item) => item.kind === "image").slice(0, MINIATURE_MEDIA_PER_PROJECT),
      gallery: (project.gallery || []).slice(0, MINIATURE_MEDIA_PER_PROJECT),
    })),
    services: content.services.slice(0, MINIATURE_SERVICES),
    testimonials: content.testimonials.slice(0, 1),
    mediaSettings: {
      ...content.mediaSettings,
      autoplayOnScroll: false,
      hoverPreview: false,
      lightbox: false,
      loop: false,
    },
  };
}
