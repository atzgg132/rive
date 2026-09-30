"use client";

import { ResponsiveWorkspacePreview } from "@/components/marketing/ResponsiveWorkspacePreview";
import { FluidAppWindow } from "@/components/marketing/AppWindowFrame";
import { InvoiceDocument } from "@/components/marketing/InvoiceDocument";
import { chapters } from "@/content/site/home";
import { ChapterSection, type ChapterMotion } from "@/components/site/home/chapters/ChapterSection";
import { ChapterBody, ChapterHead, Plate } from "@/components/site/home/chapters/ChapterText";
import shared from "@/components/site/home/chapters/Chapter.module.css";
import css from "@/components/site/home/chapters/ChapterMoney.module.css";

const copy = chapters.money;

type Figure = (typeof copy.figures)[number];

function formatFigure(figure: Figure, value: number) {
  const n = figure.format === "en-IN" ? new Intl.NumberFormat("en-IN").format(Math.round(value)) : String(Math.round(value));
  return `${"prefix" in figure ? figure.prefix : ""}${n}${"suffix" in figure ? figure.suffix : ""}`;
}

const motion: ChapterMotion = ({ gsap }, c, scope) => {
  const invoice = scope.querySelector<HTMLElement>("[data-invoice]");
  const invoiceWrap = scope.querySelector<HTMLElement>("[data-invoice-wrap]");
  const revenue = scope.querySelector<HTMLElement>("[data-revenue]");
  const visuals = scope.querySelector<HTMLElement>("[data-visuals]");
  const figureEls = gsap.utils.toArray<HTMLElement>("[data-figure]", scope);
  const row = scope.querySelector<HTMLElement>("[data-figures]");
  if (!invoice || !invoiceWrap || !revenue || !visuals || !row) return;

  if (c.reduce) {
    [revenue, invoiceWrap, row].forEach((el, i) => gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: i * 0.1, ease: "none", scrollTrigger: { trigger: visuals, start: "top 88%", once: true } }));
    return;
  }

  /* The invoice arrives lying back in space and flattens into the page as it
     is scrolled to; the revenue window behind it drifts the other way. */
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: visuals, start: "top 90%", end: "center 42%", scrub: 1, invalidateOnRefresh: true },
  });
  tl.fromTo(
    invoice,
    { rotateX: c.mobile ? 34 : 44, rotateY: c.mobile ? -10 : -16, rotateZ: c.mobile ? 3 : 5, yPercent: 14, scale: 0.94, transformOrigin: "50% 100%", force3D: true },
    { rotateX: 0, rotateY: 0, rotateZ: 0, yPercent: 0, scale: 1, force3D: true },
    0,
  );
  tl.fromTo(revenue, { yPercent: 5 }, { yPercent: -3, force3D: true }, 0);
  gsap.from(revenue, { opacity: 0, duration: 1, scrollTrigger: { trigger: visuals, start: "top 88%", once: true } });

  /* Counters count up once on enter; the accessible value is static text. */
  figureEls.forEach((el, i) => {
    const figure = copy.figures[i];
    const out = el.querySelector<HTMLElement>("[data-figure-value]");
    if (!figure || !out) return;
    const state = { v: 0 };
    out.textContent = formatFigure(figure, 0);
    gsap.to(state, {
      v: figure.value,
      duration: 2.2,
      delay: i * 0.18,
      ease: "power3.out",
      onUpdate: () => {
        out.textContent = formatFigure(figure, state.v);
      },
      scrollTrigger: { trigger: row, start: "top 82%", once: true },
    });
    gsap.from(el, { opacity: 0, y: 28, duration: 0.9, delay: i * 0.18, scrollTrigger: { trigger: row, start: "top 88%", once: true } });
  });
  return () => {
    figureEls.forEach((el, i) => {
      const out = el.querySelector<HTMLElement>("[data-figure-value]");
      if (out && copy.figures[i]) out.textContent = formatFigure(copy.figures[i], copy.figures[i].value);
    });
  };
};

export function ChapterMoney() {
  return (
    <ChapterSection chapter="money" theme="ink" from="paper" labelledBy="chapter-money-title" onMotion={motion}>
      <div className={shared.wrap}>
        <div className={css.head}>
          <ChapterHead
            id="chapter-money-title"
            copy={copy}
            titleClassName={`s-display ${css.title}`}
            titleContent={
              <span data-money-title className={css.titleInner}>
                <span data-sentence className={css.sentence}>Rive records payments.</span>{" "}
                <span data-sentence className={css.sentence}>It doesn&rsquo;t move money.</span>
              </span>
            }
          />
        </div>
        <div className={css.grid}>
          <div className={css.text}>
            <ChapterBody copy={copy} />
          </div>
          <div className={css.visuals} data-visuals>
            <Plate className={css.revenue} data-revenue>
              <ResponsiveWorkspacePreview view="revenue" />
            </Plate>
            <div className={css.invoiceWrap} data-invoice-wrap>
              <div className={css.invoice} data-invoice>
                <FluidAppWindow aspect={0.74} className={css.invoiceWindow}>
                  <InvoiceDocument />
                </FluidAppWindow>
              </div>
            </div>
          </div>
        </div>

        <div className={css.figures} data-figures>
          <span className={css.anchor} data-thread-anchor="money" aria-hidden="true" />
          {copy.figures.map((figure) => (
            <div key={figure.label} className={css.figure} data-figure>
              <span className={css.figureValue} data-figure-value aria-hidden="true">
                {formatFigure(figure, figure.value)}
              </span>
              <span className={css.srOnly}>{formatFigure(figure, figure.value)}</span>
              <span className={css.figureLabel}>{figure.label}</span>
            </div>
          ))}
          <p className={`s-sample-label ${css.figuresNote}`}>{copy.figuresLabel}</p>
        </div>
      </div>
    </ChapterSection>
  );
}
