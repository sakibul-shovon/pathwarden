import type {
  ActionDetail,
  ActionListItem,
  AgentWitness,
  ApiErrorBody,
  ApplyResult,
  Artifact,
  Candidate,
  CapState,
  EvalSummary,
  Explain,
  ForensicReport,
  GraphAt,
  HealResult,
  MemoryEntry,
  PostedEntry,
  RunResult,
  ScenarioInfo,
} from "./types";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
// `?ws=tinyqueue-mcp` shows the lineage written by the MCP gateway (P9); default: the main workspace
const WS = new URLSearchParams(window.location.search).get("ws") ?? "tinyqueue";
export const PUBLIC_PAGE_SINK = "sink:public_release_page";

/** Hosted mode (PW_AUTH=on): the workspace key, from `?key=` (kept for the tab session) or
 *  VITE_API_KEY. Local mode needs none. It is sent only in the Authorization header. */
function apiKey(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get("key");
  try {
    if (fromUrl) window.sessionStorage.setItem("pw_key", fromUrl);
    return window.sessionStorage.getItem("pw_key") ?? (import.meta.env.VITE_API_KEY as string | undefined) ?? null;
  } catch {
    return fromUrl ?? (import.meta.env.VITE_API_KEY as string | undefined) ?? null;
  }
}

/** An error answered by the API in the documented `{"error", "detail"}` shape. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.status = status;
    this.code = code;
  }
}

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
  const response = await fetch(`${BASE}/api${path}`, {
    method,
    signal,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const err = data as Partial<ApiErrorBody> | null;
    throw new ApiError(response.status, err?.error ?? "http_error", err?.detail ?? response.statusText);
  }
  return data as T;
}

const ws = (path: string): string => `/ws/${WS}${path}`;

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
  forensics: (id: string) =>
    request<ForensicReport>("POST", ws(`/forensics/${id}`), { mode: "scripted" }),
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
