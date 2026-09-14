import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { InstMark } from "@/components/marketing/primitives";
import { RiveLogo } from "@/components/RiveLogo";

export default function NotFound() {
  return (
    <main data-surface="marketing" className="marketing-root" style={{ minHeight: "100dvh", display: "flex", alignItems: "center" }}>
      <div className="inst-container" style={{ paddingBlock: "6rem" }}>
        <RiveLogo height={40} color="#181511" />
        <p className="inst-mono" style={{ marginTop: "3rem", color: "var(--inst-ink-soft)" }}>
          <InstMark mark="triangle" accent />404 / Nothing filed at this address
        </p>
        <h1 className="inst-display inst-display--page" style={{ marginTop: "1.5rem" }}>The page moved.<br />Your work didn&rsquo;t.</h1>
        <div style={{ marginTop: "2.5rem" }}>
          <Link href="/" className="marketing-focus inst-btn">Return home <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      </div>
    </main>
  );
}
