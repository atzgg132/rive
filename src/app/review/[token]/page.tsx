import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agreement review — rive.",
  robots: { index: false, follow: false },
};

function forwardSearch(searchParams: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
    else if (typeof value === "string") params.append(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Compatibility entry point for bearer review links. It forwards to the
 * session-exchange route handler, which validates the link, mints the
 * purpose-bound HttpOnly session cookie, and lands the browser on the clean
 * /review page — the raw token never stays in the address bar.
 *
 * The forward is a document navigation (meta refresh + inline script), not a
 * server-component redirect: an async page always renders after the shell has
 * flushed, so redirect() would travel through the flight stream and race the
 * client router's initialization. A plain navigation has no router dependency.
 */
export default async function ContractReviewTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = forwardSearch(await searchParams);
  const href = `/api/public/contracts/review/${encodeURIComponent(token)}/session${query}`;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-foreground">
      <meta httpEquiv="refresh" content={`0;url=${href}`} />
      <script dangerouslySetInnerHTML={{ __html: `window.location.replace(${JSON.stringify(href)});` }} />
      <p className="text-sm text-muted-foreground">
        Opening your Agreement review…{" "}
        <a className="text-primary underline underline-offset-2" href={href}>
          Continue
        </a>
      </p>
    </main>
  );
}
