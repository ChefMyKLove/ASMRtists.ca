import { useEffect, useState } from "react";

/**
 * Returns true when the page is loaded inside a modal/iframe context
 * via `?embed=1`. When true, the SiteHeader and SiteFooter hide
 * themselves so the page drops cleanly into a host site's modal.
 */
export function useEmbedMode(): boolean {
  const [isEmbed, setIsEmbed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("embed");
    setIsEmbed(flag === "1" || flag === "true");
  }, []);

  return isEmbed;
}
