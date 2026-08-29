/* Structured data names production from every environment. A dev deploy that
   identified itself would compete with production in search results. */
export const PRODUCTION_ORIGIN = "https://www.rive.work";

export const deploymentOrigin = process.env.APP_URL || PRODUCTION_ORIGIN;

export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Rive — run your service business in one connected workspace",
} as const;
