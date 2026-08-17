import assert from "node:assert/strict";
import test from "node:test";

import { embedSrcFor, parseEmbedInput } from "../../src/utils/portfolioEmbeds.ts";
import {
  DEFAULT_PORTFOLIO_CONTENT,
  getPublicPortfolioContent,
  mergePortfolioContent,
  resolveProjectCoverImage,
  resolveProjectPlayableCover,
  validatePortfolioContent,
  validatePortfolioForPublish,
} from "../../src/utils/portfolio.ts";
import {
  MANAGED_ASSET_KEY,
  MANAGED_IMAGE_URL,
  MANAGED_MEDIA_URL,
  PORTFOLIO_MEDIA_LIMITS,
  extensionKind,
  isProxiedAssetKind,
  matchesContentSignature,
  maxBytesFor,
} from "../../src/utils/portfolioMedia.ts";

function baseContent(overrides = {}) {
  return { ...DEFAULT_PORTFOLIO_CONTENT, name: "Test", projects: [], services: [], ...overrides };
}

function project(overrides = {}) {
  return { id: "p1", title: "T", description: "", role: "", year: "2026", url: "", imageUrl: "", ...overrides };
}

/* ---------- embed parsing ---------- */

test("parses every YouTube share form to the same video id", () => {
  const inputs = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "youtube.com/watch?v=dQw4w9WgXcQ",
    "//www.youtube.com/embed/dQw4w9WgXcQ",
    '<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=x" title="YouTube video player" frameborder="0" allowfullscreen></iframe>',
  ];
  for (const input of inputs) {
    const parsed = parseEmbedInput(input);
    assert.equal(parsed?.provider, "youtube", `failed for ${input}`);
    assert.equal(parsed?.providerId, "dQw4w9WgXcQ", `failed for ${input}`);
  }
});

test("keeps the Vimeo privacy hash that unlisted videos require", () => {
  assert.equal(parseEmbedInput("https://vimeo.com/76979871")?.providerId, "76979871");
  assert.equal(parseEmbedInput("https://vimeo.com/76979871/abc123def4")?.providerId, "76979871:abc123def4");
  const embedded = parseEmbedInput('<iframe src="https://player.vimeo.com/video/76979871?h=abc123def4"></iframe>');
  assert.equal(embedded?.providerId, "76979871:abc123def4");
  assert.match(embedded?.embedUrl ?? "", /h=abc123def4/);
});

test("resolves the remaining supported providers", () => {
  const cases = [
    ["https://www.loom.com/share/0123456789abcdef0123456789abcdef", "loom"],
    ["https://dai.ly/x8abcd1", "dailymotion"],
    ["https://soundcloud.com/artist/track-name", "soundcloud"],
    ["https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", "spotify"],
    ["https://music.apple.com/us/album/some-record/1234567890", "applemusic"],
    ["https://www.mixcloud.com/artist/some-show/", "mixcloud"],
    ['<iframe src="https://bandcamp.com/EmbeddedPlayer/album=1234567890/size=large/"></iframe>', "bandcamp"],
  ];
  for (const [input, provider] of cases) {
    assert.equal(parseEmbedInput(input)?.provider, provider, `failed for ${input}`);
  }
});

test("every generated embed URL re-parses to the same identity", () => {
  const inputs = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://vimeo.com/76979871/abc123def4",
    "https://www.loom.com/share/0123456789abcdef0123456789abcdef",
    "https://dai.ly/x8abcd1",
    "https://soundcloud.com/artist/track-name",
    "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
    "https://music.apple.com/us/album/some-record/1234567890",
    "https://www.mixcloud.com/artist/some-show/",
    '<iframe src="https://bandcamp.com/EmbeddedPlayer/album=1234567890/size=large/"></iframe>',
  ];
  for (const input of inputs) {
    const first = parseEmbedInput(input);
    const second = parseEmbedInput(first.embedUrl);
    assert.equal(second?.provider, first.provider, `provider drifted for ${input}`);
    assert.equal(second?.providerId, first.providerId, `id drifted for ${input}`);
  }
});

test("rejects hostile and unsupported embed input", () => {
  const rejected = [
    "javascript:alert(1)",
    "https://evil.example.com/embed/abc",
    '<iframe src="https://evil.example.com/x" onload="alert(1)"></iframe>',
    "data:text/html,<script>alert(1)</script>",
    "https://www.youtube.com/watch?v=../../etc/passwd",
    "",
    "not a url at all",
  ];
  for (const input of rejected) {
    assert.equal(parseEmbedInput(input), null, `should have rejected ${input}`);
  }
});

test("discards every attribute of a pasted iframe except its source", () => {
  const parsed = parseEmbedInput(
    '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" onload="steal()" sandbox="allow-everything"></iframe>',
  );
  assert.equal(parsed?.embedUrl.includes("onload"), false);
  assert.equal(parsed?.embedUrl.includes("steal"), false);
  assert.match(parsed?.embedUrl ?? "", /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
});

/* ---------- backward compatibility ---------- */

test("a portfolio with no practices keeps today's shape", () => {
  const merged = mergePortfolioContent({ name: "Ada", projects: [project()], services: [], testimonials: [] });
  assert.deepEqual(merged.practices, []);
  assert.equal(merged.practiceLayout, "unified");
  assert.equal(merged.mediaSettings.autoplayOnScroll, false);
  assert.deepEqual(merged.projects[0].media, []);
});

test("upgrades a legacy image gallery into media with stable identifiers", () => {
  const legacy = {
    name: "Ada",
    projects: [project({ gallery: [{ id: "gallery-a", url: "https://example.com/a.jpg", alt: "A", caption: "C" }] })],
  };
  const first = mergePortfolioContent(legacy);
  assert.equal(first.projects[0].media.length, 1);
  assert.equal(first.projects[0].media[0].kind, "image");
  assert.equal(first.projects[0].media[0].id, "gallery-a");
  // Normalizing the result again must not renumber anything.
  const second = mergePortfolioContent(first);
  assert.deepEqual(second.projects[0].media, first.projects[0].media);
});

test("mirrors image media back into gallery so image-only readers keep working", () => {
  const merged = mergePortfolioContent({
    name: "Ada",
    projects: [project({
      media: [
        { id: "m1", kind: "image", url: "https://example.com/a.jpg", alt: "", caption: "" },
        { id: "m2", kind: "video", url: "https://example.com/a.mp4", alt: "", caption: "" },
      ],
    })],
  });
  assert.equal(merged.projects[0].gallery.length, 1);
  assert.equal(merged.projects[0].gallery[0].id, "m1");
});

/* ---------- practice visibility ---------- */

test("hides private practices and everything assigned to them", () => {
  const content = baseContent({
    practices: [
      { id: "bake", slug: "baking", name: "Baking", tagline: "", description: "", order: 0, visibility: "public" },
      { id: "music", slug: "music", name: "Music", tagline: "", description: "", order: 1, visibility: "private" },
    ],
    projects: [
      project({ id: "shared", title: "Shared" }),
      project({ id: "cake", title: "Cake", practiceId: "bake" }),
      project({ id: "track", title: "SECRET_TRACK", practiceId: "music" }),
    ],
  });
  const publicContent = getPublicPortfolioContent(content);
  assert.deepEqual(publicContent.practices.map((practice) => practice.id), ["bake"]);
  assert.deepEqual(publicContent.projects.map((item) => item.id), ["shared", "cake"]);
  assert.equal(JSON.stringify(publicContent).includes("SECRET_TRACK"), false);
});

/* ---------- validation ---------- */

test("accepts supported media and rejects unsupported media", () => {
  const managed = "/api/public/assets/portfolio/123e4567-e89b-12d3-a456-426614174000/123e4567-e89b-12d3-a456-426614174001.mp4";
  assert.equal(
    validatePortfolioContent(baseContent({
      projects: [project({ media: [{ id: "m1", kind: "video", url: managed, alt: "", caption: "" }] })],
    })),
    null,
  );
  assert.match(
    validatePortfolioContent(baseContent({
      projects: [project({ media: [{ id: "m1", kind: "embed", url: "https://evil.example.com/x", alt: "", caption: "" }] })],
    })) ?? "",
    /supported provider/,
  );
  assert.match(
    validatePortfolioContent(baseContent({
      projects: [project({ media: [{ id: "m1", kind: "video", url: "ftp://example.com/a.mp4", alt: "", caption: "" }] })],
    })) ?? "",
    /uploads or HTTPS URLs/,
  );
});

test("an embed's source link must describe the same media as the embed", () => {
  const embed = parseEmbedInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const withSource = (sourceUrl) => validatePortfolioContent(baseContent({
    projects: [project({ media: [{ id: "m1", kind: "embed", url: embed.embedUrl, sourceUrl, alt: "", caption: "" }] })],
  }));

  // The pair the editor actually writes.
  assert.equal(withSource(embed.pageUrl), null);
  // A different video from the same provider.
  assert.match(withSource("https://www.youtube.com/watch?v=aaaaaaaaaaa") ?? "", /same media/);
  // A different provider entirely.
  assert.match(withSource("https://vimeo.com/123456789") ?? "", /same media/);
  // A link that is not a supported provider at all.
  assert.match(withSource("https://example.com/watch") ?? "", /same media/);
  // Absent stays fine: sourceUrl is optional.
  assert.equal(withSource(undefined), null);
});

test("plain http is refused everywhere the messages promise HTTPS", () => {
  /* The CSP allows only `https:` for img-src and media-src, so an http:// link
     that saved cleanly would simply never load on the published page. Refusing
     it at the point of entry is the only place the owner can be told why. */
  assert.match(
    validatePortfolioContent(baseContent({
      projects: [project({ media: [{ id: "m1", kind: "video", url: "http://example.com/a.mp4", alt: "", caption: "" }] })],
    })) ?? "",
    /uploads or HTTPS URLs/,
  );
  assert.match(
    validatePortfolioContent(baseContent({ profileImageUrl: "http://example.com/me.png" })) ?? "",
    /HTTPS URL/,
  );
  assert.match(
    validatePortfolioContent(baseContent({ projects: [project({ imageUrl: "http://example.com/a.png" })] })) ?? "",
    /HTTPS URLs/,
  );
  assert.match(
    validatePortfolioContent(baseContent({ social: [{ label: "x", url: "http://example.com" }] })) ?? "",
    /HTTPS URLs/,
  );
  // The HTTPS equivalents stay acceptable.
  assert.equal(
    validatePortfolioContent(baseContent({
      profileImageUrl: "https://example.com/me.png",
      social: [{ label: "x", url: "https://example.com" }],
      projects: [project({ imageUrl: "https://example.com/a.png" })],
    })),
    null,
  );
});

test("blank media and gallery rows are allowed while being filled in", () => {
  assert.equal(
    validatePortfolioContent(baseContent({
      projects: [project({
        gallery: [{ id: "g1", url: "", alt: "", caption: "" }],
        media: [{ id: "m1", kind: "image", url: "", alt: "", caption: "" }],
      })],
    })),
    null,
  );
});

test("rejects reserved, duplicate, and unreferenced practices", () => {
  const practice = (overrides) => ({ id: "a", slug: "", name: "Baking", tagline: "", description: "", order: 0, visibility: "public", ...overrides });

  assert.match(validatePortfolioContent(baseContent({ practices: [practice({ name: "Work" })] })) ?? "", /reserved/);
  assert.match(
    validatePortfolioContent(baseContent({ practices: [practice({ id: "a" }), practice({ id: "b" })] })) ?? "",
    /unique/,
  );
  assert.match(
    validatePortfolioContent(baseContent({
      practices: [practice({ id: "a" })],
      projects: [project({ practiceId: "missing" })],
    })) ?? "",
    /belong to a practice/,
  );
  assert.equal(
    validatePortfolioContent(baseContent({
      practices: [practice({ id: "a" })],
      projects: [project({ practiceId: "a" })],
    })),
    null,
  );
});

test("rejects malformed media settings", () => {
  assert.match(validatePortfolioContent(baseContent({ mediaSettings: { layout: "spiral" } })) ?? "", /layout is invalid/);
  assert.match(validatePortfolioContent(baseContent({ mediaSettings: { autoplayOnScroll: "yes" } })) ?? "", /true or false/);
  assert.equal(validatePortfolioContent(baseContent({ mediaSettings: { autoplayOnScroll: true, layout: "masonry" } })), null);
});

/* ---------- upload content signatures ---------- */

test("confirms uploads against their magic bytes, not the declared type", () => {
  const header = (bytes) => Uint8Array.from(bytes.concat(Array(64 - bytes.length).fill(0)));
  const ascii = (value) => [...value].map((character) => character.charCodeAt(0));

  assert.equal(matchesContentSignature("png", header([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(matchesContentSignature("jpg", header([0xff, 0xd8, 0xff])), true);
  assert.equal(matchesContentSignature("pdf", header(ascii("%PDF-1.7"))), true);
  assert.equal(matchesContentSignature("mp4", header([0, 0, 0, 0x20, ...ascii("ftypisom")])), true);
  assert.equal(matchesContentSignature("webm", header([0x1a, 0x45, 0xdf, 0xa3])), true);
  assert.equal(matchesContentSignature("mp3", header(ascii("ID3"))), true);
  assert.equal(matchesContentSignature("wav", header([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")])), true);

  // An executable renamed to .mp4 must not pass as video.
  assert.equal(matchesContentSignature("mp4", header([0x4d, 0x5a, 0x90, 0x00])), false);
  // HTML renamed to .png must not pass as an image.
  assert.equal(matchesContentSignature("png", header(ascii("<html><scri"))), false);
  assert.equal(matchesContentSignature("exe", header([0x4d, 0x5a])), false);
});

/* ---------- managed asset keys ---------- */

test("the asset key allowlist rejects traversal and unknown formats", () => {
  const owner = "123e4567-e89b-12d3-a456-426614174000";
  const asset = "123e4567-e89b-12d3-a456-426614174001";

  assert.equal(MANAGED_ASSET_KEY.test(`portfolio/${owner}/${asset}.mp4`), true);
  assert.equal(MANAGED_ASSET_KEY.test(`portfolio/${owner}/${asset}.mp3`), true);
  assert.equal(MANAGED_ASSET_KEY.test(`portfolio/${owner}/${asset}.pdf`), true);

  const rejected = [
    `portfolio/${owner}/../../secrets.mp4`,
    `portfolio/${owner}/${asset}.exe`,
    `portfolio/${owner}/${asset}.svg`,
    `portfolio/${owner}/${asset}.html`,
    `other/${owner}/${asset}.mp4`,
    `portfolio/${owner}/${asset}.mp4/../x.mp4`,
    `portfolio/${owner}/${asset}`,
  ];
  for (const key of rejected) {
    assert.equal(MANAGED_ASSET_KEY.test(key), false, `should have rejected ${key}`);
  }
});

test("the image URL pattern stays image-only so avatars cannot become video", () => {
  const path = (extension) =>
    `/api/public/assets/portfolio/123e4567-e89b-12d3-a456-426614174000/123e4567-e89b-12d3-a456-426614174001.${extension}`;

  assert.equal(MANAGED_IMAGE_URL.test(path("png")), true);
  assert.equal(MANAGED_IMAGE_URL.test(path("mp4")), false);
  assert.equal(MANAGED_IMAGE_URL.test(path("pdf")), false);
  // The wider media pattern accepts both.
  assert.equal(MANAGED_MEDIA_URL.test(path("png")), true);
  assert.equal(MANAGED_MEDIA_URL.test(path("mp4")), true);
});

test("images and documents are proxied; seekable media is redirected to storage", () => {
  // Documents are framed by the case-study page, and the app's CSP allows
  // frame-src 'self' only, so they have to be served from this origin rather
  // than redirected to the storage host.
  for (const kind of ["image", "document"]) {
    assert.equal(isProxiedAssetKind(kind), true, `${kind} should stream through the app`);
  }
  for (const kind of ["video", "audio"]) {
    assert.equal(isProxiedAssetKind(kind), false, `${kind} should be redirected for range requests`);
  }
  assert.equal(extensionKind("mp4"), "video");
  assert.equal(extensionKind("mp3"), "audio");
  assert.equal(extensionKind("pdf"), "document");
  assert.equal(extensionKind("exe"), null);
});

test("uncompressed audio gets its own ceiling", () => {
  assert.ok(maxBytesFor("audio", "audio/wav") > maxBytesFor("audio", "audio/mpeg"));
  assert.equal(maxBytesFor("video", "video/mp4"), PORTFOLIO_MEDIA_LIMITS.video.maxBytes);
});

/* ---------- regression guards for review findings ---------- */

test("a practice added but not yet filled in does not block saving a draft", () => {
  const blank = { id: "practice-abc", slug: "", name: "", tagline: "", description: "", order: 0, visibility: "public" };
  assert.equal(validatePortfolioContent(baseContent({ practices: [blank] })), null);
  // Two untouched practices must not collide on the empty slug either.
  assert.equal(
    validatePortfolioContent(baseContent({ practices: [blank, { ...blank, id: "practice-def" }] })),
    null,
  );
});

test("publishing still refuses a portfolio with an unnamed practice", () => {
  const publishable = {
    ...DEFAULT_PORTFOLIO_CONTENT,
    name: "Ada", headline: "h", bio: "b", contactEmail: "a@b.co",
  };
  assert.equal(validatePortfolioForPublish(publishable), null);
  assert.match(
    validatePortfolioForPublish({
      ...publishable,
      practices: [{ id: "p", slug: "", name: "", tagline: "", description: "", order: 0, visibility: "public" }],
    }) ?? "",
    /Name every practice/,
  );
});

test("ambient embeds are chromeless and muted; a click promotes to a real player", () => {
  const parsed = parseEmbedInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const ambient = new URL(embedSrcFor(parsed, "ambient"));
  assert.equal(ambient.searchParams.get("controls"), "0");
  assert.equal(ambient.searchParams.get("mute"), "1");
  assert.equal(ambient.searchParams.get("autoplay"), "1");
  // Looping one video requires naming it as its own playlist.
  assert.equal(ambient.searchParams.get("playlist"), "dQw4w9WgXcQ");

  const player = new URL(embedSrcFor(parsed, "player"));
  assert.equal(player.searchParams.get("autoplay"), "1");
  assert.equal(player.searchParams.get("mute"), null);
  assert.equal(player.searchParams.get("controls"), null);

  // Vimeo has a purpose-built chromeless mode that the player must not inherit.
  const vimeo = parseEmbedInput("https://vimeo.com/76979871");
  assert.equal(new URL(embedSrcFor(vimeo, "ambient")).searchParams.get("background"), "1");
  assert.equal(new URL(embedSrcFor(vimeo, "player")).searchParams.get("background"), null);
});

test("every ambient and player source still resolves to its original provider", () => {
  for (const input of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://vimeo.com/76979871/abc123def4", "https://dai.ly/x8abcd1"]) {
    const parsed = parseEmbedInput(input);
    for (const mode of ["ambient", "player"]) {
      const rebuilt = parseEmbedInput(embedSrcFor(parsed, mode));
      assert.equal(rebuilt?.provider, parsed.provider, `${mode} drifted for ${input}`);
      assert.equal(rebuilt?.providerId, parsed.providerId, `${mode} id drifted for ${input}`);
    }
  }
});

/* --------------------------------------------------------------------- */
/* Project cover resolution                                              */
/* --------------------------------------------------------------------- */

const photo = { id: "m-photo", kind: "image", url: "/api/public/assets/portfolio/a/b.jpg", alt: "", caption: "" };
const embed = { id: "m-embed", kind: "embed", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", alt: "", caption: "" };
const video = { id: "m-video", kind: "video", url: "/api/public/assets/portfolio/a/c.mp4", alt: "", caption: "" };

test("an explicit cover always wins, whatever the media contains", () => {
  const withCover = project({ imageUrl: "https://cdn.example.com/cover.jpg", media: [embed, photo, video] });
  assert.equal(resolveProjectCoverImage(withCover), "https://cdn.example.com/cover.jpg");
  assert.equal(resolveProjectCoverImage(withCover, { allowPosterFrame: false }), "https://cdn.example.com/cover.jpg");
});

test("a photo in the media beats an embed or a video for the cover", () => {
  // The reported bug: with no explicit cover, an embed listed before the photo
  // was taken as the cover, so a third-party iframe stood in for the project.
  assert.equal(resolveProjectCoverImage(project({ media: [embed, photo] })), photo.url);
  assert.equal(resolveProjectCoverImage(project({ media: [video, photo] })), photo.url);
  assert.equal(resolveProjectCoverImage(project({ media: [embed, video, photo] })), photo.url);
});

test("media order does not decide the cover when a photo exists anywhere", () => {
  for (const media of [[photo, embed], [embed, photo], [video, embed, photo], [photo, video, embed]]) {
    assert.equal(resolveProjectCoverImage(project({ media })), photo.url, JSON.stringify(media.map((m) => m.kind)));
  }
});

test("a poster frame is used only where a still is genuinely needed", () => {
  const posterVideo = { ...video, posterUrl: "/api/public/assets/portfolio/a/poster.jpg" };
  const posterEmbed = { ...embed, posterUrl: "https://img.youtube.com/vi/x/hq.jpg" };

  // Image slots take the poster rather than showing a placeholder.
  assert.equal(resolveProjectCoverImage(project({ media: [posterVideo] })), posterVideo.posterUrl);
  assert.equal(resolveProjectCoverImage(project({ media: [posterEmbed] })), posterEmbed.posterUrl);

  // The card declines it, because it would rather mount the player itself.
  assert.equal(resolveProjectCoverImage(project({ media: [posterVideo] }), { allowPosterFrame: false }), "");

  // A real photo still outranks a poster frame.
  assert.equal(resolveProjectCoverImage(project({ media: [posterVideo, photo] })), photo.url);
});

test("a project with nothing to show reports no cover", () => {
  assert.equal(resolveProjectCoverImage(project()), "");
  assert.equal(resolveProjectCoverImage(project({ media: [] })), "");
  assert.equal(resolveProjectCoverImage(project({ imageUrl: "   " })), "");
  assert.equal(resolveProjectCoverImage(project({ media: [{ ...photo, url: "" }] })), "");
  assert.equal(resolveProjectCoverImage(project({ media: [{ id: "d", kind: "document", url: "/a/b.pdf", alt: "", caption: "" }] })), "");
});

test("the card falls back to a player only when there is no still, preferring native video", () => {
  assert.equal(resolveProjectPlayableCover(project({ media: [embed, video] }))?.id, video.id);
  assert.equal(resolveProjectPlayableCover(project({ media: [embed] }))?.id, embed.id);
  assert.equal(resolveProjectPlayableCover(project({ media: [photo] })), undefined);
  assert.equal(resolveProjectPlayableCover(project()), undefined);
});

test("cover resolution never reaches for audio or documents", () => {
  const audio = { id: "m-audio", kind: "audio", url: "/api/public/assets/portfolio/a/d.mp3", alt: "", caption: "" };
  const doc = { id: "m-doc", kind: "document", url: "/api/public/assets/portfolio/a/e.pdf", alt: "", caption: "" };
  assert.equal(resolveProjectCoverImage(project({ media: [audio, doc] })), "");
  assert.equal(resolveProjectPlayableCover(project({ media: [audio, doc] })), undefined);
});
