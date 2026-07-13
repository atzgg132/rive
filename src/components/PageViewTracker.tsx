"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Fires a lightweight POST /api/track to the backend every time
 * the Next.js route changes, giving the admin dashboard real visitor data.
 * Only tracks non-admin routes.
 */
export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Don't track admin visits
    if (pathname?.startsWith("/admin")) return;

    fetch("http://localhost:5000/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer || "",
      }),
    }).catch(() => {
      // Silently fail — tracking should never break the user experience
    });
  }, [pathname]);

  return null;
}
