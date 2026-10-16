import type { CapEdge, CapNode } from "../../api/types";

/** Labels, classes and layout roots of the capability canvas. The toxic flag, the costs and the cuts come from the API. */

export const capLabel = (n: CapNode): string => {
  const trust = n.trust ?? "source";
  const second = n.kind === "source" ? trust : n.kind === "sink" ? (n.external ? "external sink" : "internal sink") : n.kind === "store" ? "store" : "agent";
  const head = n.kind === "source" ? `◆ ${n.name}` : `${n.toxic ? "⚠ toxic " : ""}${n.name}`;
  return `${head}\n${second}`;
};

export const capNodeClasses = (n: CapNode, selected: string | null): string =>
  [n.kind, n.kind === "source" && n.trust ? n.trust : "", n.toxic ? "toxic" : "", n.external ? "external" : "", n.name === selected ? "selected" : ""].filter(Boolean).join(" ");

export const capEdgeText = (e: CapEdge, cut: Set<string>): string => (e.revoked ? `${e.cost} revoked` : cut.has(e.cap_id) ? `${e.cost} cut` : String(e.cost));

export const capEdgeClasses = (e: CapEdge, cut: Set<string>): string => [e.revoked ? "revoked" : "", cut.has(e.cap_id) ? "cut" : ""].filter(Boolean).join(" ");

/** The breadth-first layout starts from the sources, so the flow reads from data in to sinks out. */
export const capRoots = (nodes: CapNode[]): string[] => nodes.filter((n) => n.kind === "source").map((n) => n.name);
