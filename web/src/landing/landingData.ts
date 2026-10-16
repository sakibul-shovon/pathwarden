import type { EvalSummary } from "../api/types";
import q2aText from "../../../api/graph/queries/q2a_untrusted_witness.cypher?raw";
import q2bText from "../../../api/graph/queries/q2b_secret_witness.cypher?raw";
import summaryJson from "../../../eval/results/summary.json";
import issueText from "../../../fixtures/issues/issue_42.md?raw";
import graphModelText from "../../../docs/graph-model.md?raw";
import readmeText from "../../../README.md?raw";
import storyJson from "./recorded/story.json";
import type { LandingStory } from "./story";

/** Everything the landing page shows comes from these imports, read at build time: the generated evaluation, the two gate queries,
 *  the issue fixture, the README and graph-model text, and one recorded run. Nothing the page claims is typed into a component. */
export const summary = summaryJson as unknown as EvalSummary;
export const story = storyJson as unknown as LandingStory;
export const Q2A = q2aText;
export const Q2B = q2bText;
export const ISSUE = issueText;
export const README = readmeText;
export const GRAPH_MODEL = graphModelText;
