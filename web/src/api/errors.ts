import { UNREACHABLE } from "./failure";

/** An error answered by the API in the documented `{"error", "detail"}` shape (or classified from a non-answer).
 *  Kept free of browser globals so it can be imported by logic that runs in unit tests. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.status = status;
    this.code = code;
  }
}

/** The API did not answer at all (network failure, a proxy's Bad Gateway, or something that is not JSON). */
export const isUnreachable = (err: unknown): boolean => err instanceof ApiError && err.code === UNREACHABLE;
/** The API answered but FalkorDB is down (503 `falkordb_unavailable`). */
export const isDatabaseDown = (err: unknown): boolean => err instanceof ApiError && err.code === "falkordb_unavailable";
