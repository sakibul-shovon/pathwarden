import { useEffect, useId, useState, type FormEvent } from "react";
import { api, ApiError, clearKey, getWorkspace, setKey, setWorkspace } from "../api/client";
import { Button } from "../shared/components/Button";
import { ErrorSummary, type SummaryError } from "../shared/components/ErrorSummary";
import { Field } from "../shared/components/Field";
import { Notice } from "../shared/components/Notice";
import { PasswordField } from "../shared/components/PasswordField";
import { connectErrorFor, validateConnect, type ConnectField } from "./connectValidation";
import type { AccessState } from "./useAccess";

interface ConnectProps {
  workspace: string;
  reason: Extract<AccessState, "needs_key" | "rejected" | "forbidden">;
  onConnected: (workspace: string) => void;
}

const REASON: Record<ConnectProps["reason"], string> = {
  needs_key: "This deployment needs a workspace key to open a workspace.",
  rejected: "The key stored for this tab was not accepted. Enter a valid key.",
  forbidden: "The key in use cannot open this workspace. Use the key of this workspace, or choose another workspace.",
};

/** The hosted-mode access form (ui-redesign.md §12.3). A real key is checked by the API, never by this page: what the
 *  server answers (401 / 403) is what the user is told. Local mode never shows this screen. */
export function Connect({ workspace, reason, onConnected }: ConnectProps) {
  const uid = useId();
  const ids: Record<ConnectField, string> = { workspace: `${uid}-workspace`, key: `${uid}-key` };
  const [ws, setWs] = useState(workspace);
  const [key, setKeyText] = useState("");
  const [errors, setErrors] = useState<(SummaryError & { field?: ConnectField })[]>([]);
  const [focusKey, setFocusKey] = useState(0);
  const [pending, setPending] = useState(false);

  // "Error:" in front of the page title, so a screen reader says it first
  useEffect(() => {
    if (errors.length === 0) return;
    const before = document.title;
    document.title = `Error: ${before}`;
    return () => {
      document.title = before;
    };
  }, [errors.length, focusKey]);

  const fail = (list: (SummaryError & { field?: ConnectField })[]): void => {
    setErrors(list);
    setFocusKey((n) => n + 1);
  };

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    const local = validateConnect(ws, key);
    if (local.length > 0) {
      fail(local.map((x) => ({ field: x.field, fieldId: ids[x.field], message: x.message })));
      return;
    }
    const target = ws.trim();
    const previous = getWorkspace();
    setPending(true);
    setKey(key);
    setWorkspace(target);
    try {
      await api.scenarios();
      setErrors([]);
      onConnected(target);
    } catch (err) {
      clearKey();
      setWorkspace(previous);
      const status = err instanceof ApiError ? err.status : 0;
      const code = err instanceof ApiError ? err.code : "unreachable";
      const mapped = connectErrorFor(status, code, target);
      fail([{ ...("field" in mapped ? { field: mapped.field, fieldId: ids[mapped.field] } : {}), message: mapped.message }]);
    } finally {
      setPending(false);
    }
  }

  const fieldError = (field: ConnectField): string | undefined => errors.find((x) => x.field === field)?.message;

  return (
    <div className="pw-connect">
      <h2 className="pw-t-xl">Connect to a workspace</h2>
      <Notice variant="info">{REASON[reason]}</Notice>
      <ErrorSummary errors={errors} focusKey={focusKey} />
      <form onSubmit={(e) => void submit(e)} noValidate className="pw-connect__form">
        <Field
          id={ids.workspace}
          label="Workspace"
          hint="Lowercase letters, digits, - and _. Add -mcp for the lineage written by the MCP gateway."
          error={fieldError("workspace")}
        >
          {(a11y) => (
            <input
              {...a11y}
              className="pw-input pw-mono"
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={ws}
              onChange={(ev) => setWs(ev.target.value)}
            />
          )}
        </Field>
        <PasswordField
          id={ids.key}
          label="Access key"
          hint="At least 8 characters. Keep it out of screenshots and shared links."
          error={fieldError("key")}
          value={key}
          onChange={setKeyText}
        />
        <div>
          <Button type="submit" variant="primary" pending={pending}>
            {pending ? "Checking…" : "Connect"}
          </Button>
        </div>
      </form>
      <p className="pw-muted">
        Keys are issued by whoever runs this deployment (<code>PW_API_KEYS</code>). Running Pathwarden locally needs no key. The
        key is kept for this browser tab only.
      </p>
    </div>
  );
}
