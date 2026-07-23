import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Issue } from "../domain/contracts";
import { IssueSummary } from "./IssueSummary";

const issues: Issue[] = [
  {
    id: "error-1",
    task_id: "task",
    product_id: "product",
    sku_id: "sku-1",
    code: "INVALID_PRICE",
    field: "price",
    severity: "error",
    message: "价格无效",
    source_ref: {
      file_id: null,
      file_name: null,
      template: null,
      sheet: "Products",
      row: 3,
      field: "price",
    },
    resolved: false,
    created_at: "2026-07-24T00:00:00Z",
  },
  {
    id: "info-1",
    task_id: "task",
    product_id: "product",
    sku_id: "sku-2",
    code: "NORMALIZATION_NEEDED",
    field: "product_name",
    severity: "info",
    message: "需要规范化",
    source_ref: {
      file_id: null,
      file_name: null,
      template: null,
      sheet: "Products",
      row: 4,
      field: "product_name",
    },
    resolved: false,
    created_at: "2026-07-24T00:00:00Z",
  },
];

describe("IssueSummary", () => {
  afterEach(cleanup);

  it("summarizes blocking issues and focuses the selected source issue", () => {
    const onFocus = vi.fn();
    render(
      <IssueSummary issues={issues} focusedIssueId={null} onFocus={onFocus} />,
    );

    expect(screen.getByLabelText("1 个阻断错误")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "定位：价格无效" }));
    expect(onFocus).toHaveBeenCalledWith("error-1");
  });
});
