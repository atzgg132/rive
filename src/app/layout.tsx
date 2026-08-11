import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import PageViewTracker from "@/components/PageViewTracker";
import { ThemeProvider } from "@/components/ThemeProvider";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  fallback: ["Outfit Fallback", "system-ui", "sans-serif"],
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
      className={`${outfit.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="rive-color-theme"
        >
          <PageViewTracker />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
