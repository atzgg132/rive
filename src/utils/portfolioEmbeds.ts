/** Provider parsing for portfolio media embeds.
 *
 * People paste whatever their provider's share panel gave them: a watch URL, a
 * short link, an /embed/ URL, or the entire <iframe> block. We accept all of
 * them, extract only the provider and its identifier, and rebuild the iframe
 * source ourselves. No user-supplied host, attribute, or markup ever reaches
 * the DOM, so a pasted <iframe onload="..."> contributes nothing but its ID.
 */

export type EmbedProvider =
  | "youtube"
  | "vimeo"
  | "loom"
  | "dailymotion"
  | "soundcloud"
  | "spotify"
  | "bandcamp"
  | "applemusic"
  | "mixcloud";

export type EmbedRole = "video" | "audio";

export type ParsedEmbed = {
  provider: EmbedProvider;
  role: EmbedRole;
  /** Canonical provider identifier. Stable across the input forms above. */
  providerId: string;
  /** The iframe source this app builds. Never taken verbatim from input. */
  embedUrl: string;
  /** Human-facing link for "watch on ..." affordances. */
  pageUrl: string;
  /** Derivable without a network call. Only YouTube exposes one. */
  posterUrl?: string;
  /** Audio players are fixed-height; video players use aspectRatio instead. */
  embedHeight?: number;
};

export const EMBED_PROVIDERS: Record<EmbedProvider, { label: string; role: EmbedRole }> = {
  youtube: { label: "YouTube", role: "video" },
  vimeo: { label: "Vimeo", role: "video" },
  loom: { label: "Loom", role: "video" },
  dailymotion: { label: "Dailymotion", role: "video" },
  soundcloud: { label: "SoundCloud", role: "audio" },
  spotify: { label: "Spotify", role: "audio" },
  bandcamp: { label: "Bandcamp", role: "audio" },
  applemusic: { label: "Apple Music", role: "audio" },
  mixcloud: { label: "Mixcloud", role: "audio" },
};

const MAX_EMBED_INPUT_LENGTH = 4_000;
const IFRAME_SRC = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;
const VIMEO_ID = /^\d{6,12}$/;
const VIMEO_HASH = /^[A-Za-z0-9]{6,24}$/;
const LOOM_ID = /^[a-f0-9]{20,40}$/i;
const DAILYMOTION_ID = /^[A-Za-z0-9]{5,12}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{16,32}$/;
const SPOTIFY_TYPE = /^(?:track|album|playlist|episode|show|artist)$/;
const BANDCAMP_PLAYER = /^(?:album|track)=\d{1,20}(?:\/[a-z_]+=[A-Za-z0-9]+)*\/?$/;
const APPLE_STOREFRONT = /^[a-z]{2}$/;
const APPLE_PATH = /^(?:album|playlist|song|podcast)\/[A-Za-z0-9%._~-]{1,120}\/(?:pl\.)?[A-Za-z0-9._-]{1,64}$/;
const SOUNDCLOUD_PATH = /^[A-Za-z0-9_-]{2,60}(?:\/(?:sets\/)?[A-Za-z0-9_-]{1,120})?$/;
const MIXCLOUD_PATH = /^[A-Za-z0-9_-]{2,60}\/[A-Za-z0-9_-]{1,120}$/;

/** Accept bare hosts and protocol-relative sources the way a browser bar does. */
function toUrl(raw: string): URL | null {
  let value = raw.trim();
  if (!value || value.length > MAX_EMBED_INPUT_LENGTH) return null;
  if (value.startsWith("//")) value = `https:${value}`;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function host(url: URL): string {
  return url.hostname.toLowerCase().replace(/^(?:www\.|m\.)+/, "");
}

function segments(url: URL): string[] {
  return url.pathname.split("/").filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });
}

function youtube(id: string, start?: string | null): ParsedEmbed | null {
  if (!YOUTUBE_ID.test(id)) return null;
  const seconds = start && /^\d{1,6}$/.test(start) ? Number(start) : 0;
  const query = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1" });
  if (seconds > 0) query.set("start", String(seconds));
  return {
    provider: "youtube",
    role: "video",
    providerId: id,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?${query.toString()}`,
    pageUrl: `https://www.youtube.com/watch?v=${id}`,
    posterUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

function vimeo(id: string, hash?: string | null): ParsedEmbed | null {
  if (!VIMEO_ID.test(id)) return null;
  const privacy = hash && VIMEO_HASH.test(hash) ? hash : null;
  const query = new URLSearchParams({ dnt: "1", title: "0", byline: "0", portrait: "0" });
  if (privacy) query.set("h", privacy);
  return {
    provider: "vimeo",
    role: "video",
    providerId: privacy ? `${id}:${privacy}` : id,
    embedUrl: `https://player.vimeo.com/video/${id}?${query.toString()}`,
    pageUrl: privacy ? `https://vimeo.com/${id}/${privacy}` : `https://vimeo.com/${id}`,
  };
}

function parseYoutube(url: URL, hostname: string): ParsedEmbed | null {
  const path = segments(url);
  if (hostname === "youtu.be") return youtube(path[0] || "", url.searchParams.get("t"));
  if (hostname !== "youtube.com" && hostname !== "youtube-nocookie.com" && hostname !== "music.youtube.com") return null;
  if (path[0] === "watch") return youtube(url.searchParams.get("v") || "", url.searchParams.get("t"));
  if (path[0] === "embed" || path[0] === "shorts" || path[0] === "live" || path[0] === "v") {
    return youtube(path[1] || "", url.searchParams.get("start") || url.searchParams.get("t"));
  }
  return null;
}

function parseVimeo(url: URL, hostname: string): ParsedEmbed | null {
  const path = segments(url);
  const hash = url.searchParams.get("h");
  if (hostname === "player.vimeo.com") {
    return path[0] === "video" ? vimeo(path[1] || "", hash) : null;
  }
  if (hostname !== "vimeo.com") return null;
  // vimeo.com/123456789, vimeo.com/123456789/abcdef (unlisted), and the
  // channel/group/album forms that put the id in the final segment.
  const numeric = path.filter((segment) => VIMEO_ID.test(segment));
  const id = numeric.at(-1);
  if (!id) return null;
  const index = path.lastIndexOf(id);
  return vimeo(id, hash || path[index + 1] || null);
}

function parseLoom(url: URL, hostname: string): ParsedEmbed | null {
  if (hostname !== "loom.com" && hostname !== "useloom.com") return null;
  const path = segments(url);
  const id = path[0] === "share" || path[0] === "embed" ? path[1] : null;
  if (!id || !LOOM_ID.test(id)) return null;
  return {
    provider: "loom",
    role: "video",
    providerId: id,
    embedUrl: `https://www.loom.com/embed/${id}?hideEmbedTopBar=true`,
    pageUrl: `https://www.loom.com/share/${id}`,
  };
}

function parseDailymotion(url: URL, hostname: string): ParsedEmbed | null {
  const path = segments(url);
  // geo.dailymotion.com is the host of the player we build, so parsing has to
  // round-trip it for server-side revalidation of already-saved embeds.
  const id = hostname === "dai.ly"
    ? path[0]
    : hostname === "geo.dailymotion.com"
      ? url.searchParams.get("video") || ""
      : hostname === "dailymotion.com" && (path[0] === "video" || path[0] === "embed")
        ? (path[0] === "embed" ? path[2] : path[1])
        : null;
  if (!id || !DAILYMOTION_ID.test(id)) return null;
  return {
    provider: "dailymotion",
    role: "video",
    providerId: id,
    embedUrl: `https://geo.dailymotion.com/player.html?video=${id}`,
    pageUrl: `https://www.dailymotion.com/video/${id}`,
  };
}

function soundcloud(pagePath: string): ParsedEmbed | null {
  if (!SOUNDCLOUD_PATH.test(pagePath)) return null;
  const pageUrl = `https://soundcloud.com/${pagePath}`;
  const query = new URLSearchParams({
    url: pageUrl,
    color: "#ff5500",
    auto_play: "false",
    hide_related: "true",
    show_comments: "false",
    show_teaser: "false",
  });
  return {
    provider: "soundcloud",
    role: "audio",
    providerId: pagePath,
    embedUrl: `https://w.soundcloud.com/player/?${query.toString()}`,
    pageUrl,
    embedHeight: 166,
  };
}

function parseSoundcloud(url: URL, hostname: string): ParsedEmbed | null {
  if (hostname === "w.soundcloud.com" || hostname === "player.soundcloud.com") {
    // The embed code wraps the real track URL in a query parameter.
    const inner = url.searchParams.get("url");
    const innerUrl = inner ? toUrl(inner) : null;
    if (!innerUrl) return null;
    const innerHost = host(innerUrl);
    if (innerHost !== "soundcloud.com" && innerHost !== "api.soundcloud.com") return null;
    return soundcloud(segments(innerUrl).join("/"));
  }
  if (hostname !== "soundcloud.com") return null;
  return soundcloud(segments(url).join("/"));
}

function parseSpotify(url: URL, hostname: string): ParsedEmbed | null {
  if (hostname !== "open.spotify.com" && hostname !== "spotify.com") return null;
  const path = segments(url).filter((segment) => !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(segment));
  const [type, id] = path[0] === "embed" ? [path[1], path[2]] : [path[0], path[1]];
  if (!type || !id || !SPOTIFY_TYPE.test(type) || !SPOTIFY_ID.test(id)) return null;
  return {
    provider: "spotify",
    role: "audio",
    providerId: `${type}/${id}`,
    embedUrl: `https://open.spotify.com/embed/${type}/${id}`,
    pageUrl: `https://open.spotify.com/${type}/${id}`,
    embedHeight: type === "track" || type === "episode" ? 152 : 352,
  };
}

function parseBandcamp(url: URL, hostname: string): ParsedEmbed | null {
  // Bandcamp only exposes numeric album/track ids through its embed code, so
  // this provider genuinely requires the pasted <iframe>.
  if (hostname !== "bandcamp.com") return null;
  const path = url.pathname.replace(/^\/EmbeddedPlayer\/?/i, "");
  if (path === url.pathname || !BANDCAMP_PLAYER.test(path)) return null;
  const parts = path.replace(/\/$/, "").split("/");
  const identity = parts[0];
  return {
    provider: "bandcamp",
    role: "audio",
    providerId: identity,
    embedUrl: `https://bandcamp.com/EmbeddedPlayer/${identity}/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/artwork=small/transparent=true/`,
    pageUrl: `https://bandcamp.com/EmbeddedPlayer/${identity}/`,
    embedHeight: 120,
  };
}

function parseAppleMusic(url: URL, hostname: string): ParsedEmbed | null {
  if (hostname !== "music.apple.com" && hostname !== "embed.music.apple.com") return null;
  const path = segments(url);
  const storefront = path[0] && APPLE_STOREFRONT.test(path[0]) ? path[0] : null;
  if (!storefront) return null;
  const rest = path.slice(1).map((segment) => encodeURIComponent(segment)).join("/");
  if (!APPLE_PATH.test(rest)) return null;
  const track = url.searchParams.get("i");
  const suffix = track && /^\d{1,20}$/.test(track) ? `?i=${track}` : "";
  return {
    provider: "applemusic",
    role: "audio",
    providerId: `${storefront}/${rest}${suffix}`,
    embedUrl: `https://embed.music.apple.com/${storefront}/${rest}${suffix}`,
    pageUrl: `https://music.apple.com/${storefront}/${rest}${suffix}`,
    embedHeight: suffix ? 175 : 450,
  };
}

function parseMixcloud(url: URL, hostname: string): ParsedEmbed | null {
  if (hostname === "player-widget.mixcloud.com") {
    const feed = url.searchParams.get("feed");
    const feedUrl = feed ? toUrl(feed.startsWith("/") ? `https://mixcloud.com${feed}` : feed) : null;
    return feedUrl ? mixcloud(segments(feedUrl).join("/")) : null;
  }
  if (hostname !== "mixcloud.com") return null;
  return mixcloud(segments(url).join("/"));
}

function mixcloud(path: string): ParsedEmbed | null {
  if (!MIXCLOUD_PATH.test(path)) return null;
  const feed = `/${path}/`;
  return {
    provider: "mixcloud",
    role: "audio",
    providerId: path,
    embedUrl: `https://player-widget.mixcloud.com/widget/iframe/?hide_cover=1&feed=${encodeURIComponent(feed)}`,
    pageUrl: `https://www.mixcloud.com${feed}`,
    embedHeight: 120,
  };
}

/** Turn any supported paste into a canonical embed, or null when unsupported. */
export function parseEmbedInput(input: unknown): ParsedEmbed | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_EMBED_INPUT_LENGTH) return null;

  const source = trimmed.includes("<iframe") ? trimmed.match(IFRAME_SRC)?.[1] : trimmed;
  const url = source ? toUrl(source) : null;
  if (!url) return null;

  const hostname = host(url);
  return (
    parseYoutube(url, hostname) ||
    parseVimeo(url, hostname) ||
    parseLoom(url, hostname) ||
    parseDailymotion(url, hostname) ||
    parseSoundcloud(url, hostname) ||
    parseSpotify(url, hostname) ||
    parseBandcamp(url, hostname) ||
    parseAppleMusic(url, hostname) ||
    parseMixcloud(url, hostname)
  );
}

/**
 * Build the player source for a given presentation.
 *
 * "ambient" is a scroll-triggered background preview: muted, looping, and as
 * close to chromeless as each provider allows, so a portfolio page does not
 * suddenly wear someone else's player furniture. Vimeo has a purpose-built
 * `background` mode; the others get their controls stripped individually.
 *
 * "player" is what a deliberate click promotes to — full controls and sound,
 * which is also the only way most providers will unmute.
 */
export function embedSrcFor(parsed: ParsedEmbed, mode: "ambient" | "player"): string {
  const url = new URL(parsed.embedUrl);
  const query = url.searchParams;

  if (mode === "player") {
    query.delete("background");
    query.delete("controls");
    query.delete("mute");
    query.delete("muted");
    query.set("autoplay", "1");
    return url.toString();
  }

  query.set("autoplay", "1");
  switch (parsed.provider) {
    case "youtube":
      query.set("mute", "1");
      query.set("controls", "0");
      query.set("disablekb", "1");
      query.set("iv_load_policy", "3");
      // Looping a single video requires naming it as its own playlist.
      query.set("loop", "1");
      query.set("playlist", parsed.providerId);
      break;
    case "vimeo":
      // Implies muted, looping, chromeless, and autoplaying in one parameter.
      query.set("background", "1");
      break;
    case "loom":
      query.set("hide_owner", "true");
      query.set("hideEmbedTopBar", "true");
      query.set("muted", "1");
      break;
    case "dailymotion":
      query.set("mute", "1");
      query.set("controls", "0");
      break;
    default:
      query.set("mute", "1");
      break;
  }
  return url.toString();
}

/** Server-side guard: an embed is valid only if we can still rebuild it. */
export function isSupportedEmbedUrl(value: unknown, provider?: unknown): boolean {
  if (typeof value !== "string") return false;
  const parsed = parseEmbedInput(value);
  if (!parsed) return false;
  return provider === undefined || parsed.provider === provider;
}
