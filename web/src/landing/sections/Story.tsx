import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ReleaseSheet } from "../../app/views/run/ReleaseSheet";
import { RuleOfTwoLetters } from "../../shared/components/RuleOfTwoLetters";
import { useMediaQuery } from "../../shared/lib/useMediaQuery";
import { carriedBy, issueParts, plateOf, type Link } from "../landingLogic";
import type { LandingStory } from "../story";
import { Section } from "./Section";
import { WitnessPlate } from "./WitnessPlate";

type ExhibitId = "a" | "b" | "c" | "d";

interface Exhibit {
  id: ExhibitId;
  title: string;
  text: ReactNode;
  link: Link;
  figure: ReactNode;
}

function IssueFigure({ issue }: { issue: string }) {
  const parts = issueParts(issue);
  return (
    <figure className="pw-fig">
      <div className="pw-fig__plate pw-issue">
        <p className="pw-eyebrow">fixtures/issues/issue_42.md</p>
        <pre className="pw-issue__text">{parts.visible}</pre>
        {parts.hidden && (
          <p className="pw-issue__hidden">
            <span className="pw-issue__flag">hidden instruction</span> {parts.hidden}
          </p>
        )}
      </div>
      <figcaption className="pw-fig__caption">The comment is invisible when the issue is rendered, and plain text to an agent that reads the raw issue.</figcaption>
    </figure>
  );
}

function ChainFigure({ story }: { story: LandingStory }) {
  const chain = carriedBy(plateOf(story));
  return (
    <figure className="pw-fig">
      <div className="pw-fig__plate">
        <ol className="pw-chain">
          {chain.map((s, i) => (
            <li key={s.id} className="pw-chain__item">
              <strong>{s.label}</strong> <code>{s.id}</code>
              {s.tags.length > 0 && <span className="pw-muted"> {s.tags.join(" · ")}</span>}
              {i < chain.length - 1 && <span className="pw-chain__arrow" aria-hidden="true">←</span>}
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="pw-fig__caption">
        The lineage Pathwarden recorded: the untrusted source, the raw text read from it, and the memory entry that now carries it, in the order they were made.
      </figcaption>
    </figure>
  );
}

function LeakFigure({ story }: { story: LandingStory }) {
  return (
    <figure className="pw-fig">
      <ReleaseSheet posted={story.guard_off.posted} markLeaks held={false} />
      <figcaption className="pw-fig__caption">
        The public release page with the guard off.{" "}
        {story.guard_off.run.sessions.map((s) => (
          <span key={s.id} className="pw-inline-r2">
            {s.agent} <RuleOfTwoLetters data={s.rule_of_two} />
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** The sticky figure follows the exhibit in the middle of the viewport; each exhibit also has its own "Show figure" button, so it works from the keyboard. */
function useActive(enabled: boolean): [ExhibitId, (id: ExhibitId) => void] {
  const [active, setActive] = useState<ExhibitId>("a");
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.getAttribute("data-exhibit") as ExhibitId);
      },
      { rootMargin: "-40% 0px -50% 0px" },
    );
    document.querySelectorAll("[data-exhibit]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [enabled]);
  return [active, setActive];
}

export function Story({ story, issue }: { story: LandingStory; issue: string }) {
  const plate = useMemo(() => plateOf(story), [story]);
  const parts = issueParts(issue);
  const wide = useMediaQuery("(min-width: 1100px)");
  const [active, setActive] = useActive(wide);
  // the first figure is there from the start; only a change of exhibit crossfades
  const [swapped, setSwapped] = useState(false);
  useEffect(() => {
    if (active !== "a") setSwapped(true);
  }, [active]);
  const sessions = story.guard_off.run.sessions;
  const triage = sessions.find((s) => s.agent === "triage");
  const allGreen = sessions.every((s) => s.rule_of_two.green);
  const letters = (s?: (typeof sessions)[number]): string => (s ? (["A", "B", "C"] as const).filter((k) => s.rule_of_two[k]).join(" and ") : "");

  const exhibits: Exhibit[] = [
    {
      id: "a",
      title: "Monday: a normal-looking issue",
      text: (
        <p>
          Issue #42 reports a real bug and hides a comment: <q>{parts.hidden}</q>
        </p>
      ),
      link: { label: "Reproduce this with the guard off", href: "app/?tab=run&scenario=attack_pipeline_42&guard=off" },
      figure: <IssueFigure issue={issue} />,
    },
    {
      id: "b",
      title: "Triage remembers it",
      text: (
        <p>
          Triage summarises the issue and writes the &ldquo;convention&rdquo; into shared team memory. Its own session holds {letters(triage)}: {triage?.rule_of_two.green ? "within the rule" : "outside the rule"}.
        </p>
      ),
      link: { label: "Reproduce this with the guard off", href: "app/?tab=run&scenario=attack_pipeline_42&guard=off" },
      figure: <ChainFigure story={story} />,
    },
    {
      id: "c",
      title: "Fixer follows it; Release posts it",
      text: (
        <p>
          Fixer loads the convention and the deploy configuration and writes the changelog with the secrets; Release posts it. {allGreen ? "Every session passed the Rule of Two." : "At least one session broke the rule."}
        </p>
      ),
      link: { label: "Reproduce this with the guard off", href: "app/?tab=run&scenario=attack_pipeline_42&guard=off" },
      figure: <LeakFigure story={story} />,
    },
    {
      id: "d",
      title: "With Pathwarden, the post is held",
      text: (
        <p>
          Before <code>post_release</code> runs, two path queries find both paths. Verdict {plate.verdict}, reason {plate.reason}, {plate.llmCalls} LLM calls, decided in {plate.latencyMs.toFixed(1)} ms in the recorded run. Nothing is posted.
        </p>
      ),
      link: { label: "Reproduce this with the guard on", href: "app/?tab=run&scenario=attack_pipeline_42" },
      figure: <WitnessPlate plate={plate} scenario={story.scenario} />,
    },
  ];
  const current = exhibits.find((e) => e.id === active) ?? exhibits[0]!;

  return (
    <Section id="story" eyebrow="How it works" title="One attack, four exhibits" lead={<p>Everything below was recorded from a real scripted run of {story.scenario}, not drawn by hand.</p>}>
      <div className={wide ? "pw-story pw-story--wide" : "pw-story"}>
        <ol className="pw-story__list">
          {exhibits.map((e) => (
            <li key={e.id} id={e.id === "d" ? "proof" : undefined} className={wide && active === e.id ? "pw-exhibit pw-exhibit--on" : "pw-exhibit"} data-exhibit={e.id}>
              <h3 className="pw-exhibit__title">
                <span className="pw-exhibit__n" aria-hidden="true">
                  {e.id.toUpperCase()}
                </span>
                {e.title}
              </h3>
              <div className="pw-exhibit__text">{e.text}</div>
              <p className="pw-exhibit__links">
                <a href={e.link.href}>{e.link.label}</a>
                {wide && (
                  <button type="button" className="pw-linkbtn" aria-pressed={active === e.id} onClick={() => setActive(e.id)}>
                    Show figure
                  </button>
                )}
              </p>
              {!wide && <div className="pw-exhibit__fig">{e.figure}</div>}
            </li>
          ))}
        </ol>
        {wide && (
          <div className="pw-story__sticky" aria-live="polite">
            <div key={current.id} className={swapped ? "pw-story__fig pw-story__fig--swap" : "pw-story__fig"}>
              {current.figure}
            </div>
          </div>
        )}
      </div>
      <p className="pw-muted">Running a scenario resets the demo workspace. The links open the app with the scenario chosen; they do not run it for you.</p>
    </Section>
  );
}
