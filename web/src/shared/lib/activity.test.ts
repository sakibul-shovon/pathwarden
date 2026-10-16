import { afterEach, describe, expect, it } from "vitest";
import { beginMutation, endMutation, isMutating, subscribeActivity } from "./activity";

afterEach(() => {
  while (isMutating()) endMutation();
});

describe("activity store", () => {
  it("is busy from the first begin until the last end", () => {
    expect(isMutating()).toBe(false);
    beginMutation();
    beginMutation();
    expect(isMutating()).toBe(true);
    endMutation();
    expect(isMutating()).toBe(true);
    endMutation();
    expect(isMutating()).toBe(false);
  });

  it("never goes negative when an end arrives without a begin", () => {
    endMutation();
    expect(isMutating()).toBe(false);
    beginMutation();
    expect(isMutating()).toBe(true);
  });

  it("notifies subscribers on every change and stops after unsubscribe", () => {
    let calls = 0;
    const off = subscribeActivity(() => {
      calls += 1;
    });
    beginMutation();
    endMutation();
    expect(calls).toBe(2);
    off();
    beginMutation();
    expect(calls).toBe(2);
  });
});
