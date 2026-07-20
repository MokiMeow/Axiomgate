import { describe, expect, it } from "vitest";

import {
  contentChanged,
  contentHash,
  resolvePollInterval,
} from "../public/refresh.mjs";

describe("dashboard live refresh", () => {
  it("ignores object key order and detects only real content changes", () => {
    const initial = { id: "msn_live", approvals: [{ id: "act_1", status: "PENDING" }] };
    const hash = contentHash(initial);
    expect(contentChanged(hash, { approvals: [{ status: "PENDING", id: "act_1" }], id: "msn_live" })).toEqual({
      changed: false,
      hash,
    });
    expect(contentChanged(hash, { id: "msn_live", approvals: [] }).changed).toBe(true);
  });

  it("uses a three-second live default, slower demo default, and bounded override", () => {
    expect(resolvePollInterval(undefined, false)).toBe(3_000);
    expect(resolvePollInterval(undefined, true)).toBe(10_000);
    expect(resolvePollInterval("1500", false)).toBe(1_500);
    expect(resolvePollInterval("100", false)).toBe(3_000);
    expect(resolvePollInterval("120000", false)).toBe(60_000);
  });
});
