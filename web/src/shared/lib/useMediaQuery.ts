import { useEffect, useState } from "react";

/** True while the viewport matches the media query (re-evaluated when it changes). Layout is CSS; this is only for the
 *  few places where the component tree itself differs (e.g. a collapsed setup panel on narrow screens). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (): void => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
