"use client";

import Link from "next/link";
import { RiveLogo } from "@/components/RiveLogo";
import { StartFree } from "@/components/site/StartFree";

export function SiteNav() {
  return (
    <header data-testid="site-header">
      <Link href="/" aria-label="Rive home"><RiveLogo height={24} /></Link>
      <StartFree placement="nav" />
    </header>
  );
}
