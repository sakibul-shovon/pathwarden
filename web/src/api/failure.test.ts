import { describe, expect, it } from "vitest";
import { parseResponse, UNREACHABLE } from "./failure";

describe("parseResponse", () => {
  it("returns the parsed body of a successful answer", () => {
    expect(parseResponse(200, true, '{"t": 4}')).toEqual({ data: { t: 4 } });
  });

  it("treats an empty successful body as null data", () => {
    expect(parseResponse(204, true, "")).toEqual({ data: null });
  });

  it("keeps the documented error shape", () => {
    expect(parseResponse(409, false, '{"error":"invalid_state","detail":"act-0001 is executed"}')).toEqual({
      error: { status: 409, code: "invalid_state", detail: "act-0001 is executed" },
    });
  });

  it("keeps FalkorDB being down distinct from the API being down", () => {
    const parsed = parseResponse(503, false, '{"error":"falkordb_unavailable","detail":"ConnectionError"}');
    expect(parsed).toEqual({ error: { status: 503, code: "falkordb_unavailable", detail: "ConnectionError" } });
  });

  it("classifies a proxy's plain-text Bad Gateway as unreachable, not as a parse error", () => {
    const parsed = parseResponse(502, false, "Bad Gateway");
    expect("error" in parsed && parsed.error.code).toBe(UNREACHABLE);
  });

  it("classifies an HTML page served instead of JSON as unreachable even with status 200", () => {
    const parsed = parseResponse(200, true, "<!doctype html><title>x</title>");
    expect("error" in parsed && parsed.error.code).toBe(UNREACHABLE);
  });

  it("classifies an empty 5xx from a gateway as unreachable", () => {
    expect(parseResponse(504, false, "")).toEqual({ error: { status: 504, code: UNREACHABLE, detail: "HTTP 504" } });
  });

  it("falls back to http_error for other failures without the documented shape", () => {
    expect(parseResponse(418, false, '{"message":"teapot"}', "I'm a teapot")).toEqual({
      error: { status: 418, code: "http_error", detail: "I'm a teapot" },
    });
  });
});
