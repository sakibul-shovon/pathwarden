/** The product's own icon set (ui-redesign.md §16.7): 20 px grid, 1.5 px stroke, square caps. No icon dependency. */

export const ICON_PATHS = {
  gate: "M4 17V3M16 17V3M4 6.5h12M4 11.5h12",
  block: "M4 4h12v12H4z",
  check: "M4 10.5l4 4 8-9",
  outbound: "M6 14L14 6M7 6h7v7",
  lock: "M5 9h10v8H5z M7 9V6.5a3 3 0 016 0V9",
  diamond: "M10 3l7 7-7 7-7-7z",
  barrel: "M4 5c0-1.1 2.7-2 6-2s6 .9 6 2-2.7 2-6 2-6-.9-6-2z M4 5v10c0 1.1 2.7 2 6 2s6-.9 6-2V5",
  document: "M5 3h7l3 3v11H5z M12 3v3h3",
  patch: "M4 4h12v12H4z M10 7v6M7 10h6",
  clock: "M10 3a7 7 0 100 14 7 7 0 000-14z M10 6v4l3 2",
  cut: "M5 5l10 10M15 5L5 15",
  play: "M6 4l10 6-10 6z",
  pause: "M6 4v12M14 4v12",
  "step-back": "M14 4L7 10l7 6z M5 4v12",
  "step-forward": "M6 4l7 6-7 6z M15 4v12",
  copy: "M7 7h9v10H7z M4 13V3h9",
  "external-link": "M8 4H4v12h12v-4 M11 4h5v5 M16 4L9 11",
  "chevron-down": "M5 8l5 5 5-5",
  "chevron-right": "M8 5l5 5-5 5",
  warning: "M10 3L18 17H2z M10 8v4 M10 14.5v.5",
  info: "M10 3a7 7 0 100 14 7 7 0 000-14z M10 9v5 M10 6.5v.5",
  close: "M5 5l10 10M15 5L5 15",
  menu: "M3 6h14M3 10h14M3 14h14",
  key: "M7 11a3.5 3.5 0 110-7 3.5 3.5 0 010 7z M10 8h7 M14 8v3 M16.5 8v2",
  stack: "M10 3l7 3.5-7 3.5-7-3.5z M3 10l7 3.5 7-3.5 M3 13.5l7 3.5 7-3.5",
  graph: "M4 4h4v4H4z M12 4h4v4h-4z M8 12h4v4H8z M6 8v2h8V8 M10 10v2",
  table: "M3 4h14v12H3z M3 8h14 M8 4v12",
  "zoom-in": "M9 3a6 6 0 100 12A6 6 0 009 3z M13.5 13.5L17 17 M9 6.5v5 M6.5 9h5",
  "zoom-out": "M9 3a6 6 0 100 12A6 6 0 009 3z M13.5 13.5L17 17 M6.5 9h5",
  fit: "M3 7V3h4 M13 3h4v4 M17 13v4h-4 M7 17H3v-4",
  sun: "M10 6.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z M10 2v2 M10 16v2 M2 10h2 M16 10h2 M4.3 4.3l1.4 1.4 M14.3 14.3l1.4 1.4 M4.3 15.7l1.4-1.4 M14.3 5.7l1.4-1.4",
  moon: "M16 11.5A6.5 6.5 0 018.5 4 6.5 6.5 0 1016 11.5z",
  "arrow-right": "M3 10h13 M11 5l5 5-5 5",
} as const;

export type IconName = keyof typeof ICON_PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  /** Give an icon an accessible name only when it stands alone; next to text leave it out. */
  label?: string;
  className?: string;
}

export function Icon({ name, size = 16, label, className }: IconProps) {
  return (
    <svg
      className={className ? `pw-icon ${className}` : "pw-icon"}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
