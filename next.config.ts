import type { NextConfig } from "next";

/* Public portfolios embed players from these hosts and nowhere else. The
   allowlist mirrors the providers in src/utils/portfolioEmbeds.ts; adding a
   provider there without adding it here leaves its player blank. */
const EMBED_FRAME_HOSTS = [
  "https://www.youtube-nocookie.com",
  "https://www.youtube.com",
  "https://player.vimeo.com",
  "https://www.loom.com",
  "https://geo.dailymotion.com",
  "https://w.soundcloud.com",
  "https://open.spotify.com",
  "https://bandcamp.com",
  "https://embed.music.apple.com",
  "https://player-widget.mixcloud.com",
];

/* A nonce policy would force every marketing page to render dynamically, so
   this keeps static output and blocks third-party script hosts while allowing
   Next's inline bootstraps. Development additionally needs eval for React's
   debugging transforms. */
const scriptSrc = `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`;
const contentSecurityPolicy = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  `frame-src 'self' ${EMBED_FRAME_HOSTS.join(" ")}`,
  // Portfolio owners may reference any HTTPS image host, plus inline uploads.
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Accel-Buffering", value: "no" },
];

const sensitiveRouteHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cache-Control", value: "private, no-store" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  deploymentId: process.env.DEPLOYMENT_VERSION,
  // The local app is routinely opened through 127.0.0.1 while Next starts on
  // localhost. Allow the dev HMR endpoint from both local hostnames.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      { source: "/sign", headers: sensitiveRouteHeaders },
      { source: "/sign/:token", headers: sensitiveRouteHeaders },
      { source: "/review", headers: sensitiveRouteHeaders },
      { source: "/review/:token", headers: sensitiveRouteHeaders },
      { source: "/invoice/:token", headers: sensitiveRouteHeaders },
      { source: "/api/public/invoices/:path*", headers: sensitiveRouteHeaders },
      { source: "/api/public/contracts/:path*", headers: sensitiveRouteHeaders },
      {
        source: "/fonts/:path*",
        headers: [
          // Next's public-file default is max-age=0, so every visit re-downloaded
          // the LCP typeface. These files change only when replaced; rename them
          // if the bytes change so caches cannot keep a stale face.
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
