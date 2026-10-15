import type {
  ActionDetail,
  ActionListItem,
  ApiErrorBody,
  Artifact,
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
const WS = "tinyqueue";
export const PUBLIC_PAGE_SINK = "sink:public_release_page";

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
): Promise<T> {
  const response = await fetch(`${BASE}/api${path}`, {
    method,
    signal,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
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
    request<HealResult>("POST", ws(`/heal/${id}/approve`), { approver: "maintainer" }),
  artifact: (id: string, graph: "main" | "sandbox") =>
    request<Artifact>("GET", ws(`/artifacts/${id}?graph=${graph}`)),
  timelineMax: () => request<{ t: number }>("GET", ws("/timeline/max")),
  graphAt: (t: number, signal?: AbortSignal) =>
    request<GraphAt>("GET", ws(`/graph-at?t=${t}`), undefined, signal),
  memory: () => request<MemoryEntry[]>("GET", ws("/memory")),
  releaseQuarantine: (qid: string) =>
    request<{ quarantine_id: string; released: number }>("POST", ws(`/quarantine/${qid}/release`)),
  sink: (id: string) => request<PostedEntry[]>("GET", ws(`/sinks/${encodeURIComponent(id)}`)),
};
