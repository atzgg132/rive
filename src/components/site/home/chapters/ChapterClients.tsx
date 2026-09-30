"use client";

import { ResponsiveWorkspacePreview } from "@/components/marketing/ResponsiveWorkspacePreview";
import { chapters } from "@/content/site/home";
import { ChapterSection, type ChapterMotion } from "@/components/site/home/chapters/ChapterSection";
import { ChapterText, Plate, SampleTag } from "@/components/site/home/chapters/ChapterText";
import shared from "@/components/site/home/chapters/Chapter.module.css";
import css from "@/components/site/home/chapters/ChapterClients.module.css";

const copy = chapters.clients;

/* The projects window starts exactly behind the clients window, then fans out
   to the upper right while both drift at different speeds — depth from two
   scroll rates. Same choreography on phones; the offsets are measured, so
   they adapt to each layout. */
const motion: ChapterMotion = ({ gsap }, c, scope) => {
  const stack = scope.querySelector<HTMLElement>("[data-stack]");
  const front = scope.querySelector<HTMLElement>("[data-front]");
  const back = scope.querySelector<HTMLElement>("[data-back]");
  if (!stack || !front || !back) return;

  if (c.reduce) {
    [front, back].forEach((el, i) => gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: i * 0.1, ease: "none", scrollTrigger: { trigger: stack, start: "top 88%", once: true } }));
    return;
  }

  gsap.from(front, { opacity: 0, y: 48, duration: 1.1, scrollTrigger: { trigger: stack, start: "top 88%", once: true } });

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: stack, start: "top 82%", end: "bottom 38%", scrub: 1, invalidateOnRefresh: true },
  });
  tl.fromTo(
    back,
    {
      x: () => front.offsetLeft - back.offsetLeft,
      y: () => front.offsetTop - back.offsetTop,
      scale: 0.97,
      rotate: 0,
      force3D: true,
    },
    { x: 0, y: 0, scale: 1, rotate: c.mobile ? 1.2 : 1.8, force3D: true },
    0,
  );
  tl.fromTo(front, { yPercent: c.mobile ? 2 : 3.5 }, { yPercent: c.mobile ? -1 : -2.5, force3D: true }, 0);
};

export function ChapterClients() {
  return (
    <ChapterSection chapter="clients" theme="ink" from="ink" labelledBy="chapter-clients-title" onMotion={motion}>
      <div className={`${shared.wrap} ${css.grid}`}>
        <ChapterText id="chapter-clients-title" copy={copy} />
        <div className={css.visual}>
          <div className={css.stack} data-stack>
            <Plate className={css.back} data-back>
              <ResponsiveWorkspacePreview view="projects" />
            </Plate>
            <Plate className={css.front} data-front>
              <ResponsiveWorkspacePreview view="clients" />
            </Plate>
          </div>
          <SampleTag />
        </div>
      </div>
    </ChapterSection>
  );
}
