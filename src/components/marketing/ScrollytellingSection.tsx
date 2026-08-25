import type { MarketingChapter } from "@/content/marketing/home";
import { homeContent } from "@/content/marketing/home";
import { DeferredProductScene } from "@/components/marketing/product/DeferredProductScene";
import { ProblemDisconnection, type ProblemDisconnectionProps } from "@/components/marketing/product/ProblemDisconnection";

type ProblemBeat = typeof homeContent.tax;

export function ScrollytellingSection({
  problem,
  chapters,
}: {
  problem: ProblemBeat;
  chapters: readonly MarketingChapter[];
}) {
  return (
    <div data-testid="scrollytelling-section" className="mx-auto max-w-4xl">
      <article id="problem" data-chapter-index="0" className="relative scroll-mt-0">
        <span id="features" className="absolute top-0" aria-hidden="true" />
        <div data-testid="marketing-problem" className="py-[clamp(2.5rem,5svh,5rem)]">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-warning">{problem.eyebrow}</p>
          <h2 className="mt-4 max-w-xl text-[clamp(1.5rem,1.8svh+0.9vw,2.25rem)] font-black leading-[1.08] tracking-[-0.045em] text-foreground">{problem.title}</h2>
          <p className="mt-4 max-w-lg text-[0.95rem] leading-7 text-muted-foreground">{problem.body}</p>
          <ol className="mt-6 max-w-lg divide-y divide-[color:var(--stroke-hairline)] border-y border-[var(--stroke-hairline)]">
            {problem.duties.map((duty) => (
              <li key={duty.label} className="grid grid-cols-[2rem_1fr] gap-3 py-2.5">
                <span className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{duty.label}</span>
                <span>
                  <span className="block text-sm font-bold tracking-[-0.02em] text-foreground">{duty.job}</span>
                  <span className="mt-0.5 block text-[0.78rem] leading-5 text-muted-foreground">{duty.gap}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-lg text-lg font-black tracking-[-0.035em] text-foreground sm:text-xl">{problem.close}</p>
          <div className="mt-9">
            <ProblemDisconnection {...(problem.visual.props as unknown as ProblemDisconnectionProps)} />
          </div>
        </div>
      </article>

      {chapters.map((chapter, index) => (
        <article
          key={chapter.id}
          id={chapter.id}
          data-chapter-index={index + 1}
          className="scroll-mt-0 py-[clamp(2rem,4svh,3.5rem)]"
        >
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">{index === 0 ? homeContent.scrolly.eyebrow : chapter.eyebrow}</p>
          <h3 className="mt-5 max-w-xl text-[clamp(1.65rem,2svh+1vw,3rem)] font-black leading-[1.02] tracking-[-0.045em] text-foreground">{index === 0 ? homeContent.scrolly.title : chapter.title}</h3>
          <p className="mt-6 max-w-lg text-base leading-8 text-muted-foreground">{chapter.body}</p>
          <DeferredProductScene className="mt-9" sceneKey={chapter.id} visual={chapter.visual} />
        </article>
      ))}
    </div>
  );
}
