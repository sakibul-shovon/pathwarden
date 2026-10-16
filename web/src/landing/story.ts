import type { ActionDetail, Artifact, Explain, ForensicReport, PostedEntry, RunResult } from "../api/types";

/** The shape of `recorded/story.json`, written by `scripts/capture_landing_story.py` from the real API. The landing page draws every
 *  figure from it: it never types an id, a path or a verdict itself. */
export interface LandingStory {
  scenario: string;
  generated: { command: string; date: string; commit: string; mode: string; note: string };
  guard_off: { run: RunResult; posted: PostedEntry[] };
  guard_on: { run: RunResult; action: ActionDetail; explain: Explain };
  heal: { report: ForensicReport; held: Artifact; healed: Artifact };
}
