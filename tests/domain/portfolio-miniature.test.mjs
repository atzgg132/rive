import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_PORTFOLIO_CONTENT } from "../../src/utils/portfolio.ts";
import {
  MINIATURE_MEDIA_PER_PROJECT,
  MINIATURE_PROJECTS,
  MINIATURE_SERVICES,
  miniatureContent,
} from "../../src/utils/portfolioMiniature.ts";

/** The template gallery mounts the real renderer per card. What keeps that
 *  affordable is that the content it renders has been cut down first. */

function contentWith(overrides) {
  return { ...DEFAULT_PORTFOLIO_CONTENT, ...overrides };
}

function project(id, media = []) {
  return { id, title: `Project ${id}`, description: "", role: "", year: "2026", url: "", imageUrl: "", media };
}

test("only the first few projects are rendered", () => {
  const content = contentWith({ projects: Array.from({ length: 12 }, (_, i) => project(`p${i}`)) });
  assert.equal(miniatureContent(content).projects.length, MINIATURE_PROJECTS);
});

test("video, audio and embeds are dropped — each embed is another iframe", () => {
  const content = contentWith({
    projects: [project("p1", [
      { id: "m1", kind: "image", url: "/a.png", alt: "", caption: "" },
      { id: "m2", kind: "video", url: "/a.mp4", alt: "", caption: "" },
      { id: "m3", kind: "audio", url: "/a.mp3", alt: "", caption: "" },
      { id: "m4", kind: "embed", url: "https://youtube.com/embed/x", alt: "", caption: "" },
      { id: "m5", kind: "image", url: "/b.png", alt: "", caption: "" },
    ])],
  });

  const media = miniatureContent(content).projects[0].media;
  assert.deepEqual(media.map((item) => item.kind), ["image", "image"]);
});

test("media is capped per project even when every item is an image", () => {
  const images = Array.from({ length: 9 }, (_, i) => ({ id: `m${i}`, kind: "image", url: `/${i}.png`, alt: "", caption: "" }));
  const content = contentWith({ projects: [project("p1", images)] });
  assert.equal(miniatureContent(content).projects[0].media.length, MINIATURE_MEDIA_PER_PROJECT);
});

test("playback is off, so a gallery of thumbnails never starts playing anything", () => {
  const content = contentWith({
    mediaSettings: { ...DEFAULT_PORTFOLIO_CONTENT.mediaSettings, autoplayOnScroll: true, hoverPreview: true, lightbox: true, loop: true },
  });
  const settings = miniatureContent(content).mediaSettings;
  assert.equal(settings.autoplayOnScroll, false);
  assert.equal(settings.hoverPreview, false);
  assert.equal(settings.lightbox, false);
  assert.equal(settings.loop, false);
});

test("services and testimonials are trimmed, and identity is left alone", () => {
  const content = contentWith({
    name: "Arnav",
    headline: "I design products",
    tagline: "Selected visual work",
    services: Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, title: `Service ${i}`, description: "" })),
    testimonials: Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, quote: "Great", name: `Client ${i}` })),
  });

  const mini = miniatureContent(content);
  assert.equal(mini.services.length, MINIATURE_SERVICES);
  assert.equal(mini.testimonials.length, 1);
  // The whole point is that it is recognisably the owner's portfolio.
  assert.equal(mini.name, "Arnav");
  assert.equal(mini.headline, "I design products");
  assert.equal(mini.tagline, "Selected visual work");
});

test("an empty portfolio survives without throwing", () => {
  const mini = miniatureContent(contentWith({ projects: [], services: [], testimonials: [] }));
  assert.deepEqual(mini.projects, []);
  assert.deepEqual(mini.services, []);
});

test("the original content is not mutated", () => {
  const content = contentWith({ projects: [project("p1", [{ id: "m1", kind: "video", url: "/a.mp4", alt: "", caption: "" }])] });
  const before = JSON.stringify(content);
  miniatureContent(content);
  assert.equal(JSON.stringify(content), before, "the editor's own draft must not be trimmed by rendering a thumbnail");
});
