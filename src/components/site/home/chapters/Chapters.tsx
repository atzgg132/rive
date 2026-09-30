import { ChapterClients } from "@/components/site/home/chapters/ChapterClients";
import { ChapterAgreements } from "@/components/site/home/chapters/ChapterAgreements";
import { ChapterMoney } from "@/components/site/home/chapters/ChapterMoney";
import { ChapterCalendarPortfolio } from "@/components/site/home/chapters/ChapterCalendarPortfolio";

/** The four deep-dive chapters after the pinned stage, alternating ink and
 * paper. Each has its own signature scroll moment. */
export function Chapters() {
  return (
    <>
      <ChapterClients />
      <ChapterAgreements />
      <ChapterMoney />
      <ChapterCalendarPortfolio />
    </>
  );
}
