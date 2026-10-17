/** The Pathwarden mark: an untrusted (solid) and a secret (dotted) route converging on the gate. */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M2 9h12q6 0 6 7" fill="none" stroke="var(--untrusted-line)" strokeWidth="3" strokeLinecap="round" />
      <path d="M2 23h12q6 0 6-7" fill="none" stroke="var(--secret)" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.1 5" />
      <rect x="23" y="6" width="4" height="20" rx="1.5" fill="currentColor" />
    </svg>
  );
}
