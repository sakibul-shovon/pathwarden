/** Turns an HTTP answer into either data or the documented `{"error","detail"}` shape (plan §18).
 *  Anything that is not that shape (a proxy's "Bad Gateway", an HTML page, an empty 5xx) means the API itself did not
 *  answer: it is classified `unreachable`, never shown as a JSON parse error. */

export type Parsed = { data: unknown } | { error: { status: number; code: string; detail: string } };

export const UNREACHABLE = "unreachable";

export function parseResponse(status: number, ok: boolean, text: string, statusText = ""): Parsed {
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      return { error: { status, code: UNREACHABLE, detail: `The API answered with something that is not JSON (HTTP ${status}).` } };
    }
  }
  if (ok) return { data: body };
  const err = (typeof body === "object" && body !== null ? body : {}) as { error?: unknown; detail?: unknown };
  if (typeof err.error === "string") {
    return { error: { status, code: err.error, detail: typeof err.detail === "string" ? err.detail : statusText } };
  }
  const code = status === 502 || status === 503 || status === 504 ? UNREACHABLE : "http_error";
  return { error: { status, code, detail: statusText || `HTTP ${status}` } };
}
