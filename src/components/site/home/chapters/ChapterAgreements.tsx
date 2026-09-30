"use client";

import { chapters } from "@/content/site/home";
import { ChapterSection, type ChapterMotion } from "@/components/site/home/chapters/ChapterSection";
import { ChapterText, SampleTag } from "@/components/site/home/chapters/ChapterText";
import { PhoneAcceptance } from "@/components/site/home/chapters/PhoneAcceptance";
import shared from "@/components/site/home/chapters/Chapter.module.css";
import css from "@/components/site/home/chapters/ChapterAgreements.module.css";

const copy = chapters.agreements;

/* One pinned beat: the page inside the phone scrolls to the acceptance card,
   the client's name is typed into it, and the recorded-acceptance stamp lands.
   Desktop pins the whole two-column block; below 1024px the text stacks above
   and only the phone pins. */
const motion: ChapterMotion = ({ gsap }, c, scope) => {
  const block = scope.querySelector<HTMLElement>("[data-pin-block]");
  const phoneStage = scope.querySelector<HTMLElement>("[data-phone-stage]");
  const screen = scope.querySelector<HTMLElement>("[data-screen]");
  const scaler = scope.querySelector<HTMLElement>("[data-scaler]");
  const scroll = scope.querySelector<HTMLElement>("[data-doc-scroll]");
  const typed = scope.querySelector<HTMLElement>("[data-typed]");
  const typedText = scope.querySelector<HTMLElement>("[data-typed-text]");
  const caret = scope.querySelector<HTMLElement>("[data-typed-caret]");
  const stamp = scope.querySelector<HTMLElement>("[data-stamp]");
  const phone = scope.querySelector<HTMLElement>("[data-phone]");
  if (!block || !phoneStage || !screen || !scaler || !scroll || !typed || !typedText || !caret || !stamp || !phone) return;

  const input = scroll.querySelector<HTMLInputElement>("input");
  const aside = scroll.querySelector<HTMLElement>("aside");
  const name = input?.value || "Rhea Kapoor";

  /* Place the typed-name overlay exactly over the page's own name field, in
     the page's unscaled coordinates, and report how far the page must travel
     to bring the acceptance card into view. */
  let travel = 0;
  const measure = () => {
    const scale = scaler.getBoundingClientRect().width / scaler.offsetWidth || 1;
    const origin = scroll.getBoundingClientRect();
    if (input) {
      const r = input.getBoundingClientRect();
      typed.style.left = `${(r.left - origin.left) / scale}px`;
      typed.style.top = `${(r.top - origin.top) / scale}px`;
      typed.style.width = `${r.width / scale}px`;
      typed.style.height = `${r.height / scale}px`;
    }
    const screenH = (scaler.parentElement?.clientHeight ?? screen.clientHeight) / scale;
    const docH = scroll.offsetHeight;
    const asideTop = aside ? (aside.getBoundingClientRect().top - origin.top) / scale : docH * 0.5;
    travel = Math.max(0, Math.min(asideTop - 96, docH - screenH));
  };
  measure();

  phone.setAttribute("data-armed", "");
  const disarm = () => phone.removeAttribute("data-armed");

  if (c.reduce) {
    gsap.set(scroll, { y: -travel });
    typedText.textContent = name;
    caret.style.display = "none";
    gsap.fromTo(phone, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "none", scrollTrigger: { trigger: phone, start: "top 88%", once: true } });
    gsap.fromTo(stamp, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "none", scrollTrigger: { trigger: phone, start: "top 70%", once: true } });
    return disarm;
  }

  typedText.textContent = "";
  gsap.set(stamp, { opacity: 0, scale: 0.6, yPercent: 30 });
  gsap.set(caret, { opacity: 0 });
  const typing = { n: 0 };

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: c.desktop ? block : phoneStage,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      scrub: 0.8,
      start: () => {
        const el = c.desktop ? block : phoneStage;
        return el.offsetHeight <= window.innerHeight - 110 ? "center center+=28" : "top top+=76";
      },
      end: () => `+=${Math.round(window.innerHeight * (c.desktop ? 0.85 : c.tablet ? 0.75 : 0.65))}`,
    },
  });
  tl.fromTo(scroll, { y: 0 }, { y: () => (measure(), -travel), ease: "power1.inOut", duration: 0.52, force3D: true }, 0);
  tl.to(caret, { opacity: 1, duration: 0.02 }, 0.52);
  tl.to(
    typing,
    {
      n: name.length,
      duration: 0.3,
      onUpdate: () => {
        typedText.textContent = name.slice(0, Math.round(typing.n));
      },
    },
    0.54,
  );
  tl.to(stamp, { opacity: 1, scale: 1, yPercent: 0, duration: 0.11, ease: "back.out(2.4)", force3D: true }, 0.88);
  tl.to(caret, { opacity: 0, duration: 0.02 }, 0.9);
  tl.to({}, { duration: 0.01 }, 1);

  return () => {
    disarm();
    typedText.textContent = name;
  };
};

export function ChapterAgreements() {
  return (
    <ChapterSection chapter="agreements" theme="paper" from="ink" labelledBy="chapter-agreements-title" onMotion={motion}>
      <div className={shared.wrap}>
        <div className={css.block} data-pin-block>
          <ChapterText id="chapter-agreements-title" copy={copy} className={css.text}>
            <p className={`s-note ${css.note}`} data-ch-extra>
              {copy.note}
            </p>
          </ChapterText>
          <div className={css.stage} data-phone-stage>
            <PhoneAcceptance />
            <SampleTag>Sample agreement · typed name</SampleTag>
          </div>
        </div>
      </div>
    </ChapterSection>
  );
}
