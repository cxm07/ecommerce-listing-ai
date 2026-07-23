import { describe, expect, it } from "vitest";
import { canApprove } from "./permissions";

describe("canApprove", () => {
  it("does not grant product approval to an operator", () => {
    expect(canApprove(["operator"])).toBe(false);
  });

  it("grants approval to reviewers and administrators", () => {
    expect(canApprove(["reviewer"])).toBe(true);
    expect(canApprove(["admin"])).toBe(true);
  });
});
