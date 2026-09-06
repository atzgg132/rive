import type { Metadata } from "next";
import "./globals.css";
import { FontPreloads } from "@/components/FontPreloads";
import PageViewTracker from "@/components/PageViewTracker";
import { AuthOverlayProvider } from "@/components/auth/AuthOverlayProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { deploymentOrigin } from "@/lib/siteMetadata";

export const metadata: Metadata = {
  metadataBase: new URL(deploymentOrigin),
  title: "Rive — One workspace for every moving part",
  description:
    "The operating system for independent work. Rive connects clients, projects, agreements, invoices, expenses, calendar, imports, and portfolio proof in one workspace.",
  keywords: [
    "digital service business software",
    "project management",
    "client management",
    "agency management software",
    "service business software",
    "invoice management",
    "revenue management",
    "contract management",
    "calendar sync",
    "business data import",
  ],
  openGraph: {
    title: "Rive — One workspace for every moving part",
    description:
      "The operating system for independent work. Connect clients, projects, agreements, invoices, expenses, calendar, imports, and portfolio proof in one workspace.",
    type: "website",
    url: "https://www.rive.work",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <FontPreloads />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="rive-color-theme"
        >
          <PageViewTracker />
          <AuthOverlayProvider>
            {children}
          </AuthOverlayProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
