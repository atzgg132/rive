import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import PageViewTracker from "@/components/PageViewTracker";
import { ThemeProvider } from "@/components/ThemeProvider";

const outfit = localFont({
  src: "./fonts/outfit-marketing.woff2",
  variable: "--font-outfit",
  display: "optional",
  weight: "100 900",
  fallback: ["system-ui", "sans-serif"],
});

const jetBrainsMono = localFont({
  src: "./fonts/jetbrains-mono-marketing.woff2",
  variable: "--font-jetbrains-mono",
  display: "optional",
  weight: "600",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "Rive — Connected client, project, contract and financial operations",
  description:
    "Rive is an all-in-one workspace for digital service businesses to manage clients, projects, contracts, revenue, invoices, expenses, calendars, imports, and portfolios.",
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
    title: "Rive — Run your service business in one connected workspace",
    description:
      "Clients, projects, contracts, revenue, expenses, calendars, imports, and your public portfolio—connected in one operating workspace.",
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
    <html
      lang="en"
      className={`${outfit.variable} ${jetBrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="rive-color-theme"
        >
          <PageViewTracker />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
