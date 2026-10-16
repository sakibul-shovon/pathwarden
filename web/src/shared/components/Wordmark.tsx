/** The mark: two strokes enter from the left, one solid (untrusted path) and one dotted (secret path), and meet a short
 *  vertical bar (the gate). It always encodes that, never decoration (ui-redesign.md §16.2). Monochrome, never animated. */
export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <span className="pw-wordmark">
      <svg width={size * 1.2} height={size} viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" focusable="false">
        <path d="M1 5h14" />
        <path d="M1 15h14" strokeDasharray="1.5 3" strokeLinecap="butt" />
        <path d="M19 2v16" />
      </svg>
      <span className="pw-wordmark__text">Pathwarden</span>
    </span>
  );
}
