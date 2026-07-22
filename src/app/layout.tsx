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
  title: "rive. — the freelance os",
  description:
    "rive. is the all-in-one platform for freelancers and businesses. manage projects, clients, revenue, and gigs — powered by ai.",
  keywords: [
    "freelance platform",
    "project management",
    "client management",
    "gig board",
    "ai assistant",
    "freelancer tools",
    "revenue management",
  ],
  openGraph: {
    title: "rive. — the freelance os",
    description:
      "your entire freelance operating system, powered by ai. manage everything in one place.",
    type: "website",
    url: "https://rive.app",
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
      suppressHydrationWarning
    >
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <PageViewTracker />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
