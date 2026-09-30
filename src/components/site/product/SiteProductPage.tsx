import type { ProductPageCopy } from "@/content/site/products";

export function SiteProductPage({ slug }: { slug: ProductPageCopy["slug"]; importAvailable?: boolean }) {
  return <section data-stub="product" style={{ minHeight: "80vh" }}>{slug}</section>;
}
