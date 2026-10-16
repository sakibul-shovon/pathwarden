import { isTabId, type TabId, type UrlState } from "./url";

/** The story guide for first-time visitors (ui-redesign.md §12.5): six suggested steps through the product's own story.
 *  Steps are suggestions, never run for the user (a run resets the workspace). Progress is a per-browser convenience
 *  kept in `localStorage`; the app must work, and look right, when storage is blocked. */

export type GuideStepId = "leak" | "hold" | "case" | "heal" | "sleeper" | "remediate";

export interface GuideStep {
  id: GuideStepId;
  title: string;
  instruction: string;
  /** The view that step happens in, with the URL state to preset (never `autorun`). */
  tab: TabId;
  preset: Partial<UrlState>;
  /** What counts as done, stated to the user. */
  doneWhen: string;
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "leak",
    title: "Watch it leak.",
    instruction: "Run the attack with the guard off: the secret reaches the public release page although every agent passes the Rule of Two.",
    tab: "run",
    preset: { scenario: "attack_pipeline_42", guard: false },
    doneWhen: "the public release page shows the leaked lines",
  },
  {
    id: "hold",
    title: "Run it again with the guard on.",
    instruction: "The same attack is now held before anything is posted.",
    tab: "run",
    preset: { scenario: "attack_pipeline_42", guard: true },
    doneWhen: "the outcome is HELD",
  },
  {
    id: "case",
    title: "Open the case.",
    instruction: "See why it was held: the two witness paths and the memory that carried the instruction.",
    tab: "investigate",
    preset: {},
    doneWhen: "you have opened a held action",
  },
  {
    id: "heal",
    title: "Heal it.",
    instruction: "Run forensics (it quarantines the poisoned memory and replays the work in a sandbox), compare held and healed, then decide.",
    tab: "investigate",
    preset: {},
    doneWhen: "a forensic report is shown",
  },
  {
    id: "sleeper",
    title: "See the sleeper.",
    instruction: "Run attack_sleeper_44: Wednesday's leak traces back to a memory written on Monday. Replay it in Time travel.",
    tab: "run",
    preset: { scenario: "attack_sleeper_44", guard: true },
    doneWhen: "you have visited the 'poisoned memory written' moment",
  },
  {
    id: "remediate",
    title: "Remove the leak path.",
    instruction: "Compute the cheapest verified set of permissions to remove so this path cannot exist.",
    tab: "remediate",
    preset: { topology: "enterprise12" },
    doneWhen: "the four candidate cuts are shown",
  },
];

export interface Onboarding {
  /** The user hid the guide. */
  hidden: boolean;
  done: GuideStepId[];
  /** The view the user was on last: a returning visitor without a deep link lands there. */
  lastTab: TabId | null;
}

export const ONBOARDING_STORAGE_KEY = "pw_onboarding";
export const EMPTY_ONBOARDING: Onboarding = { hidden: false, done: [], lastTab: null };

const STEP_IDS = new Set<string>(GUIDE_STEPS.map((s) => s.id));
const isStepId = (v: unknown): v is GuideStepId => typeof v === "string" && STEP_IDS.has(v);

/** Anything unreadable in storage (corrupt JSON, another version, hand-edited) falls back to a fresh start. */
export function parseOnboarding(raw: string | null): Onboarding {
  if (raw === null) return EMPTY_ONBOARDING;
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof Onboarding, unknown>>;
    const done = Array.isArray(v.done) ? [...new Set(v.done.filter(isStepId))] : [];
    return {
      hidden: v.hidden === true,
      done,
      lastTab: typeof v.lastTab === "string" && isTabId(v.lastTab) ? v.lastTab : null,
    };
  } catch {
    return EMPTY_ONBOARDING;
  }
}

export function markDone(state: Onboarding, id: GuideStepId): Onboarding {
  return state.done.includes(id) ? state : { ...state, done: [...state.done, id] };
}

/** The first step not done yet, or null when the guide is finished. */
export function nextStep(state: Onboarding): GuideStep | null {
  return GUIDE_STEPS.find((s) => !state.done.includes(s.id)) ?? null;
}

export function readOnboarding(): Onboarding {
  try {
    return parseOnboarding(window.localStorage.getItem(ONBOARDING_STORAGE_KEY));
  } catch {
    return EMPTY_ONBOARDING;
  }
}

export function writeOnboarding(state: Onboarding): void {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // blocked storage: the guide simply does not remember
  }
}
