/* Canonicals and structured-data identity name production even from a dev
   deploy, or dev.rive.work competes with production in search results. Only
   metadataBase follows the running host, so relative asset paths resolve. */
export const PRODUCTION_ORIGIN = "https://www.rive.work";

export const deploymentOrigin = process.env.APP_URL || PRODUCTION_ORIGIN;

export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Rive — run your service business in one connected workspace",
} as const;
