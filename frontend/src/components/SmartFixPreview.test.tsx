import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Issue } from "../domain/contracts";
import { SmartFixPreview } from "./SmartFixPreview";

const safeIssue: Issue = {
  id: "info-1", task_id: "task", product_id: "product", sku_id: "sku-1", code: "NORMALIZATION_NEEDED", field: "product_name", severity: "info", message: "需要规范化",
  source_ref: { file_id: null, file_name: null, template: null, sheet: "Products", row: 4, field: "product_name" }, resolved: false, created_at: "2026-07-24T00:00:00Z",
};

describe("SmartFixPreview", () => {
  afterEach(cleanup);

  it("shows a before-and-after review and delegates confirmed safe fixes", () => {
    const onApply = vi.fn().mockResolvedValue(true);
    render(<SmartFixPreview issues={[safeIssue]} originalValue="  夏季短袖 T 恤  " onApply={onApply} />);

    fireEvent.click(screen.getByRole("button", { name: "预览可安全处理的 1 项" }));
    expect(screen.getByText("原始值")).toBeTruthy();
    expect(screen.getByText("建议值")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "确认应用安全处理" }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
