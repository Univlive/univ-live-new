// src/hooks/useFavicon.ts
import { useEffect } from "react";

/**
 * Dynamically sets the browser favicon and page <title> for an educator's
 * subdomain website.
 *
 * - If the educator has uploaded a logo, use it as the favicon.
 * - Otherwise, fall back to the default /favicon.png.
 */
export function useFavicon(logoUrl?: string | null, coachingName?: string | null) {
  useEffect(() => {
    // --- Favicon ---
    const faviconUrl = logoUrl?.trim() || "/favicon.png";

    // Find or create the <link rel="icon"> tag
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = faviconUrl.endsWith(".svg") ? "image/svg+xml" : "image/png";
    link.href = faviconUrl;

    // --- Page title ---
    if (coachingName?.trim()) {
      document.title = `${coachingName.trim()} | Powered by UNIV.LIVE`;
    }

    // Restore defaults when the component unmounts (navigating away from tenant page)
    return () => {
      if (link) link.href = "/favicon.png";
    };
  }, [logoUrl, coachingName]);
}
