import type { Metadata } from "next";
import { OG_IMAGE } from "@/lib/siteMetadata";

const siteUrl = "https://www.rive.work";

/* Next replaces a segment's `openGraph` wholesale rather than merging the
   parent's into it, dropping the images src/app/opengraph-image.tsx contributes
   at the root. Restating them here is what keeps these pages' cards from
   shipping empty. */
const images = [OG_IMAGE];

export function marketingMetadata(title: string, description: string, path = "/"): Metadata {
  const url = new URL(path, siteUrl).toString();
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Rive",
      url,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}
