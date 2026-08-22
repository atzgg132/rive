import type { MarketingChapter } from "@/content/marketing/home";
import { ProductDashboard, type ProductDashboardProps } from "@/components/marketing/product/ProductDashboard";
import { ProductInvoiceFlow, type ProductInvoiceFlowProps } from "@/components/marketing/product/ProductInvoiceFlow";
import { ProductContractFlow, type ProductContractFlowProps } from "@/components/marketing/product/ProductContractFlow";
import { ProductPortfolioStudio, type ProductPortfolioStudioProps } from "@/components/marketing/product/ProductPortfolioStudio";
import { ProductCalendar, type ProductCalendarProps } from "@/components/marketing/product/ProductCalendar";
import { ProductImport, type ProductImportProps } from "@/components/marketing/product/ProductImport";

export function MarketingProductScene({ visual }: { visual: MarketingChapter["visual"] }) {
  switch (visual.kind) {
    case "dashboard": return <ProductDashboard {...(visual.props as unknown as ProductDashboardProps)} />;
    case "invoice": return <ProductInvoiceFlow {...(visual.props as unknown as ProductInvoiceFlowProps)} />;
    case "contract": return <ProductContractFlow {...(visual.props as unknown as ProductContractFlowProps)} />;
    case "portfolio": return <ProductPortfolioStudio {...(visual.props as unknown as ProductPortfolioStudioProps)} />;
    case "calendar": return <ProductCalendar {...(visual.props as unknown as ProductCalendarProps)} />;
    case "import": return <ProductImport {...(visual.props as unknown as ProductImportProps)} />;
  }
}
