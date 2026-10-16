import type {
  ActionDetail,
  ActionListItem,
  AgentWitness,
  ApplyResult,
  Artifact,
  Candidate,
  CapState,
  EvalSummary,
  Explain,
  ForensicReport,
  GraphAt,
  HealResult,
  HealthInfo,
  MemoryEntry,
  PostedEntry,
  RunResult,
  ScenarioInfo,
} from "./types";
import { beginMutation, endMutation } from "../shared/lib/activity";
import { ApiError } from "./errors";
import { parseResponse, UNREACHABLE } from "./failure";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
// `?ws=tinyqueue-mcp` shows the lineage written by the MCP gateway (P9); default: the main workspace
const DEFAULT_WORKSPACE = "tinyqueue";
let currentWorkspace = new URLSearchParams(window.location.search).get("ws") ?? DEFAULT_WORKSPACE;
/** The workspace every `/api/ws/{ws}/...` call goes to; the shell switches it without a reload. */
export const getWorkspace = (): string => currentWorkspace;
export const setWorkspace = (name: string): void => {
  currentWorkspace = name;
};
export const PUBLIC_PAGE_SINK = "sink:public_release_page";

/** Hosted mode (PW_AUTH=on): the workspace key, from `?key=` (kept for the tab session) or VITE_API_KEY. Local mode
 *  needs none. It is sent only in the Authorization header, never logged and never shown. The URL is read once, when
 *  this module loads: the app later rewrites the address bar, so nothing may depend on `?key=` staying there. */
const KEY_STORAGE = "pw_key";
const keyFromUrl = new URLSearchParams(window.location.search).get("key");
try {
  if (keyFromUrl) window.sessionStorage.setItem(KEY_STORAGE, keyFromUrl);
} catch {
  // storage can be blocked: the key then lives only in memory for this page load
}

function initialKey(): string | null {
  const fromEnv = (import.meta.env.VITE_API_KEY as string | undefined) ?? null;
  try {
    return window.sessionStorage.getItem(KEY_STORAGE) ?? keyFromUrl ?? fromEnv;
  } catch {
    return keyFromUrl ?? fromEnv;
  }
}

let currentKey: string | null = initialKey();
const apiKey = (): string | null => currentKey;
export const hasKey = (): boolean => currentKey !== null;

/** Use a key from the Connect form for the rest of this tab session. */
export function setKey(key: string): void {
  currentKey = key;
  try {
    window.sessionStorage.setItem(KEY_STORAGE, key);
  } catch {
    // memory only
  }
}

/** Sign out: forget the key everywhere, including a build-time VITE_API_KEY (otherwise signing out would do nothing). */
export function clearKey(): void {
  currentKey = null;
  try {
    window.sessionStorage.removeItem(KEY_STORAGE);
  } catch {
    // nothing stored
  }
}

export { ApiError, isDatabaseDown, isUnreachable } from "./errors";

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  human = false,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const key = apiKey();
  if (key) headers["Authorization"] = `Bearer ${key}`;
  // risk-increasing actions (approve, release, apply): a deliberate-action guard, not authentication
  if (human) headers["X-PW-Human"] = "true";
  // a POST can hold the workspace lock for a long time (run, forensics, heal): polling pauses meanwhile
  const mutating = method === "POST";
  if (mutating) beginMutation();
  try {
    let response: Response;
    try {
      response = await fetch(`${BASE}/api${path}`, {
        method,
        signal,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err; // a cancelled request is not a failure
      throw new ApiError(0, UNREACHABLE, "Could not reach the Pathwarden API.");
    }
    const parsed = parseResponse(response.status, response.ok, await response.text(), response.statusText);
    if ("error" in parsed) throw new ApiError(parsed.error.status, parsed.error.code, parsed.error.detail);
    return parsed.data as T;
  } finally {
    if (mutating) endMutation();
  }
}

const ws = (path: string): string => `/ws/${currentWorkspace}${path}`;

export const api = {
  evalSummary: () => request<EvalSummary>("GET", "/eval/summary"),
  capState: (topology: string) => request<CapState>("GET", `/remediation/${topology}`),
  capReset: (topology: string) =>
    request<CapState>("POST", `/remediation/${topology}/reset`, undefined, undefined, true),
  capSuggest: (topology: string) =>
    request<{ topology: string; candidates: Candidate[] }>("POST", `/remediation/${topology}/suggest`),
  capApply: (topology: string, capIds: string[]) =>
    request<ApplyResult>("POST", `/remediation/${topology}/apply`, { cap_ids: capIds }, undefined, true),
  capWitness: (topology: string, agent: string) =>
    request<AgentWitness>("GET", `/remediation/${topology}/witness/${encodeURIComponent(agent)}`),
  scenarios: () => request<ScenarioInfo[]>("GET", ws("/scenarios")),
  run: (name: string, guard: boolean, mode: "scripted" | "live") =>
    request<RunResult>("POST", ws(`/scenarios/${name}/run`), { guard, mode }),
  reset: () => request<{ reset: boolean }>("POST", ws("/reset")),
  actions: () => request<ActionListItem[]>("GET", ws("/actions")),
  action: (id: string) => request<ActionDetail>("GET", ws(`/actions/${id}`)),
  explain: (id: string) => request<Explain>("GET", ws(`/actions/${id}/explain`)),
  health: () => request<HealthInfo>("GET", "/health"),
  forensics: (id: string, mode: "scripted" | "llm" = "scripted") =>
    request<ForensicReport>("POST", ws(`/forensics/${id}`), { mode }),
  healApprove: (id: string) =>
    request<HealResult>("POST", ws(`/heal/${id}/approve`), { approver: "maintainer" }, undefined, true),
  artifact: (id: string, graph: "main" | "sandbox") =>
    request<Artifact>("GET", ws(`/artifacts/${id}?graph=${graph}`)),
  timelineMax: () => request<{ t: number }>("GET", ws("/timeline/max")),
  graphAt: (t: number, signal?: AbortSignal) =>
    request<GraphAt>("GET", ws(`/graph-at?t=${t}`), undefined, signal),
  memory: () => request<MemoryEntry[]>("GET", ws("/memory")),
  releaseQuarantine: (qid: string) =>
    request<{ quarantine_id: string; released: number }>(
      "POST",
      ws(`/quarantine/${qid}/release`),
      undefined,
      undefined,
      true,
    ),
  sink: (id: string) => request<PostedEntry[]>("GET", ws(`/sinks/${encodeURIComponent(id)}`)),
};
