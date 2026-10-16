import { useMemo } from "react";
import "../app/views/evaluation/evaluation.css";
import "../app/views/investigate/investigate.css";
import "../app/views/run/run.css";
import { useAnchorFocus, useProbe } from "./hooks";
import { ISSUE, story, summary } from "./landingData";
import { plateOf } from "./landingLogic";
import { Footer } from "./sections/Footer";
import { Heal } from "./sections/Heal";
import { Hero } from "./sections/Hero";
import { Limits, RunIt } from "./sections/LimitsRun";
import { Mcp } from "./sections/Mcp";
import { Problem } from "./sections/Problem";
import { Remediate } from "./sections/Remediate";
import { Results } from "./sections/Results";
import { Story } from "./sections/Story";
import { TopBar } from "./sections/TopBar";
import { WhyGraph } from "./sections/WhyGraph";
import "./landing.css";

/** The public project page (ui-redesign.md §11). Every claim on it is read from the repository at build time or from one recorded run
 *  (see `landingData.ts`); the primary action follows a single health probe, so the page renders fully with the API stopped. */
export function Landing() {
  const probe = useProbe();
  useAnchorFocus();
  const plate = useMemo(() => plateOf(story), []);
  return (
    <>
      <a className="pw-skip" href="#top">
        Skip to content
      </a>
      <TopBar probe={probe} />
      <main className="pw-landing">
        <Hero probe={probe} plate={plate} scenario={story.scenario} />
        <Problem story={story} />
        <Story story={story} issue={ISSUE} />
        <Heal story={story} />
        <Remediate summary={summary} />
        <Mcp plate={plate} />
        <Results summary={summary} />
        <WhyGraph />
        <Limits summary={summary} />
        <RunIt probe={probe} />
      </main>
      <Footer generated={`${story.generated.date} from commit ${story.generated.commit} (${story.generated.command})`} />
    </>
  );
}
