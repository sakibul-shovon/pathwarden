import { describe, expect, it } from "vitest";
import { EMPTY_ONBOARDING, GUIDE_STEPS, markDone, nextStep, parseOnboarding } from "./guide";

describe("story guide", () => {
  it("has the six steps of the plan, in order, and never presets autorun", () => {
    expect(GUIDE_STEPS.map((s) => s.id)).toEqual(["leak", "hold", "case", "heal", "sleeper", "remediate"]);
    for (const step of GUIDE_STEPS) expect(step.preset).not.toHaveProperty("autorun");
  });

  it("presets the leak step with the guard off and the hold step with it on", () => {
    expect(GUIDE_STEPS[0]?.preset).toMatchObject({ scenario: "attack_pipeline_42", guard: false });
    expect(GUIDE_STEPS[1]?.preset).toMatchObject({ scenario: "attack_pipeline_42", guard: true });
  });

  it("walks through the steps as they are marked done", () => {
    let state = EMPTY_ONBOARDING;
    expect(nextStep(state)?.id).toBe("leak");
    state = markDone(state, "leak");
    expect(nextStep(state)?.id).toBe("hold");
    state = markDone(markDone(state, "hold"), "case");
    expect(nextStep(state)?.id).toBe("heal");
  });

  it("does not record a step twice and reports a finished guide", () => {
    const once = markDone(EMPTY_ONBOARDING, "leak");
    expect(markDone(once, "leak")).toBe(once);
    const all = GUIDE_STEPS.reduce((state, step) => markDone(state, step.id), EMPTY_ONBOARDING);
    expect(nextStep(all)).toBeNull();
  });
});

describe("parseOnboarding: storage is untrusted input", () => {
  it("starts fresh when nothing is stored", () => {
    expect(parseOnboarding(null)).toEqual(EMPTY_ONBOARDING);
  });

  it("reads a valid record", () => {
    expect(parseOnboarding('{"hidden":true,"done":["leak","hold"],"lastTab":"investigate"}')).toEqual({
      hidden: true,
      done: ["leak", "hold"],
      lastTab: "investigate",
    });
  });

  it("drops unknown steps, duplicates and an unknown last view", () => {
    expect(parseOnboarding('{"done":["leak","leak","nope",3],"lastTab":"admin"}')).toEqual({ hidden: false, done: ["leak"], lastTab: null });
  });

  it("falls back to a fresh start for corrupt or non-object storage", () => {
    expect(parseOnboarding("{not json")).toEqual(EMPTY_ONBOARDING);
    expect(parseOnboarding("42")).toEqual(EMPTY_ONBOARDING);
    expect(parseOnboarding('"text"')).toEqual(EMPTY_ONBOARDING);
  });
});
