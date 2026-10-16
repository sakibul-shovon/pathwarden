import { ApiError } from "../api/errors";

/** Plain-language titles for the API's error codes (ui-redesign.md §13.12). The raw `error` code is always shown next to
 *  the title (for debugging), and the server's own `detail` is kept; nothing is hidden behind the friendly wording. */
export interface DescribedError {
  title: string;
  /** The raw code of the API (or `client_error` for something that is not an API answer). */
  code: string;
  /** Extra guidance written here, not the server's detail. */
  hint?: string;
  /** The server's `detail`, as received. */
  detail?: string;
}

const TITLE: Record<string, { title: string; hint?: string }> = {
  unreachable: { title: "Can't reach the Pathwarden API" },
  falkordb_unavailable: { title: "FalkorDB is not answering", hint: "Start the database (make up), then retry." },
  unauthorized: { title: "A workspace key is needed" },
  forbidden: { title: "This key can't open that workspace" },
  human_required: {
    title: "This action needs a deliberate human confirmation",
    hint: "The app should have sent it from a confirmation dialog: this indicates a bug.",
  },
  unknown_workspace: { title: "Not found" },
  unknown_scenario: { title: "Not found" },
  unknown_sink: { title: "Not found" },
  not_found: { title: "Not found" },
  eval_not_run: { title: "No evaluation results yet", hint: "Generate them with make eval." },
  invalid_state: { title: "That action has already moved on" },
  quarantined: { title: "Blocked by a quarantine" },
  bad_request: { title: "The request was not valid" },
  validation_error: { title: "The request was not valid" },
  internal_error: { title: "Something failed on the server", hint: "Pathwarden fails closed: nothing is reported as allowed." },
  live_not_available: { title: "No language model configured", hint: "Set PW_LLM_API_KEY (and PW_LLM_MODEL) for live agents, or use scripted agents." },
  llm_not_configured: { title: "No language model configured", hint: "Set PW_LLM_API_KEY (and PW_LLM_MODEL) for live agents, or use scripted agents." },
};

export function describeError(err: unknown): DescribedError {
  if (err instanceof ApiError) {
    const known = TITLE[err.code];
    return {
      title: known?.title ?? "Something went wrong",
      code: err.code,
      hint: known?.hint,
      detail: err.code === "unreachable" ? undefined : err.message || undefined,
    };
  }
  return { title: "Something went wrong", code: "client_error", detail: err instanceof Error ? err.message : String(err) };
}
