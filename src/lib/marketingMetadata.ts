import type { Metadata } from "next";

const siteUrl = "https://www.rive.work";

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
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
