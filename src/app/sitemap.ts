import type { MetadataRoute } from "next";
import { marketingRouteMetadata } from "@/content/marketing/nav";

const siteUrl = "https://www.rive.work";

export default function sitemap(): MetadataRoute.Sitemap {
  return marketingRouteMetadata.map((route) => ({
    url: new URL(route.path, siteUrl).toString(),
    changeFrequency: route.path === "/" || route.path === "/changelog" ? "weekly" : "monthly",
    priority: route.priority,
  }));
}
