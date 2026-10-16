import { Button } from "../../../shared/components/Button";
import { Icon } from "../../../shared/icons/Icon";
import { GUIDE_STEPS, nextStep, type GuideStep } from "../../guide";
import { restartGuide, setGuideHidden, useGuide } from "../../guideStore";

/** The six-step walk through the product's own story (ui-redesign.md §12.5). It only suggests: a step never runs for the
 *  user, because running a scenario resets the workspace. Progress is remembered per browser. */
export function StoryGuide({ onApply }: { onApply: (step: GuideStep) => void }) {
  const guide = useGuide();
  if (guide.hidden) {
    return (
      <div className="pw-guide pw-guide--hidden">
        <Button variant="quiet" size="sm" onClick={() => setGuideHidden(false)}>
          <Icon name="info" size={14} /> Show the story guide
        </Button>
      </div>
    );
  }
  const next = nextStep(guide);
  return (
    <section className="pw-guide" aria-labelledby="pw-guide-title">
      <div className="pw-guide__head">
        <h2 id="pw-guide-title" className="pw-run__h">
          The story, in six steps
        </h2>
        <Button variant="quiet" size="sm" onClick={() => setGuideHidden(true)}>
          Hide guide
        </Button>
      </div>
      <ol className="pw-guide__steps">
        {GUIDE_STEPS.map((step) => {
          const done = guide.done.includes(step.id);
          const isNext = next?.id === step.id;
          return (
            <li key={step.id} className={done ? "pw-guide__step pw-guide__step--done" : isNext ? "pw-guide__step pw-guide__step--next" : "pw-guide__step"}>
              <span className="pw-guide__mark">
                {done ? <Icon name="check" size={14} label="Done" /> : null}
                {!done && isNext ? <span className="pw-visually-hidden">Next: </span> : null}
              </span>
              <div>
                <strong>{step.title}</strong>
                {isNext && (
                  <>
                    <p className="pw-guide__text">{step.instruction}</p>
                    <p className="pw-muted pw-guide__done-when">Done when {step.doneWhen}.</p>
                    <Button size="sm" variant="primary" onClick={() => onApply(step)}>
                      {step.tab === "run" ? "Set up this step" : `Go to ${step.tab === "investigate" ? "Investigate" : step.tab === "remediate" ? "Remediate" : step.tab}`}
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {next === null && (
        <p>
          You have seen the whole story.{" "}
          <Button variant="quiet" size="sm" onClick={restartGuide}>
            Restart the guide
          </Button>
        </p>
      )}
    </section>
  );
}
