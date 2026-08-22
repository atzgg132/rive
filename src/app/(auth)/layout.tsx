import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Rive account",
    template: "%s — Rive",
  },
  description: "Enter or create the workspace where client context follows the work.",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
