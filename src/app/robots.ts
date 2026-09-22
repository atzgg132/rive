import type { MetadataRoute } from "next";

const siteUrl = "https://www.rive.work";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/calendar",
        "/dashboard",
        "/forgot-password",
        "/invoice/",
        "/login",
        "/migrate",
        "/onboarding",
        "/portfolio",
        "/portfolio-preview",
        "/register",
        "/reset-password",
        "/review/",
        "/sign/",
        "/verify-email",
        "/workflow",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
