import { describe, expect, it } from "vitest";
import { connectErrorFor, validateConnect } from "./connectValidation";

describe("validateConnect", () => {
  it("accepts a demo workspace with a key of at least 8 characters", () => {
    expect(validateConnect("tinyqueue", "pwdemo-key-tinyqueue-0001")).toEqual([]);
  });

  it("accepts the MCP view of a workspace", () => {
    expect(validateConnect("tinyqueue-mcp", "pwdemo-key-tinyqueue-0001")).toEqual([]);
  });

  it("asks for both fields when they are empty, naming each", () => {
    expect(validateConnect("", "")).toEqual([
      { field: "workspace", message: "Enter the workspace name." },
      { field: "key", message: "Enter the access key." },
    ]);
  });

  it("rejects a workspace name the server would refuse", () => {
    for (const bad of ["Tiny Queue", "../x", "UPPER", "-lead", "a".repeat(40)]) {
      expect(validateConnect(bad, "pwdemo-key-tinyqueue-0001")[0]?.field, bad).toBe("workspace");
    }
  });

  it("rejects a key that is shorter than the server allows", () => {
    expect(validateConnect("tinyqueue", "short")).toEqual([{ field: "key", message: "The access key has at least 8 characters." }]);
  });
});

describe("connectErrorFor", () => {
  it("blames the key for a 401", () => {
    expect(connectErrorFor(401, "unauthorized", "tinyqueue")).toEqual({ field: "key", message: "This key was not accepted." });
  });

  it("blames the workspace choice for a 403 and quotes the workspace", () => {
    const e = connectErrorFor(403, "forbidden", "tenant-b");
    expect(e).toMatchObject({ field: "workspace" });
    expect(e.message).toContain('"tenant-b"');
  });

  it("is not a field error when the API simply did not answer", () => {
    const e = connectErrorFor(0, "unreachable", "tinyqueue");
    expect("field" in e).toBe(false);
    expect(e.message).toBe("The API did not answer. Try again.");
  });
});
