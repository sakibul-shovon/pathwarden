import { useGSAP } from "@gsap/react";
import { useEffect, useRef } from "react";
import { gsap, reducedMotion } from "../gsap";

/** The attack as a route diagram: an illustration of `attack_pipeline_42`, not live data.
 *  GSAP draws the two routes, sends a packet along each, and then either closes the gate or lets them through. */
export function RouteDiagram({ guard }: { guard: boolean }) {
  const root = useRef<SVGSVGElement>(null);
  const introDone = useRef(false);
  const final = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const P = (sel: string): SVGPathElement => {
        const el = root.current?.querySelector<SVGPathElement>(sel);
        if (!el) throw new Error(`missing ${sel}`);
        return el;
      };
      const settle = (g: boolean): void => {
        gsap.set(q("#h-gate"), { scaleY: g ? 1 : 0.12, opacity: g ? 1 : 0.35, transformOrigin: "50% 50%" });
        gsap.set(q("#h-hold"), { opacity: g ? 1 : 0, scale: 1, transformOrigin: "50% 50%" });
        gsap.set(q("#h-leak"), { opacity: g ? 0 : 1 });
        gsap.set(q("#h-out"), { drawSVG: g ? "0%" : "100%", stroke: g ? "var(--line)" : "var(--hold)" });
        gsap.set(q("#h-page"), { stroke: g ? "var(--control)" : "var(--hold)" });
      };

      const playFinal = (g: boolean): void => {
        final.current?.kill();
        if (reducedMotion()) {
          settle(g);
          return;
        }
        const tl = gsap.timeline();
        final.current = tl;
        tl.set(q("#h-packet-m"), { opacity: 1 });
        if (g) {
          // closed gate: the packet runs into it and stops
          tl.set(q("#h-leak"), { opacity: 0 })
            .set(q("#h-out"), { drawSVG: "0%" })
            .to(q("#h-gate"), { scaleY: 1, opacity: 1, duration: 0.25, ease: "power2.out", transformOrigin: "50% 50%" })
            .to(q("#h-packet-m"), { motionPath: { path: P("#h-p-out"), align: P("#h-p-out"), alignOrigin: [0.5, 0.5], end: 0.62 }, duration: 0.6, ease: "power1.in" }, "<")
            .to(q("#h-gate"), { x: 3, yoyo: true, repeat: 3, duration: 0.05 })
            .to(q("#h-packet-m"), { opacity: 0, scale: 0.2, transformOrigin: "50% 50%", duration: 0.2 })
            .fromTo(q("#h-hold"), { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2.4)", transformOrigin: "50% 50%" }, "-=0.1")
            .to(q("#h-page"), { stroke: "var(--control)", duration: 0.2 }, "<");
        } else {
          // open gate: the packet reaches the public page, which now shows secret values
          tl.to(q("#h-hold"), { opacity: 0, duration: 0.15 })
            .to(q("#h-gate"), { scaleY: 0.12, opacity: 0.35, duration: 0.3, ease: "power2.inOut", transformOrigin: "50% 50%" }, "<")
            .set(q("#h-out"), { drawSVG: "0%", stroke: "var(--hold)" })
            .to(q("#h-out"), { drawSVG: "100%", duration: 0.55, ease: "power1.inOut" })
            .to(q("#h-packet-m"), { motionPath: { path: P("#h-p-out"), align: P("#h-p-out"), alignOrigin: [0.5, 0.5] }, duration: 0.55, ease: "power1.inOut" }, "<")
            .to(q("#h-packet-m"), { opacity: 0, duration: 0.15 })
            .to(q("#h-page"), { stroke: "var(--hold)", duration: 0.2 })
            .fromTo(q("#h-leak"), { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.4, ease: "power2.out" }, "<");
        }
      };

      if (introDone.current) {
        playFinal(guard);
        return;
      }

      if (reducedMotion()) {
        gsap.set(q(".h-station, #h-draft, .h-src"), { opacity: 1 });
        gsap.set(q("#h-u, #h-s"), { drawSVG: "100%" });
        settle(guard);
        return;
      }

      gsap.set(q(".h-station, #h-draft, .h-src"), { opacity: 0, y: 6 });
      gsap.set(q("#h-u, #h-s"), { drawSVG: "0%" });
      gsap.set(q("#h-hold, #h-leak"), { opacity: 0 });
      gsap.set(q("#h-out"), { drawSVG: "0%" });
      gsap.set(q("#h-packet-u, #h-packet-s, #h-packet-m"), { opacity: 0 });
      const intro = gsap.timeline({
        onComplete: () => {
          introDone.current = true;
          playFinal(guard);
        },
      });
      intro
        .to(q(".h-src"), { opacity: 1, y: 0, stagger: 0.15, duration: 0.35, ease: "power2.out" })
        .to(q("#h-u"), { drawSVG: "100%", duration: 0.9, ease: "power1.inOut" }, 0.2)
        .to(q("#h-packet-u"), { opacity: 1, duration: 0.01 }, 0.2)
        .to(q("#h-packet-u"), { motionPath: { path: P("#h-u"), align: P("#h-u"), alignOrigin: [0.5, 0.5] }, duration: 0.9, ease: "power1.inOut" }, 0.2)
        .to(q("#h-s"), { drawSVG: "100%", duration: 0.9, ease: "power1.inOut" }, 0.5)
        .to(q("#h-packet-s"), { opacity: 1, duration: 0.01 }, 0.5)
        .to(q("#h-packet-s"), { motionPath: { path: P("#h-s"), align: P("#h-s"), alignOrigin: [0.5, 0.5] }, duration: 0.9, ease: "power1.inOut" }, 0.5)
        .to(q(".h-station"), { opacity: 1, y: 0, stagger: 0.12, duration: 0.3 }, 0.5)
        .to(q("#h-packet-u, #h-packet-s"), { opacity: 0, duration: 0.15 }, 1.45)
        .to(q("#h-draft"), { opacity: 1, y: 0, duration: 0.2 }, 1.4)
        .fromTo(q("#h-draft circle"), { scale: 0.6 }, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.5)", transformOrigin: "50% 50%" }, 1.4);
    },
    { dependencies: [guard], scope: root },
  );

  useEffect(() => () => {
    final.current?.kill();
  }, []);

  return (
    <svg
      ref={root}
      className="route"
      viewBox="0 20 640 350"
      role="img"
      aria-label={
        guard
          ? "Untrusted and secret data meet at a changelog draft. Pathwarden holds it at the gate. Nothing reaches the public page."
          : "Untrusted and secret data meet at a changelog draft and flow to the public release page, which leaks secret values."
      }
    >
      <path id="h-u" d="M60 80 H300 Q410 80 410 190" className="ln ln-u" />
      <path id="h-s" d="M60 300 H300 Q410 300 410 190" className="ln ln-s" />
      <path id="h-p-out" d="M410 190 H575" className="ln-hidden" />
      <path id="h-out" d="M410 190 H575" className="ln ln-out" />

      <g className="h-station">
        <rect x="140" y="62" width="76" height="36" rx="8" className="st" />
        <text x="178" y="85" textAnchor="middle" className="t">Triage</text>
      </g>
      <g className="h-station">
        <rect x="236" y="62" width="100" height="36" rx="8" className="st" />
        <text x="286" y="85" textAnchor="middle" className="t">Team memory</text>
      </g>
      <g className="h-station">
        <rect x="236" y="282" width="76" height="36" rx="8" className="st" />
        <text x="274" y="305" textAnchor="middle" className="t">Fixer</text>
      </g>

      <g className="h-src">
        <path d="M60 52 L92 80 L60 108 L28 80Z" className="src src-u" />
        <text x="60" y="85" textAnchor="middle" className="t t-b">U</text>
        <text x="60" y="130" textAnchor="middle" className="t t-s">Issue #42</text>
      </g>
      <g className="h-src">
        <path d="M60 272 L92 300 L60 328 L28 300Z" className="src src-s" />
        <text x="60" y="305" textAnchor="middle" className="t t-b">S</text>
        <text x="60" y="350" textAnchor="middle" className="t t-s">.env file</text>
      </g>

      <g id="h-draft">
        <circle cx="410" cy="190" r="22" className="st draft" />
        <text x="410" y="196" textAnchor="middle" className="t t-b">⚠</text>
        <text x="440" y="226" className="t t-s">Draft</text>
      </g>

      <g>
        <rect id="h-gate" x="486" y="140" width="14" height="100" rx="4" className="gate-bar" />
        <g id="h-hold">
          <path d="M486 104 l14 0 l10 10 l0 14 l-10 10 l-14 0 l-10 -10 l0 -14z" className="octa" />
          <text x="493" y="124" textAnchor="middle" className="t t-b t-inv">HOLD</text>
        </g>
        <text x="493" y="262" textAnchor="middle" className="t t-s">Gate</text>
      </g>

      <g>
        <rect id="h-page" x="560" y="140" width="72" height="100" rx="8" className="page" />
        <rect x="570" y="152" width="52" height="6" rx="3" className="skel" />
        <rect x="570" y="166" width="40" height="6" rx="3" className="skel" />
        <g id="h-leak">
          <rect x="570" y="182" width="52" height="8" rx="3" className="leak-bar" />
          <rect x="570" y="196" width="44" height="8" rx="3" className="leak-bar" />
        </g>
        <text x="596" y="262" textAnchor="middle" className="t t-s">Public page</text>
      </g>

      <circle id="h-packet-u" r="7" className="packet packet-untrusted" />
      <circle id="h-packet-s" r="7" className="packet packet-secret" />
      <circle id="h-packet-m" r="7" className="packet packet-plain" />
    </svg>
  );
}
