import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Issue } from "../domain/contracts";
import { SmartFixPreview } from "./SmartFixPreview";

const safeIssue: Issue = {
  id: "info-1",
  task_id: "task",
  product_id: "product",
  sku_id: "sku-1",
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
};

describe("SmartFixPreview", () => {
  afterEach(cleanup);

  it("opens a non-mutating preview for contract-safe normalization work", () => {
    render(<SmartFixPreview issues={[safeIssue]} />);

    fireEvent.click(
      screen.getByRole("button", { name: "预览可安全处理的 1 项" }),
    );
    expect(screen.getByText("仅预览，尚未写入商品数据。")).toBeTruthy();
    expect(screen.getByText("后端智能修复接口尚未接入")).toBeTruthy();
  });
});
