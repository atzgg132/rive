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

/* Deliberately omits default-src and script-src. Next injects inline bootstrap
   scripts, so locking those down needs nonce plumbing and a full runtime test
   pass; shipping a broad script policy now would either break the app or be
   security theatre. These directives are the ones that constrain the surface
   this app actually exposes — user-supplied media, embeds, and forms — and
   none of them can break first-party rendering. */
const contentSecurityPolicy = [
  `frame-src 'self' ${EMBED_FRAME_HOSTS.join(" ")}`,
  // Portfolio owners may reference any HTTPS image host, plus inline uploads.
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

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
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Accel-Buffering", value: "no" },
        ],
      },
    ];
  },
};

export default nextConfig;
