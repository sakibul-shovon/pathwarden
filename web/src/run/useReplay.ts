import { useCallback, useEffect, useRef, useState } from "react";
import { reducedMotion } from "../gsap";

/** Reveals a finished run one event at a time. The API answers only when the run is complete (polling
 *  only, plan §19), so this is a labelled replay of the recorded run, never a fake live stream. */
export function useReplay(total: number, runId: number): {
  step: number;
  playing: boolean;
  skip: () => void;
  restart: () => void;
} {
  const [step, setStep] = useState(total);
  const [playing, setPlaying] = useState(false);
  const totalRef = useRef(total);
  totalRef.current = total;

  const restart = useCallback(() => {
    if (reducedMotion() || totalRef.current === 0) {
      setStep(totalRef.current);
      setPlaying(false);
      return;
    }
    setStep(0);
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (runId > 0) restart();
  }, [runId, restart]);

  useEffect(() => {
    if (!playing) return;
    const every = Math.min(520, Math.max(160, 6500 / Math.max(total, 1)));
    const timer = window.setInterval(() => {
      setStep((s) => {
        if (s + 1 >= totalRef.current) {
          setPlaying(false);
          return totalRef.current;
        }
        return s + 1;
      });
    }, every);
    return () => window.clearInterval(timer);
  }, [playing, total]);

  const skip = useCallback(() => {
    setStep(totalRef.current);
    setPlaying(false);
  }, []);

  return { step, playing, skip, restart };
}
