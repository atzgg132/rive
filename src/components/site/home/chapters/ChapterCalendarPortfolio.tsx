"use client";

import { ResponsiveWorkspacePreview } from "@/components/marketing/ResponsiveWorkspacePreview";
import { PortfolioSpecimen } from "@/components/marketing/PortfolioShowcase";
import { SpecimenFrame } from "@/components/marketing/SpecimenFrame";
import { chapters } from "@/content/site/home";
import { PORTFOLIO_TEMPLATES } from "@/utils/portfolio";
import { ChapterSection, type ChapterMotion } from "@/components/site/home/chapters/ChapterSection";
import { ChapterText, Plate, SampleTag } from "@/components/site/home/chapters/ChapterText";
import shared from "@/components/site/home/chapters/Chapter.module.css";
import css from "@/components/site/home/chapters/ChapterCalendarPortfolio.module.css";

const copy = chapters.calendarPortfolio;
const COUNT = PORTFOLIO_TEMPLATES.length;

const pad = (n: number) => String(n).padStart(2, "0");

const motion: ChapterMotion = ({ gsap }, c, scope) => {
  const calendar = scope.querySelector<HTMLElement>("[data-calendar]");
  const gallery = scope.querySelector<HTMLElement>("[data-gallery]");
  const viewport = scope.querySelector<HTMLElement>("[data-gallery-viewport]");
  const track = scope.querySelector<HTMLElement>("[data-gallery-track]");
  const bar = scope.querySelector<HTMLElement>("[data-gallery-bar]");
  const count = scope.querySelector<HTMLElement>("[data-gallery-count]");
  const slides = gsap.utils.toArray<HTMLElement>("[data-slide]", scope);
  if (!calendar || !gallery || !viewport || !track || !bar) return;

  if (c.reduce) {
    viewport.setAttribute("tabindex", "0");
    gsap.fromTo(calendar, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "none", scrollTrigger: { trigger: calendar, start: "top 90%", once: true } });
    slides.forEach((slide, i) => gsap.fromTo(slide, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: i * 0.05, ease: "none", scrollTrigger: { trigger: gallery, start: "top 85%", once: true } }));
    return () => viewport.removeAttribute("tabindex");
  }

  gsap.fromTo(
    calendar,
    { clipPath: "inset(10% 9% 10% 9% round 28px)", scale: 1.08, yPercent: 6 },
    {
      clipPath: "inset(0% 0% 0% 0% round 24px)",
      scale: 1,
      yPercent: 0,
      ease: "none",
      force3D: true,
      scrollTrigger: { trigger: calendar, start: "top 92%", end: "top 38%", scrub: 1 },
    },
  );

  /* The gallery pins; vertical scroll drives the track sideways. Each slide
     leans by its distance from centre and its content slides against the
     frame. All positions come from measurements taken at refresh, so the
     scrub never reads layout. */
  const parts = slides.map((slide) => ({
    slide,
    body: slide.querySelector<HTMLElement>("[data-slide-body]"),
    inner: slide.querySelector<HTMLElement>("[data-slide-inner]"),
    cap: slide.querySelector<HTMLElement>("[data-slide-cap]"),
  }));
  const setters = parts.map((p) => ({
    rot: gsap.quickSetter(p.slide, "rotateY", "deg"),
    scale: gsap.quickSetter(p.slide, "scale"),
    op: gsap.quickSetter(p.slide, "opacity"),
    shift: p.inner ? gsap.quickSetter(p.inner, "x", "px") : null,
    cap: p.cap ? gsap.quickSetter(p.cap, "y", "px") : null,
  }));

  let centers: number[] = [];
  let widths: number[] = [];
  let vpWidth = 0;
  let dist = 0;
  const tilt = c.mobile ? 9 : 14;
  const measure = () => {
    vpWidth = viewport.clientWidth;
    centers = slides.map((s) => s.offsetLeft + s.offsetWidth / 2);
    widths = slides.map((s) => s.offsetWidth);
    dist = Math.max(0, track.scrollWidth - vpWidth);
  };
  measure();

  parts.forEach((p) => p.inner && gsap.set(p.inner, { scale: 1.12, transformOrigin: "50% 0%" }));
  const setTrack = gsap.quickSetter(track, "x", "px");
  const apply = (x: number, p: number) => {
    setTrack(x);
    slides.forEach((_, i) => {
      const d = Math.max(-1.4, Math.min(1.4, (centers[i] + x - vpWidth / 2) / (vpWidth * 0.5)));
      const a = Math.abs(d);
      setters[i].rot(-d * tilt);
      setters[i].scale(1 - Math.min(a, 1) * 0.07);
      setters[i].op(1 - Math.min(a, 1) * 0.42);
      setters[i].shift?.(-Math.max(-1.2, Math.min(1.2, d)) * widths[i] * 0.04);
      setters[i].cap?.(Math.min(a, 1) * 10);
    });
    bar.style.transform = `scaleX(${p})`;
    if (count) count.textContent = `${pad(Math.min(COUNT, Math.round(p * (COUNT - 1)) + 1))} / ${pad(COUNT)}`;
  };

  const state = { p: 0 };
  gsap.to(state, {
    p: 1,
    ease: "none",
    onUpdate: () => apply(-state.p * dist, state.p),
    scrollTrigger: {
      trigger: gallery,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      scrub: 1,
      start: "top top+=72",
      end: () => {
        measure();
        return `+=${Math.round(dist * 0.85)}`;
      },
      onRefresh: () => apply(-state.p * dist, state.p),
    },
  });
  apply(0, 0);

  return () => {
    gsap.set(track, { clearProps: "transform" });
    bar.style.transform = "";
  };
};

export function ChapterCalendarPortfolio() {
  return (
    <ChapterSection chapter="calendar-portfolio" theme="paper" from="ink" labelledBy="chapter-calendar-title" onMotion={motion}>
      <div className={`${shared.wrap} ${css.intro}`}>
        <ChapterText id="chapter-calendar-title" copy={copy} />
        <div className={css.calendarCol}>
          <Plate className={css.calendar} data-calendar>
            <ResponsiveWorkspacePreview view="calendar" />
          </Plate>
          <SampleTag />
        </div>
      </div>

      <div className={css.gallery} data-gallery>
        <div className={css.galleryHead}>
          <p className={`s-kicker ${css.galleryKicker}`}>Portfolio templates</p>
          <p className={`s-mono ${css.count}`} data-gallery-count aria-hidden="true">
            {`${pad(1)} / ${pad(COUNT)}`}
          </p>
        </div>
        <div className={css.viewport} data-gallery-viewport role="region" aria-label="Six portfolio templates, scroll sideways to browse">
          <span className={css.corner} data-thread-anchor="portfolio" aria-hidden="true" />
          <ul className={css.track} data-gallery-track>
            {PORTFOLIO_TEMPLATES.map((template) => (
              <li key={template.key} className={css.slide} data-slide>
                <figure className={css.figure}>
                  <div className={css.browser}>
                    <div className={css.chrome} aria-hidden="true">
                      <span className={css.dots}>
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className={css.url}>yourname.rive.work</span>
                      <span className={css.swatch} style={{ background: template.accent }} />
                    </div>
                    <div className={css.body} data-slide-body>
                      <div className={css.inner} data-slide-inner>
                        <SpecimenFrame>
                          <PortfolioSpecimen templateKey={template.key} opening />
                        </SpecimenFrame>
                      </div>
                    </div>
                  </div>
                  <figcaption className={css.caption} data-slide-cap>
                    <span className={css.name}>{template.name}</span>
                    <span className={css.desc}>{template.description}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
        <div className={css.progress} aria-hidden="true">
          <span className={css.bar} data-gallery-bar />
        </div>
      </div>
    </ChapterSection>
  );
}
