import type cytoscape from "cytoscape";
import { prefersReducedMotion, tokenMs } from "../../shared/lib/motion";

/** The Cytoscape style sheets (ui-redesign.md §15.4). Colours come from the design tokens at the moment the canvas is built,
 *  so both themes work; every colour is paired with a shape, a line style or a word (the labels in `graphModel.canvasLabel`). */

export interface Palette {
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  lineStrong: string;
  sheet: string;
  paper: string;
  untrusted: string;
  secret: string;
  hold: string;
  highlight: string;
  mono: string;
  /** Milliseconds, read from the motion tokens (and zero where reduced motion makes the change instant). */
  motion: { dimMs: number; previewMs: number; applyMs: number };
}

const FALLBACK: Palette = {
  ink: "#16191d",
  ink2: "#3b4148",
  ink3: "#5b626b",
  line: "#d7d2c5",
  lineStrong: "#8d887b",
  sheet: "#fbfaf6",
  paper: "#f3f1ea",
  untrusted: "#b4450c",
  secret: "#8f1c6b",
  hold: "#b3261e",
  highlight: "#ffd84a",
  mono: "ui-monospace, monospace",
  motion: { dimMs: 120, previewMs: 180, applyMs: 260 },
};

export function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string): string => css.getPropertyValue(name).trim() || fallback;
  return {
    ink: read("--ink", FALLBACK.ink),
    ink2: read("--ink-2", FALLBACK.ink2),
    ink3: read("--ink-3", FALLBACK.ink3),
    line: read("--line", FALLBACK.line),
    lineStrong: read("--line-strong", FALLBACK.lineStrong),
    sheet: read("--sheet", FALLBACK.sheet),
    paper: read("--paper", FALLBACK.paper),
    untrusted: read("--untrusted", FALLBACK.untrusted),
    secret: read("--secret", FALLBACK.secret),
    hold: read("--hold", FALLBACK.hold),
    highlight: read("--highlight", FALLBACK.highlight),
    mono: read("--font-mono", FALLBACK.mono),
    // dimming stays at --dur-1 (it is not in the reduced-motion override) but is instant when motion is reduced; the others are 0 there already
    motion: { dimMs: prefersReducedMotion() ? 0 : tokenMs("--dur-1", 120), previewMs: tokenMs("--dur-2", 180), applyMs: tokenMs("--dur-3", 260) },
  };
}

export const NODE = { width: 150, height: 52, sourceHeight: 64 } as const;

/** Diagonal hatching for sealed (quarantined) nodes: the same "redaction" motif as a BLOCK pill, drawn as an SVG data URI. */
export function hatchUri(color: string, width: number = NODE.width, height: number = NODE.height): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>` +
    `<defs><pattern id='h' width='8' height='8' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'>` +
    `<line x1='0' y1='0' x2='0' y2='8' stroke='${color}' stroke-width='1.4'/></pattern></defs>` +
    `<rect width='${width}' height='${height}' fill='url(#h)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

type Sheet = cytoscape.StylesheetJson;

/** A style transition over `ms` for the listed properties; nothing at all for no time, so a reduced-motion change is a plain jump. */
const transition = (properties: string, ms: number): Record<string, string> => (ms > 0 ? { "transition-property": properties, "transition-duration": `${ms / 1000}s` } : {});

/** The lineage canvas: artifacts by kind, sources as diamonds, witness paths thick (solid untrusted, dotted secret). */
export function lineageStyle(p: Palette): Sheet {
  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "text-wrap": "wrap",
        "text-max-width": `${NODE.width - 10}px`,
        "font-family": p.mono,
        "font-size": 12,
        "line-height": 1.25,
        color: p.ink,
        "text-valign": "center",
        "text-halign": "center",
        shape: "rectangle",
        width: NODE.width,
        height: NODE.height,
        "background-color": p.sheet,
        "border-width": 1.5,
        "border-color": p.lineStrong,
        "border-style": "solid",
        ...transition("opacity", p.motion.dimMs),
      },
    },
    { selector: "node.memory", style: { shape: "barrel" } },
    { selector: "node.draft", style: { shape: "cut-rectangle" } },
    {
      selector: "node.source",
      style: { shape: "diamond", height: NODE.sourceHeight, "text-background-color": p.sheet, "text-background-opacity": 0.9, "text-background-padding": "2px", "text-background-shape": "rectangle" },
    },
    { selector: "node.sanitized", style: { "border-style": "dashed" } },
    { selector: "node.approved", style: { "border-style": "double", "border-width": 4 } },
    { selector: "node.payload", style: { "border-width": 3, "border-color": p.ink } },
    { selector: "node.u", style: { "border-color": p.untrusted, "border-width": 4 } },
    { selector: "node.s", style: { "border-color": p.secret, "border-width": 4, "border-style": "dotted" } },
    { selector: "node.u.s", style: { "border-style": "double", "border-width": 6 } },
    { selector: "node.tainted", style: { "border-color": p.secret, "border-style": "double", "border-width": 6 } },
    { selector: "node.marked", style: { "underlay-color": p.highlight, "underlay-opacity": 0.6, "underlay-padding": 8, "underlay-shape": "round-rectangle" } },
    {
      selector: "node.quarantined",
      style: { "background-image": hatchUri(p.ink3), "background-fit": "cover", "background-image-opacity": 0.55, opacity: 0.7 },
    },
    {
      selector: "node.lane",
      style: {
        shape: "rectangle",
        "background-color": p.paper,
        "background-opacity": 0.7,
        "border-width": 1,
        "border-color": p.line,
        padding: "0px",
        label: "",
        events: "no",
      },
    },
    {
      selector: "node.anchor",
      style: { width: 1, height: 1, "background-opacity": 0, "border-width": 0, label: "", events: "no", opacity: 0 },
    },
    {
      selector: "edge",
      style: {
        width: 1.5,
        "line-color": p.ink3,
        "line-style": "solid",
        "target-arrow-color": p.ink3,
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        label: "data(text)",
        "font-family": p.mono,
        "font-size": 10,
        color: p.ink,
        "text-background-color": p.sheet,
        "text-background-opacity": 0.9,
        "text-background-padding": "2px",
        "arrow-scale": 1.1,
        ...transition("opacity", p.motion.dimMs),
      },
    },
    { selector: "edge.taxi", style: { "curve-style": "taxi", "taxi-direction": "vertical", "taxi-turn": "50%", "taxi-turn-min-distance": 12 } },
    { selector: "edge.u", style: { width: 4, "line-color": p.untrusted, "target-arrow-color": p.untrusted } },
    { selector: "edge.s", style: { width: 4, "line-style": "dotted", "line-color": p.secret, "target-arrow-color": p.secret } },
    // while the witness trace plays, a witness edge that has not been reached yet looks like any other edge
    { selector: "edge.untraced", style: { width: 1.5, "line-style": "solid", "line-color": p.ink3, "target-arrow-color": p.ink3, label: "" } },
    { selector: "node.picked", style: { "border-color": p.ink, "border-width": 3, "underlay-color": p.ink, "underlay-opacity": 0.14, "underlay-padding": 6 } },
    { selector: ".dim", style: { opacity: 0.25 } },
    { selector: ".gone", style: { display: "none" } },
  ];
}

/** The capability canvas: sources are diamonds, stores barrels, sinks tags, agents boxes; a toxic agent has a double
 *  border and a warning in its label, a revoked flow is dashed and faded, the previewed cut is thick. */
export function capabilityStyle(p: Palette): Sheet {
  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "text-wrap": "wrap",
        "text-max-width": "118px",
        "font-family": p.mono,
        "font-size": 10,
        "line-height": 1.25,
        color: p.ink,
        "text-valign": "center",
        "text-halign": "center",
        shape: "rectangle",
        width: 126,
        height: 38,
        "background-color": p.sheet,
        "border-width": 1.5,
        "border-color": p.lineStrong,
      },
    },
    {
      selector: "node.source",
      style: { shape: "diamond", width: 140, height: 62, "text-background-color": p.sheet, "text-background-opacity": 0.9, "text-background-padding": "2px", "text-background-shape": "rectangle" },
    },
    { selector: "node.source.untrusted", style: { "border-color": p.untrusted, "border-width": 3 } },
    { selector: "node.source.secret", style: { "border-color": p.secret, "border-width": 3, "border-style": "dotted" } },
    { selector: "node.store", style: { shape: "barrel" } },
    { selector: "node.sink", style: { shape: "tag" } },
    { selector: "node.sink.external", style: { "border-width": 4 } },
    { selector: "node.toxic", style: { "border-color": p.hold, "border-width": 6, "border-style": "double" } },
    { selector: "node.selected", style: { "underlay-color": p.ink, "underlay-opacity": 0.16, "underlay-padding": 7 } },
    {
      selector: "edge",
      style: {
        width: 1.5,
        "line-color": p.ink3,
        "target-arrow-color": p.ink3,
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        label: "data(text)",
        "font-family": p.mono,
        "font-size": 9,
        color: p.ink,
        "text-background-color": p.sheet,
        "text-background-opacity": 0.9,
        "text-background-padding": "2px",
        ...transition("width, line-color, target-arrow-color, opacity", p.motion.previewMs),
      },
    },
    // applying a cut: the revoked flows fade (the dash style changes with them)
    { selector: "edge.revoked", style: { "line-style": "dashed", opacity: 0.35, ...transition("width, line-color, target-arrow-color, opacity", p.motion.applyMs) } },
    { selector: "edge.cut", style: { width: 4, "line-color": p.hold, "target-arrow-color": p.hold } },
    { selector: ".dim", style: { opacity: 0.25 } },
    { selector: ".gone", style: { display: "none" } },
  ];
}
