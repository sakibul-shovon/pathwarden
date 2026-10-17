import { AnimatePresence, LazyMotion, domMax, m } from "motion/react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NavContext, VIEWS, type TabId } from "./nav";
import { ActionsProvider } from "./shell/actions";
import { AppShell } from "./shell/AppShell";
import { AuthProvider, useAuth } from "./shell/auth";
import { HealthProvider } from "./shell/health";
import { SignIn } from "./shell/SignIn";
import { Icon } from "./ui/Icon";
import { ToastProvider } from "./ui/Toast";

// every view is its own chunk: GSAP, Cytoscape and the plots load only where they are used
const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const RunTab = lazy(() => import("./tabs/Run").then((m) => ({ default: m.RunTab })));
const InvestigateTab = lazy(() => import("./tabs/Investigate").then((m) => ({ default: m.InvestigateTab })));
const TimeTravelTab = lazy(() => import("./tabs/TimeTravel").then((m) => ({ default: m.TimeTravelTab })));
const MemoryTab = lazy(() => import("./tabs/Memory").then((m) => ({ default: m.MemoryTab })));
const RemediateTab = lazy(() => import("./tabs/Remediate").then((m) => ({ default: m.RemediateTab })));
const EvaluationTab = lazy(() => import("./tabs/Evaluation").then((m) => ({ default: m.EvaluationTab })));

const Loading = (
  <div className="panel skeleton-panel" aria-busy="true"><span className="skeleton sk-title" /><span className="skeleton sk-graph" /><span className="sr-only">Loading…</span></div>
);

const TAB_IDS: TabId[] = ["home", ...VIEWS.map((v) => v.id)];

/** Deep links make a state reproducible (and checkable in a headless browser):
 *  ?tab=investigate&scenario=attack_pipeline_42&guard=off&autorun=1&autoforensics=1&autoheal=1
 *  ?tab=time&t=16 opens the Time travel tab at logical time 16; ?tab=remediate&topology=tinyqueue3 picks a topology.
 *  With no ?tab= the overview opens, unless the link carries run parameters (older links keep opening Run). */
function readUrl(): {
  tab: TabId;
  scenario: string;
  guard: boolean;
  autorun: boolean;
  autoForensics: boolean;
  autoHeal: boolean;
  t: number | null;
  topology: "enterprise12" | "tinyqueue3";
} {
  const q = new URLSearchParams(window.location.search);
  const runLink = q.has("scenario") || q.has("guard") || q.has("autorun");
  const tab = (q.get("tab") ?? (runLink ? "run" : "home")) as TabId;
  return {
    tab: TAB_IDS.includes(tab) ? tab : "home",
    scenario: q.get("scenario") ?? "attack_pipeline_42",
    guard: q.get("guard") !== "off",
    autorun: q.get("autorun") === "1",
    autoForensics: q.get("autoforensics") === "1",
    autoHeal: q.get("autoheal") === "1",
    t: /^\d+$/.test(q.get("t") ?? "") ? Number(q.get("t")) : null,
    topology: q.get("topology") === "tinyqueue3" ? "tinyqueue3" : "enterprise12",
  };
}

function Notice({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name="alert" size={28} />
      <p><strong>{title}</strong></p>
      <p className="muted">{children}</p>
      {action}
    </div>
  );
}

function Console({ tab, url, consume }: { tab: Exclude<TabId, "home">; url: ReturnType<typeof readUrl>; consume: (name: string) => void }) {
  const auth = useAuth();
  const view = VIEWS.find((v) => v.id === tab);
  const initialRun = useMemo(() => ({ scenario: url.scenario, guard: url.guard, autorun: url.autorun }), [url]);
  const onAutoRun = useCallback(() => consume("autorun"), [consume]);
  const onAutoConsumed = useCallback((name: "autoforensics" | "autoheal") => consume(name), [consume]);

  let body: ReactNode;
  if (view?.workspace && auth.status !== "ok") {
    if (auth.status === "checking") body = <div className="panel skeleton-panel" aria-busy="true"><span className="skeleton sk-title" /><span className="skeleton sk-graph" /><span className="sr-only">Checking access…</span></div>;
    else if (auth.status === "needs-key" || auth.status === "forbidden") body = <SignIn viewLabel={view.label} />;
    else if (auth.status === "unknown-workspace") body = <Notice title="That workspace does not exist.">{auth.detail} Use the workspace switcher in the top bar.</Notice>;
    else body = (
      <Notice title="Can't reach the Pathwarden API." action={<button type="button" className="btn btn-solid" onClick={auth.retry}>Retry</button>}>
        {auth.detail}
      </Notice>
    );
  } else {
    switch (tab) {
      case "run": body = <RunTab initial={initialRun} onAutoRun={onAutoRun} />; break;
      case "investigate": body = <InvestigateTab autoForensics={url.autoForensics} autoHeal={url.autoHeal} onAutoConsumed={onAutoConsumed} />; break;
      case "time": body = <TimeTravelTab initialT={url.t} />; break;
      case "memory": body = <MemoryTab />; break;
      case "remediate": body = <RemediateTab initialTopology={url.topology} />; break;
      case "evaluation": body = <EvaluationTab />; break;
    }
  }

  return (
    <AppShell>
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}>
          <Suspense fallback={Loading}>{body}</Suspense>
        </m.div>
      </AnimatePresence>
    </AppShell>
  );
}

function ConsoleFrame({ tab, url, consume }: { tab: Exclude<TabId, "home">; url: ReturnType<typeof readUrl>; consume: (name: string) => void }) {
  const auth = useAuth();
  return (
    <HealthProvider>
      <ActionsProvider enabled={auth.status === "ok"}>
        <Console tab={tab} url={url} consume={consume} />
      </ActionsProvider>
    </HealthProvider>
  );
}

export function App() {
  const url = useMemo(readUrl, []);
  const [tab, setTab] = useState<TabId>(url.tab);
  const consumed = useRef(new Set<string>());

  const go = useCallback((next: TabId) => {
    const target = new URL(window.location.href);
    const ws = target.searchParams.get("ws");
    target.search = "";
    target.searchParams.set("tab", next);
    if (ws) target.searchParams.set("ws", ws);
    window.history.pushState(null, "", target.pathname + target.search);
    setTab(next);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = (): void => setTab(readUrl().tab);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // one-shot deep-link parameters (autorun, autoforensics, autoheal) fire once: leaving and coming back,
  // or pressing Back, never repeats a run or a human-only action
  const consume = useCallback((name: string) => {
    consumed.current.add(name);
    const target = new URL(window.location.href);
    if (target.searchParams.has(name)) {
      target.searchParams.delete(name);
      window.history.replaceState(null, "", target.pathname + target.search);
    }
  }, []);

  const live = {
    ...url,
    autorun: url.autorun && !consumed.current.has("autorun"),
    autoForensics: url.autoForensics && !consumed.current.has("autoforensics"),
    autoHeal: url.autoHeal && !consumed.current.has("autoheal"),
  };

  return (
    <LazyMotion features={domMax} strict>
      <NavContext.Provider value={{ tab, go }}>
        <ToastProvider>
          {tab === "home" ? (
            <Suspense fallback={null}><Home /></Suspense>
          ) : (
            <AuthProvider>
              <ConsoleFrame tab={tab} url={live} consume={consume} />
            </AuthProvider>
          )}
        </ToastProvider>
      </NavContext.Provider>
    </LazyMotion>
  );
}
