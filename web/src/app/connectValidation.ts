/** Client-side checks of the Connect form. They mirror the server's own rules (`api/auth.py`: a workspace is
 *  `^[a-z0-9][a-z0-9_-]{0,31}$` and a key has at least 8 characters) only to save a round trip; the server stays the
 *  authority, and what it answers (401/403) is what the user finally sees. */

export type ConnectField = "workspace" | "key";

export interface ConnectError {
  field: ConnectField;
  message: string;
}

const WORKSPACE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
export const MIN_KEY_LENGTH = 8;

export function validateConnect(workspace: string, key: string): ConnectError[] {
  const errors: ConnectError[] = [];
  const ws = workspace.trim();
  if (ws === "") errors.push({ field: "workspace", message: "Enter the workspace name." });
  else if (!WORKSPACE.test(ws.replace(/-mcp$/, "") || ws)) {
    errors.push({ field: "workspace", message: "Workspace names use lowercase letters, digits, - and _ (at most 32 characters)." });
  }
  if (key === "") errors.push({ field: "key", message: "Enter the access key." });
  else if (key.length < MIN_KEY_LENGTH) errors.push({ field: "key", message: `The access key has at least ${MIN_KEY_LENGTH} characters.` });
  return errors;
}

/** What to tell the user for an answer of the API to the access probe. */
export function connectErrorFor(status: number, code: string, workspace: string): ConnectError | { message: string } {
  if (status === 401 || code === "unauthorized") return { field: "key", message: "This key was not accepted." };
  if (status === 403 || code === "forbidden") {
    return { field: "workspace", message: `This key can't open workspace "${workspace}". Check the workspace name or use that workspace's key.` };
  }
  return { message: "The API did not answer. Try again." };
}
