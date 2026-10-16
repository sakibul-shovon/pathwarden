import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, clearKey, keySource, saveKey, workspaceName } from "../api/client";
import { errorText } from "../hooks";

export type AuthStatus = "checking" | "ok" | "needs-key" | "forbidden" | "unknown-workspace" | "unreachable" | "error";

export interface AuthState {
  status: AuthStatus;
  detail: string | null;
}

interface AuthApi extends AuthState {
  /** `local`: no key was needed or sent; `session` / `built-in`: a key is in use. */
  mode: "local" | "session" | "built-in";
  signIn: (workspace: string, key: string) => Promise<AuthState>;
  signOut: () => void;
  retry: () => void;
}

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth outside AuthProvider");
  return value;
}

/** One read-only probe (the same call the Run tab makes): it tells local mode from hosted mode and
 *  a valid key from a missing or wrong one. A 403 never reveals whether a workspace exists. */
async function probe(): Promise<AuthState> {
  try {
    await api.scenarios();
    return { status: "ok", detail: null };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) return { status: "needs-key", detail: err.message };
      if (err.status === 403) return { status: "forbidden", detail: err.message };
      if (err.code === "unknown_workspace") return { status: "unknown-workspace", detail: err.message };
      return { status: "error", detail: `${err.message} (${err.code})` };
    }
    return { status: "unreachable", detail: errorText(err) };
  }
}

function withWorkspace(name: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("ws", name);
  window.location.assign(url.toString());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "checking", detail: null });
  const [, bump] = useState(0);

  const retry = useCallback(() => {
    setState({ status: "checking", detail: null });
    void probe().then(setState);
  }, []);

  useEffect(() => {
    retry();
  }, [retry]);

  const signIn = useCallback(async (workspace: string, key: string): Promise<AuthState> => {
    saveKey(key);
    if (workspace !== workspaceName()) {
      withWorkspace(workspace); // the workspace is read once per page load, so switch by reloading
      return { status: "checking", detail: null };
    }
    const next = await probe();
    if (next.status !== "ok") clearKey();
    setState(next);
    return next;
  }, []);

  const signOut = useCallback(() => {
    clearKey();
    bump((n) => n + 1);
    retry();
  }, [retry]);

  const value = useMemo<AuthApi>(() => {
    const source = keySource();
    return {
      ...state,
      mode: source === "none" ? "local" : source,
      signIn,
      signOut,
      retry,
    };
  }, [state, signIn, signOut, retry]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
