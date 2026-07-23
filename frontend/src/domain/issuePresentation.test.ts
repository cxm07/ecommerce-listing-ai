import { describe, expect, it } from "vitest";
import { issueBusinessLabel } from "./issuePresentation";

describe("issueBusinessLabel", () => {
  it("uses a Chinese business label instead of exposing a detection code", () => {
    expect(issueBusinessLabel("INVALID_PRICE", "price")).toBe("价格需要补充或修正");
  });
});
