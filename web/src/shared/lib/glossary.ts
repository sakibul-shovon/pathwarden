/** Plain-language meanings of the six words the product leans on (ui-redesign.md §18.3, "Language"). Each is one or two sentences that
 *  restate what the product already does; none adds a claim. The rules they paraphrase are in README sections 5 and 8 and in plan §4. */

export const GLOSSARY = {
  witness: {
    title: "Witness",
    text: "The proof behind a decision: the actual chain of artifacts, from the payload back to the source, that a path query found in the lineage graph. It is a path you can read, not a score.",
  },
  trifecta: {
    title: "Trifecta",
    text: "A payload that descends from untrusted input and from a secret at the same time, on its way to an external sink. When both witness paths exist the action is held with the reason TRIFECTA.",
  },
  sanitized: {
    title: "Sanitized",
    text: "An artifact a sanitizer produced from a single input. A sanitizer can cut an untrusted path; it never cuts a secret path, because a derived value can still encode a secret. Only a person's approval does.",
  },
  quarantine: {
    title: "Quarantine",
    text: "A seal on everything derived from an untrusted source. The gate blocks anything built on a sealed artifact. Applying a quarantine only reduces risk, so it can be automatic; releasing one puts risk back, so it needs a person.",
  },
  toxic: {
    title: "Toxic agent",
    text: "An agent that can receive untrusted data, can receive secrets and can reach an external sink. Any one of the three is fine; all three together are the problem.",
  },
  cut: {
    title: "Cut",
    text: "A set of capability flows to remove so that no agent stays toxic. Each candidate is computed with max flow and checked on a temporary copy of the graph before it can be applied.",
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
export const GLOSSARY_KEYS = Object.keys(GLOSSARY) as GlossaryKey[];
