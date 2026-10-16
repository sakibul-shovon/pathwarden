# Pathwarden — UI/UX redesign plan

> **Implementation status (2026-10-17):** the owner approved and asked for the whole redesign. It is implemented on branch `phase/p13a-homepage` (decisions D-032 and D-033 in `docs/DECISIONS.md`). Differences from this plan: GSAP **and** Motion are both used (U-2: the owner asked for both); fonts come from `@fontsource` packages instead of vendored files (U-3); `plan.md` was not amended (U-1); no `scripts/ui_check.mjs` was added (U-9: the checks ran from a scratch folder); the workspace switcher offers `<ws>` and `<ws>-mcp` only; the remaining items of §15 P13d (NVDA/axe pass, regenerated README screenshots, mobile pipeline diagram) are open (`docs/PROGRESS.md` K-P13-1..4). Treat the sections below as the design intent, not as a description of unfinished work.

> **Original status: PROPOSAL, waiting for the owner's approval.** Nothing in `web/` has been changed. No packages were installed.
> **Written:** 2026-10-17 · **Branch:** `docs/ui-redesign` · **Scope:** `web/` only (presentation layer). No backend, API, fixture, evaluation or test changes.
> **Readers:** the project owner (to approve the decisions in §2) and the coding agent who implements the approved phases (§15).

---

## Contents

0. [Summary](#0-summary)
1. [What exists today](#1-what-exists-today)
2. [Decisions the owner must make first](#2-decisions-the-owner-must-make-first)
3. [Research findings](#3-research-findings)
4. [Design direction and visual identity](#4-design-direction-and-visual-identity)
5. [Information architecture and navigation](#5-information-architecture-and-navigation)
6. [Homepage](#6-homepage)
7. [Page-by-page redesign](#7-page-by-page-redesign)
8. [Key user journeys](#8-key-user-journeys)
9. [Motion and interaction specification](#9-motion-and-interaction-specification)
10. [Light and dark themes](#10-light-and-dark-themes)
11. [Responsive design](#11-responsive-design)
12. [Accessibility](#12-accessibility)
13. [What must not change (functional contract)](#13-what-must-not-change-functional-contract)
14. [What cannot be done without backend changes](#14-what-cannot-be-done-without-backend-changes)
15. [Implementation phases, tasks and acceptance criteria](#15-implementation-phases-tasks-and-acceptance-criteria)
16. [Risks](#16-risks)
17. [Regression checks and testing](#17-regression-checks-and-testing)
18. [Definition of done](#18-definition-of-done)
19. [Sources](#19-sources)
- [Appendix A — Copy deck](#appendix-a--copy-deck)
- [Appendix B — Proposed file structure](#appendix-b--proposed-file-structure)

---

## 0. Summary

**The problem.** The UI works, but it reads like a default template: one column of identical bordered cards, a muted paragraph on every tab, tables for everything, system fonts, and a palette that follows the OS. There is no homepage; the app opens on the Run tab's form, and the product's central idea ("each agent passes its check, the system still leaks") is told in one sentence of grey text.

**The direction: "Signal & Route".** The interface works like a precise instrument, light-first, and borrows from transit diagrams. Untrusted data is one line, secret data is another, and Pathwarden is the gate that stops them reaching a public sink together. Three rules hold it together:

1. **Colour means data.** The chrome is ink on paper. Hues appear only for trust labels and verdicts (untrusted, secret, held, allowed, quarantined). Nothing is coloured for decoration.
2. **Show the path, then the proof.** Every verdict links to its route, and every graph has a text version that a keyboard or screen-reader user can follow.
3. **Honest machinery.** Nothing moves unless something happened. Replays are labelled as replays, polling shows as polling, and disabled features say why. The UI never fakes live agent activity; the API does not stream it (§14).

**What changes for users.**
- A short, interactive **homepage** gets a first-time visitor to a live result in one click.
- **Navigation is grouped by the response loop:** Simulate → Respond → Replay → Prevent → Prove. The tab labels stay the same.
- **Investigate** becomes an inbox plus a case file: verdict, witness routes, forensics as a stepper, diff, then the human approval.
- A **sign-in screen** for hosted mode (`PW_AUTH=on`) uses the existing workspace keys. There is no new backend authentication.
- **Light mode by default**, with a Light / Dark / System switch.
- **Full keyboard and screen-reader access** to things that today work only by clicking on a canvas.

**Motion.** The default plan needs no new dependencies: CSS transitions with `@starting-style`, the View Transitions API, the Web Animations API, and Cytoscape's built-in animations. **Motion** (`motion@14.3.0`, formerly Framer Motion) is an optional extra that needs approval. **GSAP** was evaluated and is not recommended (§9.4).

**Before any code is written**, the owner must answer the decisions in §2. Most important: `plan.md` §19 requires "Plain CSS with light/dark via `prefers-color-scheme`" and six tabs, and §6 fixes the frontend stack. A theme toggle, a homepage and any animation library all conflict with that text, and `plan.md` takes precedence over chat instructions (AGENTS.md §0).

**Timing.** The hackathon submission closes on **18 Oct 2026, 23:59 IST**. §2 (U-10) recommends either freezing `main` for submission or shipping only the low-risk re-skin (phase P13a) before then.

---

## 1. What exists today

### 1.1 Inventory (inspected in full)

| File | Lines | Role |
|---|---:|---|
| `web/src/App.tsx` | 80 | Header, tagline, six-tab nav. Reads the deep-link parameters once; tab clicks do not update the URL. |
| `web/src/api/client.ts` | 117 | `fetch` wrapper. Sends the `Authorization: Bearer` key (from `?key=`, `sessionStorage.pw_key` or `VITE_API_KEY`) and `X-PW-Human` on the four human calls. Workspace comes from `?ws=` (default `tinyqueue`). Errors become `ApiError`. |
| `web/src/api/types.ts` | 293 | Types that mirror plan §18 (no `any`). |
| `web/src/hooks.ts` | 46 | `usePoll`, `useThemeTick` (OS colour-scheme listener), `errorText`. |
| `web/src/styles.css` | 163 | One global stylesheet. Tokens follow `prefers-color-scheme`. |
| `web/src/tabs/Run.tsx` | 178 | Scenario select, guard checkbox, mode radios (live disabled), Run. Outcome banner, agent cards with the Rule-of-Two badge, public page, timeline table. |
| `web/src/tabs/Investigate.tsx` | 326 | Action list (polled every 3 s), verdict card, lineage graph, Cypher text, laundering table, forensics, report, diff, heal approval. |
| `web/src/tabs/TimeTravel.tsx` | 175 | Range slider over the logical clock, marker buttons, graph at `t` (debounced 120 ms, abortable). |
| `web/src/tabs/Memory.tsx` | 95 | q8 inventory table (polled every 3 s). Release quarantine uses `window.confirm`. |
| `web/src/tabs/Remediate.tsx` | 214 | Topology select, capability graph, witness on node tap, candidate table, Show cut, Apply (`window.confirm`), Reset. |
| `web/src/tabs/Evaluation.tsx` | 129 | Everything rendered from `GET /api/eval/summary` (polled every 10 s). |
| `web/src/components/LineageGraph.tsx` | 176 | Cytoscape `breadthfirst` graph. Stable positions for time travel. Colour plus line style plus shape encodings. |
| `web/src/components/CapabilityGraph.tsx` | 124 | Cytoscape capability graph; toxic, revoked and cut encodings; tap an agent node to select it. |
| `web/src/components/RuleOfTwo.tsx` | 23 | A/B/C pills plus a verdict badge. |

The stack is React 18.3.1, Vite 8, TypeScript 7 (strict) and cytoscape 3.34, with no other runtime dependencies. CI job `web` runs `npm run build` (`tsc --noEmit` then `vite build`). There is no frontend test framework: decision A-16 uses headless Edge and the DevTools protocol instead.

### 1.2 UX audit: what is wrong, specifically

| # | Problem | Where | Effect on users |
|---|---|---|---|
| A1 | No orientation or homepage. The app opens on a form. | `App.tsx` | A first-time visitor or judge must already know what to click. |
| A2 | The core insight is buried in muted paragraphs. | Run (the "Meta's Rule of Two…" paragraph), Remediate, Forensics | The "aha" (every agent passes, the path fails) is read, not seen. |
| A3 | Flat hierarchy. Every section is the same card with the same h2/h3 weight, and a verdict looks like any other banner. | all tabs | Nothing tells the eye where to look first. |
| A4 | Tables everywhere: a 30-plus-row timeline, memory, candidates, evaluation. No filtering or grouping. | Run, Memory, Remediate, Evaluation | Hard to scan, and they overflow on phones. |
| A5 | Graph labels are 9–10 px, the legend is prose, and there is no zoom, fit or focus control. | Lineage and capability graphs | Proof paths are hard to read, and the most important visual is the least legible. |
| A6 | Remediate agents can only be selected by clicking the canvas. | `CapabilityGraph.tsx` | Keyboard and screen-reader users cannot reach per-agent witnesses (WCAG 2.1.1). |
| A7 | The status vocabulary is styled three different ways: verdicts (ALLOW/HOLD/BLOCK), recorded statuses (held/blocked/executed/superseded/rejected) and run outcomes (HELD/LEAKED/POSTED). | Run, Investigate, Memory, Time travel | Users must re-learn the colours on each tab. |
| A8 | The theme follows the OS only. Light mode was never verified (DECISIONS B6: "light-mode appearance" not verified, headless Edge ran dark). | `styles.css` | The default experience the owner wants (light) is the least tested. |
| A9 | Hosted mode has no sign-in. A missing key shows as a red error banner on every tab. | `client.ts` + every tab | Looks broken, and offers no way to enter a key except editing the URL. |
| A10 | The MCP gateway view (`?ws=tinyqueue-mcp`, D-026) can only be reached through the URL. | `client.ts` | A real feature nobody can find. |
| A11 | `window.confirm` is used for risk-increasing actions. | Memory, Remediate | It cannot show structured information (the cap ids), cannot be styled, and blocks the page. |
| A12 | Waiting shows only as the text "Running…": no elapsed time, no skeletons, and polling is invisible. | Run, Investigate | Users cannot tell whether the system is working or stuck. |
| A13 | The tab is not reflected in the URL after a click, so refresh loses your place and Back does nothing. | `App.tsx` | Not shareable, and disorienting. |
| A14 | System font, 13 px monospace. Ids like `a-0001`, `s-0002`, `act-0001` and `PWDEMO-SECRET-…` are dense and easy to misread (0/O, 1/l/I). | global | Mistakes when reading the evidence a security user relies on. |
| A15 | Graph containers have fixed heights (460 px / 520 px), and tables use fixed column layouts. | `styles.css` | Cramped on phones and wasted space on large screens. |

### 1.3 Binding constraints found in the repository

| Constraint | Source | Effect on the redesign |
|---|---|---|
| "Six tabs. Plain CSS with light/dark via `prefers-color-scheme`. Polling only." | `plan.md` §19 | A homepage, a manual theme toggle and any CSS-in-JS conflict with it. **Needs an amendment** (U-1). Polling only means no streaming, so "live activity" must be honest (§9). |
| Frontend = React 18 + Vite + TypeScript + `cytoscape` (built-in `breadthfirst` layout) | `plan.md` §6, AGENTS.md §3 | No component libraries, state managers, router, icon or chart libraries. Graph layouts stay built-in. |
| "No new dependencies beyond Section 6 without asking." | plan §4 rule 12, AGENTS.md §3 | Motion, GSAP, fonts packages and test tools each need a human OK and a `DECISIONS.md` entry (U-2, U-3, U-9). |
| "Scope creep (component libraries, state managers) → forbidden by rule 12." | `docs/phases/P10a…md` §8 | Primitives are written in-house (small). |
| TypeScript `strict`, no `any` for API data, types mirror §18 | AGENTS.md §3 | `types.ts` stays as it is. |
| "Never hand-edit evaluation numbers." | plan §4 rule 11 | Home and Evaluation must render numbers from `GET /api/eval/summary` only. No metric is typed into copy. |
| Risk-increasing actions need a human; `X-PW-Human: true` on those calls | plan §4 rule 8, §17; D-029 | The UI keeps the human header on exactly the same four calls and keeps an explicit confirm step. |
| "Information never conveyed by colour alone." | P10a-T6 | Every encoding keeps a shape, line style, glyph or text label. |
| Deep links are a documented feature (shareable links) | DECISIONS A-16, `docs/MCP.md` | The URL contract in §5.5 is frozen. New parameters are additive only. |
| Time travel shows *current* flags, not history | DECISIONS B9 / A-09 | The disclaimer stays and is made more visible. |
| Key in `Authorization: Bearer`; `?key=` kept in `sessionStorage`; CORS is a non-goal | D-028, `docs/SECURITY.md`, `docs/DEPLOY.md` | Sign-in reuses this mechanism exactly. A hosted UI must be served from the same origin or through a proxy. |
| UI only; no backend or business-logic changes | the owner's brief | Anything needing new endpoints is documented in §14, not built. |

---

## 2. Decisions the owner must make first

Implementation must not start until these are answered and recorded in `docs/DECISIONS.md` (proposed ids D-032 onward). The recommended option comes first.

| ID | Question | Options (recommended first) | Why it matters |
|---|---|---|---|
| **U-1** | Amend `plan.md` §19 (and §6 if U-2/U-3/U-9 add anything) so the redesign is in scope? | **(a) Yes: owner edits §19 to "Home + six views; light default with Light/Dark/System toggle; plain CSS with cascade layers; polling only"** · (b) Record a D-entry only and leave plan.md alone | `plan.md` outranks chat (AGENTS.md §0). Without (a), an agent following the rules must refuse the toggle and the homepage. |
| **U-2** | Animation technology | **(a) Zero dependencies: CSS + `@starting-style`, View Transitions API, Web Animations API, Cytoscape animations** · (b) add `motion@14.3.0` (MIT; peer React `^18 \|\| ^19`) for layout and exit animations · (c) add `gsap@3.15.0` + `@gsap/react@2.1.2` | (a) covers every animation in §9 at zero bundle cost, except the optional inbox layout animations M18–M20 (which become instant). (b) is justified only if those are wanted. (c) duplicates (a) for this product (§9.4). |
| **U-3** | Typeface | **(a) Self-host Atkinson Hyperlegible Next + Atkinson Hyperlegible Mono (`.woff2` files in `web/public/fonts/` with `OFL.txt`; not an npm dependency)** · (b) IBM Plex Sans + Plex Mono (OFL) · (c) keep the system font stack | Ids and fake secrets are the evidence. A face designed to tell 0/O and 1/l/I apart is a functional choice, not decoration (§4.3). |
| **U-4** | What opens at `/` with no parameters? | **(a) The new Home. Backward-compatible: a URL with `scenario`, `guard` or `autorun` and no `tab` still opens Run** · (b) Keep Run as the default and reach Home at `?tab=home` | Changes the landing page of every bare link. (a) keeps every documented deep link working (§5.5). |
| **U-5** | Theme default and persistence | **(a) Light by default, even when the OS is dark. Switch: Light / Dark / System. Saved in `localStorage.pw_theme` (try/catch).** · (b) Follow the OS by default | The owner asked for light as the primary experience. (a) does that and still lets OS-dark users opt in with one click. |
| **U-6** | Sync navigation into the URL | **(a) `history.pushState` on view change (keeps `ws`; drops one-shot `autorun`/`autoforensics`/`autoheal` so Back never re-runs a mutation)** · (b) keep today's read-once behaviour | Fixes A13. Removing one-shot parameters after they fire is the only behaviour change, and it prevents an accidental second run when someone presses Back. |
| **U-7** | Replace `window.confirm` with in-app `<dialog>` confirmations | **(a) Yes: native `<dialog>` with the same text, same explicit consent, focus trapped, Escape cancels** · (b) keep `window.confirm` | Fixes A11 and allows a structured preview (cap ids, affected artifacts). Note: headless click-through recipes that accept JS dialogs must be updated (§16 R11). |
| **U-8** | Remove `?key=` from the address bar once it is stored | **(a) Yes: `history.replaceState` after saving to `sessionStorage`** · (b) leave it | Keeps the key out of history, screenshots and the video. Authentication behaviour is unchanged (the key is still read from `sessionStorage`). |
| **U-9** | UI test tooling | **(a) No new dependency: script the existing headless-Edge + DevTools-protocol recipe (Node 22 built-ins only) as `scripts/ui_check.mjs`** · (b) add `@playwright/test` + `@axe-core/playwright` as devDependencies | (a) follows A-16. (b) gives real visual-regression and axe scans, but needs approval under rule 12. |
| **U-10** | Timing relative to the 18 Oct 23:59 IST submission | **(a) Freeze `main` for the submission and the demo video; implement P13a–P13d afterwards** · (b) ship only P13a (re-skin, no logic changes) before the deadline if the full regression walkthrough (§17.2) passes by a cut-off the owner chooses · (c) attempt everything before the deadline (not recommended) | A redesign the day before submission is the single largest risk to the demo (§16 R1). |
| **U-11** | Surface existing backend capabilities the UI does not use today? | **(a) Only `GET /api/health` (read-only status pill)** · (b) also `POST /ws/{ws}/reset` ("Reset demo") and `POST /actions/{id}/approve` / `reject` | (b) adds new user-facing actions (one of them risk-increasing), which is new functionality. Recommendation: list it for later, do not build. |
| **U-12** | `?autoheal=1` performs a human-only action (heal approval, with `X-PW-Human`) without a click | **(a) Keep as-is (documented, A-16); raise separately** · (b) require a click in hosted mode | Security observation, not a redesign item. The redesign must not change it silently. |

---

## 3. Research findings

Research was done on 2026-10-17. Sources are in §19. Vendor and blog claims are marked as such.

### 3.1 Agentic products: patterns we take

| Product / source | What it does | What Pathwarden takes |
|---|---|---|
| **GitHub Agent HQ / Mission Control** (Universe, Oct 2025) | "A single command center to assign, steer, and track" many agents, available on web, IDE, mobile and CLI. | One persistent **console shell**: the workspace is always visible, and a **held-actions inbox** badge shows wherever you are. |
| **Datadog AI Agent Monitoring** | An interactive graph of each agent's decision path (inputs, tool calls, calls to other agents, outputs). Argues that agentic systems are non-linear (fan-in/fan-out) and linear traces are not enough. | The lineage graph is the **primary evidence surface**, not an appendix. Fan-in (untrusted and secret meeting at the draft) is the visual climax. |
| **LangSmith run tree / Langfuse Agent Graphs + Trace Log view** | The same run shown as a tree or graph and as a flat log. | Run shows the same timeline two ways: **agent lanes** (spatial) and an **event log** (filterable). |
| **Vercel AI Elements** | A `Tool` component (input, output, status) and a `Confirmation` component for approving tool execution. | One **approval card** pattern for every human action: what will happen, the exact payload or diff, then Approve / Cancel. |
| **Microsoft Design, "UX design for agents"** | Agent status "clearly visible at all times"; actions viewable "through logs or dashboards"; "nudging more than notifying"; transparency, control, consistency. | Always-visible **status pill**, an honest **"updated Ns ago"** polling indicator, and inbox badges instead of pop-up toasts. |
| **Human-in-the-loop guides** (Dataiku; AI UX Playground) | Put checkpoints before irreversible actions and show the exact change. "An approval card that hides the payload is ineffective." | **Approve healed release** sits directly under the held-versus-healed diff. **Apply cut** previews the cut on the graph before the dialog. |
| **Wiz Security Graph / attack path analysis** | "Toxic combinations": low-severity issues chained into a critical path from an internet-facing entry point to crown jewels. | The same mental model as Pathwarden's toxic agents and witness paths. Render **entry → … → sink as one highlighted route** with everything else dimmed. |
| **Linear UI refresh** (Mar 2026; also 2024) | "Don't compete for attention you haven't earned"; navigation "a few notches dimmer"; "structure should be felt not seen"; lower-contrast borders; warmer, less saturated greys; shipped incrementally behind flags. | Chrome recedes and content leads. Hairline borders, spacing over boxes. Phased delivery (P13a–d), each phase shippable. |

### 3.2 Award-winning sites and visual storytelling

- **Awwwards Site of the Year 2025** listings show *Lando Norris* (OFF+BRAND.) and *Messenger* (abeto), both immersive, motion-heavy brand experiences. A 2026 commentary on Site of the Day winners notes scrollytelling and respect for `prefers-reduced-motion`. **We take the craft:** typographic scale, choreographed reveals, tactile micro-interactions, one strong visual idea per screen. **We reject the format:** no scroll-jacking, no 3D, no page-length narrative. Pathwarden is a tool, and the homepage's job is to get someone to a real result in one click.
- **Explorable explanations** (Bret Victor; Bartosz Ciechanowski's interactive essays) replace paragraphs with a diagram the reader manipulates. The homepage hero is built this way: one switch (Pathwarden off/on) changes the outcome of the drawn attack.
- **Transit diagrams** (Harry Beck's 1933 London Underground map) show topology instead of geography. This is our visual metaphor: lineage instead of time, data "lines" running through agent "stations", and an interchange where two lines meet.

### 3.3 Platform capabilities (October 2026)

| Capability | Status | Use |
|---|---|---|
| Same-document **View Transitions** (`document.startViewTransition`) | Baseline (newly available) since Firefox 144, 14 Oct 2025 | View-to-view transitions with no library. Instant fallback. |
| CSS **anchor positioning** | Baseline since Jan 2026 (Firefox 147) | Tooltips and menus anchored to graph toolbar buttons with no Floating UI. Progressive: fall back to fixed placement. |
| CSS **scroll-driven animations** | Chrome/Edge 115+, Safari 26; Firefox reports conflict | Not used for anything essential. `@supports`-guarded flourishes on Home at most. |
| `@starting-style`, `transition-behavior: allow-discrete`, `<dialog>`, Popover API | Baseline | Entry/exit animations of dialogs, sheets and popovers without JS. |
| **Cytoscape 3.34**: `transition-property` / `transition-duration` / `transition-timing-function`, `line-dash-pattern`, `line-dash-offset`, `underlay-*`, `outline-*`, `ele.animate()` / `cy.animate()`, `eles.flashClass()` | In the official docs | Path tracing, dimming, fit/zoom and "marching" witness edges with **no new dependency**. Colour formats Cytoscape accepts must be verified by a probe (R0-5). |
| **Motion** 14.3.0 (npm, 2026-10-15) | Peer `react ^18.0.0 \|\| ^19.0.0`. Full `motion` component ≈ 43 KB; `m` + `LazyMotion` ≈ 5 KB + `domAnimation` 24 KB; `useAnimate` mini 3.3 KB (motion.dev) | Only if U-2(b). |
| **GSAP** 3.15.0; `@gsap/react` 2.1.2 | 100% free including the former Club plugins (SplitText, MorphSVG, DrawSVG, ScrollTrigger) since the Webflow acquisition | Evaluated; not recommended (§9.4). |
| React latest is 19.3.1 | — | **We stay on 18.3.1.** A framework upgrade does not belong in a UI redesign. |

### 3.4 Accessibility standards

- Target: **WCAG 2.2 AA**. The 2.2 criteria that matter here:
  - 2.4.11 Focus Not Obscured: sticky headers must not hide focus.
  - 2.5.7 Dragging Movements: the time slider and graph panning need click alternatives.
  - 2.5.8 Target Size: at least 24 × 24 CSS px.
  - 3.3.8 Accessible Authentication: allow paste and password managers.
  - 3.2.6 Consistent Help.
- Sign-in fields follow web.dev guidance: `autocomplete="current-password"` lets password managers fill the key, and tap targets are at least 48 px on touch.

### 3.5 Typography

- The 2026 type commentary says the fatigue is "with defaulting to Inter without considering alternatives". For developer tools it suggests an "industrial sans with a monospace companion", and warns to test faces at 13 px, not 48 px.
- **Choice: Atkinson Hyperlegible Next + Atkinson Hyperlegible Mono** (Braille Institute, Feb 2025). Seven weights and a variable version. The Mono is "designed to assist coders" where exact character reading is critical. Free under SIL OFL-1.1 per Google Fonts and Fontsource; the license file must be verified before vendoring (R0-5).
  - **Why it fits:** Pathwarden's evidence is ids (`a-0001`, `s-0002`, `act-0001`), keys (`team_convention:42`) and fake secrets (`PWDEMO-SECRET-…`). A misread character is a misread proof. Hyperlegibility is the product requirement; the distinctive look is a bonus.
  - It is a humanist face with a recognisable personality. It does not resemble the generic neo-grotesques of AI-generated layouts or the serif-on-cream style of Claude's own UI.

### 3.6 Patterns we reject, and why

| Rejected | Reason |
|---|---|
| Purple/indigo gradients, glow, glassmorphism, "sparkle" AI icons, orbs | The signature of template AI products, and colour without meaning breaks rule 1 ("colour means data"). |
| Cream/beige backgrounds, serif display headings, coral accents | Reads as Claude's own visual language, which the owner explicitly wants to avoid. |
| Bento grids of marketing claims, stat counters with typed numbers | Text-heavy in disguise. Typed numbers break rule 11. |
| Fake streaming text, typing cursors, pulsing "agent thinking" avatars | The API does not stream (polling only). Faking liveness undermines trust in a security product. |
| Scroll-jacking, auto-looping hero video, parallax | Hurts usability and accessibility (WCAG 2.2.2) and delays the one action that matters. |
| Emoji as icons, mixed icon sets | Inconsistent rendering across platforms. A small custom SVG set is used instead (§4.6). |

---

## 4. Design direction and visual identity

### 4.1 Concept: "Signal & Route"

Pathwarden is a lineage gate. Its users read routes (which data travelled where) and signals (held, allowed, quarantined). The identity combines:

- **Route:** a transit-diagram drawing language. 2 px lines, 45° and 90° bends, round "station" nodes, interchanges where lines meet.
- **Signal:** railway-signal semantics for verdicts. A red octagon for held, a green check for allowed, a hatched slate block for quarantined.
- **Instrument:** calm, dense, precise panels, like an oscilloscope or air-traffic display. Calm until it matters (Linear), then unmistakable.

Design principles in priority order:
1. **Colour means data.** (§0)
2. **One focal point per screen.** The verdict, the route or the decision, never all three at the same weight.
3. **Show, then tell.** A diagram or state first, then at most one sentence of helper text. Longer explanations go behind a "Why?" disclosure.
4. **Honest machinery.** (§0)
5. **Every graph has a text twin.** (§12)

### 4.2 Brand elements

- **Wordmark:** `pathwarden`, lowercase, Atkinson Hyperlegible Next Bold, tracking −1%.
- **Mark:** two strokes (one solid, one dotted) converging into a short vertical bar, the gate. Inline SVG at 16, 24 and 32 px. Also used as the favicon (`web/public/favicon.svg`).
- **Motif:** route lines are used sparingly, only in the homepage hero, the sign-in panel and empty states. Never as background decoration inside the console.
- **Voice:** short, declarative, concrete. "Held. Nothing was posted." not "Your action has been successfully held by our system!" Labels are nouns, buttons are verbs. Ids are always shown in monospace.

### 4.3 Typography

| Token | Value |
|---|---|
| `--font-sans` | `"Atkinson Hyperlegible Next", system-ui, -apple-system, "Segoe UI", sans-serif` |
| `--font-mono` | `"Atkinson Hyperlegible Mono", ui-monospace, "Cascadia Mono", Consolas, monospace` |
| Loading | Two variable `.woff2` files (sans normal, mono normal; italic only if used), `font-display: swap`, sans preloaded in `index.html`. Files ship **unmodified**: no subsetting or renaming, because OFL Reserved Font Names apply to modified versions. |

| Style | Size / line-height / tracking / weight | Use |
|---|---|---|
| Display XL | `clamp(2.5rem, 4.5vw + 1rem, 4.5rem)` / 1.02 / −0.02em / 800 | Homepage H1 only |
| Display | 2.25rem / 1.1 / −0.015em / 700 | Sign-in headline, homepage section titles |
| H1 (view title) | 1.5rem / 1.2 / −0.01em / 700 | One per console view |
| H2 | 1.125rem / 1.3 / 0 / 700 | Panel titles |
| H3 | 0.9375rem / 1.35 / 0 / 700 | Sub-panels |
| Body L | 1.0625rem / 1.55 / 0 / 400 | Homepage lede |
| Body | 0.9375rem (15 px) / 1.5 / 0 / 400 | Console default |
| Small | 0.8125rem (13 px) / 1.45 / 0 / 400 | Meta, table secondary |
| Label | 0.75rem (12 px) / 1.3 / +0.06em / 700, uppercase | Eyebrows and field captions only |
| Mono | 0.875rem / 1.45 / 0 / 400 (Small: 0.8125rem) | Ids, keys, numbers, clocks, Cypher, payloads |

Rules: prose is at most 68 characters wide. Numbers in tables, clocks and metrics use the mono face, because tabular-figure support in Next is unverified (R0-5). Never more than two weights per component.

### 4.4 Colour system

Light is primary. All values are **hex** on purpose: Cytoscape reads these tokens through `getComputedStyle`, which returns custom properties unresolved (see §10.3). The contrast figures below were **computed** (WCAG 2.x relative luminance) for this document.

**Neutrals**

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F4F5F7` | `#0B0D10` | Page canvas |
| `--surface` | `#FFFFFF` | `#13161B` | Panels, cards, inputs |
| `--surface-2` | `#ECEEF1` | `#1A1E24` | Insets: code, diff, table header, graph canvas |
| `--line` | `#DFE2E7` | `#272C34` | Hairline separators (decorative; "felt, not seen") |
| `--control` | `#7F8794` | `#636B78` | Borders that identify a control (≥ 3:1: 3.62 on surface, 3.32 on bg, 3.12 on surface-2) |
| `--ink` | `#0E1116` | `#ECEFF3` | Primary text; primary button background (light) |
| `--ink-2` | `#3B4350` | `#B4BBC6` | Secondary text |
| `--ink-3` | `#5E6775` | `#8F98A5` | Tertiary text and meta (5.72:1 on light surface, 6.22:1 on dark) |
| `--focus` | `#0E1116` | `#ECEFF3` | 2 px focus ring + 2 px offset (17:1) |

**Semantic colours.** These are the only hues in the product.

| Meaning | Token | Light text / line / tint | Dark text / line / tint | Light text contrast on surface | Non-colour cue (always present) |
|---|---|---|---|---|---|
| Untrusted | `--untrusted` | `#B45309` / `#C2620A` / `#FFF1E0` | `#F5A142` / `#F5A142` / `#2E1F0E` | 5.02 (line 4.16) | Solid thick line, diamond source with **U** |
| Secret | `--secret` | `#B0175E` / `#C2185B` / `#FCE7F1` | `#FF7AB6` / `#FF7AB6` / `#33121F` | 6.71 (line 5.87) | Dotted thick line, diamond source with **S** |
| Held / blocked | `--hold` | `#B42318` / — / `#FDECEA` | `#FF8A7A` / — / `#36140F` | 6.57 | Octagon icon + the word HELD/BLOCKED |
| Allowed / executed | `--allow` | `#137A48` / — / `#E4F4EA` | `#5AD394` / — / `#0F2A1C` | 5.38 | Check icon + the word |
| Quarantined | `--quarantine` | `#5B6472` / — / `#E9EBEF` | `#9AA3B0` / — / `#1F242B` | 5.98 | Diagonal hatch fill + lock glyph |

All semantic text colours stay ≥ 4.5:1 on `--bg`, `--surface` and their own tint in both themes; the lowest is light untrusted on its tint, at 4.52.

**Note on untrusted versus held:** amber and red are confusable with protanopia and deuteranopia. That is why both always carry a non-colour cue: untrusted is a solid line with a U diamond; held is an octagon with a word.

**Primary action:** light theme `--ink` background with `--surface` text (18.9:1); dark theme inverted. **Destructive or risk-increasing** buttons use an outline in `--hold`, never a solid red fill, so they don't compete with verdicts.

### 4.5 Space, radius, elevation, grid

| Token group | Values |
|---|---|
| Space (4 px base) | `--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 24 · `--s-6` 32 · `--s-7` 48 · `--s-8` 64 · `--s-9` 96 |
| Radius | `--r-xs` 4 (chips) · `--r-sm` 6 (inputs, buttons) · `--r-md` 10 (panels) · `--r-lg` 16 (dialogs, homepage panels) · `--r-pill` 999 |
| Elevation | Borders do most of the work. Shadows only on floating layers (dialog, popover, sheet, toast). Light: `0 1px 2px rgb(14 17 22 / .06), 0 8px 24px rgb(14 17 22 / .08)`. Dark: no shadow; use a `--control` border on `--surface-2`. |
| Layout | Console: nav rail 232 px (collapsible to 64 px) + fluid content (max 1440 px) + optional inspector 360 px. Home: 12-column grid, max 1200 px, 24 px gutters (16 px at ≤ 480 px). |
| Breakpoints | 480 · 768 · 1024 · 1280 · 1536 |

### 4.6 Iconography

About 24 icons drawn in-house as inline SVG in one `web/src/ui/Icon.tsx`: 20 px grid, 1.5 px stroke, round caps, `currentColor`. No icon library (rule 12).

The set covers:
- Domain: source (diamond), agent, store (barrel), sink (tag), external sink (tag with ↗), gate, held (octagon), allowed (check), quarantined (hatched square), sanitized (dashed square), witness route.
- Controls: play, pause, step back/forward, fit, zoom in/out, copy, filter, external link, key, workspace, sun, moon, monitor (system theme), chevron, close.

### 4.7 One encoding table for the whole product

Graphs, chips, tables and the homepage all use this single mapping. Today it is split across three components.

| Concept | Colour | Line / border | Glyph | Text |
|---|---|---|---|---|
| Untrusted path / source | untrusted | solid, 4 px | ◇ with U | "untrusted" |
| Secret path / source | secret | dotted, 4 px | ◇ with S | "secret" |
| Both (doubly tainted) | untrusted + secret | double border | ⚠ | "untrusted + secret" |
| Sanitized artifact | none | dashed border | dashed square | "sanitized" |
| Approved artifact | none | — | ✓ seal | "approved" |
| Quarantined | quarantine | hatched fill, 60% opacity | lock | "quarantined" |
| Agent / store / sink | ink | round-rect / barrel / tag | per §4.6 | name |
| External sink | ink | thick border | ↗ | "external" |
| Toxic agent | hold | double border | ⚠ | "toxic" |
| Revoked flow | ink-3 | dashed, 35% opacity | — | "revoked" |
| Previewed cut | hold | 4 px + "cut" label | scissors | "cut" |

**Status vocabulary.** Every API value keeps its exact text; only the styling is unified.

| API value | Where it comes from | Chip |
|---|---|---|
| `HOLD` | gate verdict | octagon, hold colour |
| `BLOCK` | gate verdict | octagon, hold colour, label "BLOCK" |
| `ALLOW` | gate verdict | check, allow colour |
| `held`, `blocked` | recorded status | octagon, hold colour |
| `executed` | recorded status | check, allow colour |
| `superseded` | recorded status | ink-3, struck-through id |
| `rejected` | recorded status | ink-3, × |
| Run outcome `HELD` / `LEAKED` / `POSTED` | computed in `Run.tsx` (unchanged logic) | verdict slab (§7.2) |

---

## 5. Information architecture and navigation

### 5.1 Users and their jobs

| User | Job to be done | Time budget | First view |
|---|---|---|---|
| **Evaluator / judge** | "Show me the leak, then show me it stopped, and prove it." | 3–5 minutes | Home → Run |
| **Security / platform engineer** | "Something was held: why, is it real, how do I fix it safely?" | 5–15 minutes per case | Investigate inbox |
| **Agent developer** | "Route my agents through the MCP gateway and see their lineage." | sessions | Workspace switcher → MCP view |
| **Owner / maintainer** | "Find the cheapest permission change that removes the risk class." | 10 minutes | Remediate |

### 5.2 Sitemap

```
Home                              (new; public, no key needed)
Console
  Simulate   → Run                ?tab=run
  Respond    → Investigate        ?tab=investigate   (inbox badge: held/blocked count)
             → Memory             ?tab=memory
  Replay     → Time travel        ?tab=time
  Prevent    → Remediate          ?tab=remediate
  Prove      → Evaluation         ?tab=evaluation
Sign in                           (a state, shown when a workspace view needs a key)
```

The **tab labels and ids stay exactly as they are** (README, `docs/MCP.md`, screenshots and the video script use them). The groups (Simulate, Respond, Replay, Prevent, Prove) are small captions in the nav that teach the loop.

### 5.3 Shell anatomy (desktop ≥ 1024 px)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ◇═▌ pathwarden   [ tinyqueue ▾ ]                ● API ok   ☀︎▾   Local mode   │  ← top bar 56px
├──────────────┬────────────────────────────────────────────────────────────────┤
│ Home         │  Investigate                                   Updated 2s ago │
│              │  ───────────────────────────────────────────────────────────── │
│ SIMULATE     │                                                                │
│  Run         │   (view content)                                               │
│ RESPOND      │                                                                │
│  Investigate①│                                                                │
│  Memory      │                                                                │
│ REPLAY       │                                                                │
│  Time travel │                                                                │
│ PREVENT      │                                                                │
│  Remediate   │                                                                │
│ PROVE        │                                                                │
│  Evaluation  │                                                                │
│              │                                                                │
│ ⌄ collapse   │                                                                │
└──────────────┴────────────────────────────────────────────────────────────────┘
```

| Element | Behaviour | Data source |
|---|---|---|
| Workspace switcher | Shows the current `ws`. Offers `<ws>` ("Scripted runtime") and `<ws>-mcp` ("Through the MCP gateway"). Selecting one rewrites `?ws=` and reloads the views (D-026). In local mode a free-text field accepts another workspace name. | URL only (no list endpoint, §14) |
| Status pill | `● API ok` / `● Database unavailable` / `● API unreachable`. Polls `GET /api/health` every 15 s and on window focus. | existing endpoint (U-11a) |
| Theme menu | Light / Dark / System, with a check on the current one. | `localStorage.pw_theme` |
| Auth chip | `Local mode` (no key needed), `Signed in · <ws>` with a menu containing "Sign out", or `Built-in key` (`VITE_API_KEY`; sign-out hidden, with an explanation). | sessionStorage / env / probe (§7.1) |
| Inbox badge | Count of `held` + `blocked` actions from the existing 3 s `GET /actions` poll, announced politely when it increases. | existing poll |
| "Updated Ns ago" | Shown on polled views; a 1-frame dot pulse on each successful poll. | `usePoll` |

### 5.4 Smaller screens

- **768–1023 px:** the rail collapses to icons with tooltips; the inspector becomes a right-hand sheet.
- **< 768 px:** a top bar with a menu button opens the navigation as a full-height `<dialog>` sheet. The current view title sits under the top bar, and the inspector becomes a bottom sheet. No bottom tab bar: seven destinations do not fit.

### 5.5 URL and deep-link contract (frozen; additive changes only)

| Parameter | Today | After the redesign |
|---|---|---|
| `tab` | `run` (default) · `investigate` · `time` · `memory` · `remediate` · `evaluation` | Same, plus `home`. Default when absent: Home (U-4a), **except** that a URL carrying `scenario`, `guard` or `autorun` and no `tab` opens Run, as today. |
| `scenario` | Run: initial scenario (default `attack_pipeline_42`; first in list if unknown) | unchanged |
| `guard=off` | Run: guard off | unchanged |
| `autorun=1` | Run: runs on load | unchanged; removed from the URL after it fires if U-6a |
| `autoforensics=1` | Investigate: forensics on the auto-selected action | unchanged; one-shot if U-6a |
| `autoheal=1` | Investigate: approves the healed release when recommended | unchanged (U-12); one-shot if U-6a |
| `t=N` | Time travel position | unchanged; kept in sync while scrubbing if U-6a (`replaceState`, not `pushState`, so Back is not flooded) |
| `topology=tinyqueue3` | Remediate topology (else `enterprise12`) | unchanged; synced if U-6a |
| `ws` | Workspace (default `tinyqueue`; `tinyqueue-mcp` = gateway view) | unchanged; also set by the switcher and the sign-in form |
| `key` | Hosted key, stored in `sessionStorage.pw_key` | unchanged; removed from the address bar after storing if U-8a |

---

## 6. Homepage

### 6.1 Goals and budget

- A first-time visitor understands the problem **without reading a paragraph**, and reaches a real, live result in **one click**.
- **Copy budget:** at most 120 words above the footer. Every sentence is at most 20 words.
- **No typed metrics.** Every number comes from `GET /api/eval/summary` (rule 11). Statements of design fact are allowed because the plan guarantees them: "No LLM in the gate" (rule 3), "deterministic" (§11).
- Public: needs no key (eval summary is global public data, D-028 / SECURITY.md).

### 6.2 Layout (desktop)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◇═▌ pathwarden                                  Console   ☀︎   [Open console] │
├──────────────────────────────────────────────────────────────────────────────┤
│  LINEAGE GATE FOR MULTI-AGENT SYSTEMS                                         │
│                                                                              │
│  Every agent passes.                    ┌──────────────────────────────────┐ │
│  The system still leaks.                │  ◇ Issue #42 ━━━━ Triage ━━━━┓    │ │
│                                         │  (U)            ABC: ●○●     ┃    │ │
│  Pathwarden traces every read and       │        Team memory ┅┅┓  ┏━━━━┛    │ │
│  write across agents, memory and days,  │  ◇ .env ┅┅┅┅┅┅┅ Fixer ┻━━┫        │ │
│  and holds the action when untrusted    │  (S)            ABC: ○●●  ┃        │ │
│  and secret data meet.                  │       Changelog draft ═══╋═══ ▌▐ ═│ │
│                                         │                 Release ABC: ○○● │ │
│  [▶ Watch the attack]  [Open console]   │                   Public page    │ │
│                                         │   Pathwarden  ( Off |●On )       │ │
│                                         │   ⬣ Held at the gate · 2 routes  │ │
│                                         └──────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│  Two lamps each. Three on the path.                                          │
│  [Triage ●○●] [Fixer ○●●] [Release ○○●]   =   [The path ●●●]                 │
│  A untrusted input · B secrets · C acts outside                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  From hold to fix                                                            │
│  ┌ Hold ─────┐ ┌ Explain ──┐ ┌ Heal ─────┐ ┌ Prevent ──┐                     │
│  │ ⬣ gate    │ │ ━┅ routes │ │ ⧉ diff    │ │ ✂ cut     │                     │
│  │ 1 line    │ │ 1 line    │ │ 1 line    │ │ 1 line    │                     │
│  │ Open ›    │ │ Open ›    │ │ Open ›    │ │ Open ›    │                     │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘                     │
├──────────────────────────────────────────────────────────────────────────────┤
│  Measured, not claimed               (all values from /api/eval/summary)     │
│  120 scenarios · seed 20261015                                               │
│  Attacks released (ASR)   PW ●┤ 0.0% [0.0, 6.0]   Per-session Rule of Two ●── │
│  Benign held (FHR)        PW ●┤ …                 DLP …   Coarse ablation …  │
│  Read the limitations ›                                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  Works with any MCP client · make up && make demo  [copy] · Threat model ›   │
└──────────────────────────────────────────────────────────────────────────────┘
```

(The example numbers in the wireframe show layout only. At runtime every number is rendered from the API.)

### 6.3 Sections

| # | Section | Content | Interaction | Data |
|---|---|---|---|---|
| H1 | **Hero** | Eyebrow, headline, one-sentence lede, two buttons, **route diagram** (inline SVG, not Cytoscape) labelled "Illustration of `attack_pipeline_42`". | A **Pathwarden Off/On** segmented switch on the diagram. **Off:** both lines run through the gate to "Public page", which shows `PWDEMO-SECRET-…` and "Leaked". **On:** the gate closes, a held octagon appears, and the label reads "Held at the gate · 2 witness routes". It defaults to On after the first draw. **Watch the attack** → `?tab=run&scenario=attack_pipeline_42&guard=off&autorun=1`. **Open console** → `?tab=run`, or `?tab=investigate` when the inbox count is > 0. | Static illustration, verified against a real run (R0-4). No live claims. |
| H2 | **Two lamps each. Three on the path.** | Three agent tiles, each with A/B/C lamps (the existing role text from `Run.tsx` `AGENTS`), then "=" and a fourth tile, "The path", with all three lit. A one-line legend. | Hover or focus a tile to show its one-line role. The lamps light in sequence on first view (M4). | Static. The lamp states must equal the real sessions of `attack_pipeline_42` (Triage A·C, Fixer B·C, Release C), checked at R0-4. |
| H3 | **From hold to fix** | Four step cards (Hold, Explain, Heal, Prevent), each with a tiny drawn visual, one line of text and an "Open ›" link (`investigate`, `investigate`, `investigate`, `remediate`). | The whole card is a link; visible focus. | Static copy (Appendix A). |
| H4 | **Measured, not claimed** | Dataset line plus a dot-and-interval plot for ASR and FHR of the defenses that were `run`; `not_run` defenses listed by name with "needs live LLM mode". Defense display names come from a label map matching plan §20.3 (B0 None, B2 Per-session Rule of Two, B4 DLP scanner, PW Pathwarden, PW-coarse Coarse ablation, B1/B3 LLM judges). | Hover or focus a dot to see k/n. "Read the limitations ›" links to Evaluation. | `GET /api/eval/summary`. On `eval_not_run`, show an empty state: "Run `make eval` to generate results." |
| H5 | **Footer** | One line: MCP gateway mention, the quickstart command with a copy button, links to the threat model and README on GitHub. | Copy button with a 2 s "Copied" state (aria-live). | Static. The GitHub repo is private until D-014, so links 404 for outsiders; hide them while `VITE_REPO_URL` is unset. |

### 6.4 Homepage motion (details in §9)

On load, the hero lines draw once: untrusted first, then secret 300 ms later, a merge pulse at the draft, then the gate closes. Total ≤ 2.4 s. Toggling the switch replays only the gate segment. H2 lamps light once when scrolled into view. Nothing loops. With reduced motion, the final state is shown immediately.

### 6.5 Homepage responsiveness

At < 768 px the hero stacks: headline, lede, buttons, then the diagram rotated to run **top to bottom** (a separate SVG layout, not a scaled-down copy). H2 tiles become a 2 × 2 grid. H3 becomes a vertical list. The H4 plot keeps one row per defense with labels above the dots.

---

## 7. Page-by-page redesign

Each page lists: **keep** (functional contract, which must not change; full list in §13), **new layout**, **states**, **interaction and motion**, **responsive**, **accessibility**.

### 7.1 Sign in (hosted mode, `PW_AUTH=on`)

**Keep:** the key is sent only as `Authorization: Bearer`. It is stored in `sessionStorage.pw_key` (tab session) and falls back to `VITE_API_KEY`. `?key=` still signs in automatically. No new backend authentication.

**When it appears.** On start, the shell makes one read-only probe: `GET /api/ws/{ws}/scenarios`, using the key if one is present. This is additive; it is the same call Run already makes.

| Probe result | Meaning | UI |
|---|---|---|
| 200 | Local mode, or a valid key | Console. Auth chip shows `Local mode` (no key was sent) or `Signed in · ws`. |
| 401 `unauthorized` | Hosted, key missing or unknown | Workspace views (Run, Investigate, Time travel, Memory) show **Sign in**. Home and Evaluation stay public. Remediate reads stay public; Apply/Reset open Sign in as a dialog if they return 401. |
| 403 `forbidden` | Key not valid for this workspace (or the workspace does not exist; the API answers both the same way on purpose) | Sign in with the message "This key can't open that workspace." Never imply the workspace exists. |
| 404 `unknown_workspace` (local mode) | Workspace name not found | Inline error with the workspace switcher focused. |
| network error / 503 | API down / database down | Full-page "Can't reach the Pathwarden API" with Retry. Status pill shows the reason. |

**Layout.**

```
┌──────────────────────────────┬───────────────────────────────────────┐
│  ◇═▌ pathwarden               │   Sign in to a workspace              │
│                              │                                       │
│   (static route diagram,     │   Workspace                           │
│    quiet, ink + 2 hues)      │   [ tinyqueue                     ]   │
│                              │                                       │
│  "Every agent passes.        │   Workspace key                       │
│   The system still leaks."   │   [ •••••••••••••••••••     👁 ][Paste]│
│                              │   Kept for this browser tab only.     │
│                              │                                       │
│                              │   [ Open workspace ]                  │
│                              │                                       │
│                              │   Where do I get a key? ›             │
│                              │   ← Back to overview                  │
└──────────────────────────────┴───────────────────────────────────────┘
```

**Fields.**
- **Workspace:** `autocomplete="username"`, default from `?ws=` or `tinyqueue`. Client-side hint mirrors the server pattern `^[a-z0-9][a-z0-9_-]{0,31}$` (informational only; the server decides).
- **Key:** `type="password"`, `autocomplete="current-password"` so password managers can save the pair, a show/hide toggle, and a Paste button (WCAG 3.3.8).

**Submit.** Validates with the same probe. On success: store the key in `sessionStorage.pw_key`, set `?ws=` and go to the view the user asked for. On failure: show an error summary (`role="alert"`) and focus the first invalid field.

**Error copy** maps API codes to messages (Appendix A). The key is never echoed, logged or shown, and the input is cleared on 401.

**Sign out:** removes `sessionStorage.pw_key` and returns to Sign in. There is no server session to revoke (§14). When `VITE_API_KEY` is set, Sign out is hidden and the chip reads "Built-in key", with a tooltip explaining why.

**"Where do I get a key?"** opens a disclosure: "Keys are issued by whoever runs this Pathwarden deployment (`PW_API_KEYS`). Local mode needs none."

**Motion:** a panel fade and rise (M14). A wrong key shakes the field once (4 px, 200 ms; none with reduced motion). The diagram does not animate on this page.

**Responsive:** below 768 px the brand panel collapses to a 120 px header strip.

**Accessibility:** labels are always visible (no placeholder-as-label), errors are linked with `aria-describedby`, the target is ≥ 44 px on touch, and paste is allowed.

### 7.2 Run → "Simulate"

**Keep:**
- The scenario list comes from the API; an unknown initial scenario falls back to the first one.
- `autorun` behaviour is unchanged.
- `api.run(name, guard, "scripted")` is followed by `api.sink(PUBLIC_PAGE_SINK)`.
- The outcome logic stays exactly as it is: the last action `held`/`blocked` → HELD; any posted line matching `/PWDEMO-|### Checksum/` → LEAKED; otherwise POSTED.
- Live mode stays disabled with its reason.
- Sessions are grouped by agent, and gate rows are emphasised.

**Layout.**

```
┌ Command bar ───────────────────────────────────────────────────────────────────┐
│ Scenario [attack_pipeline_42 ▾]   Pathwarden guard (●On)   Mode [Scripted|Live⊘] │
│ "Issue #42 hides an instruction; every agent passes the Rule of Two…" [▶ Run]  │
└────────────────────────────────────────────────────────────────────────────────┘
┌ Verdict slab ──────────────────────────────────────────────────────────────────┐
│ ⬣ HELD  act-0001 · TRIFECTA · Nothing was posted.          [Investigate this ›] │
└────────────────────────────────────────────────────────────────────────────────┘
┌ Agent lanes (Mon) ─────────────────────────────────────────────────────────────┐
│ Triage  s-0001  A● B○ C●  ✓ Rule of Two  │ ● start ● read issue:42 ● sanitize ● write… │
│ Fixer   s-0002  A○ B● C●  ✓ Rule of Two  │        ● load ● load ● read env:PORT …  │
│ Release s-0003  A○ B○ C●  ✓ Rule of Two  │                         ● propose ⬣ gate │
│                                   [ Lanes | Event log ]   [↻ Replay]          │
└────────────────────────────────────────────────────────────────────────────────┘
┌ Public release page ───────────────────────────────────────────────────────────┐
│ (document frame)  Nothing was posted.   — or the posted note with leaked lines │
└────────────────────────────────────────────────────────────────────────────────┘
```

- **Scenario picker:** a native `<select>`, but options are grouped with `<optgroup>` by the API's `expected.status` ("Attacks (expected: held)" / "Benign controls (expected: executed)"). The scenario description sits next to it as the only helper text.
- **Guard:** a native checkbox styled as a switch (`role="switch"`), with the state word next to it ("On"/"Off"). Turning it off tints the command bar edge with untrusted amber to show the risky mode.
- **Verdict slab:** the most prominent element after a run. **HELD**: octagon, hold colour, a link to Investigate pre-selecting the action (same selection logic as today, via `?tab=investigate`). **LEAKED**: the hold colour plus a count of leaked lines. **POSTED**: allow colour.
- **Agent lanes:** one row per agent, sessions as chips with A/B/C lamps (the RuleOfTwo badge, restyled). Timeline events become dots on the lane at their `t`, with the operation as a tooltip and visible label on focus. Days (Mon/Wed) are column bands. The gate event is the octagon at the end.
- **Event log:** the same `result.timeline` as a sortable table, with filter chips per agent and operation. Gate rows are emphasised. Monospace detail column.
- **Public release page:** shown as a document frame. Leaked lines are highlighted with the secret tint and a "leaked" margin marker (colour plus marker). The content is shown exactly as today.

**States:**
- **Empty** (before the first run): the lanes show three idle agents with a ghosted path and "Run a scenario to see what the agents did".
- **Running:** an indeterminate progress bar on the command bar, an elapsed timer in mono, and the Run button disabled ("Running…"). The agents show **no** fake activity.
- **Error:** an inline alert with the API `error` code and `detail`.

**Motion:** after the response arrives, the run is **replayed** onto the lanes (M6), labelled "Replay of the recorded run", with "Skip" and "Replay" buttons. The verdict slab enters (M7).

**Responsive:** at < 768 px lanes become a vertical timeline (agent badge on each event), and the command bar stacks.

**Accessibility:** the lanes are a list of events with `aria-label`s ("t 4, Triage, write, team_convention:42 → a-0004"). The event log is the full table equivalent. The verdict slab has `role="status"`.

### 7.3 Investigate → "Respond" (inbox + case file)

**Keep:**
- The actions poll every 3 s.
- Auto-select the first `held`/`blocked` action, else the first action.
- Load `action` + `explain`.
- The forensics flow is unchanged, including the diff fetch (`main` held payload, `sandbox` healed payload) and the version bump.
- Heal approval is offered only when `recommendation === "APPROVE_HEALED_RELEASE"` and the action is not yet healed.
- `autoforensics` / `autoheal` semantics stay the same.
- The QUARANTINED_LINEAGE explanation stays.
- Witness paths stay drawn after quarantine.
- Query texts are shown read-only.
- The laundering table stays.
- LLM forensic mode stays disabled with its reason.

**Layout (≥ 1280 px).**

```
┌ Inbox ─────────┬ Case act-0001 ─────────────────────────────────────────┬ Evidence ──────────┐
│ NEEDS REVIEW   │ ⬣ HOLD · TRIFECTA        recorded status: held          │ Untrusted route    │
│ ▸ act-0001 ⬣   │ sink:public_release_page ↗ external                     │ 1 changelog:42     │
│ RESOLVED       │ Decision 3.0 ms · LLM calls 0                           │ 2 team_conv…:42    │
│   act-0002 ✓   │ ┌ Lineage ─────────────── [Trace U] [Trace S] [Fit] ┐   │ 3 raw a-0001       │
│                │ │                                                    │   │ 4 ◇ src:issue:42   │
│                │ │            (Cytoscape lineage graph)               │   │ Secret route       │
│                │ │                                                    │   │ 1 changelog:42 …   │
│                │ └────────────────────────────────────────────────────┘   │ Show the Cypher ▸  │
│                │ Memory laundering (2)                                    │                    │
│                │ Response plan  ① Investigate ② Quarantine ③ Sandbox ④ Re-gate ⑤ Diff ⑥ Approve │
│                │ [ Run forensics ]   Mode: Scripted (LLM needs P8)        │                    │
└────────────────┴──────────────────────────────────────────────────────────┴────────────────────┘
```

- **Inbox:** groups the polled list on the client: "Needs review" (`held`, `blocked`) and "Resolved" (the rest). The **order within each group is the API order** (unchanged). Each row shows id (mono), status chip and payload id. The selected row has an ink left rule.
- **Case header:** the verdict chip, the reason in large type, recorded status, sink with its external marker, and a facts row: decision latency in mono, and **LLM calls: 0** (from the API, never typed).
- **Lineage graph:** full width, with a min height of 480 px, or 60 vh on large screens. Toolbar:
  - **Trace untrusted** / **Trace secret** dim everything else and play the path animation once (M8).
  - **Fit**, **Zoom ±**, **Full screen** (opens the graph in a `<dialog>`).
  - Labels at 12 px minimum.
  - A legend as chips (§4.7).
- **Evidence panel (text twin):** the untrusted and secret witness paths as **numbered step lists** with icons; the quarantined ancestors; "Show the Cypher" disclosures, with a copy button, holding exactly the `explain.queries` text ("read-only; exactly what the gate runs").
- **Memory laundering:** compact rows ("`team_convention:42` written by **triage** in `s-0001` on **Mon** from `src:issue:42`"). A table on wide screens, stacked rows on narrow ones.
- **Response plan:** a six-step stepper that is **filled from the report after the single forensics request returns**. It is not live, and says so: "Completed in one request". Step contents come from report fields: source, quarantine id and artifact count, sandbox action and verdict, recommendation, diff, approval.
- **Held vs healed:** side-by-side diff with removed and added line marks (colour plus a `−`/`+` gutter). A **Unified** toggle on narrow screens.
- **Approval card:** "Releasing increases exposure, so it needs a person." A summary of what will happen (new release from the healed sandbox run; act-0001 becomes superseded only if it executes), then **[Approve healed release]**. The interaction is unchanged (one click on a card that states the consequence). The result banner keeps the same text and the RuleOfTwo badges of the heal sessions.

**States:**
- **Empty inbox:** "No actions yet" with a link to Run.
- **Loading:** a skeleton of the case header and a graph placeholder.
- **Error:** an alert with the code.

**Motion:** M8 (path trace), M9 (fit/zoom), M10 (stepper fill), M11 (diff reveal); M18–M20 only if U-2(b).

**Responsive:**
- < 1280 px: the evidence panel becomes a tab next to "Lineage" ("Graph | Routes").
- < 1024 px: the inbox becomes a horizontal chip scroller above the case.
- < 768 px: the graph defaults to "Routes" (the text twin) with "Show graph" opening full screen.

**Accessibility:**
- The graph has `role="img"` and an `aria-label` that summarises it ("Lineage of a-0010: 14 nodes; untrusted route of 4 steps; secret route of 3 steps"), plus `aria-describedby` pointing at the evidence panel.
- Every toolbar control is a real button.
- The new-held-action announcement is polite.

### 7.4 Time travel → "Replay"

**Keep:**
- `timelineMax` polled every 3 s.
- Initial `t` is the deep link or the max.
- The whole graph fixes the layout (`stablePositions`, bounding box 1100 × 460).
- Debounced (120 ms), abortable `graph-at`; a stale answer is never rendered (`graph.t === requested`).
- Markers and `doubly_tainted` are rendered exactly as the API returns them.
- The empty state when max = 0.
- "Written at this moment" = nodes whose `created_at === t`.
- The disclaimer that flags are shown as they are *now*.

**Layout.** The graph takes the page. A **sticky scrubber** sits at the bottom, styled like a media or audio-editor timeline:

```
┌ Graph at t = 16 ──────────────────────────────────────────── 19 nodes · 28 edges · ⚠ 1 doubly tainted ┐
│                                (Cytoscape, stable layout)                                             │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
  Written at t = 16: a-0012 changelog:44 (draft, by fixer)
  ⓘ Quarantine, approval and status are shown as they are now, not as they were at t.
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [◀] [▶ Play] [▶|]   ──●──────────────────────⚑────────────────⚑●──   t = 16 / 18                      │
│                     0     Poisoned memory written (t=4) ↑   Draft doubly tainted (t=16) ↑             │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- The scrubber is still a **native `<input type="range">`** (keyboard arrows, Home/End and screen-reader support for free), styled. Step buttons remain as the non-drag alternative (WCAG 2.5.7).
- **Markers** are flags above the track, positioned from the API's marker `t`. They are buttons (jump to `t`). The current marker is emphasised, and "none" markers are shown disabled with the existing reason.
- **Play** (new, UI-only) advances `t` by 1 every 700 ms until the max, using the existing debounced fetch, and pauses when the user interacts. It is a convenience over the existing slider; no new endpoint.
- The **disclaimer** moves from muted text to an info row next to the graph, because it is a correctness caveat.

**Motion:** nodes created at `t` fade and scale in (Cytoscape style transition, 200 ms). The marker node gets a one-time underlay pulse when reached (M12). With reduced motion, a static underlay.

**Responsive:** at < 768 px the scrubber stays sticky and full width, and the marker labels move under the track as chips.

**Accessibility:**
- The range has `aria-valuetext` ("t 16 of 18, draft doubly tainted").
- Marker buttons are labelled.
- Play/Pause is a toggle button with `aria-pressed`.
- The "Written at this moment" line is a polite live region, throttled to the final value after scrubbing stops.

### 7.5 Memory → "Team memory"

**Keep:**
- Polled every 3 s.
- Every q8 field is shown.
- The release confirmation text and its consequence. With U-7a the text moves into a `<dialog>`; otherwise it stays `window.confirm`.
- The button is disabled when `quarantine_id === null`, with the hint "run forensics again".
- The notice after release, then reload.

**Layout:** a filterable list with filter chips **All · From untrusted origin · Quarantined** (client-side filters of the polled data). Each row: key (bold) and kind; memory id (mono); writer as an agent chip; day; untrusted origins as U chips; state chip (hatched "Quarantined" with a lock, or "Active"); and the action button on the right ("Release quarantine", an outline button in the hold colour, because releasing is risk-increasing).

**Dialog (U-7a):**
- Title: "Release quarantine `{quarantine_id}`?"
- Body: the same two consequences as today, plus the number of entries in this list that this quarantine covers (counted client-side from rows with the same `quarantine_id`).
- Buttons: **Cancel** (default focus) and **Release**.

**States:**
- **Empty:** "No memory entries yet" with a link to Run.
- **Error:** an alert.
- **After release:** a toast (M15) plus an inline notice, same text as today.

**Responsive:** below 768 px rows become stacked cards.

**Accessibility:**
- A real table at ≥ 768 px (with `<caption>`).
- Filter chips are `aria-pressed` toggle buttons.
- The dialog uses native `<dialog>` with `showModal()`. Escape cancels and focus returns to the button.

### 7.6 Remediate → "Prevent"

**Keep:**
- Selecting a topology resets state and reloads.
- The eval optimum note is optional.
- Witness on selection.
- Suggest cuts.
- Preview cut.
- **Apply** is enabled only when `verified && needs_cut`, with a confirmation listing the cap ids.
- Reset.
- "Cheapest verified" = minimum `total_cost` among verified candidates.
- Every number comes from the API.

**Layout.**

```
┌ Topology [enterprise12 | tinyqueue3]                  [Suggest cuts] [Reset topology] ┐
├ Toxic agents (5): [⚠ billing_agent] [⚠ docs_writer] [⚠ oncall_assistant] …            ┤ ← buttons = keyboard path
│ ┌ Capability graph ───────────────────────────── [Fit] [±] [Full screen] ┐ ┌ Witness ───────┐│
│ │                                                                        │ │ ⚠ release_bot  ││
│ │            (Cytoscape capability graph)                                │ │ from untrusted ││
│ │                                                                        │ │  public_issues…││
│ └────────────────────────────────────────────────────────────────────────┘ │ from secret …  ││
│                                                                            │ to external …  ││
│ Candidate cuts                                                             └────────────────┘│
│ ┌ C3 · cheapest verified ┐ ┌ C1 ───────┐ ┌ C2 ───────┐ ┌ C4 ───────┐                          │
│ │ cost 16 ▇▇▇▇▇▇▇▇░░░░   │ │ cost 17   │ │ cost 22   │ │ cost 23   │                          │
│ │ max flow 16 · 4 flows  │ │ …         │ │ …         │ │ …         │                          │
│ │ ✓ verified             │ │           │ │           │ │           │                          │
│ │ [Preview] [Apply…]     │ │           │ │           │ │           │                          │
│ └────────────────────────┘ └───────────┘ └───────────┘ └───────────┘                          │
│ From the last make eval: best 16 · optimum 14 · gap 2 (a cheaper mixed cut exists)            │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

(Numbers in the wireframe are layout only; at runtime they come from the API.)

- **Toxic agents as buttons** select the agent exactly like a node tap (same `onSelect`). This fixes A6. An "All agents" disclosure lists every agent as a button, so non-toxic agents are reachable too.
- **Witness panel:** three rows (from untrusted, from secret, to external) as path chips, with the toxic chip in the header.
- **Candidate cards** replace the table on wide screens. Each has a cost bar scaled to the maximum candidate cost on the page (data-driven), max flow, flow count, verified badge or invalid reason, the revoked cap ids in a disclosure, **Preview** (toggles the cut on the graph) and **Apply…** (opens the dialog).
- **Apply dialog (U-7a):** title "Apply C3?". It lists every revoked flow as `src → dst (cost)`, shows the before count of toxic agents and states "Reset restores the demo topology". Buttons: Cancel (default) and Apply.
- **After apply:** a result strip "Toxic agents 5 → 0" (counts from `toxic_before` / `toxic_after`, with a number tween, M13), plus the name chips before and after.

**Responsive:** cards become a vertical list below 1024 px. The witness panel becomes a bottom sheet on phones. The graph keeps full screen as the primary mode on phones.

**Accessibility:** the graph has a summary label ("12 agents, 5 toxic; select an agent below to see its witness"). Candidate cards are `article`s with headings. A text table view of the candidates is available ("View as table").

### 7.7 Evaluation → "Prove"

**Keep:** everything is rendered from `GET /api/eval/summary` (rule 11). `not_run` stays explicit. The error state names `make eval`. The file names stay visible. Limitations stay. The 10 s poll stays.

**Layout:**
- **Header:** dataset facts (scenarios, attacks, benign, seed) as mono facts.
- **Defense comparison:** two dot-and-interval plots, ASR and FHR. One row per defense; the dot is the rate and the whisker is the Wilson 95% interval; the k/n text sits on the right. Lower is better, stated once in the axis title. `not_run` rows show a hatched band with "needs live LLM mode (P8)". The plot is hand-drawn SVG (no chart library). A **"View as table"** toggle shows today's table, which is also the accessible equivalent.
- **Witness accuracy:** one large mono figure with k/n.
- **Falsification criteria:** a checklist; each status is a chip with its exact API text.
- **Per family:** a compact table, released/attacks and held/benign. Cells with a non-zero count get a subtle hold tint *plus* the number (never colour alone). `not_run` is hatched.
- **Remediation:** candidates against the brute-force optimum, with a gap highlight.
- **How to read this:** the limitations, given prominent placement (not small print). They are part of the honesty of the product.

**Motion:** dots slide from 0 to their value once on first view (300 ms, M16). Nothing on the 10 s refresh.

### 7.8 Global states

| State | Pattern |
|---|---|
| Loading (first) | Skeletons shaped like the final layout. No spinners except inside buttons. |
| Loading (refresh) | No visual change except "Updated Ns ago". |
| Empty | One line, one action, and a small route-motif illustration (inline SVG). |
| API error | Inline alert with a human sentence plus the code (`forbidden`, `eval_not_run` …) and the API's `detail`, which is never swallowed. Copy table in Appendix A. |
| Disabled feature | The disabled control plus the reason inline ("Live mode needs phase P8"). Never hidden, never faked. |
| Human action in progress | The button shows its verb in progress ("Releasing…") and stays disabled; other human buttons are disabled while busy (today's `busy` logic). |

---

## 8. Key user journeys

Each journey becomes a scripted walkthrough in §17.2. ✓ = the success criterion that must be observable.

**J1 — "See the leak, then stop it" (evaluator, ≤ 3 minutes)**
1. Open `/`. Home renders without a key. ✓ The hero draws and the switch works.
2. Click **Watch the attack**. Run opens with guard off and autoruns. ✓ The verdict slab says LEAKED; the public page highlights the `PWDEMO-` lines; all three sessions show "✓ Rule of Two".
3. Toggle the guard on and Run. ✓ HELD `act-…` TRIFECTA; "Nothing was posted".
4. Click **Investigate this ›**. ✓ The held action is selected; the verdict shows LLM calls 0; both routes are listed and drawn.

**J2 — "Respond to a held action" (engineer)**
1. The inbox badge shows 1. Open Investigate. ✓ Auto-selects the held action.
2. **Trace untrusted** and then **Trace secret**. ✓ Each route is highlighted and listed as steps.
3. **Run forensics**. ✓ The stepper fills from the report; quarantine id, sandbox action, verdict and reason shown exactly as returned; recommendation APPROVE_HEALED_RELEASE; the diff renders.
4. **Approve healed release**. ✓ Banner: "Healed release act-0002 executed; act-0001 is superseded." The inbox moves act-0001 to Resolved.

**J3 — "A sleeper across days"**
1. Run `attack_sleeper_44` (guard on). ✓ HELD; the lanes show a Mon and a Wed band.
2. Time travel. ✓ Opens at max `t`; the two marker flags are at the API's `t` values.
3. Jump to "Poisoned memory written". ✓ The graph at that `t`; "Written at this moment" names the memory.
4. **Play** from 0. ✓ Steps advance; no stale frame is shown; it pauses at the end.
5. Memory, filter "From untrusted origin". ✓ The poisoned entry is listed with its origin chip.

**J4 — "Release a quarantine" (human, risk-increasing)**
1. After J2 forensics, open Memory and filter "Quarantined". ✓ The entries show the hatched state.
2. Click **Release quarantine**. ✓ The dialog states the consequences and Cancel has focus.
3. Confirm. ✓ The request carries `X-PW-Human: true`; the toast and notice read "Released {quarantine_id}: N artifact(s) restored." (today's text); the rows update.

**J5 — "Reduce the blast radius"**
1. Remediate, `enterprise12`. ✓ The toxic agent buttons are listed.
2. Keyboard: Tab to a toxic agent and press Enter. ✓ The witness panel shows three rows.
3. **Suggest cuts**. ✓ Four cards; the cheapest verified is marked; the eval optimum note is shown when available.
4. **Preview** C3, then **Apply…**, then confirm. ✓ The request carries `X-PW-Human: true`; the result strip shows the before and after counts; revoked edges are dashed.
5. **Reset topology**. ✓ Back to the original state.

**J6 — "Sign in to a hosted workspace"** (`PW_AUTH=on`)
1. Open `/?tab=investigate` with no key. ✓ The sign-in screen (not a red banner).
2. Enter a wrong key. ✓ "This key wasn't accepted"; the field is cleared and focused.
3. Enter a valid key for another tenant's workspace. ✓ "This key can't open that workspace" (no existence leak).
4. Enter the correct pair. ✓ The Investigate inbox loads; the chip reads "Signed in · tinyqueue".
5. **Sign out**. ✓ Back to sign-in; `sessionStorage.pw_key` is removed.
6. Open `/?tab=run&key=<valid>`. ✓ Signed in automatically; the key is removed from the address bar (U-8a).

**J7 — "Look at the MCP gateway's lineage"**
1. Workspace switcher → "Through the MCP gateway". ✓ The URL has `ws=tinyqueue-mcp`; Investigate shows the gateway's held action with both witnesses (D-026).

---

## 9. Motion and interaction specification

### 9.1 Principles

1. **Purposeful:** every animation communicates a state change, a cause and effect, or spatial continuity. If removing it loses no information, remove it.
2. **Fast:** interface feedback takes 120–240 ms. Narrative sequences (hero, replay, path trace) take ≤ 1.2 s per step and ≤ 2.4 s in total. Nothing blocks input.
3. **Interruptible:** any new input cancels or fast-forwards a running animation.
4. **Once:** nothing loops except the indeterminate progress bar while a request is actually pending.
5. **Reduced motion is a first-class mode, not an afterthought** (§9.5).

### 9.2 Tokens

| Token | Value | Use |
|---|---|---|
| `--dur-1` | 120 ms | Colour and opacity on hover or press |
| `--dur-2` | 180 ms | View transitions, chips, toggles |
| `--dur-3` | 240 ms | Dialogs, sheets, verdict entrance |
| `--dur-4` | 400 ms | Graph fit/zoom, diff sweep |
| `--dur-story` | 700 ms | One narrative step (route draw, replay step) |
| `--ease-out` | `cubic-bezier(.2,.7,.2,1)` | Entrances |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | Moves |
| `--ease-snap` | `cubic-bezier(.3,1.25,.5,1)` | Only the held "stamp" and the lamp lighting (slight overshoot) |

### 9.3 Catalogue

"Tech" is the implementation under the recommended zero-dependency option U-2(a).

| ID | Element | Trigger | Animation | Duration | Tech | Reduced motion |
|---|---|---|---|---|---|---|
| M1 | View change | Nav click | Crossfade + 8 px rise of the content area; the nav and top bar stay fixed (`view-transition-name`) | dur-2 | View Transitions API | Instant |
| M2 | Hero route draw | Home first paint | Untrusted line draws, secret line follows 300 ms later, merge pulse at the draft, gate closes | ≤ 2.4 s total | SVG `stroke-dashoffset` via Web Animations API (WAAPI), sequenced with `Animation.finished` | Final state, static |
| M3 | Hero guard switch | Switch change | Gate bars slide shut or open; outcome label crossfades | dur-3 | CSS transitions | Instant |
| M4 | Rule-of-Two lamps | Section enters view (once) | Lamps light in sequence, 80 ms stagger, snap ease | ≈ 500 ms | IntersectionObserver + CSS | Lit immediately |
| M5 | Request pending | Run / forensics / suggest in flight | Indeterminate progress bar, elapsed timer (mono) | while pending | CSS | Static bar + timer |
| M6 | Run replay | Run response received | Timeline events appear on lanes in `t` order, 60 ms stagger, capped at 1.2 s; "Skip" / "Replay" | ≤ 1.2 s | WAAPI | Instant, all shown |
| M7 | Verdict slab | New outcome | Fade + scale 0.98 → 1. HELD: octagon stamps in. LEAKED: leaked lines sweep-highlight left to right | dur-3 (+ dur-4 sweep) | CSS `@starting-style` + WAAPI | Fade only |
| M8 | Witness path trace | "Trace U/S" button, or first load of a held case | Non-path elements fade to 25% opacity; path edges animate `line-dash-offset` ("marching") for 1.2 s, then stay solid and highlighted | 200 ms + 1.2 s | Cytoscape `transition-*` styles + `ele.animate()` | Static highlight, no marching |
| M9 | Graph fit / zoom | Toolbar | Animated viewport | dur-4 | `cy.animate({ fit })` | Instant |
| M10 | Forensics stepper | Report received | Steps check off in order, 100 ms stagger, labelled "completed in one request" | ≈ 700 ms | CSS | All checked at once |
| M11 | Diff reveal | Diff loaded | Removed/added line tints sweep in | dur-4 | CSS | Static |
| M12 | Time-travel step | `t` changes | New nodes fade and scale in; reached marker node gets one underlay pulse | 200 ms | Cytoscape transitions | Static underlay |
| M13 | Remediation result | Apply succeeds | Toxic count tweens from before to after; revoked edges fade to dashed | dur-4 | WAAPI number tween + Cytoscape | Instant |
| M14 | Dialog / sheet / popover | Open / close | Fade + 8 px translate; backdrop fade | dur-3 | `<dialog>` + `@starting-style` + `transition-behavior: allow-discrete` | Fade only |
| M15 | Toast | Human action completed | Slide up from the bottom; auto-dismiss after 6 s, paused on hover/focus | dur-3 | CSS | Fade only |
| M16 | Eval dots | First view | Dots slide from 0 to their value | 300 ms | CSS transform | Static |
| M17 | Micro-interactions | Hover / press / focus | Colour transitions; press = 1 px translate; focus ring appears instantly (never animated) | dur-1 | CSS | Colour only |
| M18 | Inbox regroup | Status changes after polling | Row moves from "Needs review" to "Resolved" | dur-3 | **Motion `layout`** (only if U-2b); otherwise instant | Instant |
| M19 | Inbox → case shared element | Select an action | Selected row's id morphs into the case header | dur-3 | **Motion `layoutId`** (U-2b) or View Transitions with `view-transition-name` | Instant |
| M20 | Panel exit | Report or diff cleared on new selection | Fade out before unmount | dur-2 | **Motion `AnimatePresence`** (U-2b); otherwise instant | Instant |
| M21 | Poll heartbeat | Each successful poll | The dot in "Updated Ns ago" blinks once (opacity) | 300 ms | CSS | None |

### 9.4 Technology choice

| Criterion | **Zero-dep** (CSS, View Transitions, WAAPI, Cytoscape) | **Motion 14.3** (`motion/react`) | **GSAP 3.15** + `@gsap/react` |
|---|---|---|---|
| Plan compliance (rule 12, §6, §19) | ✓ no change | Needs approval and a D-entry | Needs approval and a D-entry |
| Bundle added | 0 KB | ≈ 5 KB (`m` + `LazyMotion`) + 24 KB `domAnimation`; 43 KB full component | gsap core + `@gsap/react` (measure; plugins extra) |
| React fit | Manual hooks (small) | Declarative, React-native API | Imperative, via the `useGSAP` hook |
| Layout / exit animations (M18–M20) | View Transitions cover M19; M18/M20 instant | **Best-in-class** (`layout`, `layoutId`, `AnimatePresence`) | Possible with the Flip plugin, imperative |
| SVG path drawing (M2) | WAAPI on `stroke-dashoffset` | Supported | **Best** (DrawSVG, timelines) |
| Scroll-choreographed storytelling | CSS scroll-driven animations (partial in Firefox) | `useScroll` | **Best** (ScrollTrigger) |
| Reduced motion | Media query + one helper | `MotionConfig reducedMotion="user"` (verify) | `gsap.matchMedia()` |
| Licence | — | MIT | Free, standard licence (Webflow) |

**Recommendation: U-2(a), zero-dependency.** Every animation that carries information (M1–M17, M21) is native. GSAP's strengths are long timelines and scroll choreography, which this design deliberately avoids, and it would overlap with WAAPI. **Motion is the only library with a real case** (M18–M20: layout continuity in the inbox). Add it only if the owner wants that polish after P13c, use the `m` + `LazyMotion` + `domAnimation` setup, and measure the bundle delta.

### 9.5 Reduced motion

- **CSS:** `@media (prefers-reduced-motion: reduce)` sets every `--dur-*` to `0.01ms` and disables transforms in keyframes; opacity fades of ≤ 120 ms may remain.
- **JS:** `prefersReducedMotion()` in `web/src/motion.ts` gates WAAPI and Cytoscape animations (`animate: false`, no `line-dash-offset` loop).
- **In-app override (optional, P13d):** "Motion: System / Reduced" in the theme menu, stored in `localStorage.pw_motion`.
- **No flashing** more than 3 times per second anywhere (WCAG 2.3.1). No auto-playing motion longer than 5 s without a pause control (WCAG 2.2.2); Time-travel Play has Pause.

---

## 10. Light and dark themes

### 10.1 Behaviour (U-5a)

- **Default: Light**, including for visitors whose OS is dark.
- The switch lives in the top bar (and on Sign in): **Light / Dark / System**. "System" follows `prefers-color-scheme` live.
- The choice is stored in `localStorage.pw_theme`, wrapped in try/catch; private windows fall back to Light.
- **No flash:** a 10-line inline script in `web/index.html` sets `<html data-theme="…">` and `style.colorScheme` before the stylesheet paints.
- `<meta name="theme-color">` is updated per theme (mobile browser chrome).
- `color-scheme` is set per theme, so native controls (range, select, scrollbars, `<dialog>` backdrop) match.

### 10.2 Implementation

```css
@layer reset, tokens, base, layout, components, utilities;
@layer tokens {
  :root, [data-theme="light"] { color-scheme: light; --bg:#F4F5F7; /* … */ }
  [data-theme="dark"]          { color-scheme: dark;  --bg:#0B0D10; /* … */ }
  @media (prefers-color-scheme: dark) {
    [data-theme="system"]      { color-scheme: dark;  --bg:#0B0D10; /* … */ }
  }
}
```

### 10.3 Graph theming (a technical trap)

`LineageGraph` and `CapabilityGraph` read tokens with `getComputedStyle(document.documentElement).getPropertyValue('--x')`. For unregistered custom properties this returns the **declared text**, not a resolved colour. So:
- Graph-facing tokens must be literal colours (hex), never `light-dark()`, `oklch()` (unless the R0-5 probe shows Cytoscape parses it) or `var()` chains.
- `useThemeTick` must also re-render when `data-theme` changes, not only when the OS preference changes. Add a `MutationObserver` on `<html>`'s `data-theme`, or a small theme store.
- Both graphs must be visually checked in both themes after every token change (§17.3).

### 10.4 Completeness checklist (both themes)

Every view, dialog, toast, tooltip, skeleton, empty state, error state, focus ring, selection colour (`::selection`), scrollbar (`scrollbar-color`), native control, graph (nodes, edges, labels, underlays, text backgrounds), SVG illustration (`currentColor` + tokens) and print style (`@media print`: light, no chrome) must work in both themes.

---

## 11. Responsive design

| Width | Shell | Investigate | Graphs | Tables |
|---|---|---|---|---|
| ≥ 1536 | Rail + content + inspector | 3 columns | 60 vh | full |
| 1280–1535 | Rail + content + inspector | 3 columns | 520 px | full |
| 1024–1279 | Rail + content; inspector as tab | 2 columns | 480 px | full |
| 768–1023 | Icon rail; inspector as right sheet | Inbox as chip scroller | 420 px + Full screen | scroll in their own container |
| < 768 | Top bar + menu sheet | Single column; "Routes" text twin first | Full screen on demand | Stacked cards (Memory, candidates, event log) |

Rules:
- No horizontal page scroll down to 320 px at 100% zoom (WCAG 1.4.10). Graphs, code and diff panes may scroll inside their own containers.
- Touch targets are ≥ 44 px with `(pointer: coarse)` and ≥ 24 px otherwise (WCAG 2.5.8).
- Sticky elements (top bar, scrubber) set `scroll-padding` so focus is never hidden (WCAG 2.4.11).
- Test widths: 360, 390, 768, 1024, 1280, 1440, 1920.

---

## 12. Accessibility

**Target: WCAG 2.2 AA.** The checklist below becomes acceptance criteria in §15.

| Area | Requirement |
|---|---|
| Structure | `header`, `nav[aria-label="Primary"]`, `main`, `aside` for the inspector. Skip link "Skip to content". One `h1` per view. `document.title` = "View · Pathwarden". |
| Keyboard | Everything reachable and operable; visible focus (2 px ring, 2 px offset, ≥ 3:1); Escape closes dialogs and sheets; arrow keys on the scrubber; no keyboard trap except inside modal dialogs. |
| Graphs | `role="img"` + a summary `aria-label` + `aria-describedby` → the text twin (route step lists, toxic agent buttons, candidate list). Every canvas action has a button equivalent (A6 fix). |
| Colour | Never the only cue (§4.7). Text ≥ 4.5:1, UI boundaries and graph lines ≥ 3:1 (§4.4, computed). |
| Live regions | Run outcome `role="status"`; errors `role="alert"`; the inbox count increase is polite; polled refreshes are **not** announced. |
| Forms | Visible labels, `autocomplete`, errors linked with `aria-describedby`, `aria-invalid`, focus moves to the error summary. |
| Motion | §9.5. |
| Custom controls | Prefer native elements, styled: checkbox with `role="switch"`, radio groups for segmented controls, `<dialog>`, `<details>`, `<input type="range">`, `<select>`. |
| Forced colours | `@media (forced-colors: active)`: borders on all chips and buttons, system colours. The canvas graphs cannot adapt, so the text twins carry the information. |
| Zoom | Works at 200% browser zoom and with 400% text reflow at 320 px. |
| Authentication | Paste allowed, password manager allowed, no cognitive test (WCAG 3.3.8). |
| Help | "Where do I get a key?" and the "Why?" disclosures sit in the same place on every view (WCAG 3.2.6). |

---

## 13. What must not change (functional contract)

The implementing agent treats this section as a test oracle. A deviation is a regression unless an approved decision in §2 explicitly allows it.

### 13.1 API client (`web/src/api/client.ts`)
- `request()` semantics:
  - `Content-Type: application/json` only when there is a body.
  - `Authorization: Bearer <key>` only when a key exists.
  - `X-PW-Human: true` **only** on `capReset`, `capApply`, `healApprove` and `releaseQuarantine`.
  - Body is JSON.
  - The response is parsed as JSON. A non-2xx response becomes `ApiError(status, error ?? "http_error", detail ?? statusText)`.
- `BASE` comes from `VITE_API_BASE` (default same origin). Paths are `/api/...`.
- The workspace comes from `?ws=` (default `tinyqueue`). Allowed refactor: read it through a function instead of a module constant, with the same precedence.
- Every endpoint, method and body stays the same: run `mode: "scripted"`; forensics `mode: "scripted"`; heal approval `approver: "maintainer"`; `PUBLIC_PAGE_SINK = "sink:public_release_page"`.
- Key handling:
  - `?key=` is written to `sessionStorage.pw_key`.
  - Lookup order: `sessionStorage`, then `VITE_API_KEY`.
  - Storage exceptions are tolerated.
  - The key never appears in UI text, logs or URLs (beyond the incoming `?key=`, which U-8 removes).

### 13.2 Types (`web/src/api/types.ts`)
Unchanged. New UI-only types (theme, view ids, auth state) live in new files.

### 13.3 Polling
`usePoll` semantics stay the same. Intervals: actions 3000 ms, `timeline/max` 3000 ms, memory 3000 ms, eval summary 10000 ms.

Additive reads, and nothing else new:
- Health every 15 s (U-11a).
- One auth probe on load (§7.1).
- The inbox badge moves the existing actions poll (same endpoint, same 3000 ms) up into the shell. It then runs on every console view, not only while Investigate is open, and Investigate consumes the same data instead of starting a second poll. It does not run while signed out in hosted mode.

### 13.4 Behaviour per view
The "Keep" lists in §7.1–§7.7 are normative.

### 13.5 Graph semantics
- **Layout:** `breadthfirst` everywhere. Time travel uses `preset` positions from a headless layout of the full graph with a bounding box.
- **Lineage encodings:** untrusted is solid and thick, secret is dotted and thick, both is a double border, sanitized is dashed, quarantined is greyed, a source is a diamond, tainted gets ⚠, and the marker gets a halo.
- **Capability encodings:** source diamond U/S/I, store barrel, sink tag, external sink with a thick border, toxic agent with a double red border and ⚠, revoked edge dashed and faded, previewed cut thick and red.
- **Interaction:** tapping an agent node selects it.

New styles may restyle these encodings but must not remove any of them.

### 13.6 Content honesty
- Artifact `content` is rendered only where it is today: Run's public page and Investigate's diff.
- The LEAK regex stays exactly as it is.
- No number about evaluation or remediation is typed into the UI.
- Disabled features keep their reasons (live mode: P8; LLM forensics: P8; B1/B3: not run).

### 13.7 Outside `web/`
No changes to `api/`, `fixtures/`, `eval/`, `tests/`, `mock_upstreams/`, `scripts/` (except an approved `scripts/ui_check.mjs`, U-9a), `Makefile`, `docker-compose.yml` or `plan.md` (except the U-1 amendment made or approved by the owner).

---

## 14. What cannot be done without backend changes

These are documented, not implemented. "Fallback" is what the redesign does instead.

| # | Wished-for UI | Why it is blocked | What it would need | Fallback in the redesign |
|---|---|---|---|---|
| B1 | User accounts: username/password, SSO, MFA, password reset, roles | Keys map only to workspaces (D-028); user accounts are out of scope (SECURITY.md) | A user model and identity provider | Workspace-key sign-in (§7.1) |
| B2 | "Which workspace is this key for?" | No whoami endpoint | `GET /api/whoami` | The user types the workspace (default `tinyqueue`) |
| B3 | Server-side sign-out, key expiry, session timeout | Keys are static configuration | Sessions/tokens | Client sign-out clears `sessionStorage` |
| B4 | Live agent activity during a run; forensics progress | `POST run` and `POST forensics` answer only when finished; polling only (§19) | Server-sent events, or a run id plus a progress endpoint | Honest pending state (M5), then a labelled replay (M6, M10) |
| B5 | Run history and comparing runs | No runs endpoint | `GET /runs` | Current actions list and timeline |
| B6 | Notifications outside the open tab (email, push) | None | Notification service | Inbox badge from the existing poll |
| B7 | Historical (versioned) quarantine, approval and status in time travel | Mutable flags (A-09) | Versioned properties | The disclaimer stays, more visible |
| B8 | A quarantine list independent of memory rows; release after an API restart | D-019: ids remembered in API memory; a `COVERS` query would need rule-1 approval | A read query over `(Quarantine)-[:COVERS]->()` | Disabled button with the existing hint |
| B9 | Download `results.csv`, `summary.md` | Not served by the API | A static route | File names shown; repo link when public |
| B10 | Approver identity on heal approval | No identity (`approver: "maintainer"`) | B1 | Unchanged |
| B11 | Live LLM mode, LLM forensics, B1/B3 judges | P8 not implemented (501) | P8 | Disabled with the reason |
| B12 | UI on a different origin than the API | No CORS (non-goal, D-028) | A CORS allow-list | Same origin or proxy (DEPLOY.md) |
| B13 | Search across artifacts or content | No search endpoint; the gate never reads content | A search endpoint | Client-side filters of loaded lists |
| B14 | Listing workspaces in the switcher | Hosted health hides graph names on purpose | Not wanted (it would leak tenant names) | `<ws>` and `<ws>-mcp` only; free text in local mode |
| B15 | Friendly artifact titles | The graph stores ids, kinds and keys only | — | Key + kind + id in mono |

---

## 15. Implementation phases, tasks and acceptance criteria

Phase naming follows the repo convention (`P<n>[a-d]`, commit-msg hook): **P13a–P13d** on branch `phase/p13-ui-redesign`, with commits like `P13a: feat(web): design tokens and theme`.

Each phase is independently shippable. Tasks are ticked **only with evidence** recorded in `docs/PROGRESS.md` (AGENTS.md §5). Effort figures are rough estimates for one agent session, not commitments.

### R0 — Approval and baseline (no UI code)

| ID | Task | Files |
|---|---|---|
| R0-1 | Owner answers U-1…U-12. Record D-032 onward in `docs/DECISIONS.md`. | `docs/DECISIONS.md` |
| R0-2 | Amend `plan.md` §19 (and §6 for any approved dependency). This is done by the owner, or by the agent with the owner's explicit OK. | `plan.md` |
| R0-3 | Write `docs/phases/P13-ui-redesign.md` from this plan (tasks, tests, DoD). Add a P13 row to PROGRESS. | `docs/phases/`, `docs/PROGRESS.md` |
| R0-4 | **Baseline evidence:** screenshots of every view at 1440 and 390 px in light and dark; `npm run build` output (bundle sizes); a network log (method, path, headers present) for J1–J7 on the current UI; `make test` result; real `attack_pipeline_42` sessions (to verify the Home lamp states). | `docs/PROGRESS.md`, scratch folder |
| R0-5 | **Probes (rule 13 spirit):** (a) the colour formats Cytoscape 3.34 accepts (hex, rgb, hsl, oklch?); (b) `line-dash-offset` animation via `ele.animate()`; (c) `transition-property` on class changes; (d) font `OFL.txt` and files from the official source; tabular-figure support in Atkinson Next. | scratch page, `DECISIONS.md` |

**Acceptance:**
- [ ] All decisions recorded.
- [ ] plan.md amended (or the D-entry says why not).
- [ ] Baseline evidence recorded.
- [ ] Probe results recorded.

### P13a — Foundations and re-skin (all views coherent, logic untouched) · about 4–6 h

| ID | Task | Files |
|---|---|---|
| P13a-T1 | Vendor the fonts (unmodified `.woff2` + `OFL.txt`); add `@font-face`, preload; favicon SVG; `<meta name="theme-color">`; `<meta name="description">`. | `web/public/fonts/*`, `web/public/favicon.svg`, `web/index.html` |
| P13a-T2 | Split `styles.css` into cascade layers: `tokens.css` (§4.4–4.5, §9.2), `base.css` (reset, type, focus, selection, reduced motion, forced colours), `layout.css`, `components.css`. Map **existing class names** to the new tokens so every current view is restyled without editing its TSX. | `web/src/styles/*.css`, `web/src/main.tsx` |
| P13a-T3 | Theme: `theme.ts` (get/set/subscribe, localStorage try/catch), the inline init script, `useThemeTick` also observing `data-theme`. | `web/src/theme.ts`, `web/src/hooks.ts`, `web/index.html` |
| P13a-T4 | Primitives: `Button`, `IconButton`, `Chip` / `StatusChip` / `VerdictChip`, `Panel`, `Switch`, `Segmented`, `Dialog` (native), `Disclosure`, `CodeBlock` (copy), `EmptyState`, `Skeleton`, `Notice` / `Toast`, `Icon`. | `web/src/ui/*.tsx` |
| P13a-T5 | Shell: rail and top bar, view groups, workspace switcher, status pill (`/api/health`), theme menu, auth chip (display only in this phase), inbox badge (reusing the Investigate poll through a shared hook), skip link, document titles. | `web/src/shell/*.tsx`, `web/src/App.tsx` |
| P13a-T6 | Navigation state: `nav.ts` (read the URL exactly as `readUrl` does today; Home default rule from U-4; push/replace per U-6). | `web/src/nav.ts`, `web/src/App.tsx` |
| P13a-T7 | Graph palettes read the new tokens (hex only); label size ≥ 12 px; nothing else changes in the graphs. | `web/src/components/LineageGraph.tsx`, `CapabilityGraph.tsx` |

**Acceptance:**
- [ ] `npm run build` exits 0; no `any` added (`grep -n ": any\|as any" web/src` is empty).
- [ ] Every deep link in §5.5 lands in the same state as the R0-4 baseline (headless check).
- [ ] The network log for J1–J5 matches the baseline except for the additive reads listed in §13.3 (health poll, auth probe, shell-level actions poll); `X-PW-Human` appears on exactly the four calls.
- [ ] Theme: Light is the default on a fresh profile with OS dark; the switch persists across reloads; no theme flash (screenshot at first paint); both graphs re-render when the theme is switched manually.
- [ ] Reduced motion: no transform animations with the OS setting on.
- [ ] Contrast spot check of the token pairs in §4.4 in the running UI (DevTools).
- [ ] Every view usable at 390 px with no page-level horizontal scroll.
- [ ] No runtime dependency added unless U-2 or U-3 approved it (`git diff web/package.json`).

### P13b — Home, Sign in, Run, Investigate · about 6–8 h

| ID | Task | Files |
|---|---|---|
| P13b-T1 | Home: hero with the route diagram (desktop and mobile SVGs) and the switch; lamps section; four step cards; eval proof plot from the API; footer. | `web/src/pages/Home.tsx`, `web/src/home/*.tsx` |
| P13b-T2 | Sign in: probe and state machine (§7.1), form, error mapping, sign out, built-in key handling, `?key=` handling (U-8). | `web/src/auth/*.tsx`, `web/src/api/client.ts` (key setters/getters; no change to request semantics) |
| P13b-T3 | Run: command bar, verdict slab, agent lanes + event log, public page frame, replay (M6), states. | `web/src/tabs/Run.tsx`, `web/src/run/*.tsx` |
| P13b-T4 | Investigate: inbox groups, case header, graph toolbar (trace, fit, zoom, full screen), evidence panel (text twin), laundering rows, response-plan stepper, diff with unified toggle, approval card. | `web/src/tabs/Investigate.tsx`, `web/src/investigate/*.tsx`, `LineageGraph.tsx` |
| P13b-T5 | Motion M1–M11, M14, M15, M17, M21, with reduced-motion fallbacks. | `web/src/motion.ts`, CSS |

**Acceptance:**
- [ ] J1, J2 and J6 pass end to end with recorded evidence (dev server and production build; J6 with `PW_AUTH=on`).
- [ ] Home makes **no** workspace call without a key, and its numbers equal `summary.json` (spot check three values). Changing the generated file changes the UI (rule-11 check, as in P10c).
- [ ] The Home lamp states equal the R0-4 real-run sessions.
- [ ] `?tab=investigate&autoforensics=1&autoheal=1` produces the same API calls and final state as the baseline.
- [ ] Every graph action has a keyboard path; the text twin lists the same node ids as `gate.untrusted_witness` / `gate.secret_witness`.
- [ ] Keyboard-only walkthrough of J1, J2 and J6 completed.

### P13c — Time travel, Memory, Remediate, Evaluation · about 5–7 h

| ID | Task | Files |
|---|---|---|
| P13c-T1 | Time travel: full-bleed graph, sticky scrubber (native range), marker flags, Play/Pause, disclaimer row, M12. | `web/src/tabs/TimeTravel.tsx` |
| P13c-T2 | Memory: filter chips, rows/cards, release `<dialog>` (U-7), toast. | `web/src/tabs/Memory.tsx` |
| P13c-T3 | Remediate: toxic-agent buttons, all-agents disclosure, witness panel, candidate cards and table view, Apply `<dialog>`, result strip (M13), graph toolbar. | `web/src/tabs/Remediate.tsx`, `CapabilityGraph.tsx` |
| P13c-T4 | Evaluation: dot-and-interval plots (SVG) with a table toggle, per-family table, criteria checklist, remediation table, limitations block, M16. | `web/src/tabs/Evaluation.tsx`, `web/src/ui/IntervalPlot.tsx` |

**Acceptance:**
- [ ] J3, J4, J5 and J7 pass with recorded evidence.
- [ ] Time travel: three `t` values compared with `graph-at?t=` (as in P10b); a 0 → max sweep produces exactly one request at the end (debounce kept); Play never shows a stale frame.
- [ ] Memory release and Remediate apply send `X-PW-Human: true`; Cancel sends nothing; the button is disabled when `quarantine_id` is null, with the hint.
- [ ] Evaluation: every number traced to `summary.json`; `not_run` visible; the table view matches the plot.
- [ ] The Remediate agent witness is reachable by keyboard (A6 fixed).

### P13d — Polish, audit, documentation, merge · about 3–5 h

| ID | Task | Files |
|---|---|---|
| P13d-T1 | Full accessibility audit (§12), contrast, forced colours, 200% zoom, screen-reader smoke test (NVDA + Edge). Fix findings. | various |
| P13d-T2 | Responsive QA at the widths in §11, both themes. | various |
| P13d-T3 | Performance: Lighthouse (built into Edge DevTools; no dependency) on Home and Investigate; record the bundle delta compared with R0-4. | — |
| P13d-T4 | Optional: Motion for M18–M20 if U-2(b) was approved; optional motion override setting. | `web/package.json`, files above |
| P13d-T5 | Regenerate `docs/img/*.png` (light theme) and update README sections that describe the UI; check that `docs/MCP.md` deep links still hold. | `docs/img/`, `README.md` |
| P13d-T6 | Tracking: PROGRESS evidence, HANDOFF, DECISIONS; merge `--no-ff`; tag `phase-p13-done` (per D-004/D-016). | `docs/*` |

**Acceptance:**
- [ ] All §12 rows checked with evidence.
- [ ] Lighthouse accessibility ≥ 95 and performance ≥ 90 on Home (local production build); CLS < 0.1.
- [ ] The full regression matrix in §17.2 is green in both auth modes.
- [ ] `make test` and `make test-auth` still green (the backend is untouched; sanity check).
- [ ] `npm audit --omit=dev` shows 0 vulnerabilities; `sh scripts/scan_secrets.sh` is ok.
- [ ] README images regenerated; plan.md unchanged except U-1.

---

## 16. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | A redesign close to the 18 Oct submission breaks the demo path or the video | High if rushed | High | U-10: freeze `main`, or ship only P13a after the full §17.2 matrix. Work on `phase/p13-ui-redesign`; merge only when green. |
| R2 | Deep links or `autorun`/`autoforensics`/`autoheal` change behaviour (docs, MCP.md and the verification recipes depend on them) | Medium | High | Frozen contract (§5.5); a headless check of every link against the baseline. |
| R3 | The human header or key handling breaks → human actions return 403, or the hosted demo fails | Low | High | `client.ts` request semantics untouched; network-log comparison; J4, J5 and J6 in both auth modes. |
| R4 | Cytoscape cannot parse new colour formats → graphs render black or default | Medium | Medium | Hex-only graph tokens; R0-5 probe; graph screenshots in both themes. |
| R5 | A manual theme switch does not re-render the canvas graphs | High if forgotten | Medium | `useThemeTick` observes `data-theme` (P13a-T3 acceptance). |
| R6 | Graph components re-create the Cytoscape instance on every prop change (today's pattern), so animations restart or flicker | Medium | Medium | Keep the re-create pattern in P13a; in P13b animate only after creation; refactor to a persistent instance only with a regression check of time-travel stability. |
| R7 | Over-animation or motion sickness | Medium | Medium | §9.1 budget, the "once" rule, reduced-motion mode, review in P13d. |
| R8 | Custom controls are less accessible than the native ones they replace | Medium | High | Style native elements (§12 "Custom controls"). |
| R9 | Dependency creep against rule 12 | Medium | Medium | U-2, U-3, U-9 gates; `git diff web/package.json` in every phase's acceptance. |
| R10 | Docs drift: screenshots, README, the video script and MCP.md describe the old UI | High | Medium | Labels and ids unchanged; P13d-T5 regenerates images. |
| R11 | Replacing `window.confirm` breaks the existing headless recipes (they accept JS dialogs) | High if U-7a | Low | Update the recipe or `ui_check.mjs` to click the dialog buttons. |
| R12 | Font licence misuse (subsetting or renaming fonts with Reserved Font Names) | Low | Medium | Ship the official files unmodified with `OFL.txt` (R0-5). |
| R13 | Light mode was never verified before (B6) | — | Medium | Light is the primary QA theme in every acceptance list. |
| R14 | Homepage claims drift from reality (lamps, "0 LLM calls", numbers) | Medium | High (credibility) | Numbers from the API only; lamp states checked against a real run (R0-4); copy limited to plan-guaranteed facts (§6.1); review item in P13d. |
| R15 | The extra auth probe and health poll add load or confuse the logs | Low | Low | One probe on load; health every 15 s and on focus; both are read-only. |
| R16 | `autoheal=1` lets a link perform a human-only action without a click (existing behaviour) | — | Medium | Out of scope; U-12 raises it. The redesign must not widen it, e.g. no Home CTA uses `autoheal`. |

---

## 17. Regression checks and testing

### 17.1 Automated gates (every phase)

- `cd web && npm run build` (strict `tsc` + `vite build`); this is CI job `web`.
- `make test` and `make test-auth`: the backend is untouched, but the suite proves it.
- `npm audit --omit=dev` and `sh scripts/scan_secrets.sh`.
- Static greps:
  - `X-PW-Human` occurs only in `client.ts`.
  - No `any` for API data.
  - `sessionStorage`/`localStorage` access is wrapped in try/catch.
  - No numeric literals in Home or Evaluation copy, except layout constants.
- Optional (U-9b): Playwright visual snapshots + axe scan per view.

### 17.2 Functional regression matrix

Run on the dev server **and** the production build (`npm run build && npm run preview`), with `PW_AUTH=off` and `PW_AUTH=on`, using the headless-Edge/DevTools recipe (`scripts/ui_check.mjs` if U-9a) with a `fetch` wrapper that logs method, path and header names (never values).

| # | Check | Expected |
|---|---|---|
| F1 | Each §5.5 deep link | Same view and state as the baseline |
| F2 | J1–J7 | Every ✓ in §8 observed |
| F3 | Request log per journey | Identical to the baseline + the health/probe additions; human header on exactly four call types |
| F4 | Time travel sweep 0 → max | One `graph-at` request after the sweep; no stale frame |
| F5 | Investigate after quarantine | BLOCK / QUARANTINED_LINEAGE with recorded status `held`; witness routes still drawn and listed |
| F6 | Memory with an unknown quarantine id (API restarted) | Release disabled with the hint |
| F7 | Evaluation before `make eval` (404 `eval_not_run`) | Error state naming `make eval`; Home H4 shows its empty state |
| F8 | Live mode / LLM forensics | Disabled with reasons |
| F9 | Hosted: no key / wrong key / other workspace / valid / sign out / `?key=` | §8 J6 outcomes; the key never appears in the DOM, console or URL afterwards |
| F10 | API down / database down | Status pill and full-page error with Retry; no blank screen |

### 17.3 Visual review

- Screenshot set: 8 views (Home, Sign in, Run, Investigate, Time travel, Memory, Remediate, Evaluation) × 2 themes × 2 widths (1440, 390), plus dialogs and empty, loading and error states.
- Compared against R0-4 for regressions in content (not looks) and reviewed by the owner.
- Graph screenshots in both themes after any token change.

### 17.4 Accessibility testing

- A keyboard-only run of J1–J7.
- NVDA + Edge smoke test: landmarks, headings, the verdict announcement, the dialog, the scrubber value text.
- Contrast with DevTools.
- Forced colours (Windows contrast themes).
- 200% zoom and a 320 px reflow.
- Reduced motion on.

### 17.5 Browsers

Edge and Chrome (latest) are required. Firefox (latest) is required (View Transitions ≥ 144). Safari 26 if a Mac is available; otherwise record "not verified", as P10a did.

### 17.6 Performance budgets

- Home LCP < 2.5 s and CLS < 0.1 on a local production build.
- INP < 200 ms on the Investigate graph toolbar.
- Fonts ≤ 2 files on first load.
- JS delta vs R0-4 recorded: target ≤ +40 KB gzip with zero-dep motion; Motion, if approved, is reported separately.

---

## 18. Definition of done

- Every approved decision is recorded (D-032 onward), and plan.md §19 matches the shipped UI.
- P13a–P13d tasks are ticked with evidence in `docs/PROGRESS.md`. HANDOFF has been overwritten.
- §13 contract verified (§17.2 F1–F10 green in both auth modes, on dev and production builds).
- WCAG 2.2 AA checklist (§12) complete. Light and dark both complete (§10.4).
- No unapproved dependency. CI `web` green ("CI not verified" if it cannot be observed, per AGENTS.md §4).
- README screenshots regenerated. The owner has reviewed the final screenshots.

---

## 19. Sources

Agentic UX and products
- GitHub, "Introducing Agent HQ: Any agent, any way you work" — https://github.blog/news-insights/company-news/welcome-home-agents/
- Visual Studio Magazine, "GitHub Introduces Agent HQ…" (28 Oct 2025) — https://visualstudiomagazine.com/Articles/2025/10/28/GitHub-Introduces-Agent-HQ-to-Orchestrate-Any-Agent-Any-Way-You-Work.aspx
- Datadog, "Monitor AI agents" — https://datadoghq.com/blog/monitor-ai-agents ; DASH 2025 roundup — https://datadoghq.com/blog/dash-2025-new-feature-roundup-keynote
- LangChain, "LangSmith vs. Langfuse" — https://www.langchain.com/articles/langsmith-vs-langfuse ; Mastra comparison — https://mastra.ai/articles/langfuse-vs-langsmith
- Vercel AI Elements, Chain of Thought — https://elements.ai-sdk.dev/components/chain-of-thought
- Microsoft Design, "UX design for agents" — https://microsoft.design/articles/ux-design-for-agents/
- Dataiku, "Human-in-the-loop AI agents" — https://www.dataiku.com/blog/human-in-the-loop-ai-agents
- AI UX Playground, "What is Human-in-the-Loop UX?" — https://aiuxplayground.com/guides/how-to-design-human-in-the-loop/
- Zylos, "Agentic UX: Frontend Design Patterns for AI Agents in 2026" (vendor) — https://zylos.ai/research/2026-05-28-agentic-ux-frontend-design-patterns-ai-agents/
- Maviklabs, "Agentic UI Patterns in 2026" (vendor) — https://www.maviklabs.com/blog/agentic-ui-patterns-2026/
- Wiz Academy, "Attack Path Analysis" — https://www.wiz.io/api/md/academy/detection-and-response/attack-path-analysis ; Security Boulevard on the Wiz Security Graph — https://securityboulevard.com/2025/04/wizs-security-graphdb-vs-deeptempos-loglm

Design craft
- Linear, "Behind the latest design refresh" — https://linear.app/now/behind-the-latest-design-refresh ; changelog 2026-03-12 — https://linear.app/changelog/2026-03-12-ui-refresh ; "How we redesigned the Linear UI" — https://linear.app/now/how-we-redesigned-the-linear-ui
- Awwwards Sites of the Day — https://www.awwwards.com/websites/sites_of_the_day/ ; SOTY 2025 listings (Lando Norris / OFF+BRAND.; Messenger / abeto) — https://www.awwwards.com/websites/%23e2de00/?page=5
- Bret Victor, "Explorable Explanations" — http://worrydream.com/ExplorableExplanations/ ; Bartosz Ciechanowski — https://ciechanow.ski/
- Font Alternatives, "Neo-grotesk fatigue 2026" — https://fontalternatives.com/blog/neo-grotesk-fatigue-2026/
- Braille Institute, Atkinson Hyperlegible (Next, Mono) — https://www.brailleinstitute.org/freefont/ ; Fontsource, Atkinson Hyperlegible Mono — https://fontsource.org/fonts/atkinson-hyperlegible-mono/about ; Google Fonts repo (OFL) — https://github.com/googlefonts/atkinson-hyperlegible

Platform and libraries
- web.dev, "Same-document view transitions are now Baseline Newly available" (16 Oct 2025) — https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available
- Chrome for Developers, "What's new in view transitions (2025)" — https://developer.chrome.com/blog/view-transitions-in-2025
- Anchor positioning Baseline (Jan 2026) — https://www.buildmvpfast.com/blog/css-anchor-positioning-baseline-delete-floating-ui-2026 ; scroll-driven animations status (conflicting) — https://www.buildmvpfast.com/blog/css-scroll-driven-animations-replace-js-2026
- Cytoscape.js documentation (style: transition animation, edge line, underlay, outline; animation API) — https://js.cytoscape.org/
- Motion: upgrade guide — https://motion.dev/docs/react-upgrade-guide ; reduce bundle size — https://motion.dev/docs/react-reduce-bundle-size ; npm `motion` 14.3.0 (checked with `npm view`, 2026-10-17)
- Webflow, "GSAP becomes free" — https://webflow.com/blog/gsap-becomes-free ; GSAP 3.15.0 README — https://cdn.jsdelivr.net/npm/gsap@3.15.0/README.md ; npm `@gsap/react` 2.1.2 (checked with `npm view`)

Accessibility and forms
- Deque, "WCAG 2.2 Updates" — https://dequeuniversity.com/resources/wcag-2.2 ; TetraLogical, "What's new in WCAG 2.2" — https://tetralogical.com/blog/2023/10/05/whats-new-wcag-2.2
- web.dev Learn Forms: autofill — https://web.dev/learn/forms/autofill ; identity — https://web.dev/learn/forms/identity

Repository sources: `plan.md` §4, §6, §14, §17–§19, §20.3; `AGENTS.md` §0–§5; `docs/DECISIONS.md` A-07, A-09, A-12, A-16, D-019, D-026, D-028, D-029, Part B6; `docs/SECURITY.md`; `docs/DEPLOY.md`; `docs/phases/P10a–P10c`; every file under `web/src/`; `docs/img/*.png`; `eval/results/summary.json`.

---

## Appendix A — Copy deck

Short strings. Anything not listed keeps today's wording.

| Key | Text |
|---|---|
| home.eyebrow | Lineage gate for multi-agent systems |
| home.h1 | Every agent passes. The system still leaks. |
| home.lede | Pathwarden traces every read and write across agents, memory and days, and holds the action when untrusted and secret data meet. |
| home.cta.primary | Watch the attack |
| home.cta.secondary | Open console |
| home.diagram.caption | Illustration of `attack_pipeline_42` |
| home.diagram.off | Leaked to the public page |
| home.diagram.on | Held at the gate · 2 witness routes |
| home.lamps.title | Two lamps each. Three on the path. |
| home.lamps.legend | A reads untrusted input · B holds secrets · C acts outside |
| home.lamps.path | Rule of Two checks sessions. Pathwarden checks lineage. |
| home.loop.hold | Graph path queries before every external action. No LLM in the gate. |
| home.loop.explain | Two witness routes and the exact Cypher the gate ran. |
| home.loop.heal | Quarantine, sandbox replay, then a person approves. |
| home.loop.prevent | Max-flow finds the cheapest permissions to revoke. |
| home.proof.title | Measured, not claimed |
| home.proof.empty | No results yet. Run `make eval` to generate them. |
| run.empty | Run a scenario to see what the agents did. |
| run.pending | Running `{scenario}` · {elapsed} |
| run.replay | Replay of the recorded run |
| verdict.held | Held. Nothing was posted. |
| verdict.leaked | Leaked. The public page shows secret values, although every session passed the Rule of Two. |
| verdict.posted | Posted. A clean release note was published. |
| investigate.plan.note | Completed in one request |
| investigate.approve.why | Releasing increases exposure, so it needs a person. |
| time.disclaimer | Quarantine, approval and status are shown as they are now, not as they were at t. |
| auth.title | Sign in to a workspace |
| auth.keep | Kept for this browser tab only. |
| auth.error.401 | This key wasn't accepted. Check it and try again. |
| auth.error.403 | This key can't open that workspace. |
| auth.error.network | Can't reach the Pathwarden API. |
| auth.error.db | The API is up, but its database isn't answering. |
| auth.local | Local mode · no key needed |
| auth.builtin | Built-in key · this build carries its own key |
| error.generic | Something went wrong: {detail} ({code}) |
| status.updated | Updated {n}s ago |

---

## Appendix B — Proposed file structure

```
web/
  index.html                  # + theme init script, font preload, meta theme-color, favicon
  public/
    favicon.svg               # new
    fonts/                    # new: AtkinsonHyperlegibleNext*.woff2, AtkinsonHyperlegibleMono*.woff2, OFL.txt
  src/
    main.tsx                  # imports styles/index.css
    App.tsx                   # view switch via nav.ts, AppShell
    nav.ts                    # new: URL contract (§5.5)
    theme.ts                  # new: Light/Dark/System
    motion.ts                 # new: prefersReducedMotion, WAAPI helpers
    hooks.ts                  # usePoll unchanged; useThemeTick also observes data-theme
    api/client.ts             # request() unchanged; ws getter; key get/set/clear helpers
    api/types.ts              # unchanged
    styles/                   # new: index.css (@layer order), tokens.css, base.css, layout.css, components.css
    ui/                       # new primitives: Button, Chip, StatusChip, VerdictChip, Panel, Switch, Segmented,
                              #   Dialog, Disclosure, CodeBlock, EmptyState, Skeleton, Toast, Icon, IntervalPlot
    shell/                    # new: AppShell, NavRail, TopBar, WorkspaceSwitcher, StatusPill, ThemeMenu, AuthChip
    auth/                     # new: SignIn, useAuthProbe
    pages/Home.tsx            # new
    home/                     # new: RouteDiagram (desktop + mobile), LampTiles, LoopCards, ProofPlot
    tabs/                     # existing files, same names and exports, redesigned
    run/ investigate/         # new sub-components split out of the two largest tabs
    components/               # LineageGraph, CapabilityGraph (+ toolbar, trace), RuleOfTwo (restyled)
```

Deleted: `web/src/styles.css`, replaced by `styles/`. Nothing else is deleted.
