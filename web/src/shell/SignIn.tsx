import { m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { workspaceName } from "../api/client";
import { useNav } from "../nav";
import { Icon } from "../ui/Icon";
import { Mark } from "../ui/Mark";
import { useAuth } from "./auth";

const MESSAGES: Record<string, string> = {
  forbidden: "This key can't open that workspace.",
};

/** Hosted mode (PW_AUTH=on): the workspace key is the only credential, exactly as the API defines it.
 *  Local mode never shows this screen. The key stays in this tab's sessionStorage and is sent only as
 *  `Authorization: Bearer`. There is no account system behind it (docs/SECURITY.md). */
export function SignIn({ viewLabel }: { viewLabel: string }) {
  const auth = useAuth();
  const { go } = useNav();
  const reduce = useReducedMotion();
  const [workspace, setWorkspace] = useState(workspaceName().replace(/-mcp$/, ""));
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const keyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (auth.status === "forbidden") setError(MESSAGES.forbidden ?? null);
  }, [auth.status]);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!key.trim()) {
      setError("Enter the workspace key.");
      keyRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const next = await auth.signIn(workspace.trim() || workspaceName(), key.trim());
    setBusy(false);
    if (next.status === "ok" || next.status === "checking") return;
    setKey("");
    setShake((n) => n + 1);
    setError(
      next.status === "forbidden"
        ? "This key can't open that workspace."
        : next.status === "needs-key"
          ? "This key wasn't accepted. Check it and try again."
          : next.status === "unreachable"
            ? "Can't reach the Pathwarden API."
            : (next.detail ?? "Sign-in failed."),
    );
    keyRef.current?.focus();
  };

  return (
    <div className="signin">
      <aside className="signin-brand" aria-hidden="true">
        <span className="brand"><Mark size={30} /> pathwarden</span>
        <p className="signin-quote">Every agent passes.<br />The system still leaks.</p>
        <svg viewBox="0 0 280 120" className="signin-art">
          <path d="M10 25h140q50 0 50 45" className="ln-u" />
          <path d="M10 95h140q50 0 50-25" className="ln-s" />
          <rect x="230" y="42" width="8" height="56" rx="3" fill="currentColor" />
        </svg>
      </aside>
      <m.form
        className="signin-panel"
        onSubmit={(e) => void submit(e)}
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
        noValidate
      >
        <h1>Sign in to a workspace</h1>
        <p className="muted">
          {viewLabel} needs a workspace key. {MESSAGES[auth.status] ?? ""}
        </p>

        <label className="field">
          <span>Workspace</span>
          <input
            type="text"
            name="workspace"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Workspace key</span>
          <m.span
            className="field-row"
            key={shake}
            animate={shake && !reduce ? { x: [0, -5, 5, -3, 0] } : { x: 0 }}
            transition={{ duration: 0.24 }}
          >
            <input
              ref={keyRef}
              type={show ? "text" : "password"}
              name="key"
              autoComplete="current-password"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby="signin-help signin-error"
            />
            <button type="button" className="btn btn-quiet" onClick={() => setShow(!show)} aria-pressed={show}>
              {show ? "Hide" : "Show"}
            </button>
          </m.span>
        </label>
        <p id="signin-help" className="field-help">Kept for this browser tab only. It is sent only as an Authorization header.</p>
        <p id="signin-error" className="field-error" role="alert">{error}</p>

        <button type="submit" className="btn btn-solid btn-block" disabled={busy}>
          <Icon name="key" /> {busy ? "Checking…" : "Open workspace"}
        </button>

        <details className="disclosure">
          <summary>Where do I get a key?</summary>
          <p className="muted">Keys are issued by whoever runs this Pathwarden deployment (<code>PW_API_KEYS</code>). Local mode needs none.</p>
        </details>
        <div className="signin-links">
          <button type="button" className="btn btn-quiet" onClick={() => go("home")}>← Back to overview</button>
          <button type="button" className="btn btn-quiet" onClick={() => go("evaluation")}>See public results</button>
        </div>
      </m.form>
    </div>
  );
}
