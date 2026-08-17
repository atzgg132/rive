/** Upload limits, format allowlists, and content-signature checks for portfolio media.
 *
 * Uploads go straight to object storage from the browser, so the app never sees
 * the bytes at write time. The declared size is still trustworthy because it is
 * bound into the presigned request, but the declared content type is only the
 * browser's claim — so every upload is confirmed against its magic bytes before
 * the asset becomes usable.
 *
 * Caps are deliberately tight. Anyone who needs a longer or higher-quality piece
 * is better served by an embed, which costs this app no storage and no egress.
 */

export type PortfolioAssetKind = "image" | "video" | "audio" | "document";

export type PortfolioMediaLimit = {
  label: string;
  maxBytes: number;
  maxDurationSeconds?: number;
  perPortfolio: number;
  /** Content type to file extension. Also the accepted-format allowlist. */
  types: Record<string, string>;
};

const MB = 1024 * 1024;

export const PORTFOLIO_MEDIA_LIMITS: Record<PortfolioAssetKind, PortfolioMediaLimit> = {
  image: {
    label: "image",
    maxBytes: 10 * MB,
    perPortfolio: 60,
    types: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/avif": "avif",
    },
  },
  video: {
    label: "video",
    maxBytes: 150 * MB,
    maxDurationSeconds: 180,
    perPortfolio: 6,
    types: {
      "video/mp4": "mp4",
      "video/webm": "webm",
    },
  },
  audio: {
    label: "audio",
    maxBytes: 25 * MB,
    maxDurationSeconds: 600,
    perPortfolio: 12,
    types: {
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "audio/aac": "aac",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
    },
  },
  document: {
    label: "document",
    maxBytes: 20 * MB,
    perPortfolio: 6,
    types: {
      "application/pdf": "pdf",
    },
  },
};

/** Total managed bytes one account may hold across every portfolio asset. */
export const PORTFOLIO_STORAGE_QUOTA_BYTES = 500 * MB;
export const MAX_MEDIA_PER_PROJECT = 24;

/** Uncompressed audio earns a little more headroom than encoded audio. */
export const WAV_MAX_BYTES = 40 * MB;

const EXTENSION_KIND: Record<string, PortfolioAssetKind> = {
  jpg: "image", png: "image", webp: "image", gif: "image", avif: "image",
  mp4: "video", webm: "video",
  mp3: "audio", m4a: "audio", aac: "audio", wav: "audio",
  pdf: "document",
};

const EXTENSION_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif",
  mp4: "video/mp4", webm: "video/webm",
  mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav",
  pdf: "application/pdf",
};

const MANAGED_EXTENSIONS = Object.keys(EXTENSION_KIND).join("|");

/** Image-only, matching what the original upload path could produce. */
export const MANAGED_IMAGE_URL = /^\/api\/public\/assets\/portfolio\/[0-9a-f-]+\/[0-9a-f-]+\.(?:jpg|png|webp|gif|avif)$/i;
export const MANAGED_MEDIA_URL = new RegExp(`^/api/public/assets/portfolio/[0-9a-f-]+/[0-9a-f-]+\\.(?:${MANAGED_EXTENSIONS})$`, "i");
export const MANAGED_ASSET_KEY = new RegExp(`^portfolio/[0-9a-f-]+/[0-9a-f-]+\\.(?:${MANAGED_EXTENSIONS})$`, "i");

export function extensionKind(extension: string): PortfolioAssetKind | null {
  return EXTENSION_KIND[extension.toLowerCase()] || null;
}

export function extensionContentType(extension: string): string | null {
  return EXTENSION_CONTENT_TYPE[extension.toLowerCase()] || null;
}

export function keyExtension(key: string): string {
  return key.split(".").at(-1)?.toLowerCase() || "";
}

/** Images and documents stream through the app and cache well. Video and audio
 *  are redirected to storage so range requests, seeking, and egress bypass us.
 *
 *  Documents are proxied rather than redirected because the case-study page
 *  renders them in a frame, and a redirect to the storage host would put that
 *  frame on a different origin than the page's `frame-src 'self'` policy
 *  allows. They are also capped at 20 MB, so the seeking argument that keeps
 *  video and audio on the redirect path does not apply. */
export function isProxiedAssetKind(kind: PortfolioAssetKind): boolean {
  return kind === "image" || kind === "document";
}

export function maxBytesFor(kind: PortfolioAssetKind, contentType: string): number {
  if (kind === "audio" && (contentType === "audio/wav" || contentType === "audio/x-wav")) return WAV_MAX_BYTES;
  return PORTFOLIO_MEDIA_LIMITS[kind].maxBytes;
}

export function isPortfolioAssetKind(value: unknown): value is PortfolioAssetKind {
  return value === "image" || value === "video" || value === "audio" || value === "document";
}

function startsWithBytes(header: Uint8Array, signature: number[], offset = 0): boolean {
  if (header.length < offset + signature.length) return false;
  return signature.every((byte, index) => header[offset + index] === byte);
}

function ascii(header: Uint8Array, offset: number, length: number): string {
  if (header.length < offset + length) return "";
  return String.fromCharCode(...header.subarray(offset, offset + length));
}

const ISO_BMFF_VIDEO_BRANDS = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "M4V ", "mmp4"]);
const ISO_BMFF_AUDIO_BRANDS = new Set(["M4A ", "M4B ", "mp42", "isom", "iso2", "dash"]);

/** Confirm the uploaded bytes really are what the browser claimed. */
export function matchesContentSignature(extension: string, header: Uint8Array): boolean {
  const brand = ascii(header, 8, 4);
  const isIsoBmff = ascii(header, 4, 4) === "ftyp";

  switch (extension.toLowerCase()) {
    case "jpg":
      return startsWithBytes(header, [0xff, 0xd8, 0xff]);
    case "png":
      return startsWithBytes(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "gif":
      return ascii(header, 0, 6) === "GIF87a" || ascii(header, 0, 6) === "GIF89a";
    case "webp":
      return ascii(header, 0, 4) === "RIFF" && ascii(header, 8, 4) === "WEBP";
    case "avif":
      return isIsoBmff && (brand === "avif" || brand === "avis");
    case "mp4":
      return isIsoBmff && ISO_BMFF_VIDEO_BRANDS.has(brand);
    case "webm":
      return startsWithBytes(header, [0x1a, 0x45, 0xdf, 0xa3]);
    case "mp3":
      // Either an ID3 tag or a raw MPEG audio frame sync.
      return ascii(header, 0, 3) === "ID3" || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
    case "m4a":
      return isIsoBmff && ISO_BMFF_AUDIO_BRANDS.has(brand);
    case "aac":
      return header[0] === 0xff && (header[1] & 0xf6) === 0xf0;
    case "wav":
      return ascii(header, 0, 4) === "RIFF" && ascii(header, 8, 4) === "WAVE";
    case "pdf":
      return ascii(header, 0, 5) === "%PDF-";
    default:
      return false;
  }
}

/** Bytes needed to decide every signature above. */
export const CONTENT_SIGNATURE_BYTES = 64;
