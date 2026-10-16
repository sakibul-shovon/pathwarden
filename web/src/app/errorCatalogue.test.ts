import { describe, expect, it } from "vitest";
import { ApiError } from "../api/errors";
import { describeError } from "./errorCatalogue";

describe("describeError", () => {
  it("keeps the raw code and the server's own detail next to the plain-language title", () => {
    const d = describeError(new ApiError(409, "invalid_state", "action act-0001 is executed; nothing to heal"));
    expect(d).toMatchObject({ title: "That action has already moved on", code: "invalid_state", detail: "action act-0001 is executed; nothing to heal" });
  });

  it("distinguishes an unreachable API from FalkorDB being down", () => {
    expect(describeError(new ApiError(0, "unreachable", "x")).title).toBe("Can't reach the Pathwarden API");
    expect(describeError(new ApiError(503, "falkordb_unavailable", "ConnectionError")).title).toBe("FalkorDB is not answering");
  });

  it("does not repeat the generic detail of an unreachable API", () => {
    expect(describeError(new ApiError(0, "unreachable", "Could not reach the Pathwarden API.")).detail).toBeUndefined();
  });

  it("gives the live-mode errors guidance about the key", () => {
    for (const code of ["live_not_available", "llm_not_configured"]) {
      expect(describeError(new ApiError(501, code, "x")).hint).toContain("PW_LLM_API_KEY");
    }
  });

  it("says internal errors fail closed", () => {
    expect(describeError(new ApiError(500, "internal_error", "KeyError")).hint).toContain("fails closed");
  });

  it("shows an unknown code with its raw value instead of hiding it", () => {
    expect(describeError(new ApiError(418, "teapot", "short and stout"))).toMatchObject({ title: "Something went wrong", code: "teapot" });
  });

  it("handles errors that are not API answers", () => {
    expect(describeError(new TypeError("x is undefined"))).toMatchObject({ code: "client_error", detail: "x is undefined" });
    expect(describeError("plain text")).toMatchObject({ code: "client_error", detail: "plain text" });
  });
});
