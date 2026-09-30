import { Hero } from "@/components/site/home/Hero";
import { Fragments } from "@/components/site/home/Fragments";
import { ThreadStage } from "@/components/site/home/ThreadStage";
import { Chapters } from "@/components/site/home/chapters/Chapters";
import { Importer } from "@/components/site/home/Importer";
import { Standing } from "@/components/site/home/Standing";
import { Answers } from "@/components/site/home/Answers";
import { Pricing } from "@/components/site/home/Pricing";
import { Finale } from "@/components/site/home/Finale";
import { ThreadLine } from "@/components/site/home/ThreadLine";

/** The v2 homepage, "One Flow": one sample job carried from the first
 * enquiry to the next, with the Thread drawn through every section. */
export function SiteHome() {
  return (
    <div className="s-home" style={{ position: "relative" }}>
      <ThreadLine />
      <Hero />
      <Fragments />
      <ThreadStage />
      <Chapters />
      <Importer />
      <Standing />
      <Answers />
      <Pricing />
      <Finale />
    </div>
  );
}
