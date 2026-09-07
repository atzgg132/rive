import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RiveLogo } from "@/components/RiveLogo";

export default function NotFound() {
  return (
    <main data-surface="marketing" className="edition-not-found"><div><RiveLogo height={40} /><p>404 / Nothing at this address</p><h1 className="edition-display">The page moved.<br />Your work didn’t.</h1><Link href="/" className="marketing-focus edition-button edition-button--primary">Return home <ArrowRight className="h-4 w-4" /></Link></div></main>
  );
}
