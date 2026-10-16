/** Before the redesign the whole app lived at `/` and was driven by query parameters (`/?tab=investigate&ws=...`).
 *  Those links are in the README, in the docs and in the MCP gateway's "Review at ..." tool error, so `/` forwards any
 *  request that carries one of those parameters to `/app/` with the identical query string and hash. */
export const LEGACY_PARAMS = [
  "tab",
  "ws",
  "scenario",
  "guard",
  "mode",
  "autorun",
  "autoforensics",
  "autoheal",
  "t",
  "topology",
  "action",
  "key",
] as const;

/** A URL reference relative to the landing page (`app/?tab=...`), or null when the landing page should be shown. */
export function legacyRedirectTarget(search: string, hash = ""): string | null {
  const q = new URLSearchParams(search);
  return LEGACY_PARAMS.some((name) => q.has(name)) ? `app/${search}${hash}` : null;
}
