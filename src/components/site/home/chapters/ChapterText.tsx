import type { HTMLAttributes, ReactNode } from "react";
import css from "@/components/site/home/chapters/Chapter.module.css";

type Copy = {
  kicker: string;
  title: string;
  body: string;
  points: readonly string[];
};

export function ChapterHead({
  id,
  copy,
  titleClassName = "s-h2",
  titleContent,
}: {
  id: string;
  copy: Copy;
  titleClassName?: string;
  titleContent?: ReactNode;
}) {
  return (
    <>
      <p className="s-kicker" data-ch-kicker data-reveal>
        {copy.kicker}
      </p>
      <h2 id={id} className={`${titleClassName} ${css.title}`} data-ch-title data-reveal>
        {titleContent ?? copy.title}
      </h2>
    </>
  );
}

export function ChapterBody({ copy }: { copy: Copy }) {
  return (
    <>
      <p className={`s-lead ${css.lead}`} data-ch-lead data-reveal>
        {copy.body}
      </p>
      <ul className={css.points}>
        {copy.points.map((point) => (
          <li key={point} className={css.point} data-ch-point data-reveal>
            <span className={css.tick} data-ch-tick aria-hidden="true" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Kicker, title, lead and the three points every chapter carries. */
export function ChapterText({
  id,
  copy,
  titleClassName,
  titleContent,
  children,
  className = "",
}: {
  id: string;
  copy: Copy;
  titleClassName?: string;
  titleContent?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${css.text} ${className}`}>
      <ChapterHead id={id} copy={copy} titleClassName={titleClassName} titleContent={titleContent} />
      <ChapterBody copy={copy} />
      {children}
    </div>
  );
}

/** A product plate: rounded, hairlined, floating. */
export function Plate({ children, className = "", ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${css.plate} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SampleTag({ children = "Sample studio data" }: { children?: ReactNode }) {
  return <p className={`s-sample-label ${css.sample}`}>{children}</p>;
}
