import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

// GSAP is used for choreographed SVG timelines (route drawing, packets travelling along a path).
// React state transitions (presence, layout, springs) use Motion instead.
gsap.registerPlugin(DrawSVGPlugin, MotionPathPlugin);

export { gsap };

/** True when the visitor asked for less motion; every animation has a static final state. */
export const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
