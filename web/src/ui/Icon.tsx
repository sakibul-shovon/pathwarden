/** One small in-house icon set (20px grid, 1.5px stroke, currentColor). No icon library. */
const PATHS = {
  hold: "M7 2.5h6L17.5 7v6L13 17.5H7L2.5 13V7zM10 6.5v4.2M10 13.2v.1",
  check: "M4 10.5l4 4 8-9",
  lock: "M5.5 9V7a4.5 4.5 0 019 0v2M4.5 9h11v8h-11z",
  source: "M10 2.5l7.5 7.5-7.5 7.5L2.5 10z",
  agent: "M5 5h10a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zM7.5 9.5v1M12.5 9.5v1M8 13h4",
  store: "M3.5 6c0-1.4 2.9-2.5 6.5-2.5s6.5 1.1 6.5 2.5-2.9 2.5-6.5 2.5S3.5 7.4 3.5 6zM3.5 6v8c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V6",
  sink: "M2.5 10l4-5.5h11v11h-11z",
  play: "M6 4l10 6-10 6z",
  pause: "M6 4v12M14 4v12",
  back: "M12 4l-6 6 6 6",
  forward: "M8 4l6 6-6 6",
  fit: "M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4",
  plus: "M10 4v12M4 10h12",
  minus: "M4 10h12",
  expand: "M11 3h6v6M9 17H3v-6M17 3l-6.5 6.5M3 17l6.5-6.5",
  copy: "M7 7h9v9H7zM4 13V4h9",
  sun: "M10 6.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7zM10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6L16 16M16 4l-1.4 1.4M5.4 14.6L4 16",
  moon: "M16.5 12A7 7 0 018 3.5 7 7 0 1016.5 12z",
  monitor: "M3 4h14v9H3zM7 16.5h6M10 13v3.5",
  key: "M12.5 3.5a4 4 0 11-2.8 6.9L3.5 16.5v-2.5h2.5v-2h2l1.6-1.6A4 4 0 0112.5 3.5z",
  chevron: "M5 8l5 5 5-5",
  close: "M5 5l10 10M15 5L5 15",
  external: "M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8",
  user: "M10 10a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM3.5 17c.6-3.2 3.2-5 6.5-5s5.9 1.8 6.5 5",
  bolt: "M11 2L4.5 11H10l-1 7 6.5-9H10z",
  home: "M3 9.5L10 3l7 6.5M5 8.5V17h10V8.5",
  menu: "M3 5.5h14M3 10h14M3 14.5h14",
  alert: "M10 3l8 14H2zM10 8.5v4M10 14.8v.1",
  info: "M10 17.5a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM10 9v5M10 6.3v.1",
  route: "M3 5h6a3 3 0 013 3v4a3 3 0 003 3h2M3 15h4",
  clock: "M10 17.5a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM10 5.5V10l3 2",
  scissors: "M5 5.5a2 2 0 100 4 2 2 0 000-4zM5 12.5a2 2 0 100 4 2 2 0 000-4zM6.5 9l10-5M6.5 13l10 5",
  graph: "M4 6a2 2 0 100-4 2 2 0 000 4zM16 10a2 2 0 100-4 2 2 0 000 4zM6 17a2 2 0 100-4 2 2 0 000 4zM5.6 5.2l8.8 3M6.1 13.5l8-3",
  logout: "M8 3.5H4v13h4M12 6.5l4 3.5-4 3.5M16 10H8",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
